"""Generate version-specific release download buttons and installation instructions."""
import argparse
from html import escape
import json
from pathlib import Path
import re
from urllib.parse import urlparse
try:
    from release_metadata import metadata
except ImportError:
    from tools.release_metadata import metadata

ROOT = Path(__file__).resolve().parents[1]
REPO = 'HimanM/Udemy-Study-Tools'
PACKAGES = [('windows', 'Windows x64 installer', 'windows-x64-setup.exe'),
            ('mac-arm', 'macOS Apple Silicon', 'macos-arm64.dmg'),
            ('mac-intel', 'macOS Intel', 'macos-x64.dmg'),
            ('linux', 'Linux x64 binary', 'linux-x64.bin')]


def render(version, base, commit, store_url='', highlights=''):
    info = metadata(version, base)
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('Button images require a full commit SHA.')
    if store_url:
        parsed = urlparse(store_url)
        if parsed.scheme != 'https' or parsed.netloc != 'chromewebstore.google.com' or not parsed.path.startswith('/detail/'):
            raise ValueError('CHROME_STORE_URL must be an official Chrome Web Store listing.')
    version, tag = info['version'], info['tag']
    channel = 'prerelease' if info['prerelease'] else 'stable'
    download = f'https://github.com/{REPO}/releases/download/{tag}/StudyDock-{version}-'
    images = f'https://raw.githubusercontent.com/{REPO}/{commit}/docs/release-buttons/{channel}-'
    extension = download + 'browser-extension.zip'

    def button(name, label, url):
        return f'<a href="{escape(url, quote=True)}"><img src="{images}{name}.png" alt="{label}" width="240" height="48"></a>'

    lines = [f'## StudyDock {version}', '']
    if info['prerelease']:
        lines += ['**Preview release.** Built from the feature branch without merging into main. This does not replace the latest stable release.', '']
    lines += ['### Browser extension', '', button('extension', 'Download browser extension', store_url or extension), '',
              f'[Version {version} extension ZIP]({extension}) · [Manual installation](https://github.com/{REPO}/blob/{tag}/README.md)', '',
              'Extract the ZIP to a permanent folder, then use Chrome → Extensions → Developer mode → Load unpacked. For an upgrade, replace the existing extension files in the same folder, click Reload, and refresh your Udemy or Tutorials Dojo tabs. Keeping the same folder preserves your extension identity, settings and notes.', '',
              '### Optional desktop worker', '',
              'Browser exports work without the desktop worker. Install it if you want the desktop export interface.', '']
    lines += [button(name, label, download + suffix) for name, label, suffix in PACKAGES]
    lines += ['', f'[Windows portable ZIP]({download}windows-x64-portable.zip)', '',
              'Linux: make the binary executable and run it with `--install` to add application-menu and desktop shortcuts. Requires x64 glibc 2.35+ and X11/XWayland; no Python or pip installation is needed. macOS: open the DMG and drag StudyDock into Applications.', '',
              '### Optional Python installer', '',
              f'Download [install.py](https://raw.githubusercontent.com/{REPO}/{tag}/install.py), then run:', '',
              '```sh', f'python3 install.py --version {version}', '```', '',
              f'Windows: `py install.py --version {version}`. Python 3.9+ is needed only for this installer, with no pip packages. It selects the matching binary and verifies GitHub’s SHA-256 digest. Public downloads need no token. Close StudyDock before upgrading.', '',
              '### Changes', '', highlights.strip(), '',
              '### Current limits', '',
              'Windows and macOS builds are unsigned; macOS is not notarized. Supported extraction layouts are English-language completed tests. Review text and controls work offline; remote explanation images still need internet access. Dojo question numbers are assigned in result-list order because its category groups restart numbering; original category numbers are preserved in exports. Question-note editing and exam controls remain Udemy-specific.', '']
    return '\n'.join(lines)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--store-url', default='')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    base = json.loads((ROOT / 'extension/manifest.json').read_text())['version']
    args.output.write_text(render(args.version, base, args.commit, args.store_url,
                                 (ROOT / 'RELEASE_NOTES.md').read_text(encoding='utf-8')), encoding='utf-8')
