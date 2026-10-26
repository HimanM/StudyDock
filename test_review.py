"""Developer checks: python test_review.py (requires Playwright and Chrome)."""
import json
import difflib
import struct
import zlib
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
SCRIPT = (ROOT / "extension/review.js").read_text(encoding="utf-8")
URL = "https://www.udemy.com/course/test/learn/quiz/1/result/2"


def screenshot(page, name, **options):
    if '--screenshots' in sys.argv:
        folder = ROOT / '.dev-previews'
        folder.mkdir(exist_ok=True)
        page.screenshot(path=str(folder / name), animations='disabled', **options)


def diagram_png():
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    rows = []
    for y in range(540):
        row = bytearray(b'\0')
        for x in range(960):
            color = (238, 244, 251)
            if (100 < x < 860 and 265 < y < 275) or (475 < x < 485 and 150 < y < 380):
                color = (111, 141, 179)
            if (370 < x < 590 and 60 < y < 180) or ((100 < x < 340 or 620 < x < 860) and 330 < y < 470):
                color = (167, 195, 233)
            row.extend(color)
        rows.append(row)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 960, 540, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows))) + chunk(b'IEND', b'')


def fixture(count=65):
    questions = []
    for number in range(1, count + 1):
        state = "Correct" if number % 2 else "Incorrect"
        if number == 5:
            state = "Skipped"
        marked = '<svg class="result-pane--star-rating-icon--fixture"></svg>' if number % 3 else ""
        labels = ["Your selection is correct", "", "Your selection is correct"] if state == "Correct" else ["Your answer is incorrect", "Correct answer", ""]
        if state == "Skipped":
            labels = ["", "Correct answer", ""]
        answers = "".join(f'''<div class="result-pane--answer-result-pane--fixture"><div data-purpose="answer">
          <span data-purpose="answer-result-header-user-label">{label}</span><div data-purpose="answer-body">
          <div id="answer-text"><p>Choice {i + 1} preserves <strong>rich text</strong>.</p></div></div>
          <div data-purpose="safely-set-inner-html:rich-text-viewer:html"><p>Reason for choice {i + 1}</p></div></div></div>'''
                          for i, label in enumerate(labels))
        questions.append(f'''<div class="result-pane--question-result-pane-wrapper--fixture">{marked}
          <span class="result-pane--pane-title--fixture">Question {number}</span>
          <span data-purpose="question-result-header-status-label">{state}</span>
          <div id="question-prompt"><p>A company needs a resilient application across multiple Availability Zones.
          Which approach would you recommend for question {number}?</p><pre><code>example --region eu-west-1</code></pre>
          <a href="javascript:alert(1)" onclick="alert(1)">Unsafe link</a></div>{answers}
          <div id="overall-explanation"><p>Explanation {number}. Choose an approach that protects availability without introducing unnecessary complexity.</p>
          <p><strong>Why this works</strong></p><p>The architecture distributes work across independent failure domains.</p>
          <table><tr><th>Design</th><th>Result</th></tr><tr><td>Multiple zones</td><td>Resilient</td></tr></table>
          <a href="https://docs.aws.amazon.com/">Reference documentation</a>
          <img src="https://example.org/architecture.png" alt="Architecture diagram"></div>
          <div data-purpose="domain-pane"><div class="ud-text-md">Design resilient architectures</div></div></div>''')
    return f'''<!doctype html><html><head><meta charset="utf-8"><title>Practice exam | Udemy</title></head><body>
      <main><h1 class="results-header--title--fixture">Practice exam — Results</h1>
      <div class="revamped-result-page--revamped-result-page--fixture">
      <div class="revamped-result-page--filter-area--fixture"><input id="all" type="radio" checked><label for="all">{count} all</label></div>
      {''.join(questions)}</div></main></body></html>'''


def install(page, settings=None):
    page.evaluate("""values => {
      window.settings = values; window.listeners=[];
      window.chrome={storage:{local:{get:async defaults=>({...defaults,...settings}),set:async values=>{
        Object.assign(settings,values); listeners.forEach(fn=>fn(Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{newValue:v}])),'local'));
      }},onChanged:{addListener:fn=>listeners.push(fn)}}};
    }""", settings or {})
    page.evaluate(SCRIPT)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.route("**/*", lambda route: route.fulfill(body=fixture(), content_type="text/html"))
        png = diagram_png()
        page.route("**/architecture.png", lambda route: route.fulfill(body=png, content_type="image/png"))
        page.goto(URL)
        original = page.locator("main").evaluate("n=>n.outerHTML")
        install(page)
        root = page.locator("#udemy-study-review")
        root.wait_for()
        assert root.get_by_role("heading", name="Question 1", exact=True).is_visible()
        assert root.locator(".number").count() == 65
        assert root.locator(".number.correct .dot").count() > 0
        assert root.locator(".number.incorrect .dot").count() > 0
        assert root.locator(".number").nth(4).get_attribute("class").find("skipped") >= 0
        assert root.locator(".question .option-label").all_text_contents() == ["Your answer · Correct", "Your answer · Correct"]
        assert root.locator(".explanation table").is_visible()
        assert root.locator(".explanation img").get_attribute("alt") == "Architecture diagram"
        assert root.locator(".question a").get_attribute("href") is None
        assert root.locator("[onclick]").count() == 0

        # The tray collapses without changing the current question or pane scroll.
        assert root.get_by_role("button", name="Hide question tray").get_attribute("aria-expanded") == "true"
        before_height = root.locator('.panes').bounding_box()['height']
        root.get_by_role("button", name="Hide question tray").click()
        page.wait_for_function("document.querySelector('#udemy-study-review').shadowRoot.querySelector('.tray').getBoundingClientRect().height < 1")
        assert root.locator('.panes').bounding_box()['height'] > before_height + 40
        assert root.locator('.tray').evaluate('n=>n.inert')
        assert page.evaluate('settings.questionTrayOpen') is False
        assert root.get_by_role('button', name='Next question').is_visible()
        root.get_by_role("button", name="Show question tray").click()
        assert root.locator('.number[aria-current=true]').inner_text() == '1'
        page.wait_for_function("document.querySelector('#udemy-study-review').shadowRoot.getAnimations().length === 0")

        # Real image load, modal focus, wheel/button zoom, bounded pan, reset and Escape.
        trigger = root.get_by_role('button', name='Enlarge image: Architecture diagram')
        trigger.scroll_into_view_if_needed()
        exp_scroll = root.locator('.explanation').evaluate('n=>n.scrollTop')
        trigger.focus()
        page.keyboard.press('Enter')
        viewer = root.get_by_role('dialog', name='Image viewer')
        viewer.wait_for()
        page.wait_for_function("document.querySelector('#udemy-study-review').shadowRoot.querySelector('.viewer-image').naturalWidth === 960")
        viewer.locator('.viewer-image').wait_for(state='visible')
        assert viewer.get_by_role('button', name='Zoom out').is_disabled()
        page.keyboard.press('Tab')
        assert root.evaluate("n=>!!n.shadowRoot.activeElement.closest('.viewer')")
        page.keyboard.press('Shift+Tab')
        assert root.evaluate("n=>!!n.shadowRoot.activeElement.closest('.viewer')")
        viewer.get_by_role('button', name='Zoom in').click(click_count=4, delay=40)
        assert int(viewer.locator('.zoom-level').inner_text().strip('%')) > 200
        img = viewer.locator('.viewer-image')
        before = img.evaluate('n=>n.style.transform')
        stage = viewer.locator('.image-stage').bounding_box()
        page.mouse.move(stage['x'] + stage['width']/2, stage['y'] + stage['height']/2)
        page.mouse.down()
        page.mouse.move(stage['x'] + stage['width']/2 + 180, stage['y'] + stage['height']/2 + 100, steps=5)
        page.mouse.up()
        assert img.evaluate('n=>n.style.transform') != before
        page.mouse.wheel(0, -200)
        page.wait_for_function("parseInt(document.querySelector('#udemy-study-review').shadowRoot.querySelector('.zoom-level').value) > 300")
        page.keyboard.press('ArrowRight')
        page.keyboard.press('e')
        assert root.get_by_role('heading', name='Question 1', exact=True).inner_text() == 'Question 1'
        viewer.get_by_role('button', name='Fit image', exact=True).click()
        assert viewer.locator('.zoom-level').inner_text() == '100%'
        screenshot(page, 'review-image.png')
        page.keyboard.press('Escape')
        assert viewer.count() == 0 and root.count() == 1
        assert trigger.evaluate('n=>n.getRootNode().activeElement === n')
        assert abs(root.locator('.explanation').evaluate('n=>n.scrollTop') - exp_scroll) <= 1
        # Storage/layout updates leave a live modal intact and apply safely on close.
        trigger.click()
        page.evaluate("chrome.storage.local.set({explanationSide:'left',darkMode:true})")
        assert viewer.is_visible()
        viewer.get_by_role('button', name='Close image viewer').click()
        assert 'left' in root.locator('.panes').get_attribute('class')
        assert trigger.evaluate('n=>n.getRootNode().activeElement === n')
        page.evaluate("chrome.storage.local.set({explanationSide:'right',darkMode:false})")
        # A broken image offers a recoverable error instead of an empty viewer.
        trigger.evaluate("n=>n.src='https://example.org/broken.png'")
        trigger.click()
        viewer.get_by_text('This image could not load.', exact=False).wait_for()
        assert viewer.get_by_role('button', name='Zoom in').is_disabled()
        viewer.get_by_role('button', name='Close image viewer').click()

        root.get_by_role("button", name="Wrong 32", exact=True).click()
        assert root.get_by_role("heading", name="Question 2", exact=True).is_visible()
        root.get_by_role("button", name="Next question", exact=True).click()
        assert root.get_by_role("heading", name="Question 4", exact=True).is_visible()
        assert root.locator(".number").count() == 65
        assert root.locator(".number.dim").count() == 33
        root.locator(".number").nth(0).click()
        assert root.get_by_role("button", name="All 65", exact=True).get_attribute("aria-pressed") == "true"
        root.get_by_role("button", name="Marked 44", exact=True).click()
        root.get_by_role("button", name="Next question", exact=True).click()
        assert root.get_by_role("heading", name="Question 2", exact=True).is_visible()
        page.keyboard.press("ArrowRight")
        assert root.get_by_role("heading", name="Question 4", exact=True).is_visible()
        page.keyboard.press("e")
        assert root.locator(".explanation").is_hidden()
        page.keyboard.press("e")
        root.locator(".settings > summary").click()
        root.get_by_role("button", name="Move explanation left", exact=True).click()
        assert "left" in root.locator(".panes").get_attribute("class")
        splitter = root.get_by_role("separator")
        splitter.focus()
        page.keyboard.press("ArrowRight")
        assert page.evaluate("settings.explanationWidth") == 44
        assert root.get_by_role("heading", name="Question 4", exact=True).is_visible()
        box = splitter.bounding_box()
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + 30)
        page.mouse.down()
        page.mouse.move(650, box["y"] + 30, steps=8)
        page.mouse.up()
        assert 44 <= page.evaluate("settings.explanationWidth") <= 50
        root.get_by_role("button", name="Dark mode", exact=True).click()
        assert page.locator("html").get_attribute("data-study-dark") == ""
        assert root.get_attribute("data-dark") == ""
        settings = page.evaluate("settings")
        assert settings["explanationSide"] == "left"
        assert settings["reviewCursor"]["number"] == 4
        screenshot(page, 'review-desktop.png')
        root.get_by_role('button', name='Hide question tray').click()
        settings = page.evaluate('settings')

        root.get_by_role("button", name="Original view", exact=True).click()
        assert root.count() == 0
        # Playwright's screenshot caret handling can leave an empty style on inputs.
        restored = page.locator("main").evaluate("n=>{const copy=n.cloneNode(true);copy.querySelectorAll('[style=\"\"]').forEach(n=>n.removeAttribute('style'));copy.querySelectorAll('*').forEach(n=>{n.removeAttribute('data-study-native-surface');n.removeAttribute('data-study-native-ink');n.removeAttribute('data-study-native-answer')});return copy.outerHTML}")
        assert restored == original, '\n'.join(difflib.unified_diff(original.splitlines(), restored.splitlines()))[:2000]
        assert page.locator("main").is_visible()
        page.get_by_role("button", name="Focus review", exact=True).click()
        root.wait_for()
        assert root.get_by_role("heading", name="Question 4", exact=True).is_visible()
        # The original exporter continues to read the intact source DOM.
        page.evaluate((ROOT / "extension/review-content.js").read_text(encoding="utf-8"))
        export = page.evaluate((ROOT / "extension/extractor.js").read_text(encoding="utf-8"))
        assert len(export["questions"]) == 65, export
        assert page.evaluate("document.querySelectorAll('[class*=question-result-pane-wrapper]').length") == 65
        page.keyboard.press("Escape")
        assert root.count() == 0
        page.evaluate("chrome.storage.local.set({focusReview:false,darkMode:false})")
        assert page.locator("html").get_attribute("data-study-dark") is None

        page.reload()
        install(page, settings)
        root.wait_for()
        assert root.get_by_role("heading", name="Question 4", exact=True).is_visible()
        assert root.get_attribute("data-dark") == ""
        assert root.get_by_role("separator").get_attribute("aria-valuenow") == str(settings["explanationWidth"])
        assert root.get_by_role('button', name='Show question tray').get_attribute('aria-expanded') == 'false'
        page.goto(URL.replace("result/2", "test"))
        install(page)
        assert root.count() == 0

        page.goto(URL)
        page.locator('[data-purpose="question-result-header-status-label"]').first.evaluate("n=>n.textContent='Unknown'")
        install(page)
        page.get_by_role("button", name="Udemy changed its review layout.", exact=False).wait_for()
        assert root.count() == 0 and page.locator("main").is_visible()
        page.goto(URL)
        page.evaluate("document.querySelectorAll('[class*=star-rating-icon]').forEach(n=>n.remove())")
        install(page)
        root.wait_for()
        root.get_by_role("button", name="Marked 0", exact=True).click()
        assert root.get_by_role("heading", name="No questions match this filter").is_visible()
        root.get_by_role('button', name='Hide question tray').click()
        assert root.get_by_role('button', name='Next question').is_disabled()
        root.get_by_role('button', name='Show question tray').click()
        root.locator(".number").nth(0).click()
        assert root.get_by_role("heading", name="Question 1", exact=True).is_visible()

        page.set_viewport_size({"width": 390, "height": 844})
        page.reload()
        install(page, {"darkMode": True})
        root.wait_for()
        assert root.locator(".question").is_visible() and root.locator(".explanation").is_hidden()
        assert root.evaluate("n=>n.shadowRoot.querySelector('.workspace').scrollWidth <= innerWidth")
        assert root.locator(".number").count() == 65
        root.get_by_role("button", name="Show explanation", exact=True).click()
        assert root.locator(".explanation").is_visible()
        screenshot(page, 'review-mobile.png')
        root.get_by_role('button', name='Hide question tray').click()
        root.get_by_role('button', name='Enlarge image: Architecture diagram').click()
        viewer.wait_for()
        assert viewer.evaluate('n=>n.scrollWidth <= innerWidth')
        viewer.get_by_role('button', name='Zoom in').click()
        page.set_viewport_size({'width': 430, 'height': 800})
        page.wait_for_function("document.querySelector('#udemy-study-review').shadowRoot.querySelector('.zoom-level').value === '100%'")
        page.keyboard.press('Escape')
        assert root.count() == 1
        root.get_by_role("button", name="Hide explanation", exact=True).click()
        assert root.locator(".question").is_visible()
        # Reduced-motion sessions have no running transitions or question animations.
        page.emulate_media(reduced_motion='reduce')
        root.get_by_role('button', name='Next question').click()
        assert root.evaluate("n=>n.shadowRoot.getAnimations().length") == 0
        assert root.locator('.tray').evaluate('n=>getComputedStyle(n).transitionDuration') == '0s'
        # First-use theme follows the system, while an explicit saved choice wins.
        page.emulate_media(color_scheme='dark')
        page.reload()
        install(page)
        root.wait_for()
        assert root.get_attribute('data-dark') == ''
        page.reload()
        install(page, {'darkMode': False, 'questionTrayOpen': False})
        root.wait_for()
        assert root.get_attribute('data-dark') is None
        page.set_viewport_size({'width': 1440, 'height': 900})
        root.get_by_role('button', name='Show explanation').click()
        screenshot(page, 'review-light.png')
        # Removing the workspace while a viewer is open must remove its modal too.
        root.get_by_role('button', name='Enlarge image: Architecture diagram').click()
        page.evaluate('chrome.storage.local.set({focusReview:false})')
        assert root.count() == 0 and page.locator('main').is_visible()

        # Regression: native results with hard-coded white cards must not become light-on-white.
        page.reload()
        page.evaluate('''() => {
          const card=document.createElement('section'); card.id='native-card';
          card.style.cssText='background:rgb(255,255,255);color:rgb(32,32,32);padding:24px';
          card.innerHTML='<h2 style="color:#242424">Attempt 2</h2><p>43 of 65 correct</p><div id="colored-chart" style="background:#a6e9b7;color:#202020">Correct 66%</div><img src="https://example.org/architecture.png" alt="Native diagram">';
          document.body.prepend(card);
        }''')
        install(page, {'focusReview':False, 'darkMode':True})
        page.wait_for_function("document.querySelector('#native-card').getAttribute('data-study-native-surface') !== null")
        assert page.locator('#native-card').evaluate('n=>getComputedStyle(n).backgroundColor') == 'rgb(32, 37, 43)'
        assert page.locator('#native-card h2').evaluate('n=>getComputedStyle(n).color') == 'rgb(238, 241, 246)'
        assert page.locator('#colored-chart').evaluate('n=>getComputedStyle(n).backgroundColor') == 'rgb(166, 233, 183)'
        assert page.locator('#colored-chart').evaluate('n=>getComputedStyle(n).color') == 'rgb(32, 32, 32)'
        assert page.locator('#native-card img').evaluate('n=>getComputedStyle(n).filter') == 'none'
        page.evaluate('''() => {
          const samples=document.createElement('section'); samples.id='contrast-samples'; samples.style.cssText='background:white;color:#202020';
          samples.innerHTML='<h2 style="color:#dbe1eb">Light text on a white card</h2><p style="color:rgba(30,30,30,.4)">Low alpha caption</p><a href="#" style="color:#493e88">Dark link</a><div style="background:#ffeaa7"><span>Inherited chart label</span></div><button style="background:#6d28d9;color:white">Retake test</button>';
          document.body.append(samples);
        }''')
        page.wait_for_function("document.querySelector('#contrast-samples').hasAttribute('data-study-native-surface')")
        assert page.locator('#contrast-samples').evaluate('''root => {
          const rgb=value=>value.match(/[\\d.]+/g).slice(0,3).map(Number);
          const luminance=color=>color.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
          return [...root.querySelectorAll('h2,p,a,span,button')].every(node=>{
            let parent=node; while(getComputedStyle(parent).backgroundColor==='rgba(0, 0, 0, 0)') parent=parent.parentElement;
            const a=luminance(rgb(getComputedStyle(node).color)),b=luminance(rgb(getComputedStyle(parent).backgroundColor));
            return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5;
          });
        }''')
        page.locator('#contrast-samples p').evaluate("node=>node.style.color='#393939'")
        page.wait_for_function("getComputedStyle(document.querySelector('#contrast-samples p')).color === 'rgb(238, 241, 246)'")
        # Udemy's modern color tokens serialize as oklch()/color(), not rgb().
        page.evaluate('''() => {
          const card=document.createElement('div');card.id='modern-colors';
          card.style.cssText='background:oklch(100% 0 0);color:oklch(30% 0 0);padding:24px';
          card.innerHTML='<h2 style="color:color-mix(in srgb, #eee 90%, white)">Modern white card</h2><p>Modern dark ink</p><div id="modern-chart" style="background:oklch(90% .1 140);color:oklch(20% 0 0)">Colored chart</div>';
          document.body.prepend(card);
        }''')
        page.wait_for_function("document.querySelector('#modern-colors').hasAttribute('data-study-native-surface')")
        assert page.locator('#modern-colors').evaluate('node=>getComputedStyle(node).backgroundColor') == 'rgb(32, 37, 43)'
        assert page.locator('#modern-colors p').evaluate('node=>getComputedStyle(node).color') == 'rgb(238, 241, 246)'
        assert page.locator('#modern-chart').get_attribute('data-study-native-surface') is None
        page.evaluate('''() => {
          const chart=document.createElement('section'); chart.className='domain-progress-chart';
          chart.style.background='white'; chart.id='pastel-progress';
          chart.innerHTML='<div id="progress-correct" style="background:#e8f9f3;color:#006d6d;width:70%">70%</div><div id="progress-wrong" style="background:#ffeded;color:#a50000;width:30%">30%</div>';
          document.body.prepend(chart);
        }''')
        page.wait_for_function("document.querySelector('#pastel-progress').hasAttribute('data-study-native-surface')")
        assert page.locator('#pastel-progress').evaluate('node=>getComputedStyle(node).backgroundColor')=='rgb(32, 37, 43)'
        assert page.locator('#progress-correct').evaluate('node=>getComputedStyle(node).backgroundColor')=='rgb(232, 249, 243)'
        assert page.locator('#progress-wrong').evaluate('node=>getComputedStyle(node).backgroundColor')=='rgb(255, 237, 237)'
        assert page.locator('#progress-correct').get_attribute('data-study-native-surface') is None
        assert page.locator('#progress-wrong').get_attribute('data-study-native-surface') is None
        page.evaluate('''() => {
          const samples=document.createElement('section'); samples.id='answer-highlights';
          samples.innerHTML='<div class="result-pane--answer-result-pane--fixture" style="background:white;border:1px solid pink"><span data-purpose="answer-result-header-user-label">Your answer is incorrect</span><pre style="background:white;color:#222">{ "example": "incorrect" }</pre></div><div class="result-pane--answer-result-pane--fixture" style="background:white;border:1px solid green"><span data-purpose="answer-result-header-user-label">Correct answer</span><pre style="background:white;color:#222">{ "example": "correct" }</pre></div>';
          document.body.prepend(samples);
        }''')
        page.wait_for_function("document.querySelectorAll('#answer-highlights [data-study-native-answer]').length===2")
        assert page.locator('#answer-highlights [data-study-native-answer=incorrect]').evaluate('node=>getComputedStyle(node).backgroundColor')=='rgb(59, 43, 48)'
        assert page.locator('#answer-highlights [data-study-native-answer=correct]').evaluate('node=>getComputedStyle(node).backgroundColor')=='rgb(37, 56, 47)'
        assert page.locator('#answer-highlights [data-study-native-answer=correct] pre').evaluate('node=>getComputedStyle(node).backgroundColor')=='rgb(37, 56, 47)'
        assert page.locator('#answer-highlights [data-study-native-answer=incorrect] pre').evaluate('node=>getComputedStyle(node).color')=='rgb(238, 241, 246)'
        # Scroll-driven class/style changes must never expose the original white surface.
        assert page.locator('#modern-colors').evaluate('''async node => {
          for(let i=0;i<18;i++) {
            node.style.transform=`translateY(${i % 2}px)`;
            node.classList.toggle('is-scrolling');
            await Promise.resolve();
            if(getComputedStyle(node).backgroundColor!=='rgb(32, 37, 43)') return false;
            await new Promise(requestAnimationFrame);
            if(getComputedStyle(node).backgroundColor!=='rgb(32, 37, 43)') return false;
          }
          return true;
        }''')
        page.locator('#modern-colors').evaluate("node=>node.style.background='#a6e9b7'")
        page.wait_for_function("getComputedStyle(document.querySelector('#modern-colors')).backgroundColor==='rgb(166, 233, 183)'")
        assert page.locator('#modern-colors').get_attribute('data-study-native-surface') is None
        screenshot(page,'native-contrast.png')
        page.evaluate('''() => {
          const style=document.createElement('style');
          style.textContent='#exam-options label {display:block;padding:20px;margin:10px;border:1px solid #888;color:#e0e4eb} #exam-options label:hover,#exam-options label:focus-within,#exam-options label:has(input:checked),#exam-role[aria-checked=true] {background:#f6f7f9}';
          document.head.append(style);
          const options=document.createElement('section');options.id='exam-options';
          options.innerHTML='<label><input type="radio" name="answer" value="one"> First answer</label><label><input type="radio" name="answer" value="two"> Second answer</label><div id="exam-role" role="checkbox" aria-checked="false" tabindex="0">Custom answer</div>';
          document.body.prepend(options);
        }''')
        first_answer = page.locator('#exam-options label').first
        second_answer = page.locator('#exam-options label').nth(1)
        second_answer.hover()
        page.wait_for_function("getComputedStyle(document.querySelectorAll('#exam-options label')[1]).backgroundColor==='rgb(32, 37, 43)'")
        second_answer.locator('input').check()
        assert second_answer.evaluate("node=>getComputedStyle(node).backgroundColor") == 'rgb(42, 64, 93)'
        first_answer.locator('input').check()
        assert first_answer.evaluate("node=>getComputedStyle(node).backgroundColor") == 'rgb(42, 64, 93)'
        assert not second_answer.locator('input').is_checked()
        second_answer.locator('input').focus()
        page.wait_for_function("getComputedStyle(document.querySelectorAll('#exam-options label')[1]).backgroundColor==='rgb(32, 37, 43)'")
        page.locator('#exam-role').evaluate("node=>node.setAttribute('aria-checked','true')")
        assert page.locator('#exam-role').evaluate("node=>getComputedStyle(node).backgroundColor") == 'rgb(42, 64, 93)'
        page.evaluate("chrome.storage.local.set({darkMode:false})")
        assert first_answer.evaluate("node=>getComputedStyle(node).backgroundColor") == 'rgb(246, 247, 249)'
        assert page.locator('#native-card').evaluate('n=>getComputedStyle(n).backgroundColor') == 'rgb(255, 255, 255)'
        assert page.locator('[data-study-native-surface],[data-study-native-ink]').count() == 0
        assert page.locator('[data-study-native-answer]').count()==0

        popup = browser.new_page(viewport={'width': 350, 'height': 660})
        popup.on('pageerror', lambda error: errors.append(str(error)))
        popup.add_init_script('''window.saved = {darkMode:true}; window.chrome = {
          storage:{local:{get:async defaults=>({...defaults,...saved}),set:async values=>Object.assign(saved,values)},onChanged:{addListener:()=>{}}},
          tabs:{query:async()=>[]}, scripting:{executeScript:async()=>{}}, runtime:{getURL:path=>path}};''')
        popup.goto((ROOT / 'extension/popup.html').resolve().as_uri())
        popup.wait_for_function("document.documentElement.hasAttribute('data-dark')")
        assert popup.locator('#darkMode').is_checked()
        assert popup.locator('input[role=switch]').count() == 5
        assert popup.evaluate('document.documentElement.scrollWidth === innerWidth')
        assert popup.evaluate('document.body.scrollHeight < 600')
        popup.get_by_text('Exam controls',exact=True).click()
        popup.locator('#keepRunning').check()
        popup.wait_for_function('saved.keepRunning === true')
        screenshot(popup, 'review-popup.png', full_page=True)
        popup.locator('#darkMode').uncheck()
        popup.wait_for_function("!document.documentElement.hasAttribute('data-dark')")

        connection = browser.new_page(viewport={'width': 1000, 'height': 760})
        connection.on('pageerror', lambda error: errors.append(str(error)))
        connection.add_init_script('''window.listeners=[]; window.saved={darkMode:true}; window.chrome={
          runtime:{id:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'},
          storage:{local:{get:async defaults=>({...defaults,...saved}),set:async values=>{Object.assign(saved,values);listeners.forEach(fn=>fn({darkMode:{newValue:values.darkMode}},'local'));}},onChanged:{addListener:fn=>listeners.push(fn)}},
          tabs:{query:async()=>[{id:1,title:'Sample test',url:'https://www.udemy.com/course/test',groupId:1}]},tabGroups:{query:async()=>[{id:1,title:'Study'}]}};
          window.polls=0; window.fetch=async url=>{
            if(url.endsWith('/hello')) return {ok:true,json:async()=>({token:'fixture'})};
            if(++polls>1) return new Promise(()=>{});
            return {ok:true,json:async()=>({command:null})};
          };''')
        connection.goto((ROOT / 'extension/connect.html').resolve().as_uri())
        connection.get_by_text('Connected · 1 study tab(s) available', exact=True).wait_for()
        assert connection.locator('html').get_attribute('data-dark') == ''
        screenshot(connection, 'connection.png')
        connection.get_by_role('button', name='Light mode').click()
        assert connection.evaluate('saved.darkMode') is False
        connection.set_viewport_size({'width': 390, 'height': 844})
        assert connection.evaluate('document.documentElement.scrollWidth <= innerWidth')
        connection.evaluate("window.fetch=async()=>{throw new Error('Fixture connection error')}; polling=false; void poll()")
        connection.get_by_text('Waiting for the desktop app', exact=True).wait_for()
        assert connection.locator('#error-details').is_visible()
        assert connection.locator('#connection-error').text_content() == 'Fixture connection error'
        assert errors == [], errors
        browser.close()
    print("PASS: 65-question navigation, filters, combined marks, keyboard/drag resizing, persistence, dark mode,")
    print("      safe rich content, original view, exporter compatibility, unknown/empty states and mobile layout")
    print("PASS: real image zoom/pan/fit, focus containment, Escape/scroll restoration, deferred layout updates,")
    print("      image errors, saved tray, reduced motion, system appearance and popup theme/settings")


if __name__ == "__main__":
    main()
