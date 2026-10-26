"""Shared live/offline renderer checks, using synthetic exam content only."""
import base64
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from extractor import write_export
from portable_review import render, filename
from test_review import diagram_png

ROOT = Path(__file__).parent


def fixture():
    image = 'data:image/png;base64,' + base64.b64encode(diagram_png()).decode()
    return {'title':'Cloud Architecture / Practice Test 1','url':'https://www.udemy.com/course/test/learn/quiz/1/result/2',
        'quiz_id':'1','expected_count':5,'questions':[
        {'number':i,'question':f'Question {i} with code','question_html':f'<p>Question {i} with <strong>rich text</strong></p><pre><code>aws example --region us-east-1</code></pre>',
         'status':'correct' if i%2 else 'incorrect','is_correct':bool(i%2),'marked_for_review':True if i==2 else None if i==5 else False,
         'selected_answers':['A'],'correct_answers':['A' if i%2 else 'B'],
         'options':[{'label':'A','text':'First choice','text_html':'<p>First <em>choice</em></p>','selected':True,'correct':bool(i%2)},
                    {'label':'B','text':'Second choice','selected':False,'correct':not bool(i%2),'explanation':'Reason B'}],
         'explanation':'Solution','explanation_html':f'<p>Solution {i}</p><table><tr><td>Durability</td></tr></table><img src="{image}" alt="Architecture">',
         'notes':{'text':f'My note {i}'}} for i in range(1,6)]}


def main():
    data=fixture()
    data['questions'][4]['question_html'] += '<img src="data:image/png;base64,AA==" onerror="window.pwned=1"><script>window.pwned=2</script><a href="javascript:alert(1)">bad</a><svg onload="window.pwned=3"></svg>'
    data['title'] += '</script><script>window.pwned=4</script>'
    with tempfile.TemporaryDirectory() as temp, sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True)
        page=browser.new_page(viewport={'width':1280,'height':900})
        requests=[]; errors=[]
        page.on('request',lambda r: requests.append(r.url))
        page.on('pageerror',lambda e: errors.append(str(e)))
        paths=write_export(data,temp,'html',None)
        assert len(paths)==1 and paths[0].name==filename(data['title'])+'.html'
        page.goto(paths[0].as_uri())
        page.get_by_role('heading',name='Question 1',exact=True).wait_for()
        assert page.locator('#udemy-study-review .workspace').count()==1
        assert page.locator('.prompt strong').inner_text()=='rich text'
        assert page.locator('.prompt pre').inner_text().startswith('aws example')
        assert page.locator('.explanation table').inner_text()=='Durability'
        page.get_by_role('button',name='Wrong 2',exact=True).click()
        assert page.get_by_role('heading',name='Question 2',exact=True).is_visible()
        page.get_by_role('button',name='Marked 1',exact=True).click()
        assert page.get_by_role('button',name='Next question',exact=True).is_disabled()
        page.get_by_role('button',name='All 5',exact=True).click()
        page.keyboard.press('ArrowRight')
        assert page.get_by_role('heading',name='Question 3',exact=True).is_visible()
        page.get_by_text('Your saved notes',exact=True).click()
        assert page.get_by_text('My note 3',exact=True).is_visible()
        page.get_by_role('button',name='Enlarge image: Architecture').click()
        assert page.get_by_role('dialog').is_visible()
        page.keyboard.press('Escape')
        page.get_by_role('button',name='Question 5, correct').click()
        assert page.evaluate('window.pwned') is None
        assert page.locator('.prompt a[href]').count()==0
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not [u for u in requests if u.startswith(('http:','https:'))], requests
        assert not errors, errors
        # Basic mode cannot leak an answer key through rich HTML or label colors.
        basic=write_export(data,temp,'html',None,False)[0]
        page.goto(basic.as_uri())
        page.get_by_role('heading',name='Question 1',exact=True).wait_for()
        assert page.locator('.option.correct,.option.wrong').count()==0
        assert page.get_by_text('Your answer',exact=True).is_visible()
        assert 'Solution 1' not in page.locator('.workspace').inner_text()
        assert page.get_by_text('Result unavailable',exact=True).is_visible()
        # JS and Python produce the same document from the same shared files.
        page.goto('about:blank')
        page.evaluate((ROOT/'extension/portable-review.js').read_text(encoding='utf-8-sig'))
        assets={k:(ROOT/'extension'/v).read_text(encoding='utf-8') for k,v in {'SHELL':'portable-shell.html','CONTENT':'review-content.js','BOOT':'offline-review.js','REVIEW':'review.js'}.items()}
        js_html=page.evaluate('([data,assets])=>StudyDockPortable.render(data,assets)',[data,assets])
        # JSON whitespace differs; both payloads round-trip and executable sections match.
        assert js_html.split('</script>',1)[1]==render(data,ROOT/'extension').split('</script>',1)[1]
        browser.close()
    assert filename('CON')=='_CON' and filename('../a:b?')=='..ab'
    print('PASS: shared renderer, offline images, rich text, safe content, filters, notes, mobile, basic redaction and exam filenames')


if __name__=='__main__': main()
