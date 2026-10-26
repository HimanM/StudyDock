"""Run: py -3 test_extractor.py. Browser checks also run if Playwright is installed."""
import copy
import json
from pathlib import Path
import tempfile
import threading
from unittest.mock import patch
from http.client import HTTPConnection

from extractor import App, Bridge, chunk_limit, prepare_export, write_export, desktop_entry, open_folder, user_data_dir


def check_exports():
    q = {"number": 1, "question": "Choose a region.\n\n![Map](https://example.org/map.png)",
         "options": [{"label": "A", "text": "East", "selected": True, "correct": False, "explanation": "Option reason"},
                     {"label": "B", "text": "West", "selected": False, "correct": True}],
         "selected_answers": ["A"], "correct_answers": ["B"], "is_correct": False,
         "status": "incorrect", "explanation": "Author puts the correct answer last.",
         "marked_for_review": True, "tags": ["marked_for_review", "incorrect"],
         "notes": {"text": "Remember regional availability.", "updated_at": "2026-10-24T00:00:00Z"}}
    source = {"title": 'AZ-104 / test: one', "url": "https://www.udemy.com/test", "expected_count": 45,
              "questions": [{**copy.deepcopy(q), "number": i} for i in range(1, 46)]}
    before = copy.deepcopy(source)
    with tempfile.TemporaryDirectory() as folder:
        files = write_export(source, folder, "json", 20)
        parts = [json.loads(path.read_text(encoding="utf-8")) for path in files]
        assert [len(part["questions"]) for part in parts] == [20, 20, 5]
        assert [q["number"] for part in parts for q in part["questions"]] == list(range(1, 46))
        assert parts[0]["questions"][0]["options"][0]["explanation"] == "Option reason"
        basic = write_export(source, folder, "json", None, False)
        item = json.loads(basic[0].read_text(encoding="utf-8"))["questions"][0]
        assert "correct_answers" not in item and "explanation" not in item and "is_correct" not in item
        assert "correct" not in item["options"][0] and "explanation" not in item["options"][0]
        assert item["selected_answers"] == ["A"] and item["tags"] == ["marked_for_review"]
        assert item["notes"]["text"] == q["notes"]["text"]
        md = write_export(source, folder, "md", 5)[0].read_text(encoding="utf-8")
        assert "## Question 5" in md and "## Question 6" not in md
        assert "Correct answer(s): B" in md and "Marked for review: **Yes**" in md
        assert "![Map]" in md and "Author puts the correct answer last." in md
        assert "### Your notes" in md and q["notes"]["text"] in md
        assert write_export(source, folder, "json", 20)[0] != files[0]
        assert all(path.exists() for path in files)
    assert source == before
    assert chunk_limit("All") is None and chunk_limit("21") == 21
    for value in ("4", "0", "-1", "5.5", "abc"):
        try:
            chunk_limit(value)
            raise AssertionError(f"Accepted invalid limit: {value}")
        except ValueError:
            pass
    for invalid in ({"questions": []}, {**source, "expected_count": 46}):
        try:
            prepare_export(invalid)
            raise AssertionError("Accepted an incomplete export")
        except ValueError:
            pass
    print("PASS: export modes, chunking, review tags, rich content, validation, overwrite protection")


def check_browser():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("SKIP: browser parser checks (optional developer dependency: playwright)")
        return
    script = (Path(__file__).parent / "extension/review-content.js").read_text(encoding="utf-8") + "\n" + (Path(__file__).parent / "extension/extractor.js").read_text(encoding="utf-8")
    cards = []
    for number in range(1, 6):
        state = {1: "Correct", 2: "Incorrect", 3: "Correct", 4: "Skipped", 5: "Incorrect"}[number]
        labels = {1: ["Your answer is correct", ""], 2: ["Correct answer", "Your answer is incorrect"],
                  3: ["Your selection is correct", "Your selection is correct"], 4: ["Correct answer", ""],
                  5: ["Correct answer", "Your selection is incorrect"]}[number]
        answers = "".join(f'''<div data-purpose="answer"><span data-purpose="answer-result-header-user-label">{label}</span>
          <div data-purpose="answer-body"><div id="answer-text"><p>Option {i}</p></div></div>
          <div data-purpose="safely-set-inner-html:rich-text-viewer:html"><p>Option {i} explanation</p></div></div>'''
                          for i, label in enumerate(labels))
        star = '<svg class="result-pane--star-rating-icon--abc"></svg>' if number in (1, 3) else ""
        cards.append(f'''<div class="result-pane--question-result-pane-wrapper--abc">{star}
          <span class="result-pane--pane-title--abc">Question {number}</span>
          <span data-purpose="question-result-header-status-label">{state}</span>
          <div id="question-prompt"><p>Prompt {number} <strong>bold</strong></p><img src="https://example.org/diagram.png">
          <table><tr><th>Name</th><th>Value</th></tr><tr><td>VM1</td><td>10</td></tr></table></div>
          {answers}<div id="overall-explanation"><p>All options explained first.</p><p>Correct answer LAST.</p></div></div>''')
    html = '''<main><h1 class="results-header--title--abc">Sample results</h1>
      <div class="revamped-result-page--revamped-result-page--abc">
      <div class="revamped-result-page--filter-area--abc"><label>5 all</label><label>2 correct</label>
      <label>2 incorrect</label><label>2 marked</label></div>''' + "".join(cards) + "</div></main>"
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        page = browser.new_page()
        page.route("**/*", lambda route: route.fulfill(body=html, content_type="text/html"))
        page.goto("https://www.udemy.com/course/test/learn/quiz/1/result/2")
        data = page.evaluate(script)
        assert "error" not in data, data
        assert len(data["questions"]) == 5
        assert data["questions"][2]["selected_answers"] == ["A", "B"]
        assert data["questions"][2]["correct_answers"] == ["A", "B"]
        assert data["questions"][3]["selected_answers"] == []
        assert data["questions"][4]["selected_answers"] == ["B"]
        assert data["questions"][0]["marked_for_review"] is True
        assert data["questions"][1]["marked_for_review"] is False
        assert "Correct answer LAST." in data["questions"][0]["explanation"]
        assert data["questions"][0]["options"][0]["explanation"] == "Option 0 explanation"
        assert "![Question diagram]" in data["questions"][0]["question"]
        assert "| VM1 | 10 |" in data["questions"][0]["question"]
        page.locator("label").last.evaluate("n => n.textContent = '3 marked'")
        assert "marked count does not match" in page.evaluate(script)["error"]
        page.goto("https://www.udemy.com/course/test/learn/quiz/1/test")
        assert "In-progress" in page.evaluate(script)["error"]
        page.set_content('''<style>[class*=dialog-container] {position:fixed;inset:0;backdrop-filter:blur(8px);background:#0009}
          .limiter {max-block-size:150px} .ud-modal {background:white;padding:40px}
          </style><div class="limiter curriculum-item-view--scaled-height-limiter--abc">
          <div data-purpose="curriculum-item-viewer-content"><div class="quiz-view--container--abc" aria-hidden="true">Question text</div>
          <div class="modal-module--dialog-container--abc modal-module--is-open--abc">
          <div class="modal-module--scroll-wrapper--abc"><div role="dialog" aria-modal="true" class="ud-modal">
          <div class="title">Your test is paused</div>Progress saved.
          <div class="ud-footer-btns"><button data-purpose="unpause-test">Resume test</button></div></div></div></div>
          </div></div><footer class="curriculum-item-footer--footer--abc" style="height:40px">
          <div><div class="popper-module--popper--fixture"><button aria-label="Settings"><svg viewBox="0 0 24 24"></svg></button></div>
          <div class="popper-module--popper--fixture"><button data-purpose="theatre-mode-toggle-button" aria-label="Expanded view"><svg viewBox="0 0 24 24"></svg></button></div></div></footer>''')
        page.evaluate('''() => {
          window.uiSettings = {fullHeight:false, hidePause:false, keepRunning:false}; window.listeners=[]; window.resumes=0;
          window.chrome = {storage:{local:{get: async defaults => ({...defaults,...uiSettings}),
            set: async values => {Object.assign(uiSettings,values); listeners.forEach(fn=>fn(Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{newValue:v}])),'local'));}},
            onChanged:{addListener:fn=>listeners.push(fn)}}};
          document.querySelector('[data-purpose="unpause-test"]').onclick=()=>{
            resumes++;document.querySelector('[class*="dialog-container"]').classList.remove('modal-module--is-open--abc');
          };
        }''')
        page.evaluate((Path(__file__).parent / "extension/ui.js").read_text(encoding="utf-8"))
        page.wait_for_function("!!document.querySelector('#udemy-study-height-toggle')")
        assert page.locator('[data-studydock-controls]').evaluate("node=>getComputedStyle(node).gap") == '6px'
        assert page.get_by_role('button',name='Settings',exact=True).evaluate("node=>node.getBoundingClientRect().height") == 40
        assert page.get_by_role('button',name='Expanded view',exact=True).evaluate("node=>node.getBoundingClientRect().left-document.querySelector('[aria-label=Settings]').getBoundingClientRect().right") == 6
        assert page.evaluate("resumes") == 0
        page.evaluate("chrome.storage.local.set({fullHeight:true,hidePause:true})")
        assert page.locator(".limiter").evaluate("e=>getComputedStyle(e).maxBlockSize") == "none"
        assert page.locator("[data-study-pause]").evaluate("e=>getComputedStyle(e).backdropFilter") == "none"
        assert page.locator('[role="dialog"]').get_attribute("aria-modal") == "false"
        assert page.locator('[class*="quiz-view--container"]').get_attribute("aria-hidden") == "false"
        assert page.locator('[data-purpose="unpause-test"]').is_visible()
        assert page.evaluate("resumes") == 0
        page.evaluate("chrome.storage.local.set({fullHeight:false,hidePause:false})")
        assert page.locator(".limiter").evaluate("e=>getComputedStyle(e).maxBlockSize") == "150px"
        assert page.locator('[role="dialog"]').get_attribute("aria-modal") == "true"
        assert page.locator('[class*="quiz-view--container"]').get_attribute("aria-hidden") == "true"
        page.evaluate("chrome.storage.local.set({keepRunning:true})")
        page.wait_for_function("resumes === 1")
        page.evaluate("document.querySelector('[class*=dialog-container]').classList.add('modal-module--is-open--abc')")
        page.wait_for_function("resumes === 2")
        page.evaluate("chrome.storage.local.set({keepRunning:false})")
        page.evaluate("document.querySelector('[class*=dialog-container]').classList.add('modal-module--is-open--abc')")
        assert page.evaluate("resumes") == 2
        browser.close()
    print("PASS: browser parser, single/multiple answers, skipped, flags, author explanations, images, tables, count checks")
    print("PASS: full-height and pause toggles, restoration, accessible resume, auto-resume on/off")


def check_connection_and_gui():
    bridge = Bridge(port=0)
    threading.Thread(target=bridge.serve_forever, daemon=True).start()
    def request(path, body=None, headers=None):
        connection = HTTPConnection("127.0.0.1", bridge.server_address[1], timeout=5)
        connection.request("POST" if body is not None else "GET", path,
                           json.dumps(body) if body is not None else None, headers or {})
        response = connection.getresponse()
        status, result = response.status, json.loads(response.read())
        connection.close()
        return status, result
    try:
        try:
            duplicate = Bridge(port=bridge.server_address[1])
        except OSError:
            pass
        else:
            duplicate.server_close()
            raise AssertionError("A second app instance could bind the same port")
        assert request("/hello")[0] == 403
        headers = {"X-Study-Client": "a" * 32, "Origin": "https://unrelated.example"}
        assert request("/hello", headers=headers)[0] == 403
        headers["Origin"] = "chrome-extension://" + "a" * 32
        status, hello = request("/hello", headers=headers)
        assert status == 200
        assert request("/poll", {"tabs": []}, headers)[0] == 403
        headers["X-Study-Token"] = hello["token"]
        bridge.commands.put({"id": "job", "tab_id": 1})
        tab = {"id": 1, "title": "Test 1", "group": "az-104 tests", "url": "https://www.udemy.com/course/a/learn/quiz/1/results"}
        status, response = request("/poll", {"tabs": [tab], "busy": False}, headers)
        assert status == 200 and response["command"]["id"] == "job"
        assert bridge.tabs == [tab]
        assert request("/result", {"id": "job", "error": "Test error"}, headers)[0] == 200
        assert bridge.events.get_nowait()["error"] == "Test error"
        with tempfile.TemporaryDirectory() as folder:
            app = App(bridge, data_dir=folder)
            app.withdraw()
            assert app.last_output == Path(folder) / "exports"
            app.toggle_theme()
            assert json.loads(app.preferences_path.read_text())["darkMode"] == app.dark
            assert app.style.lookup("Treeview", "fieldbackground") == ("#20252b" if app.dark else "#ffffff")
            app.toggle_theme()
            assert app.style.lookup("Treeview", "fieldbackground") == "#20252b"
            with patch('extractor.sys.platform', 'linux'), patch('extractor.sys.frozen', True, create=True), \
                 patch('extractor.user_data_dir', return_value=Path(folder)/'user'), patch('extractor.messagebox.showinfo'):
                app.setup_help()
                extension = Path(folder)/'user/extension'
                assert (extension/'manifest.json').is_file()
                assert app.clipboard_get() == str(extension)
        app.withdraw()
        app.refresh_tabs()
        assert app.tabs.get_children() == ("1",)
        app.filter.set("not-this-group")
        assert app.tabs.get_children() == ()
        app.filter.set("")
        app.tabs.selection_set("1")
        app.extract()
        assert len(app.pending) == 1
        job_id = next(iter(app.pending))
        bridge.events.put({"id": job_id, "error": "Readable extraction failure"})
        app.tick()
        assert not app.pending
        assert "Readable extraction failure" in app.log.get("1.0", "end")
        app.destroy()
    finally:
        bridge.shutdown()
        bridge.server_close()
    print("PASS: local connection authentication, command/result flow, GUI tab filters and error recovery")


def check_desktop():
    with patch('extractor.sys.platform', 'linux'), patch.dict('os.environ', {'XDG_DATA_HOME': '/tmp/study-data'}):
        assert user_data_dir() == Path('/tmp/study-data/udemy-study-tools')
        with patch('extractor.subprocess.Popen') as launch:
            open_folder(Path('/tmp/my exports'))
            launch.assert_called_once_with(['xdg-open', str(Path('/tmp/my exports'))])
        with patch('extractor.sys.frozen', True, create=True), patch.dict('os.environ', {'LD_LIBRARY_PATH':'/tmp/bundle', 'LD_LIBRARY_PATH_ORIG':'/system/libs'}), patch('extractor.subprocess.Popen') as launch:
            open_folder(Path('/tmp/my exports'))
            assert launch.call_args.kwargs['env']['LD_LIBRARY_PATH'] == '/system/libs'
    with patch('extractor.sys.platform', 'darwin'), patch('extractor.subprocess.Popen') as launch:
        open_folder(Path('/tmp/my exports'))
        launch.assert_called_once_with(['open', str(Path('/tmp/my exports'))])
        assert user_data_dir().parts[-3:] == ('Library', 'Application Support', 'UdemyStudyTools')
    launcher = desktop_entry('/home/test/My App/Study%Tools', '/home/test/icon.png')
    assert 'Exec="/home/test/My App/Study%%Tools"' in launcher and 'Terminal=false' in launcher
    try:
        desktop_entry('/tmp/bad\ncommand', '/tmp/icon.png')
        raise AssertionError('Accepted a newline in a desktop command')
    except ValueError:
        pass
    print('PASS: desktop theme persistence, writable data paths, platform folder launching and Linux launcher escaping')


if __name__ == "__main__":
    check_exports()
    check_browser()
    check_connection_and_gui()
    check_desktop()
