"""Regenerate the shared icon assets (development only: Pillow + Playwright/Chrome)."""
from io import BytesIO
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

folder = Path(__file__).resolve().parents[1] / "extension" / "icons"
svg = (folder / "study.svg").read_text(encoding="utf-8")
with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page(viewport={"width": 512, "height": 512})
    page.set_content('<style>body{margin:0;background:transparent}svg{width:512px;height:512px;display:block}</style>' + svg)
    source = Image.open(BytesIO(page.screenshot(omit_background=True))).convert("RGBA")
    browser.close()

for size in (16, 32, 48, 128, 256):
    source.resize((size, size), Image.Resampling.LANCZOS).save(folder / f"icon-{size}.png")
source.save(folder / "study.ico", sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)])
print("Built Chrome PNGs and Windows ICO in", folder)
