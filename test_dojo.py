"""Dojo result parser and shared review checks against synthetic LearnDash markup."""
from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright
from test_notebook import MOCK
ROOT=Path(__file__).parent
URL='https://portal.tutorialsdojo.com/courses/synthetic/'


def fixture():
    rows=[]
    for i in range(1,6):
        if i in (1,4): rows.append('<tr class="categoryTr"><th colspan="7"><span>Category:</span><span>Domain '+str(i)+'</span></th></tr>')
        correct=i in (1,3); skipped=i==5; marked=i in (2,3)
        cls='reviewFlagged' if marked else ''
        choices=[]
        for j in range(3):
            key=j==0 or (i==3 and j==2)
            selected=not skipped and (key if correct else j==1)
            color='wpProQuiz_answerCorrect' if key else 'wpProQuiz_answerIncorrect' if selected else ''
            choices.append(f'<li class="{color}"><label><input disabled type="{"checkbox" if i==3 else "radio"}" {"checked" if selected else ""}><p>Choice {j+1}</p></label></li>')
        rows.append(f'<tr class="{cls} hide"><th>{i if i<4 else i-3}</th><th><p>Sample question {i}</p><a href="#" class="statistic_data">(view)</a></th><th>1</th><th>{int(correct)}</th><th>{int(not correct)}</th><th>00:00:20</th><th></th></tr>')
        rows.append(f'<tr class="{cls}" style="display:none"><th colspan="7"><ul class="wpProQuiz_questionList">{"".join(choices)}</ul><div class="wpProQuiz_response"><p>Explanation {i}: <strong>author wording is not parsed as answer metadata</strong>.</p><pre><code>example {{safe}}</code></pre><table><tr><td>Nested table</td></tr></table><img src="https://media.tutorialsdojo.com/synthetic.png" alt="Diagram"></div></th></tr>')
    return '''<html><body><div id="ld-profile"><div class="ld-table-list-item-preview"><a href="/courses/synthetic/quizzes/example/">Example exam</a><span class="ld-table-list-column-date">October 25, 2026 8:00 pm</span><a class="user_statistic" data-quiz-id="39" data-ref-id="100" href="#">Results</a></div></div><div id="wpProQuiz_user_content"><h2>User statistics</h2><h2>October 25, 2026 8:00 pm</h2><table><thead><tr><th></th><th>Question</th><th>Points</th><th>Correct</th><th>Incorrect</th><th>Time</th><th>Results</th></tr></thead><tbody>'''+''.join(rows)+'''</tbody><tfoot><tr><th></th><th>Total</th><th>5</th><th>2 (40%)</th><th>3 (60%)</th><th>00:01:40</th><th>40%</th></tr></tfoot></table></div></body></html>'''


def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True)
        page=browser.new_page(viewport={'width':1280,'height':900})
        page.route('**/*',lambda route:route.fulfill(body=fixture(),content_type='text/html'))
        page.goto(URL);page.evaluate(MOCK)
        for file in ['review-content.js','dojo.js','review.js']: page.evaluate((ROOT/'extension'/file).read_text(encoding='utf-8'))
        assert page.locator('#udemy-study-review').count()==0
        page.evaluate('chrome.storage.local.set({darkMode:true})')
        page.wait_for_timeout(250)
        assert not page.locator('html').evaluate("node=>node.hasAttribute('data-study-dark')")
        assert page.locator('[data-study-native-surface],[data-study-native-ink]').count()==0
        data=page.evaluate('StudyDockDojo.extract()')
        assert data['title']=='Example exam' and data['expected_count']==5
        assert [q['status'] for q in data['questions']]==['correct','incorrect','correct','incorrect','skipped']
        assert [q['marked_for_review'] for q in data['questions']]==[False,True,True,False,False]
        assert data['questions'][2]['selected_answers']==['A','C'] and data['questions'][2]['correct_answers']==['A','C']
        assert data['questions'][3]['number']==4 and data['questions'][3]['source_number']==1
        assert all(q['explanation'] and '<pre>' in q['explanation_html'] for q in data['questions'])
        assert all('(view)' not in q['question'] for q in data['questions'])
        assert page.locator('tr.hide').count()==5  # Export must preserve filters and collapsed rows.
        page.get_by_role('button',name='Focus review',exact=True).click()
        page.get_by_role('heading',name='Question 1',exact=True).wait_for()
        page.get_by_role('button',name='Marked 2',exact=True).click()
        assert page.get_by_role('heading',name='Question 2',exact=True).is_visible()
        page.keyboard.press('ArrowRight')
        assert page.get_by_role('heading',name='Question 3',exact=True).is_visible()
        page.get_by_role('button',name='Original view',exact=True).click()
        page.locator('tfoot th').nth(3).evaluate("n=>n.textContent='1'")
        error=page.evaluate((ROOT/'extension/dojo-extractor.js').read_text())
        assert 'totals disagree' in error['error']
        page.locator('tfoot th').nth(3).evaluate("n=>n.textContent='2'")
        page.locator('.wpProQuiz_response').first.evaluate('n=>n.remove()')
        assert 'explanation has not loaded' in page.evaluate((ROOT/'extension/dojo-extractor.js').read_text())['error']
        # Production notebook and connector select the Dojo parser, including HTML downloads.
        notebook=browser.new_page()
        notebook.add_init_script('(' + MOCK + ')()')
        notebook.goto((ROOT/'extension/notebook.html').as_uri())
        notebook.evaluate("""data=>{
          window.exportFixture=data;
          chrome.tabs.query=async()=>[{id:9,title:'Example Dojo course',url:'https://portal.tutorialsdojo.com/courses/synthetic/',groupId:1}];
          chrome.scripting.executeScript=async request=>{window.injectedFiles=request.files;return [{result:exportFixture}]};
        }""",data)
        resources={name:(ROOT/'extension'/name).read_text(encoding='utf-8') for name in ['review-content.js','offline-review.js','review.js','portable-shell.html']}
        notebook.evaluate("assets=>{window.fetch=async url=>new Response(assets[String(url).split('/').pop()],{status:200})}",resources)
        notebook.get_by_role('button',name='Refresh tabs',exact=True).click()
        notebook.locator('#format').select_option('html')
        notebook.get_by_role('button',name='Prepare downloads',exact=True).click()
        link=notebook.locator('#downloads a');link.wait_for()
        assert link.get_attribute('download')=='Example exam.html'
        assert notebook.evaluate('injectedFiles')==['review-content.js','dojo.js','dojo-extractor.js']
        with notebook.expect_download() as download: link.click()
        with tempfile.TemporaryDirectory() as folder:
            target=Path(folder)/'Example exam.html';target.write_text(Path(download.value.path()).read_text(encoding='utf-8'),encoding='utf-8')
            saved=browser.new_page();saved.goto(target.as_uri())
            saved.get_by_role('heading',name='Question 1',exact=True).wait_for()
            assert saved.get_by_role('button',name='Marked 2',exact=True).is_visible()
        connector=browser.new_page()
        connector.add_init_script('(' + MOCK + ')()')
        connector.add_init_script("window.fetch=async url=>url.endsWith('/hello')?{ok:true,json:async()=>({token:'fixture'})}:new Promise(()=>{})")
        connector.goto((ROOT/'extension/connect.html').as_uri())
        connector.evaluate("""data=>{
          chrome.tabs.get=async()=>({id:9,url:'https://portal.tutorialsdojo.com/courses/synthetic/',status:'complete'});
          chrome.scripting.executeScript=async request=>{window.injectedFiles=request.files;return [{result:data}]};
          window.fetch=async(url,options)=>{window.sentResult=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true})}};
        }""",data)
        connector.evaluate("extract({id:'fixture-export',tab_id:9})")
        assert connector.evaluate('injectedFiles')==['review-content.js','dojo.js','dojo-extractor.js']
        assert connector.evaluate('sentResult.data.questions.length')==5
        assert connector.evaluate('sentResult.data.questions[1].marked_for_review') is True
        browser.close()
    print('PASS: Dojo correct/wrong/skipped/marked, multiple answers, category numbering, rich explanations, preserved filters, totals and shared UI')


if __name__=='__main__': main()
