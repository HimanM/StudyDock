"""Exercise the built static site, with no Next.js server or backend."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import threading
import zipfile
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
BASE=os.environ.get('NEXT_PUBLIC_BASE_PATH','')


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if BASE and (self.path==BASE or self.path.startswith(BASE+'/')):
            self.path=self.path[len(BASE):] or '/'
        super().do_GET()

    def log_message(self,*args):
        pass


server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'out')))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}{BASE}/'
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome' if os.environ.get('USE_CHROME') else None)
        context=browser.new_context(viewport={'width':1440,'height':1000},color_scheme='dark')
        page=context.new_page(); errors=[]; failed=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('response',lambda response:failed.append(response.url) if response.status>=400 else None)
        page.goto(url); page.get_by_role('heading',level=1).wait_for()
        assert page.locator('h1').count()==1
        version=json.loads((ROOT.parent/'extension/manifest.json').read_text())['version']
        assert page.get_by_role('link',name='Optional Python installer',exact=True).get_attribute('href').endswith(f'/blob/v{version}/install.py')
        assert page.locator('.download-detail .eyebrow').text_content().endswith('v'+version)
        assert '\u2014' not in page.title()
        assert '\u2014' not in page.locator('body').inner_text()
        page.wait_for_function("document.documentElement.dataset.theme==='dark'")
        assert page.locator('a[href*="chromewebstore.google.com"]').count()==0
        extension_link=page.get_by_role('link',name='Download extension',exact=True).first
        assert extension_link.get_attribute('href')==BASE+'/downloads/StudyDock-extension.zip'
        with page.expect_download() as extension_download:
            extension_link.click()
        with zipfile.ZipFile(extension_download.value.path()) as archive:
            expected={file.relative_to(ROOT.parent/'extension').as_posix() for file in (ROOT.parent/'extension').rglob('*') if file.is_file()}
            assert set(archive.namelist())==expected
            assert json.loads(archive.read('manifest.json'))['version']==json.loads((ROOT.parent/'extension/manifest.json').read_text())['version']
            assert archive.read('notes.js')==(ROOT.parent/'extension/notes.js').read_bytes()
        page.get_by_text('Install in Chrome',exact=True).click()
        assert 'Load unpacked' in page.locator('.extension-install').inner_text()
        page.get_by_text('Install in Chrome',exact=True).click()
        assert page.locator('link[rel=icon]').get_attribute('href').endswith('/favicon.png')
        for width in [1440,768,390]:
            page.set_viewport_size({'width':width,'height':1000 if width>400 else 844})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
            if os.environ.get('SCREENSHOTS'):
                page.locator('img').evaluate_all("images=>Promise.all(images.map(image=>{image.loading='eager';return image.decode();}))")
                page.evaluate("scrollTo({top:0,behavior:'instant'})")
                folder=ROOT.parent/'.dev-previews'; folder.mkdir(exist_ok=True)
                page.screenshot(path=str(folder/f'website-dark-{width}.png'),full_page=True,animations='disabled')
                page.screenshot(path=str(folder/f'website-top-{width}.png'),animations='disabled')
        page.get_by_role('button',name='Open navigation',exact=True).click()
        page.get_by_role('navigation',name='Mobile navigation').get_by_role('link',name='Downloads').click()
        page.get_by_role('button',name='Open navigation',exact=True).wait_for()
        page.set_viewport_size({'width':1440,'height':1000})
        note=page.get_by_role('textbox',name='Your note for question 1')
        note.fill('A note that stays with question one.')
        page.get_by_role('button',name='Next example question').click()
        note2=page.get_by_role('textbox',name='Your note for question 2')
        assert note2.input_value()==''
        note2.fill('A second reminder.')
        page.get_by_role('button',name='Previous example question').click()
        assert note.input_value()=='A note that stays with question one.'
        page.get_by_role('tab',name='Export preview').click()
        page.get_by_role('button',name='JSON',exact=True).click()
        with page.expect_download() as event:
            page.get_by_role('button',name='Download this example').click()
        exported=json.loads(Path(event.value.path()).read_text())
        assert exported['questions'][0]['notes']['text']=='A note that stays with question one.'
        assert exported['questions'][1]['notes']['text']=='A second reminder.'
        page.get_by_role('button',name='Markdown',exact=True).click()
        assert '### Your notes' in page.get_by_label('Generated export preview').inner_text()
        page.get_by_role('button',name='Enlarge screenshot: The focused review workspace',exact=True).click()
        page.get_by_role('dialog').wait_for(); page.keyboard.press('Escape')
        page.get_by_role('dialog').wait_for(state='hidden')
        page.get_by_role('button',name='Use light theme').click()
        page.wait_for_function("document.documentElement.dataset.theme==='light'")
        page.reload(); page.wait_for_function("document.documentElement.dataset.theme==='light'")
        if os.environ.get('SCREENSHOTS'):
            page.screenshot(path=str(ROOT.parent/'.dev-previews/website-light-1440.png'),full_page=True,animations='disabled')
        page.get_by_role('link',name='Privacy',exact=True).focus()
        page.keyboard.press('Enter')
        page.wait_for_url(url+'privacy/')
        page.get_by_role('heading',name='Privacy policy',exact=True).wait_for()
        page.get_by_role('heading',name='Storage, exports and the optional desktop connection').wait_for()
        for width in [390,1440]:
            page.set_viewport_size({'width':width,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
            if os.environ.get('SCREENSHOTS'):
                page.screenshot(path=str(ROOT.parent/f'.dev-previews/website-privacy-{width}.png'),full_page=True,animations='disabled')
        page.get_by_role('link',name='Back to StudyDock',exact=True).click()
        page.wait_for_url(url)
        page.get_by_role('link',name='Read the privacy policy',exact=True).click()
        page.wait_for_url(url+'privacy/')
        assert '\u2014' not in page.locator('body').inner_text()
        policy_context=browser.new_context(java_script_enabled=False)
        policy_page=policy_context.new_page()
        policy_page.goto(url+'privacy/')
        policy_page.get_by_role('heading',name='Retention and deletion',exact=True).wait_for()
        policy_context.close()
        assert errors==[],errors
        assert failed==[],failed
        # Keep OS suggestions separate from unknown chip/libc information.
        for platform,agent,expected in [('Win32','Windows NT 10.0; Win64; x64','Windows'),('Linux x86_64','X11; Linux x86_64','Linux'),('MacIntel','Macintosh; Intel Mac OS X','Choose your Mac chip'),('iPhone','iPhone; CPU iPhone OS 18','Choose your desktop')]:
            os_context=browser.new_context(user_agent=agent,reduced_motion='reduce')
            os_context.add_init_script(f"Object.defineProperty(navigator,'platform',{{get:()=>{json.dumps(platform)}}});Object.defineProperty(navigator,'userAgentData',{{get:()=>undefined}});")
            tab=os_context.new_page(); tab.goto(url)
            tab.locator('.download-detail').get_by_role('heading',name=expected,exact=True).wait_for()
            assert tab.evaluate("getComputedStyle(document.documentElement).scrollBehavior")=='auto'
            if platform=='MacIntel':
                assert tab.locator('.platform-row[aria-pressed=true]').count()==0
                tab.get_by_role('button',name='Mac · Intel',exact=False).click()
                assert tab.get_by_role('link',name='Download for Intel Mac').get_attribute('href').endswith('-macos-x64.dmg')
            os_context.close()
        browser.close()
    print('PASS: static site, mobile layout/navigation, themes, OS suggestions, note switching, Markdown/JSON download, screenshot dialog, privacy and reduced motion')
finally:
    server.shutdown(); server.server_close()
