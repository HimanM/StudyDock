"""Release-channel validation, exact download links and extension-only packaging."""
import json
from pathlib import Path
import re
import tempfile
import unittest
import zipfile
from tools.release_metadata import metadata
from tools.release_notes import render, PACKAGES
from tools.build_browser_download import build


class ReleaseTests(unittest.TestCase):
    def test_channels_and_invalid_versions(self):
        self.assertFalse(metadata('v1.5.0', '1.5.0')['prerelease'])
        for suffix in ['alpha.1', 'beta.2', 'rc.1']:
            self.assertTrue(metadata('v1.5.0-' + suffix, '1.5.0')['prerelease'])
        for value in ['v1.4.3', 'v1.5.0-rc.0', 'v1.5.0-rc', '1.5.0\n', '../../v1.5.0', 'v1.5.0-unknown.1']:
            with self.assertRaises(ValueError):
                metadata(value, '1.5.0')

    def test_buttons_pin_every_package(self):
        for version, channel in [('1.5.0', 'stable'), ('1.5.0-rc.1', 'prerelease')]:
            body = render(version, '1.5.0', 'a' * 40, highlights='Changes here.')
            self.assertEqual(body.count('<img '), 5)
            for name, _, suffix in PACKAGES:
                self.assertIn(f'/v{version}/StudyDock-{version}-{suffix}', body)
                self.assertIn(f'/{channel}-{name}.png', body)
            self.assertIn(f'StudyDock-{version}-browser-extension.zip', body)
            self.assertIn(f'install.py --version {version}', body)
            self.assertIn('Changes here.', body)
            for image in re.findall(r'docs/release-buttons/([^"]+)', body):
                self.assertTrue((Path(__file__).parent / 'docs/release-buttons' / image).is_file())
        store = 'https://chromewebstore.google.com/detail/studydock/example'
        body = render('1.5.0', '1.5.0', 'a' * 40, store)
        self.assertIn(f'<a href="{store}">', body)
        self.assertIn('browser-extension.zip', body)
        with self.assertRaises(ValueError):
            render('1.5.0', '1.5.0', 'a' * 40, 'https://example.com')
        with self.assertRaises(ValueError):
            render('1.5.0', '1.5.0', 'main')

    def test_zip_contains_extension_not_repository(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / 'extension'; source.mkdir()
            (source / 'manifest.json').write_text(json.dumps({'version':'1.5.0','icons':{'16':'icon.png'}}))
            (source / 'icon.png').write_bytes(b'icon')
            (source / 'runtime.js').write_text('runtime')
            (source / '.private').write_text('private')
            (source / 'study-debug.js').write_text('debug')
            (root / 'README.md').write_text('repository')
            target = root / 'extension.zip'
            build(target, source)
            with zipfile.ZipFile(target) as archive:
                self.assertEqual(set(archive.namelist()), {'manifest.json','icon.png','runtime.js'})


if __name__ == '__main__':
    unittest.main()
