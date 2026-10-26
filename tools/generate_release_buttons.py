"""Render the website-style Material download buttons as transparent PNGs."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
LABELS = {'extension':'Download extension', 'windows':'Windows installer', 'mac-arm':'Mac · Apple Silicon',
          'mac-intel':'Mac · Intel', 'linux':'Linux binary'}
# Google Material Design Icons, Apache 2.0: extension/icons/LICENSE-material-icons.txt.
EXTENSION = 'M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11'
DOWNLOAD = 'M16.59 9H15V4c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v5H7.41c-.89 0-1.34 1.08-.71 1.71l4.59 4.59c.39.39 1.02.39 1.41 0l4.59-4.59c.63-.63.19-1.71-.7-1.71M5 19c0 .55.45 1 1 1h12c.55 0 1-.45 1-1s-.45-1-1-1H6c-.55 0-1 .45-1 1'


def main():
    destination = ROOT / 'docs/release-buttons'
    destination.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width':240,'height':48}, device_scale_factor=2)
        for channel, background, ink in [('stable','#adcaff','#102a48'),('prerelease','#f4cf8f','#392908')]:
            for name, label in LABELS.items():
                path = EXTENSION if name == 'extension' else DOWNLOAD
                page.set_content(f'<style>html,body{{margin:0;background:transparent}}a{{display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border-radius:24px;background:{background};color:{ink};font:600 14px/20px Arial,sans-serif;box-sizing:border-box;padding:12px 20px}}svg{{width:20px;height:20px;fill:currentColor;flex:none}}</style><a><svg viewBox="0 0 24 24"><path d="{path}"/></svg>{label}</a>')
                page.screenshot(path=str(destination / f'{channel}-{name}.png'), omit_background=True)
        browser.close()


if __name__ == '__main__':
    main()
