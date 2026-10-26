"""Installer selection, verification and platform launch checks; no real installation."""
import hashlib
import io
from pathlib import Path
import plistlib
import tempfile
import unittest
from unittest.mock import patch
from urllib.request import Request

import install


class InstallerTests(unittest.TestCase):
    def test_pinned_prerelease(self):
        self.assertEqual(install.release_endpoint(''), install.API + '/latest')
        self.assertEqual(install.release_endpoint('v1.5.0-rc.1'), install.API + '/tags/v1.5.0-rc.1')
        for bad in ['../main', '1.5.0-rc.0', '1.5.0;echo test']:
            with self.assertRaises(ValueError):
                install.release_endpoint(bad)
        asset = {'id':1,'name':'StudyDock-1.5.0-rc.1-linux-x64.bin','digest':'sha256:'+'0'*64,'size':1}
        self.assertEqual(install.select_asset({'tag_name':'v1.5.0-rc.1','assets':[asset]}, 'linux-x64.bin'), asset)

    def test_platform_selection(self):
        for system, machine, suffix in [('Linux','x86_64','linux-x64.bin'), ('Windows','AMD64','windows-x64-setup.exe'),
                                        ('Darwin','arm64','macos-arm64.dmg'), ('Darwin','x86_64','macos-x64.dmg')]:
            self.assertEqual(install.asset_suffix(system,machine),suffix)
        with self.assertRaises(ValueError):
            install.asset_suffix('Linux','aarch64')

    def test_download_verification(self):
        content = b'packaged application'
        asset = {'id':1,'name':'StudyDock-1.4.3-linux-x64.bin','digest':'sha256:'+hashlib.sha256(content).hexdigest(),'size':len(content)}
        release = {'tag_name':'v1.4.3','assets':[asset]}
        self.assertEqual(install.select_asset(release,'linux-x64.bin'),asset)
        with self.assertRaises(ValueError):
            install.select_asset(release,'macos-x64.dmg')
        with self.assertRaises(ValueError):
            install.select_asset({**release,'tag_name':'../../escape'},'linux-x64.bin')
        with self.assertRaises(ValueError):
            install.select_asset({**release,'assets':[{**asset,'digest':None}]},'linux-x64.bin')
        with tempfile.TemporaryDirectory() as directory:
            class Opener:
                def open(self, request, timeout):
                    self.request = request
                    return io.BytesIO(content)
            opener = Opener()
            package = install.download(opener,asset,'test-token',Path(directory))
            self.assertEqual(package.read_bytes(),content)
            self.assertEqual(opener.request.full_url,install.API+'/assets/1')
            install.download(opener,asset,None,Path(directory))
            self.assertIsNone(opener.request.get_header('Authorization'))
            for changes in [{'digest':'sha256:'+'0'*64},{'size':1},{'size':1000}]:
                with self.assertRaises(ValueError):
                    install.download(opener,{**asset,**changes},'test-token',Path(directory))

    def test_redirect_does_not_leak_token(self):
        request = Request(install.API+'/assets/1',headers={'Authorization':'Bearer private-token'})
        handler = install.SafeRedirect()
        other = handler.redirect_request(request,None,302,'Found',{},'https://release-assets.githubusercontent.com/file')
        self.assertIsNone(other.get_header('Authorization'))
        same = handler.redirect_request(request,None,302,'Found',{},install.API+'/assets/2')
        self.assertEqual(same.get_header('Authorization'),'Bearer private-token')
        with self.assertRaises(ValueError):
            handler.redirect_request(request,None,302,'Found',{},'http://example.com/file')

    def test_windows_and_linux_install_commands(self):
        with tempfile.TemporaryDirectory() as directory:
            package = Path(directory)/'app.bin'; package.touch()
            with patch.dict('install.os.environ',{'GH_TOKEN':'private','GITHUB_TOKEN':'also-private'}), patch('install.subprocess.run') as run:
                install.install(package,'Linux')
                self.assertEqual(run.call_args.args,([str(package),'--install'],))
                self.assertNotIn('GH_TOKEN',run.call_args.kwargs['env'])
                self.assertNotIn('GITHUB_TOKEN',run.call_args.kwargs['env'])
            with patch('install.subprocess.run') as run:
                install.install(package,'Windows')
                self.assertEqual(run.call_args.args,([str(package),'/NORESTART'],))

    def test_mac_upgrade_and_failed_copy(self):
        with tempfile.TemporaryDirectory() as directory:
            home=Path(directory); application=home/'Applications/StudyDock.app'
            application.mkdir(parents=True); (application/'old').touch()
            mounted=plistlib.dumps({'system-entities':[{'mount-point':str(home/'mounted')}]})
            def run(args,check):
                if args[0]=='ditto':
                    target=Path(args[-1]); target.mkdir(); (target/'new').touch()
            with patch('install.Path.home',return_value=home), patch('install.subprocess.check_output',return_value=mounted), patch('install.subprocess.run',side_effect=run):
                install.install(home/'package.dmg','Darwin')
            self.assertTrue((application/'new').exists())
            self.assertFalse((application/'old').exists())
            self.assertFalse((home/'Applications/StudyDock.previous.app').exists())
            def failed_copy(args,check):
                if args[0]=='ditto':
                    raise OSError('Copy failed')
            with patch('install.Path.home',return_value=home), patch('install.subprocess.check_output',return_value=mounted), patch('install.subprocess.run',side_effect=failed_copy):
                with self.assertRaises(OSError):
                    install.install(home/'package.dmg','Darwin')
            self.assertTrue((application/'new').exists())


if __name__ == '__main__':
    unittest.main()
