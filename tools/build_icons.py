"""Resize the generated brand artwork into Chrome PNGs and the Windows ICO."""
from pathlib import Path
import shutil

from PIL import Image

folder = Path(__file__).resolve().parents[1] / "extension" / "icons"
source = Image.open(folder / 'studydock.png').convert('RGBA')

for size in (16, 32, 48, 128, 256):
    source.resize((size, size), Image.Resampling.LANCZOS).save(folder / f"icon-{size}.png")
source.save(folder / "study.ico", sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)])
shutil.copyfile(folder / 'icon-32.png', folder / 'studydock-favicon.png')
print("Built Chrome PNGs and Windows ICO in", folder)
