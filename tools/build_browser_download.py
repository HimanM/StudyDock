"""Build the extension-only download served by the static website."""
import argparse
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def build(destination, source=ROOT / 'extension'):
    manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
    destination.parent.mkdir(parents=True, exist_ok=True)
    files = sorted(file for file in source.rglob('*') if file.is_file()
                   and not any(part.startswith('.') for part in file.relative_to(source).parts)
                   and file.name != 'study-debug.js')
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in files:
            if not file.resolve().is_relative_to(source.resolve()):
                raise ValueError(f'Extension file points outside its folder: {file.name}')
            archive.write(file, file.relative_to(source))
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == {file.relative_to(source).as_posix() for file in files}
        assert json.loads(archive.read('manifest.json')) == manifest
        assert all(icon in archive.namelist() for icon in manifest['icons'].values())
    print(f"Built extension {manifest.get('version_name', manifest['version'])}: {destination}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'website/public/downloads/StudyDock-extension.zip')
    build(parser.parse_args().output)
