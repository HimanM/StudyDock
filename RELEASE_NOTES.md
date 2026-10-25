## StudyDock 1.4.3

- New StudyDock identity and generated notebook icon; creator and GitHub links live in Settings.
- Browser-only question notes during exams and review, saved automatically in Chrome.
- Open notes follow focused-review navigation, preserving drafts on save failures. Native Notes buttons and exam footer controls have aligned icons and consistent spacing.
- A larger, resizable notes editor with a single focus border and minimize/expand controls; minimized notes continue following focused-review questions.
- Native dark mode supports Udemy's modern CSS colors and keeps the course sidebar dark during scroll updates.
- Answer hover, focus and checked states stay readable in dark mode; selected answers use a distinct blue surface.
- Notes attach to matching questions in both browser and desktop exports. Notes-only Markdown/JSON downloads include question numbers.
- Browser exports with detail, format and question batch controls; the desktop app is optional.
- Settings for hiding desktop integration, notes and the full-height shortcut.
- Native dark mode checks text contrast against the resulting surface and adapts dynamic page changes.
- Linux is now a single executable with bundled Python/Tk. `--install` creates application-menu and desktop icons without sudo or pip.

- Consistent Material-inspired light/dark styling across focused review, desktop exports, the connection page, popup, and exam controls.
- Native Udemy dark-mode correction for hard-coded neutral backgrounds and text; original media and colored charts are preserved.
- Image zoom/pan/fit viewer and saved collapsible question tray.
- Desktop packages for Windows x64, Linux x64 (glibc 2.35+), macOS Apple Silicon and Intel.
- Cross-platform user data paths and folder opening; saved desktop appearance.
- Automated checks, per-platform build/smoke checks, installer checks, and GitHub asset digests.
- Release downloads contain only packaged desktop apps. The extension ZIP and checksum text files are no longer release assets.

### Optional Python installer

Download [install.py](https://github.com/HimanM/Udemy-Study-Tools/blob/v1.4.3/install.py) using **Download raw file**, then run `python3 install.py` (Windows: `py install.py`). It needs Python 3.9+ with no pip packages, downloads the matching app, verifies its SHA-256 digest and installs it. Windows uses the setup wizard; macOS installs to `~/Applications`; Linux creates application-menu and desktop shortcuts. Close the app before upgrading. The installed app does not require Python.

This repository is private. Set `GH_TOKEN`/`GITHUB_TOKEN`, or enter a token at the hidden prompt, with read-only Contents access to this repository. Alternatively, download the app directly while signed into GitHub.

For the browser extension, use **Chrome setup** in the desktop app or the repository's `extension` folder. Reload the extension and refresh existing Udemy tabs after upgrading. Keep the unpacked-extension folder path unchanged to preserve settings and notes.

Windows/macOS binaries are unsigned; macOS is not notarized. English-language completed practice tests are the supported extraction layout. These builds are checked using synthetic fixtures and packaged-app smoke tests; every course-author layout cannot be guaranteed. See README for installation, privacy, platform requirements, and updating.
