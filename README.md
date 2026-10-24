# Udemy Study Tools

A Chrome extension and desktop exporter for studying completed Udemy practice tests. Read one question at a time, inspect explanations and diagrams, then export your answers into small Markdown or JSON batches for study notes.

![Focused review in dark mode](docs/focus-review.png)

## What it does

- **Focused review:** one question, a separate resizable explanation pane, All / Correct / Wrong / Marked filters, and a collapsible question-number tray.
- **Diagrams:** open images, zoom, pan, fit, and close without losing your place.
- **Consistent appearance:** light/dark themes, Material icons, comfortable reading widths, and short transitions that respect reduced-motion preferences.
- **Native Udemy dark mode:** themes neutral surfaces and text on the original page, including hard-coded white cards. Colored charts and media retain their original colors.
- **Exam controls:** full-height view, optional pause-overlay removal, and optional auto-resume.
- **Desktop exports:** choose Chrome tabs, export detail, Markdown/JSON, and any whole-number batch size from 5 upward, or All. The default is 20.

Focused review needs only the extension. Exporting also needs the desktop app. Reviewing/exporting never answers questions, changes review marks, or submits/retakes a test. Auto-resume is a separate opt-in setting that operates Udemy's Resume control.

## Install

Download the matching package from [Releases](https://github.com/HimanM/Udemy-Study-Tools/releases). This repository is private: sign in with an account that has access. Packaged desktop apps include Python and Tk; you do not need to install Python separately.

| System | Package | Installation |
| --- | --- | --- |
| Windows 10/11, x64 | `windows-x64-setup.exe` | Run the installer. It installs for your account and adds Start-menu and desktop shortcuts. A portable ZIP is also available. |
| macOS 14+, Apple Silicon | `macos-arm64.dmg` | Open the disk image and drag the app to Applications. |
| macOS 15+, Intel | `macos-x64.dmg` | Open the disk image and drag the app to Applications. |
| Linux x64, glibc 2.35+ | `linux-x64.tar.gz` | Extract the archive, then run `sh install.sh` from its folder. This installs for your account and creates application-menu and desktop entries with the app icon. No sudo needed. |

Linux builds target Ubuntu 22.04 or newer and compatible desktop distributions. Tk requires a graphical session (X11 or XWayland). Some desktop environments require **Allow Launching** on a new desktop icon, or disable desktop icons entirely; the application-menu entry remains available. Alpine/musl and Linux ARM are not covered by these packages.

The Windows and macOS packages are **unsigned**; no publisher certificate or Apple notarization credentials are configured. Windows may show SmartScreen, and macOS may require approval in System Settings → Privacy & Security after an attempted launch. Only open packages from this repository that you trust. Checksums accompany each release.

### Chrome companion

1. Download and extract the release's `chrome.zip` into a permanent folder.
2. Open `chrome://extensions`, enable **Developer mode**, and select **Load unpacked**.
3. Choose the extracted `extension` folder. Pin **Udemy Study Tools** from Chrome's Extensions menu.
4. Open a completed test attempt in Udemy and select **Review questions**.

The extension is installed locally; it is not published to the Chrome Web Store. Your existing Udemy login stays in Chrome. The desktop app's **Chrome setup** button can also show/copy the bundled extension path.

## Review controls

| Control | Action |
| --- | --- |
| All / Correct / Wrong / Marked | Filter questions; previous/next follows the filter. |
| Question numbers | Green = correct, red = wrong, amber dot = marked. A number outside the filter returns to All. Status also has accessible text labels. |
| Questions | Show/hide the tray; preference is saved. |
| Explanation | Show/hide the explanation. On narrow screens it replaces the question pane. |
| Divider | Drag to resize; keyboard arrows and Home/End work when focused. |
| More menu | Move explanation left/right and read keyboard help. |
| Appearance icon | Toggle the saved extension theme; first use follows the system. |
| Close / Original view | Return to Udemy's original layout. Focus review reopens the workspace. |
| Image | Click or press Enter/Space to open the viewer. Wheel or +/− zooms, drag/arrows pan, and Fit/0 recenters. |

**Shortcuts:** Left/Right navigate; E toggles the explanation; Escape closes an image or menu first, then returns to the original page. Shortcuts avoid editable fields and the resizing control. Layout, theme, tray visibility, and the last question of the most recently reviewed attempt are saved locally. Question content is not saved by the review workspace.

Disable Dark Reader on Udemy when using this tool's dark theme so the two extensions do not compete. The native theme adapts neutral backgrounds/text; a future Udemy layout change may need adjustments.

### During an exam

These switches are **off by default** and independent of focused review:

- **Full-height view:** removes Udemy's height limit while retaining the footer controls.
- **Hide pause screen:** removes the blur and large paused panel, leaving a small Resume control. The timer remains paused.
- **Keep exam running:** automatically resumes every pause, including manual pauses. The timer continues running. Disable this to pause normally. Browser suspension and sleeping computers can delay it.

Keep-running takes precedence over hiding the pause screen. If you use the original Fuck-Udemy-Exam-UI Tampermonkey script, disable its overlapping controls while using the extension's equivalents.

## Export for study

1. Launch the desktop app.
2. Click the extension → **Connect to Python exporter**, and leave the connection tab open.
3. In the app, select one or more completed-results tabs. Search by tab group, title, or URL; Ctrl/Cmd or Shift selects multiple tabs.
4. Choose detail level, Markdown or JSON, questions per file, and an output folder.
5. Click **Export selected tabs**. Open the output folder when finished.

| Detail level | Includes |
| --- | --- |
| Questions & your answers | Question, all options, selected answers, review flag/tag, domain |
| Full detail | Everything above, plus correct answers, result tags, overall explanation, and per-choice explanations |

Correct answers come from **Udemy's labels**, never guesses based on the author's explanation order. Full explanations preserve rich text, links, tables, code and image URLs. Authors can explain correct and incorrect choices in any order. Multi-select answers remain arrays in JSON. Skipped questions are included with empty selections.

Every export creates a new folder per tab/attempt. Files include source URL, attempt, timestamp, and part number. For example, 88 questions split into 20 gives 20 + 20 + 20 + 20 + 8. Basic mode excludes answer-key fields and result tags. Marked questions include `marked_for_review: true` and a matching tag.

Images are referenced by URL, not downloaded or transcribed. URLs can require Udemy access or expire. When asking an LLM about a diagram, attach the diagram as well as the exported text.

### Local data

The app writes to your user data directory, not its installation folder:

| System | Default directory |
| --- | --- |
| Windows | `%LOCALAPPDATA%\UdemyStudyTools` |
| macOS | `~/Library/Application Support/UdemyStudyTools` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/udemy-study-tools` |

Exports default to the `exports` subfolder; you can choose another folder. The desktop theme is stored in `preferences.json` and is independent of Chrome's saved theme. Existing source-folder exports are left in place when upgrading. Closing during an export asks before discarding pending jobs.

## Update or uninstall

Close the app before upgrading. Install the new desktop package over the old one. On Linux, run the new archive's `install.sh` again. Replace files in the extension's permanent folder, reload it at `chrome://extensions`, and refresh open Udemy tabs. Keep the extension path unchanged to retain its settings.

Uninstall Windows through Installed apps; remove the app from Applications on macOS. On Linux, remove the `app` subfolder from the data directory and `com.himanm.UdemyStudyTools.desktop` from your desktop and `~/.local/share/applications` (or the corresponding XDG location). Your export folders and preferences are kept separately; delete those only if you intend to remove your study data.

## Troubleshooting and limits

- **Waiting for the desktop app:** launch it and keep the Chrome connection tab open. The connector uses `127.0.0.1:8765`; only one app instance can use that port.
- **No tabs:** clear the search and confirm the extension is installed in the Chrome profile containing the tests.
- **Chrome denies access:** open and refresh that results tab, allow the extension access to Udemy, and retry.
- **Missing/count mismatch:** open the desired completed attempt, wait for Review questions to load, select All domains / All questions, and retry. Exports fail rather than silently save an incomplete test.
- **Unknown layout:** current parsing targets English-language completed Udemy practice tests. The original page remains available when the review parser cannot recognize the layout.
- **New install/update:** refresh already-open Udemy tabs after loading/reloading the extension.

## Privacy

No analytics, external AI service, passwords, or cookies are sent by this tool. The extension reads only the Udemy pages it needs, tab-group names, and its own settings. It sends exports to a loopback-only Python connector using extension-origin checks and a per-session token. This blocks ordinary web-page access; it is not a security boundary against other programs already running on your computer. Exported files contain the course questions, your answers, and source URLs—keep them private as appropriate.

## Run from source

Use Python 3.10+ with Tkinter and Chrome. No third-party Python packages are required at runtime:

```sh
python extractor.py
```

On Windows, `Start Extractor.bat` also works. Debian/Ubuntu source installs may need `python3-tk`; macOS needs a Python build with Tk support. Load `extension/` in Chrome as described above.

## Development and releases

Python 3.12 is used in CI. Developer packages are pinned in `requirements-dev.txt`:

```sh
python -m pip install -r requirements-dev.txt
python -m playwright install chrome
python test_extractor.py
python test_review.py
```

Linux headless checks need `xvfb-run -a python test_extractor.py`. Run `python test_review.py --screenshots` to write synthetic previews under `.dev-previews/`. The tests cover exports/authentication, desktop preferences/platform paths, review navigation, image viewer, native-theme contrast/restoration, connection states, and mobile/reduced-motion behavior. Screenshots in this README contain synthetic fixtures, not personal exports.

- **Checks workflow:** tests Windows, Linux, macOS Apple Silicon, and macOS Intel on pushes/PRs.
- **Release workflow:** on a `v*` tag, runs the checks, verifies the tag matches `extension/manifest.json`, builds on each target OS, smoke-tests the bundles, validates Linux installation/launchers and the Windows installer, then publishes packages and SHA-256 checksums only if every job succeeds.
- **Manual release workflow:** builds test artifacts without publishing a release when run from a branch.
- **Local build:** `python tools/build_release.py` on the target OS. Windows needs Inno Setup 6; macOS uses `hdiutil`; Linux needs a display or Xvfb. PyInstaller does not cross-compile.

To release, update the manifest version and `RELEASE_NOTES.md`, commit, then push the matching version tag. There is no automatic desktop/extension updater; install released updates manually. Signing/notarization is not configured.

## Credits and license

MIT, copyright 2026 HimanM. Full-height behavior derives from [Fuck-Udemy-Exam-UI](https://github.com/HimanM/Fuck-Udemy-Exam-UI); its MIT notice remains in `extension/LICENSE-fullheight.txt`. Google [Material Design Icons](https://github.com/google/material-design-icons) are bundled under Apache 2.0, with the license in `extension/icons/LICENSE-material-icons.txt`. This tool is not affiliated with Udemy.
