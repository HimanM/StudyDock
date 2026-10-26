"""Install the latest packaged StudyDock desktop app. Python 3.9+, no pip packages."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import plistlib
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

API = 'https://api.github.com/repos/HimanM/Udemy-Study-Tools/releases'
VERSION_PATTERN = r'\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.[1-9]\d*)?'


def release_endpoint(version):
    if not version:
        return API + '/latest'
    version = version.removeprefix('v')
    if not re.fullmatch(VERSION_PATTERN, version):
        raise ValueError('Use a version such as 1.5.0 or 1.5.0-rc.1.')
    return API + '/tags/v' + version


class SafeRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlparse(newurl).scheme != 'https':
            raise ValueError('Refusing a download redirect without HTTPS.')
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected and urlparse(newurl).netloc != urlparse(req.full_url).netloc:
            redirected.remove_header('Authorization')
        return redirected


def asset_suffix(system, machine):
    machine = machine.lower()
    if machine in ('x86_64', 'amd64'):
        return {'Windows': 'windows-x64-setup.exe', 'Linux': 'linux-x64.bin',
                'Darwin': 'macos-x64.dmg'}[system]
    if system == 'Darwin' and machine in ('arm64', 'aarch64'):
        return 'macos-arm64.dmg'
    raise ValueError(f'No packaged build for {system} / {machine}.')


def select_asset(release, suffix):
    version = release.get('tag_name', '').removeprefix('v')
    if not re.fullmatch(VERSION_PATTERN, version):
        raise ValueError('Release has an invalid version.')
    name = f'StudyDock-{version}-{suffix}'
    asset = next((asset for asset in release.get('assets', []) if asset.get('name') == name), None)
    if not asset or not re.fullmatch(r'sha256:[0-9a-f]{64}', asset.get('digest') or ''):
        raise ValueError('No matching package with a SHA-256 digest is available.')
    if not isinstance(asset.get('id'), int) or asset['id'] <= 0 or not isinstance(asset.get('size'), int) or asset['size'] <= 0:
        raise ValueError('Invalid release asset metadata.')
    return asset


def download(opener, asset, token, directory):
    package = directory / asset['name']
    headers = {'Accept': 'application/octet-stream', 'User-Agent': 'StudyDock-installer'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    digest = hashlib.sha256()
    size = 0
    with opener.open(Request(f"{API}/assets/{asset['id']}", headers=headers), timeout=120) as response, package.open('wb') as output:
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            if size > asset['size']:
                raise ValueError('Download exceeds the advertised package size.')
            digest.update(chunk)
            output.write(chunk)
    if size != asset['size'] or 'sha256:' + digest.hexdigest() != asset['digest']:
        raise ValueError('Download verification failed; nothing was installed.')
    return package


def install(package, system):
    environment = {key:value for key,value in os.environ.items() if key not in ('GH_TOKEN','GITHUB_TOKEN')}
    if system == 'Linux':
        package.chmod(0o700)
        subprocess.run([str(package), '--install'], check=True, env=environment)
    elif system == 'Windows':
        subprocess.run([str(package), '/NORESTART'], check=True, env=environment)
    else:
        mounted = plistlib.loads(subprocess.check_output(['hdiutil', 'attach', '-nobrowse', '-plist', str(package)]))
        mount = next(Path(item['mount-point']) for item in mounted['system-entities'] if 'mount-point' in item)
        try:
            applications = Path.home() / 'Applications'
            applications.mkdir(exist_ok=True)
            destination = applications / 'StudyDock.app'
            backup = applications / 'StudyDock.previous.app'
            if backup.exists():
                raise ValueError(f'A previous installation backup exists at {backup}. Restore or move it before retrying.')
            with tempfile.TemporaryDirectory(prefix='.studydock-', dir=applications) as stage:
                stage = Path(stage)
                fresh = stage / 'StudyDock.app'
                subprocess.run(['ditto', str(mount / 'StudyDock.app'), str(fresh)], check=True)
                if destination.exists():
                    destination.rename(backup)
                try:
                    fresh.rename(destination)
                except OSError:
                    if backup.exists():
                        backup.rename(destination)
                    raise
            if backup.exists():
                shutil.rmtree(backup)
            print(f'Installed in {destination}')
        finally:
            subprocess.run(['hdiutil', 'detach', str(mount)], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', default='', help='Install a specific version, including a prerelease; default: latest stable.')
    args = parser.parse_args()
    endpoint = release_endpoint(args.version)
    system = platform.system()
    suffix = asset_suffix(system, platform.machine())
    if system == 'Linux':
        libc, version = platform.libc_ver()
        if libc != 'glibc' or tuple(map(int, version.split('.')[:2])) < (2, 35):
            raise ValueError('Linux requires x64 glibc 2.35+ and an X11/XWayland desktop.')
    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    opener = build_opener(SafeRedirect())
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'StudyDock-installer'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    request = Request(endpoint, headers=headers)
    with opener.open(request, timeout=30) as response:
        asset = select_asset(json.load(response), suffix)
    print(f"Downloading {asset['name']}… Close StudyDock before upgrading.")
    with tempfile.TemporaryDirectory(prefix='studydock-install-') as directory:
        package = download(opener, asset, token, Path(directory))
        print('SHA-256 verified. Installing…')
        install(package, system)
    print('StudyDock installed. No Python runtime is needed to run the installed app.')


if __name__ == '__main__':
    try:
        main()
    except HTTPError as error:
        sys.exit(f'GitHub request failed ({error.code}). Check repository access and your token; nothing unverified was installed.')
    except (ValueError, KeyError, OSError, URLError, subprocess.CalledProcessError) as error:
        sys.exit(f'Installation failed: {error}')
    except (KeyboardInterrupt, EOFError):
        sys.exit('Installation cancelled.')
