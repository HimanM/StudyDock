"""Validate stable/prerelease tags and prepare the bundled display version."""
import argparse
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION_PATTERN = r'(\d+\.\d+\.\d+)(?:-(?:alpha|beta|rc)\.[1-9]\d*)?'


def metadata(value, base):
    version = value.removeprefix('v')
    match = re.fullmatch(VERSION_PATTERN, version)
    if not match or match[1] != base:
        raise ValueError(f'Release version must match manifest {base}, optionally followed by -alpha.N, -beta.N or -rc.N.')
    return {'version': version, 'tag': 'v' + version, 'prerelease': '-' in version}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', default='')
    parser.add_argument('--prepare', action='store_true')
    parser.add_argument('--github-output', type=Path)
    args = parser.parse_args()
    path = ROOT / 'extension/manifest.json'
    manifest = json.loads(path.read_text(encoding='utf-8'))
    info = metadata(args.version or manifest['version'], manifest['version'])
    if args.prepare:
        manifest['version_name'] = info['version']
        path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    if args.github_output:
        with args.github_output.open('a', encoding='utf-8') as output:
            for key, value in info.items():
                output.write(f'{key}={str(value).lower() if isinstance(value, bool) else value}\n')
    print(json.dumps(info))


if __name__ == '__main__':
    main()
