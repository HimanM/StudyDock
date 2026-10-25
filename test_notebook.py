"""Browser-only notes, exports, settings and contrast checks with synthetic questions."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from test_review import fixture, screenshot, diagram_png, URL

ROOT = Path(__file__).parent
MOCK = """() => {
  window.saved = {}; window.listeners = []; window.failSave = false;
  window.chrome = {
    runtime: {getManifest:()=>({version:'1.4.2'}), openOptionsPage:async()=>{}, getURL:path=>path},
    storage: {local: {
      get:async keys => keys === null ? {...saved} : typeof keys === 'string' ? {[keys]:saved[keys]} : {...keys,...Object.fromEntries(Object.entries(saved).filter(([key])=>key in keys))},
      set:async values => { if(failSave && Object.keys(values).some(key=>key.startsWith('studydock.note.'))) throw Error('Storage unavailable');
        const changes = Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{oldValue:saved[key],newValue:value}]));
        Object.assign(saved,values); queueMicrotask(()=>listeners.forEach(fn=>fn(changes,'local')));
      }},onChanged:{addListener:fn=>listeners.push(fn)}},
    tabs:{query:async()=>[{id:1,title:'Synthetic practice test',url:'https://www.udemy.com/course/test/learn/quiz/1/result/2',groupId:1}],create:async()=>{}},
    tabGroups:{query:async()=>[{id:1,title:'Study group'}]},
    scripting:{executeScript:async()=>[{result:window.exportFixture}]}
  };
}"""


def inject(page, file):
    return page.evaluate((ROOT / 'extension' / file).read_text(encoding='utf-8'))


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page(viewport={'width':1280,'height':900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('**/*', lambda route: route.fulfill(body=fixture(5),content_type='text/html'))
        diagram = diagram_png()
        page.route('**/architecture.png',lambda route:route.fulfill(body=diagram,content_type='image/png'))
        page.goto(URL)
        page.evaluate(MOCK)
        inject(page,'notes-store.js'); inject(page,'notes.js')
        page.locator('[id="question-prompt"]').first.evaluate("node=>node.style.paddingLeft='40px'")
        page.evaluate("dispatchEvent(new Event('resize'))")
        page.locator('.studydock-note-button').first.click()
        assert page.locator('.studydock-note-button').first.evaluate("node=>Math.abs(node.getBoundingClientRect().left-node.previousElementSibling.getBoundingClientRect().left-40)<1")
        panel = page.locator('#studydock-notes')
        panel.get_by_role('textbox',name='Your note').fill('Check availability across zones.\nMy own reasoning, not the answer key.')
        page.wait_for_function("Object.values(saved).some(note=>note.text?.startsWith('Check availability'))")
        panel.get_by_role('button',name='Close notes').click()
        page.locator('.studydock-note-button').first.click()
        assert panel.get_by_role('textbox',name='Your note').input_value().startswith('Check availability')
        page.evaluate('failSave=true')
        panel.get_by_role('textbox',name='Your note').fill('A revised note')
        panel.get_by_text('Not saved: Storage unavailable',exact=True).wait_for()
        page.evaluate('failSave=false'); panel.get_by_role('button',name='Retry save').click()
        panel.get_by_text('Saved in this browser',exact=True).wait_for()
        notes = page.evaluate('StudyDockNotes.all()')
        assert len(notes) == 1 and notes[0]['question_number'] == 1 and notes[0]['text'] == 'A revised note'
        key = notes[0]['key']
        # Numbers/attempts do not identify questions. Different quizzes and choices do.
        assert page.evaluate("async()=> (await StudyDockNotes.context(document.querySelector('#question-prompt'),45,location.href.replace('/result/2','/test'))).key") == key
        assert page.evaluate("async()=> (await StudyDockNotes.context(document.querySelector('#question-prompt'),1,location.href.replace('/quiz/1/','/quiz/2/'))).key") != key
        page.locator('[data-purpose=answer-body]').first.evaluate("node=>node.dataset.original=node.innerHTML")
        page.locator('[data-purpose=answer-body]').first.evaluate("node=>node.textContent='Different choice'")
        assert page.evaluate("async()=> (await StudyDockNotes.context(document.querySelector('#question-prompt'),1)).key") != key
        page.locator('[data-purpose=answer-body]').first.evaluate("node=>node.innerHTML=node.dataset.original")
        data = inject(page,'extractor.js')
        assert 'error' not in data, data
        assert data['questions'][0]['notes']['text'] == 'A revised note'
        assert all('notes' not in q for q in data['questions'][1:])
        page.evaluate("chrome.storage.local.set({notesEnabled:false})")
        page.wait_for_function("document.querySelector('.studydock-note-button').hidden")
        assert len(page.evaluate('StudyDockNotes.all()')) == 1
        inject(page,'browser-export.js')
        page.evaluate('data=>window.testData=data',data)
        basic = page.evaluate("JSON.parse(StudyDockExport.chunks(testData,'json','5',false)[0].text)")
        assert basic['questions'][0]['notes']['text'] == 'A revised note'
        assert 'correct_answers' not in basic['questions'][0] and 'correct' not in basic['questions'][0]['options'][0]
        full_md = page.evaluate("StudyDockExport.chunks(testData,'md','All',true)[0].text")
        assert '### Your notes\n\nA revised note' in full_md and '### Explanation' in full_md
        for bad in ['4','5.5','-1','0','1e2','']:
            assert page.evaluate("value=>{try{StudyDockExport.chunks(testData,'md',value,true);return false}catch{return true}}",bad)
        only_notes = page.evaluate("async()=>JSON.parse(StudyDockExport.notesFile(await StudyDockNotes.all(),'json').text)")
        assert only_notes['notes'][0]['question_number'] == 1 and 'preview' not in only_notes['notes'][0]
        exam_html = page.locator('[class*="question-result-pane-wrapper"]').first.evaluate('''node=>{
          const copy=node.cloneNode(true);copy.className='quiz-view--container--fixture';
          copy.querySelector('[class*=pane-title]').remove();copy.querySelector('.studydock-note-button').remove();
          return '<h2>Question 1 of 5</h2>'+copy.outerHTML;
        }''')
        exam = browser.new_page()
        exam.route('**/*',lambda route:route.fulfill(body=exam_html,content_type='text/html'))
        exam.goto(URL.replace('/result/2','/test'))
        exam.evaluate(MOCK); exam.evaluate('values=>Object.assign(saved,values)',{key:notes[0]})
        inject(exam,'notes-store.js'); inject(exam,'notes.js')
        exam.get_by_role('button',name='Notes',exact=True).click()
        exam.locator('#studydock-notes').get_by_role('heading',name='Question 1 · Notes',exact=True).wait_for()
        assert exam.locator('#studydock-notes textarea').input_value() == 'A revised note'
        # Focused notes remain visible and typing does not trigger review shortcuts.
        page.evaluate("chrome.storage.local.set({notesEnabled:true,focusReview:true,darkMode:true})")
        inject(page,'review.js')
        review = page.locator('#udemy-study-review'); review.wait_for()
        review.get_by_role('button',name='Notes',exact=True).click()
        panel.get_by_role('textbox',name='Your note').fill('Explanation remains open while I type e.')
        assert panel.is_visible() and review.locator('.explanation').is_visible()
        assert panel.locator('textarea').evaluate("node=>getComputedStyle(node).outlineStyle==='none' && getComputedStyle(node).borderTopWidth==='2px'")
        screenshot(page,'review-with-notes.png')
        panel.get_by_role('button',name='Minimize notes',exact=True).click()
        assert panel.locator('textarea').is_hidden()
        review.get_by_role('button',name='Next question',exact=True).click()
        panel.get_by_role('heading',name='Question 2 · Notes',exact=True).wait_for()
        assert panel.locator('textarea').is_hidden()
        screenshot(page,'review-notes-minimized.png')
        panel.get_by_role('button',name='Expand notes',exact=True).click()
        assert panel.locator('textarea').input_value() == ''
        panel.locator('textarea').fill('Second question note')
        review.get_by_role('button',name='Previous question',exact=True).click()
        panel.get_by_role('heading',name='Question 1 · Notes',exact=True).wait_for()
        assert panel.locator('textarea').input_value() == 'Explanation remains open while I type e.'
        # Rapid navigation must not let a late read replace the current question's draft.
        page.evaluate('''() => {
          const root=document.querySelector('#udemy-study-review').shadowRoot;
          root.querySelector('[aria-label="Next question"]').click();
          root.querySelector('[aria-label="Previous question"]').click();
        }''')
        page.wait_for_function("!document.querySelector('#studydock-notes').shadowRoot.querySelector('textarea').disabled")
        assert panel.get_by_role('heading').inner_text() == 'Question 1 · Notes'
        page.evaluate('failSave=true')
        panel.locator('textarea').fill('Unsaved first question draft')
        panel.get_by_text('Not saved: Storage unavailable',exact=True).wait_for()
        review.get_by_role('button',name='Next question',exact=True).click()
        panel.get_by_text('Still showing the previous question:',exact=False).wait_for()
        assert panel.get_by_role('heading').inner_text() == 'Question 1 · Notes'
        assert panel.locator('textarea').input_value() == 'Unsaved first question draft'
        page.evaluate('failSave=false')
        panel.get_by_role('button',name='Retry save').click()
        panel.get_by_text('Saved in this browser',exact=True).wait_for()
        review.get_by_role('button',name='Notes',exact=True).click()
        panel.get_by_role('heading',name='Question 2 · Notes',exact=True).wait_for()
        assert panel.locator('textarea').input_value() == 'Second question note'
        page.set_viewport_size({'width':390,'height':480})
        assert panel.locator('section').evaluate('node=>node.getBoundingClientRect().top>=0 && node.getBoundingClientRect().right<=innerWidth')
        page.set_viewport_size({'width':1280,'height':900})
        panel.locator('textarea').focus()
        page.keyboard.press('Escape')
        assert panel.is_hidden() and review.is_visible()
        # Pages work without any Python process or a background polling connection.
        settings = browser.new_page(viewport={'width':1100,'height':900})
        settings.add_init_script('(' + MOCK + ')()')
        settings.goto((ROOT/'extension/settings.html').resolve().as_uri())
        settings.get_by_role('switch',name='Desktop integration',exact=False).uncheck()
        assert settings.evaluate('saved.desktopIntegration') is False
        settings.get_by_role('switch',name='Dark mode',exact=False).check()
        assert settings.locator('html').get_attribute('data-dark') == ''
        screenshot(settings,'settings.png',full_page=True)
        settings.set_viewport_size({'width':390,'height':844})
        assert settings.evaluate('document.documentElement.scrollWidth <= innerWidth')
        notebook = browser.new_page(viewport={'width':1100,'height':900})
        notebook.add_init_script('(' + MOCK + ')()')
        notebook.add_init_script('saved.darkMode=true; Object.assign(saved,' + json.dumps({key:notes[0]}) + '); window.exportFixture=' + json.dumps(data))
        notebook.goto((ROOT/'extension/notebook.html').resolve().as_uri())
        notebook.get_by_text('1 saved note(s).',exact=True).wait_for()
        notebook.get_by_role('button',name='Prepare downloads').click()
        notebook.get_by_text('5 questions ready.',exact=False).wait_for()
        assert notebook.locator('#downloads a').count() == 1
        assert 'Study group' in notebook.locator('#tab').inner_text()
        screenshot(notebook,'notebook.png',full_page=True)
        with notebook.expect_download() as download:
            notebook.get_by_role('button',name='Download JSON',exact=True).click()
        assert json.loads(Path(download.value.path()).read_text())['notes'][0]['text'] == 'A revised note'
        assert errors == [], errors
        browser.close()
    print('PASS: note persistence/failure recovery, content matching, question exports, notes-only downloads, settings, focused editor and browser-only workflow')


if __name__ == '__main__':
    main()
