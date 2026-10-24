"""Build on the target OS: python tools/build_release.py. Never cross-compiles."""
import hashlib
import json
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    version = json.loads((ROOT / "extension/manifest.json").read_text())["version"]
    output = ROOT / "dist"
    output.mkdir(exist_ok=True)
    icon = ROOT / "extension/icons/study.ico"
    if sys.platform == "darwin":
        from PIL import Image
        icon = output / "study.icns"
        Image.open(ROOT / "extension/icons/studydock.png").save(icon)
    args = [sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile" if sys.platform == "linux" else "--onedir", "--windowed",
            "--name", "StudyDock", "--add-data", f"{ROOT / 'extension'}:extension",
            "--add-data", f"{ROOT / 'LICENSE'}:.", "--icon", str(icon),
            "--osx-bundle-identifier", "com.himanm.UdemyStudyTools", str(ROOT / "extractor.py")]
    subprocess.run(args, cwd=ROOT, check=True)
    folder = output / "StudyDock"
    executable = folder if sys.platform == "linux" else folder / "StudyDock.exe"
    if sys.platform == "darwin":
        executable = output / "StudyDock.app/Contents/MacOS/StudyDock"
    subprocess.run([str(executable), "--smoke-test"], check=True, timeout=60)
    label = {"win32": "windows-x64", "linux": "linux-x64", "darwin": f"macos-{'arm64' if platform.machine() == 'arm64' else 'x64'}"}[sys.platform]
    prefix = f"StudyDock-{version}-{label}"
    artifacts = []
    if sys.platform == "darwin":
        stage = output / "dmg"
        stage.mkdir(exist_ok=True)
        app = stage / "StudyDock.app"
        if app.exists():
            raise RuntimeError("Remove the previous dist/dmg build directory before rebuilding.")
        shutil.copytree(output / "StudyDock.app", app, symlinks=True)
        (stage / "Applications").symlink_to("/Applications", target_is_directory=True)
        destination = output / f"{prefix}.dmg"
        subprocess.run(["hdiutil", "create", "-volname", "StudyDock", "-srcfolder", str(stage), "-ov", "-format", "UDZO", str(destination)], check=True)
        artifacts.append(destination)
    elif sys.platform == "win32":
        iscc = shutil.which("ISCC") or r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
        subprocess.run([iscc, f"/DAppVersion={version}", str(ROOT / "packaging/windows.iss")], check=True)
        artifacts.append(output / f"{prefix}-setup.exe")
        destination = output / f"{prefix}-portable.zip"
        with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
            for file in folder.rglob("*"):
                if file.is_file():
                    archive.write(file, file.relative_to(output))
        artifacts.append(destination)
    else:
        destination = output / f"{prefix}.bin"
        shutil.copy2(executable, destination)
        artifacts.append(destination)
    # The extension remains a normal unpacked MV3 extension, installed separately in Chrome.
    if sys.platform == "win32":
        destination = output / f"StudyDock-{version}-chrome.zip"
        with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
            for file in (ROOT / "extension").rglob("*"):
                if file.is_file():
                    archive.write(file, file.relative_to(ROOT))
        artifacts.append(destination)
    checksums = output / f"SHA256SUMS-{label}.txt"
    checksums.write_text("".join(f"{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.name}\n" for file in artifacts), encoding="utf-8")
    print("\n".join(str(path) for path in artifacts + [checksums]))


if __name__ == "__main__":
    main()
