"""Local Udemy study exporter. Python 3.10+; no third-party packages."""
from __future__ import annotations

import copy
import ctypes
import json
import os
from pathlib import Path
import queue
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import uuid

ROOT = Path(__file__).resolve().parent
PORT = 8765
VERSION = json.loads((ROOT / "extension/manifest.json").read_text(encoding="utf-8"))["version"]


def user_data_dir():
    if sys.platform == "win32":
        return Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData/Local")) / "UdemyStudyTools"
    if sys.platform == "darwin":
        return Path.home() / "Library/Application Support/UdemyStudyTools"
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share")) / "udemy-study-tools"


def open_folder(path):
    if sys.platform == "win32":
        os.startfile(path)
    elif sys.platform == "linux" and getattr(sys, "frozen", False):
        # System file managers must not load the bundled app's shared libraries.
        environment = os.environ.copy()
        environment["LD_LIBRARY_PATH"] = environment.get("LD_LIBRARY_PATH_ORIG", "")
        subprocess.Popen(["xdg-open", str(path)], env=environment)
    else:
        subprocess.Popen(["open" if sys.platform == "darwin" else "xdg-open", str(path)])


def desktop_entry(executable, icon):
    # Desktop-entry escaping has two layers; percent signs are field codes even inside quotes.
    command = str(executable).replace("\\", "\\\\\\\\").replace('"', '\\\\"').replace("`", "\\\\`").replace("$", "\\\\$").replace("%", "%%")
    icon = str(icon).replace("\\", "\\\\")
    if any(char in str(executable) + icon for char in "\r\n"):
        raise ValueError("Installation paths cannot contain newlines.")
    return ("[Desktop Entry]\nType=Application\nName=StudyDock\n"
            f'Exec="{command}"\nIcon={icon}\nTerminal=false\nCategories=Education;Utility;\n'
            "StartupWMClass=UdemyStudyTools\nComment=Review and export completed Udemy practice tests\n")


def install_linux():
    if sys.platform != "linux" or not getattr(sys, "frozen", False):
        raise RuntimeError("Use --install with the packaged Linux application.")
    source = Path(sys.executable).resolve()
    destination = user_data_dir() / "app"
    destination.mkdir(parents=True, exist_ok=True)
    executable = destination / "StudyDock"
    if executable.resolve() != source:
        shutil.copy2(source, executable)
    icon = destination / "studydock.png"
    shutil.copy2(ROOT / "extension/icons/icon-256.png", icon)
    applications = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share")) / "applications"
    applications.mkdir(parents=True, exist_ok=True)
    launcher = applications / "com.himanm.UdemyStudyTools.desktop"
    launcher.write_text(desktop_entry(executable, icon), encoding="utf-8")
    launcher.chmod(0o755)
    desktop = Path.home() / "Desktop"
    if shutil.which("xdg-user-dir"):
        value = subprocess.check_output(["xdg-user-dir", "DESKTOP"], text=True).strip()
        if value:
            desktop = Path(value)
    desktop.mkdir(parents=True, exist_ok=True)
    shortcut = desktop / launcher.name
    shutil.copy2(launcher, shortcut)
    if shutil.which("gio"):
        subprocess.run(["gio", "set", str(shortcut), "metadata::trusted", "true"], capture_output=True)
    if shutil.which("update-desktop-database"):
        subprocess.run(["update-desktop-database", str(applications)], capture_output=True)
    print(f"Installed to {destination}\nDesktop shortcut: {shortcut}\nExports and settings are preserved during updates.")


def chunk_limit(value):
    if str(value).strip().lower() == "all":
        return None
    try:
        number = int(value)
    except (ValueError, TypeError):
        raise ValueError("Questions per file must be a whole number of 5 or more, or All.") from None
    if number < 5:
        raise ValueError("Questions per file must be at least 5, or All.")
    return number


def prepare_export(data, full=True):
    """Whitelist exported fields so basic mode cannot leak answer keys."""
    if not isinstance(data, dict) or not isinstance(data.get("questions"), list) or not data["questions"]:
        raise ValueError("No questions found. Open the completed attempt's Review questions page and retry.")
    if data.get("error"):
        raise ValueError(data["error"])
    result = {key: copy.deepcopy(data[key]) for key in
              ("title", "url", "quiz_id", "attempt", "expected_count", "warnings") if key in data}
    result.update(schema_version=1, exported_at=datetime.now(timezone.utc).isoformat(),
                  mode="full" if full else "questions_and_answers", questions=[])
    for question in data["questions"]:
        if not isinstance(question, dict) or not question.get("question") or not question.get("options"):
            raise ValueError("An incomplete question was found. No files were written for this tab.")
        fields = ["number", "question", "selected_answers", "marked_for_review", "tags", "domain", "notes"]
        if full:
            fields += ["correct_answers", "is_correct", "status", "explanation"]
        item = {key: copy.deepcopy(question[key]) for key in fields if key in question}
        if "notes" in item:
            note = item["notes"]
            if not isinstance(note, dict) or not isinstance(note.get("text"), str) or len(note["text"]) > 60000:
                raise ValueError("Invalid question notes. No files were written for this tab.")
            item["notes"] = {key: note[key] for key in ("text", "updated_at") if key in note}
        item["options"] = [{key: option[key] for key in
                            (["label", "text", "selected", "correct", "explanation"] if full else
                             ["label", "text", "selected"]) if key in option}
                           for option in question["options"]]
        # Result tags must follow the same no-answer-key rule as the fields above.
        if not full:
            item["tags"] = [tag for tag in item.get("tags", []) if tag == "marked_for_review"]
        result["questions"].append(item)
    expected = result.get("expected_count")
    if expected is not None and expected != len(result["questions"]):
        raise ValueError(f"Found {len(result['questions'])} of {expected} questions. Select All questions in Udemy and retry.")
    return result


def markdown(data):
    lines = [f"# {data.get('title', 'Udemy practice test')}", "",
             f"Source: {data.get('url', '')}", f"Attempt: {data.get('attempt') or 'Not shown'}",
             f"Exported: {data['exported_at']}",
             f"Part {data['part']} of {data['parts']} · {len(data['questions'])} questions", ""]
    for warning in data.get("warnings", []):
        lines += [f"> {warning}", ""]
    for q in data["questions"]:
        marked = {True: "Yes", False: "No", None: "Unknown"}[q.get("marked_for_review")]
        lines += [f"## Question {q['number']}", "", f"Marked for review: **{marked}**",
                  f"Tags: {', '.join(q.get('tags', [])) or 'none'}", "", q["question"], "", "### Answer choices", ""]
        for option in q["options"]:
            badges = []
            if option.get("selected"):
                badges.append("your answer")
            if option.get("correct"):
                badges.append("correct answer")
            suffix = f" — **{', '.join(badges)}**" if badges else ""
            lines += [f"**{option['label']}.** {option['text']}{suffix}", ""]
            if option.get("explanation"):
                lines += [f"Explanation: {option['explanation']}", ""]
        selected = q.get("selected_answers")
        lines += [f"Your answer(s): {', '.join(selected) if selected else ('None' if selected == [] else 'Unknown')}"]
        if "correct_answers" in q:
            lines += [f"Correct answer(s): {', '.join(q['correct_answers'] or []) or 'Not available'}",
                      f"Result: {q.get('status', 'unknown')}", "", "### Explanation", "",
                      q.get("explanation") or "Not provided by this page."]
        if q.get("domain"):
            lines += ["", f"Domain: {q['domain']}"]
        if q.get("notes", {}).get("text"):
            lines += ["", "### Your notes", "", q["notes"]["text"]]
        lines += ["", "---", ""]
    return "\n".join(lines)


def write_export(data, folder, fmt, limit, full=True):
    if fmt not in ("json", "md"):
        raise ValueError("Choose JSON or Markdown.")
    limit = chunk_limit("All" if limit is None else limit)
    data = prepare_export(data, full)
    total = len(data["questions"])
    size = limit or total
    parts = (total + size - 1) // size
    folder = Path(folder).expanduser().resolve()
    folder.mkdir(parents=True, exist_ok=True)
    title = re.sub(r'[^\w -]', "", data.get("title", "Udemy"))[:70].strip() or "Udemy"
    # Each run gets its own directory; previous study exports are never overwritten.
    destination = Path(tempfile.mkdtemp(prefix=f"{title}_{datetime.now():%Y%m%d_%H%M%S}_", dir=folder))
    paths = []
    for index, start in enumerate(range(0, total, size), 1):
        part = {**data, "part": index, "parts": parts, "total_questions": total,
                "questions": data["questions"][start:start + size]}
        content = json.dumps(part, indent=2, ensure_ascii=False) if fmt == "json" else markdown(part)
        path = destination / f"questions_{start + 1:03d}-{min(start + size, total):03d}.{fmt}"
        pending = path.with_suffix(".tmp")
        pending.write_text(content + "\n", encoding="utf-8")
        pending.replace(path)
        paths.append(path)
    return paths


class Bridge(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False

    def server_bind(self):
        if os.name == "nt":
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

    def __init__(self, port=PORT):
        super().__init__(("127.0.0.1", port), Handler)
        self.token = secrets.token_urlsafe(32)
        self.client = None
        self.lock = threading.Lock()
        self.commands = queue.Queue()
        self.events = queue.Queue()
        self.tabs = []
        self.last_seen = 0


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def reply(self, status, data):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        origin = self.headers.get("Origin", "")
        if re.fullmatch(r"chrome-extension://[a-p]{32}", origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Study-Token, X-Study-Client")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def allowed(self, bootstrap=False):
        origin = self.headers.get("Origin", "")
        client = self.headers.get("X-Study-Client", "")
        if (self.headers.get("Host") != f"127.0.0.1:{self.server.server_address[1]}" or
                not re.fullmatch(r"[a-p]{32}", client) or
                origin not in ("", f"chrome-extension://{client}")):
            self.reply(403, {"error": "Only the Chrome companion can connect."})
            return False
        with self.server.lock:
            if self.server.client not in (None, client):
                self.reply(403, {"error": "A different companion is already connected."})
                return False
            if bootstrap:
                self.server.client = client
        if not bootstrap and not secrets.compare_digest(self.headers.get("X-Study-Token", ""), self.server.token):
            self.reply(403, {"error": "Reconnect the companion."})
            return False
        return True

    def do_OPTIONS(self):
        origin = self.headers.get("Origin", "")
        self.reply(200 if re.fullmatch(r"chrome-extension://[a-p]{32}", origin) else 403, {})

    def do_GET(self):
        if self.path == "/hello" and self.allowed(bootstrap=True):
            self.reply(200, {"token": self.server.token})
        elif self.path != "/hello":
            self.reply(404, {})

    def do_POST(self):
        if not self.allowed():
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 30_000_000:
                raise ValueError("Invalid payload size")
            self.connection.settimeout(15)
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError("Expected an object")
            if self.path == "/poll":
                if not isinstance(data.get("tabs"), list):
                    raise ValueError("Invalid tab list")
                self.server.tabs = [t for t in data["tabs"] if isinstance(t, dict) and
                                    isinstance(t.get("id"), int) and isinstance(t.get("url"), str)]
                self.server.last_seen = time.monotonic()
                command = None
                if not data.get("busy"):
                    try:
                        command = self.server.commands.get(timeout=15)
                    except queue.Empty:
                        pass
                else:
                    time.sleep(15)
                self.reply(200, {"command": command})
            elif self.path == "/result":
                self.server.events.put(data)
                self.reply(200, {"ok": True})
            else:
                self.reply(404, {})
        except (ValueError, UnicodeDecodeError) as error:
            self.reply(400, {"error": str(error)})


class App(tk.Tk):
    def __init__(self, bridge, data_dir=None):
        super().__init__(className="UdemyStudyTools")
        self.bridge = bridge
        self.data_dir = Path(data_dir) if data_dir is not None else user_data_dir()
        self.preferences_path = self.data_dir / "preferences.json"
        self.preferences = {}
        try:
            loaded = json.loads(self.preferences_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                self.preferences = loaded
        except (OSError, ValueError):
            pass
        self.dark = self.preferences.get("darkMode", True) is True
        self.title("StudyDock — Exporter")
        self.brand_icon = tk.PhotoImage(file=ROOT / "extension/icons/icon-48.png")
        self.iconphoto(True, tk.PhotoImage(file=ROOT / "extension/icons/icon-256.png"), self.brand_icon)
        if os.name == "nt":
            self.iconbitmap(default=str(ROOT / "extension/icons/study.ico"))
        self.geometry("1080x800")
        self.minsize(880, 680)
        self.pending = {}
        self.tab_snapshot = None
        self.last_output = self.data_dir / "exports"
        self.filter = tk.StringVar(value="")
        self.format = tk.StringVar(value="Markdown (.md)")
        self.mode = tk.StringVar(value="Questions, answers, correct answers & explanations")
        self.limit = tk.StringVar(value="20")
        self.folder = tk.StringVar(value=str(self.last_output))
        self.status = tk.StringVar(value="Waiting for the Chrome companion…")
        self.style = ttk.Style(self)
        self.style.theme_use("clam")
        body = ttk.Frame(self, padding=24)
        body.pack(fill="both", expand=True)
        body.columnconfigure(0, weight=1)
        body.rowconfigure(3, weight=1, minsize=70)
        header = ttk.Frame(body)
        header.grid(row=0, column=0, sticky="ew", pady=(0, 12))
        ttk.Label(header, image=self.brand_icon).pack(side="left", padx=(0, 12))
        brand = ttk.Frame(header)
        brand.pack(side="left")
        ttk.Label(brand, text="StudyDock", style="Title.TLabel").pack(anchor="w")
        ttk.Label(brand, text="Completed tests, ready for your notes.", style="Muted.TLabel").pack(anchor="w")
        self.theme_button = ttk.Button(header, command=self.toggle_theme)
        self.theme_button.pack(side="right")
        setup = ttk.Frame(body)
        setup.grid(row=1, column=0, sticky="ew")
        ttk.Label(setup, textvariable=self.status, style="Muted.TLabel").pack(side="left")
        ttk.Button(setup, text="Chrome setup", command=self.setup_help).pack(side="right")
        search = ttk.Frame(body)
        search.grid(row=2, column=0, sticky="ew", pady=12)
        ttk.Label(search, text="Find a tab").pack(side="left")
        ttk.Entry(search, textvariable=self.filter, width=36).pack(side="left", padx=8)
        ttk.Button(search, text="Show all", command=lambda: self.filter.set("")).pack(side="left")
        ttk.Button(search, text="Select all shown", command=lambda: self.tabs.selection_set(self.tabs.get_children())).pack(side="right")
        table = ttk.Frame(body)
        table.grid(row=3, column=0, sticky="nsew")
        self.tabs = ttk.Treeview(table, columns=("group", "test", "url"), show="headings", selectmode="extended", height=4)
        for key, title, width in (("group", "Tab group", 130), ("test", "Test / tab", 350), ("url", "Source URL", 390)):
            self.tabs.heading(key, text=title)
            self.tabs.column(key, width=width, minwidth=80)
        scroll = ttk.Scrollbar(table, orient="vertical", command=self.tabs.yview)
        self.tabs.configure(yscrollcommand=scroll.set)
        self.tabs.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")
        ttk.Label(body, text="Select completed results tabs. Use Ctrl / Cmd or Shift for multiple.", style="Muted.TLabel").grid(row=4, column=0, sticky="w", pady=(8, 4))
        options = ttk.LabelFrame(body, text="Export options", padding=16)
        options.grid(row=5, column=0, sticky="ew", pady=8)
        ttk.Label(options, text="Include").grid(row=0, column=0, sticky="w", padx=(0, 10))
        ttk.Combobox(options, textvariable=self.mode, state="readonly", width=56, values=(
            "Questions & your answers", "Questions, answers, correct answers & explanations")).grid(row=0, column=1, columnspan=3, sticky="ew")
        ttk.Label(options, text="File format").grid(row=1, column=0, sticky="w", pady=10)
        ttk.Combobox(options, textvariable=self.format, state="readonly", width=20,
                     values=("Markdown (.md)", "JSON (.json)")).grid(row=1, column=1, sticky="w")
        ttk.Label(options, text="Questions per file").grid(row=1, column=2, padx=15)
        ttk.Combobox(options, textvariable=self.limit, width=10,
                     values=("5", "10", "15", "20", "25", "30", "50", "All")).grid(row=1, column=3, sticky="w")
        ttk.Label(options, text="Save to").grid(row=2, column=0, sticky="w")
        ttk.Entry(options, textvariable=self.folder).grid(row=2, column=1, columnspan=2, sticky="ew")
        ttk.Button(options, text="Browse…", command=self.choose_folder).grid(row=2, column=3, padx=(10, 0))
        options.columnconfigure(1, weight=1)
        actions = ttk.Frame(body)
        actions.grid(row=6, column=0, sticky="ew", pady=6)
        self.export_button = ttk.Button(actions, text="Export selected tabs", command=self.extract, style="Accent.TButton")
        self.export_button.pack(side="left")
        ttk.Button(actions, text="Open output folder", command=self.open_output).pack(side="left", padx=10)
        self.log = tk.Text(body, height=3, wrap="word", font=("Segoe UI" if sys.platform == "win32" else "Helvetica", 10), state="disabled", borderwidth=0, padx=14, pady=12)
        self.log.grid(row=7, column=0, sticky="ew", pady=(8, 0))
        self.apply_theme()
        self.filter.trace_add("write", lambda *_: self.refresh_tabs())
        self.protocol("WM_DELETE_WINDOW", self.close)
        self.after(500, self.tick)

    def apply_theme(self):
        colors = dict(bg="#171b20", surface="#20252b", soft="#2c333c", ink="#e0e4eb", muted="#acb6c4", line="#3c4550", accent="#adcaff", selected="#2a405d") if self.dark else dict(
            bg="#f0f3f7", surface="#ffffff", soft="#e7edf5", ink="#20252c", muted="#596574", line="#d7dfe8", accent="#285ea8", selected="#dce9fc")
        c, style = colors, self.style
        self.configure(background=c["bg"])
        style.configure(".", background=c["bg"], foreground=c["ink"], bordercolor=c["line"], lightcolor=c["line"], darkcolor=c["line"], font=("Segoe UI" if sys.platform == "win32" else "Helvetica", 10))
        style.configure("TFrame", background=c["bg"])
        style.configure("TLabel", background=c["bg"], foreground=c["ink"])
        style.configure("Title.TLabel", font=("Segoe UI" if sys.platform == "win32" else "Helvetica", 20, "bold"))
        style.configure("Muted.TLabel", foreground=c["muted"])
        style.configure("TLabelframe", bordercolor=c["line"], relief="solid")
        style.configure("TLabelframe.Label", foreground=c["muted"], padding=(4, 0))
        style.configure("TButton", background=c["soft"], foreground=c["ink"], padding=(14, 9), borderwidth=0, focusthickness=2, focuscolor=c["accent"])
        style.map("TButton", background=[("active", c["selected"])], foreground=[("disabled", c["muted"])])
        style.configure("Accent.TButton", background=c["selected"], foreground=c["accent"])
        for name in ("TEntry", "TCombobox"):
            style.configure(name, fieldbackground=c["surface"], background=c["soft"], foreground=c["ink"], bordercolor=c["line"], arrowcolor=c["ink"], padding=8, insertcolor=c["ink"])
            style.map(name, fieldbackground=[("readonly", c["surface"])], foreground=[("readonly", c["ink"])], bordercolor=[("focus", c["accent"])])
        style.configure("Treeview", background=c["surface"], fieldbackground=c["surface"], foreground=c["ink"], borderwidth=0, rowheight=38)
        style.configure("Treeview.Heading", background=c["soft"], foreground=c["muted"], padding=(10, 10), relief="flat")
        style.map("Treeview", background=[("selected", c["selected"])], foreground=[("selected", c["accent"])])
        style.map("Treeview.Heading", background=[("active", c["selected"])])
        style.configure("Vertical.TScrollbar", background=c["soft"], troughcolor=c["surface"], borderwidth=0, arrowcolor=c["muted"])
        self.option_add("*TCombobox*Listbox.background", c["surface"])
        self.option_add("*TCombobox*Listbox.foreground", c["ink"])
        self.option_add("*TCombobox*Listbox.selectBackground", c["selected"])
        self.option_add("*TCombobox*Listbox.selectForeground", c["accent"])
        self.log.configure(background=c["surface"], foreground=c["muted"], insertbackground=c["ink"], selectbackground=c["selected"])
        self.theme_button.configure(text="Light mode" if self.dark else "Dark mode")

    def toggle_theme(self):
        self.dark = not self.dark
        self.apply_theme()
        try:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            self.preferences["darkMode"] = self.dark
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=self.data_dir, delete=False) as pending:
                json.dump(self.preferences, pending)
            Path(pending.name).replace(self.preferences_path)
        except OSError as error:
            self.note(f"Theme changed for this session; could not save preference: {error}")

    def note(self, message):
        self.log.configure(state="normal")
        self.log.insert("end", message + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def refresh_tabs(self):
        selected = set(self.tabs.selection())
        self.tabs.delete(*self.tabs.get_children())
        query = self.filter.get().lower().strip()
        for tab in self.bridge.tabs:
            if query and query not in " ".join(str(tab.get(k, "")) for k in ("group", "title", "url")).lower():
                continue
            match = re.search(r"/quiz/(\d+)", tab["url"])
            title = f"Quiz {match[1]} · {tab.get('title', '')}" if match else tab.get("title", "Udemy")
            item = str(tab["id"])
            self.tabs.insert("", "end", iid=item, values=(tab.get("group", "Ungrouped"), title, tab["url"]))
            if item in selected:
                self.tabs.selection_add(item)

    def tick(self):
        connected = time.monotonic() - self.bridge.last_seen < 40
        self.status.set(f"Chrome connected · {len(self.bridge.tabs)} Udemy tabs" if connected else
                        "Waiting for Chrome — open the companion extension tab")
        snapshot = json.dumps(self.bridge.tabs, sort_keys=True)
        if snapshot != self.tab_snapshot:
            self.tab_snapshot = snapshot
            self.refresh_tabs()
        while True:
            try:
                event = self.bridge.events.get_nowait()
            except queue.Empty:
                break
            job = self.pending.pop(event.get("id"), None)
            if job is None:
                continue
            try:
                if event.get("error"):
                    raise ValueError(event["error"])
                data = event.get("data", {})
                if data.get("error"):
                    raise ValueError(data["error"])
                paths = write_export(data, job["folder"], job["fmt"], job["limit"], job["full"])
                self.last_output = paths[0].parent
                self.note(f"Saved {len(data['questions'])} questions in {len(paths)} file(s): {self.last_output}")
                for warning in data.get("warnings", []):
                    self.note("Note: " + warning)
            except Exception as error:
                self.note(f"Tab {job['tab_id']}: {error}")
        self.export_button.configure(state="disabled" if self.pending else "normal")
        self.after(500, self.tick)

    def extract(self):
        try:
            limit = chunk_limit(self.limit.get())
            if not self.tabs.selection():
                raise ValueError("Select at least one Udemy tab.")
            if time.monotonic() - self.bridge.last_seen >= 40:
                raise ValueError("Open the Chrome companion tab first (see Chrome setup).")
            if not self.folder.get().strip():
                raise ValueError("Choose an output folder.")
            for item in self.tabs.selection():
                command = {"id": uuid.uuid4().hex, "tab_id": int(item)}
                self.pending[command["id"]] = {**command, "folder": self.folder.get(), "limit": limit,
                    "fmt": "json" if self.format.get().startswith("JSON") else "md",
                    "full": self.mode.get() != "Questions & your answers"}
                self.bridge.commands.put(command)
            self.note(f"Queued {len(self.tabs.selection())} tab(s). Keep Chrome and the connector tab open.")
            self.export_button.configure(state="disabled")
        except ValueError as error:
            messagebox.showerror("Export", str(error), parent=self)

    def choose_folder(self):
        folder = filedialog.askdirectory(parent=self, initialdir=self.folder.get())
        if folder:
            self.folder.set(folder)

    def open_output(self):
        path = self.last_output if self.last_output.exists() else Path(self.folder.get())
        try:
            path.mkdir(parents=True, exist_ok=True)
            open_folder(path)
        except OSError as error:
            messagebox.showerror("Output folder", str(error), parent=self)

    def setup_help(self):
        extension = ROOT / "extension"
        if sys.platform == "linux" and getattr(sys, "frozen", False):
            extension = user_data_dir() / "extension"
            try:
                shutil.copytree(ROOT / "extension", extension, dirs_exist_ok=True)
            except OSError as error:
                messagebox.showerror("Chrome setup", str(error), parent=self)
                return
        self.clipboard_clear()
        self.clipboard_append(str(extension))
        messagebox.showinfo("One-time Chrome setup", "1. Open chrome://extensions in Chrome.\n"
            "2. Turn on Developer mode.\n3. Click Load unpacked and select this folder:\n\n"
            f"{extension}\n\n(The folder path is copied to your clipboard.)\n\n"
            "4. Keep the StudyDock connection tab open.\n"
            "Next time, open it from Chrome's Extensions menu.\n\n"
            "Use completed English-language Udemy practice tests; your answers are never changed.", parent=self)

    def close(self):
        if self.pending and not messagebox.askyesno("Export in progress", "Close the app and discard pending exports?", parent=self):
            return
        self.destroy()


def main():
    if "--install" in sys.argv:
        install_linux()
        return
    if "--smoke-test" in sys.argv:
        with tempfile.TemporaryDirectory() as folder:
            bridge = Bridge(port=0)
            try:
                app = App(bridge, data_dir=folder)
                app.update()
                app.toggle_theme()
                assert app.preferences_path.is_file()
                app.destroy()
            finally:
                bridge.server_close()
        return
    if os.name == "nt":
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("UdemyStudyExtractor.Desktop")
    try:
        bridge = Bridge()
    except OSError as error:
        root = tk.Tk()
        root.withdraw()
        if os.name == "nt":
            root.iconbitmap(default=str(ROOT / "extension/icons/study.ico"))
        messagebox.showerror("StudyDock", f"Cannot start the local connector on port {PORT}.\n"
                             f"The app may already be open.\n\n{error}")
        root.destroy()
        return
    threading.Thread(target=bridge.serve_forever, daemon=True).start()
    try:
        App(bridge).mainloop()
    finally:
        bridge.shutdown()
        bridge.server_close()


if __name__ == "__main__":
    main()
