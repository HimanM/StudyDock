## StudyDock 1.4.0

- New StudyDock identity and generated notebook icon; creator and GitHub links live in Settings.
- Browser-only question notes during exams and review, saved automatically in Chrome.
- Open notes follow focused-review navigation, preserving drafts on save failures. Native Notes buttons and exam footer controls have aligned icons and consistent spacing.
- Native dark mode supports Udemy's modern CSS colors and keeps the course sidebar dark during scroll updates.
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
- Automated checks, per-platform build/smoke checks, installer checks, and checksums.

Install the Chrome companion ZIP; the desktop package is optional. Reload the extension and refresh existing Udemy tabs after upgrading. Keep the unpacked-extension folder path unchanged to preserve settings and notes.

Windows/macOS binaries are unsigned; macOS is not notarized. English-language completed practice tests are the supported extraction layout. These builds are checked using synthetic fixtures and packaged-app smoke tests; every course-author layout cannot be guaranteed. See README for installation, privacy, platform requirements, and updating.
