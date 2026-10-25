(() => {
  if (globalThis.StudyDockNoteUI) return;
  const promptSelector = '[id="question-prompt"],[data-purpose="question-prompt"]';
  const wrapper = '[class*="result-pane--question-result-pane-wrapper--"]';
  // Google Material edit_note, Apache 2.0; see icons/LICENSE-material-icons.txt.
  const noteIcon = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M3,10h11v2H3V10z M3,8h11V6H3V8z M3,16h7v-2H3V16z M18.01,12.87l0.71-0.71c0.39-0.39,1.02-0.39,1.41,0l0.71,0.71 c0.39,0.39,0.39,1.02,0,1.41l-0.71,0.71L18.01,12.87z M17.3,13.58l-5.3,5.3V21h2.12l5.3-5.3L17.3,13.58z"/></svg>';
  const minimizePath = 'M4 11h16v2H4z', expandPath = 'M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z';
  let host, shadow, current, shownStamp, targetStamp, trigger, pending = Promise.resolve(), writes = 0, failed = false, enabled = true, opening = 0;
  let placement = 'floating';
  const buttons = new WeakMap();
  const node = (tag, text) => { const element = document.createElement(tag); if (text) element.textContent = text; return element; };
  function mount() {
    if (host) return;
    host = node('aside'); host.id = 'studydock-notes';
    host.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483640;visibility:visible!important;pointer-events:auto!important';
    shadow = host.attachShadow({mode:'open'});
    shadow.innerHTML = `<style>
      :host{--surface:#fff;--field:#f2f5f9;--ink:#20252c;--muted:#596574;--line:#c6d0dd;--accent:#285ea8;--selected:#dce9fc;color-scheme:light}
      :host([data-dark]){--surface:#20252b;--field:#171c22;--ink:#eef1f6;--muted:#bbc5d3;--line:#536071;--accent:#adcaff;--selected:#2a405d;color-scheme:dark}
      *{box-sizing:border-box}[hidden]{display:none!important}
      section{width:min(480px,calc(100vw - 36px));max-height:calc(100dvh - 36px);overflow:auto;padding:20px;background:var(--surface);color:var(--ink);font:14px/1.55 system-ui;border:1px solid var(--line);border-radius:20px;box-shadow:0 12px 48px #0004;animation:enter 160ms ease-out;transition:width 160ms ease}
      :host([data-minimized]) section{width:min(320px,calc(100vw - 36px));padding:12px 16px}
      :host([data-docked]){top:12px!important;right:12px!important;bottom:12px!important;width:var(--study-notes-width)}
      :host([data-docked]) section{width:100%;height:100%;max-height:none;display:flex;flex-direction:column;box-shadow:none;padding:20px}
      :host([data-docked]) #editor{display:flex;flex:1;min-height:0;flex-direction:column}
      :host([data-docked]) textarea{flex:1;min-height:140px;max-height:none;resize:none}
      .placement{display:flex;align-items:center;gap:8px;margin:12px 0}.placement label{margin:0;font-size:12px;color:var(--muted)}
      select{font:inherit;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:8px;padding:6px;min-width:0}
      #return{margin-left:auto;font-size:12px;background:transparent;padding:6px}
      header{display:flex;justify-content:space-between;align-items:center;gap:12px}h2{font-size:17px;margin:0}p{color:var(--muted);margin:12px 0;font-size:12px}
      .actions{display:flex;gap:4px}.actions button{display:grid;place-items:center;width:36px;height:36px;padding:8px;border-radius:10px;background:transparent;color:var(--muted)}.actions button:hover{background:var(--selected);color:var(--accent)}svg{width:20px;height:20px;fill:currentColor}
      textarea{font:inherit;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px;width:100%}
      #context{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      textarea{display:block;resize:vertical;min-height:140px;max-height:60dvh;height:clamp(200px,38dvh,420px);font-size:15px;line-height:1.7;padding:16px;background:var(--field);border:2px solid transparent}textarea:focus{border-color:var(--accent);outline:none}textarea::placeholder{color:var(--muted);opacity:1}label{display:block;margin:16px 0 8px;font-size:12px}
      button{font:inherit;border:0;border-radius:20px;padding:8px 12px;background:var(--selected);color:var(--accent);cursor:pointer}footer{display:flex;align-items:center;gap:10px;margin-top:8px}output{font-size:12px;color:var(--muted);flex:1}
      :focus-visible{outline:2px solid var(--accent);outline-offset:3px}@keyframes enter{from{opacity:0;transform:translateY(8px)}}@media(prefers-reduced-motion:reduce){section{animation:none;transition:none}}
    </style><section role="region" aria-label="Question notes"><header><h2>Question notes</h2><div class="actions">
    <button id="minimize" aria-label="Minimize notes" title="Minimize notes" aria-expanded="true" aria-controls="editor"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${minimizePath}"/></svg></button>
    <button id="close" aria-label="Close notes" title="Close notes"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button></div></header>
    <div class="placement"><label for="placement">View</label><select id="placement"><option value="floating">Floating window</option><option value="docked">Right panel</option></select><button id="return" hidden></button></div>
    <div id="editor"><p id="context"></p>
    <label for="text">Your note</label><textarea id="text" maxlength="60000" placeholder="What helped you understand this question?"></textarea>
    </div><footer><output id="status" role="status">Saved in this browser</output><button id="retry" hidden>Retry save</button></footer></section>`;
    document.body.append(host);
    shadow.querySelector('#close').onclick = () => close();
    shadow.querySelector('#return').onclick = () => {
      const explain = document.querySelector('#udemy-study-review')?.shadowRoot.querySelector('[data-control="explanation"]');
      if (explain && host.hasAttribute('data-docked')) explain.click(); else close();
    };
    shadow.querySelector('#placement').onchange = async event => {
      const next = event.target.value;
      try { await chrome.storage.local.set({notesPlacement:next}); placement = next; layout(); }
      catch(error) { event.target.value = placement; shadow.querySelector('#status').textContent = 'Could not save view: ' + error.message; }
    };
    shadow.querySelector('#minimize').onclick = () => {
      const minimized = !host.hasAttribute('data-minimized');
      setMinimized(minimized);
      if (!minimized) shadow.querySelector('#text').focus();
    };
    shadow.querySelector('#text').addEventListener('input', save);
    shadow.querySelector('#retry').onclick = save;
    shadow.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
  }
  function setMinimized(minimized) {
    host.toggleAttribute('data-minimized', minimized);
    shadow.querySelector('#editor').hidden = minimized;
    const button = shadow.querySelector('#minimize');
    button.setAttribute('aria-expanded', String(!minimized));
    button.title = minimized ? 'Expand notes' : 'Minimize notes'; button.setAttribute('aria-label', button.title);
    button.querySelector('path').setAttribute('d', minimized ? expandPath : minimizePath);
    shadow.querySelector('.placement').hidden = minimized;
    layout();
  }
  function close() { if (host) host.hidden = true; layout(); trigger?.focus(); }
  function layout() {
    const docked = !!host && !host.hidden && !host.hasAttribute('data-minimized') && placement === 'docked' && innerWidth >= 1100;
    const root = document.documentElement;
    root.toggleAttribute('data-study-notes-docked',docked);
    const review = document.querySelector('#udemy-study-review');
    review?.toggleAttribute('data-notes-docked',docked);
    const explain = review?.shadowRoot.querySelector('[data-control="explanation"]');
    review?.shadowRoot.querySelector('[data-control="notes"]')?.setAttribute('aria-pressed',String(!!host && !host.hidden));
    if (explain) {
      const visible = !docked && !review.shadowRoot.querySelector('.panes')?.classList.contains('closed');
      explain.setAttribute('aria-pressed',String(visible));
      explain.setAttribute('aria-label',visible ? 'Hide explanation' : 'Show explanation');
      explain.title = visible ? 'Hide explanation' : 'Show explanation';
    }
    if (!host) return;
    host.toggleAttribute('data-docked',docked);
    shadow.querySelector('#placement').value = placement;
    const back = shadow.querySelector('#return'); back.hidden = !docked;
    back.textContent = root.hasAttribute('data-study-focus') ? 'Explanation' : 'Course sidebar';
    back.title = root.hasAttribute('data-study-focus') ? 'Switch from Notes to Explanation' : 'Close Notes and restore the course sidebar';
  }
  function save() {
    if (!current) return;
    const info = {...current};
    const text = shadow.querySelector('#text').value;
    writes++; failed = false; shadow.querySelector('#status').textContent = 'Saving…';
    pending = pending.then(() => StudyDockNotes.write(info, text)).then(() => {
      if (current?.key === info.key) shadow.querySelector('#status').textContent = 'Saved in this browser';
    }).catch(error => {
      failed = true; shadow.querySelector('#status').textContent = 'Not saved: ' + error.message;
    }).finally(() => { writes--; shadow.querySelector('#retry').hidden = !failed; });
  }
  const stampFor = (prompt,number) => JSON.stringify([location.pathname,number,StudyDockNotes.content(prompt)]);
  async function open(prompt, number, button, focus = true) {
    const request = ++opening;
    mount(); host.hidden = false; trigger = button;
    if (focus) setMinimized(false);
    shadow.querySelector('#text').disabled = true;
    try {
      const stamp = stampFor(prompt,number); targetStamp = stamp;
      const info = await StudyDockNotes.context(prompt, number);
      await pending;
      if (request !== opening) return;
      if (failed) { targetStamp = shownStamp; shadow.querySelector('#text').disabled = false; shadow.querySelector('#status').textContent = 'Still showing the previous question: save this note before switching. Retry save.'; return; }
      const record = await StudyDockNotes.read(info.key);
      if (request !== opening) return;
      current = info; shownStamp = stamp;
      shadow.querySelector('h2').textContent = number ? `Question ${number} · Notes` : 'Question notes';
      shadow.querySelector('#context').textContent = info.preview;
      shadow.querySelector('#text').value = record?.text || '';
      shadow.querySelector('#status').textContent = number ? 'Saved in this browser · shared across attempts' : 'Question number unavailable · saved with this question';
      shadow.querySelector('#text').disabled = false;
      if (focus && !host.hidden && !host.hasAttribute('data-minimized')) shadow.querySelector('#text').focus();
    } catch (error) { if (request !== opening) return; current = null; shownStamp = targetStamp = null; shadow.querySelector('#text').disabled = true; shadow.querySelector('#status').textContent = error.message; }
    theme(); layout();
  }
  function questionNumber(prompt) {
    const reviewTitle = prompt.closest(wrapper)?.querySelector('[class*="result-pane--pane-title--"]')?.textContent;
    if (reviewTitle) return Number(reviewTitle.match(/Question\s+(\d+)/i)?.[1]) || null;
    const parse = (value, bare = false) => {
      const text = value.replace(/\s+/g,' ').trim();
      const match = text.match(/^(?:Question\s+)?(\d+)\s*(?:\/|of)\s*(\d+)$/i) || text.match(/^Question\s+(\d+)$/i) || (bare && text.match(/^(\d+)$/));
      if (!match) return null;
      const number = Number(match[1]), total = match[2] ? Number(match[2]) : null;
      return Number.isSafeInteger(number) && number > 0 && (!total || number <= total) ? number : null;
    };
    const eligible = element => element.checkVisibility() && !element.closest(`${promptSelector},[data-purpose="answer-body"],[class*="explanation"],#studydock-notes,#udemy-study-review`);
    const scopes = [...new Set([prompt.closest('[class*="quiz-view--container--"]'),prompt.closest('[data-purpose="curriculum-item-viewer-content"]'),prompt.closest('main'),document].filter(Boolean))];
    for (const scope of scopes) {
      for (const element of scope.querySelectorAll('[data-purpose="question-number"],[data-purpose*="question-counter"],[class*="question-counter"],[class*="question-count"],[class*="question-progress"],h1,h2,h3,[role="heading"]')) {
        const number = eligible(element) && parse(element.textContent,element.matches('[data-purpose="question-number"]'));
        if (number) return number;
      }
      if (scope === document) continue;
      for (const element of scope.querySelectorAll('span,p,div')) {
        if (element.children.length > 3 || !eligible(element)) continue;
        const number = parse(element.textContent);
        if (number) return number;
      }
    }
    return null;
  }
  function follow(prompt, number, button) {
    if (!host || host.hidden) return;
    trigger = button;
    if (targetStamp !== stampFor(prompt,number)) void open(prompt, number, button, false);
  }
  function theme() { host?.toggleAttribute('data-dark', document.documentElement.hasAttribute('data-study-dark')); }
  function scan() {
    document.querySelectorAll('.studydock-note-button').forEach(button => button.hidden = !enabled);
    if (!/\/learn\/(quiz|practice)\//.test(location.pathname)) { if (host) host.hidden = true; layout(); return; }
    if (!enabled) { if (host) host.hidden = true; layout(); return; }
    for (const prompt of document.querySelectorAll(promptSelector)) {
      let button = buttons.get(prompt) || prompt.nextElementSibling;
      if (!button?.isConnected || !button.classList.contains('studydock-note-button')) {
        button = node('button'); button.className = 'studydock-note-button'; button.type = 'button';
        button.innerHTML = noteIcon; button.append(document.createTextNode('Notes'));
        button.addEventListener('click', () => void open(prompt, questionNumber(prompt), button));
        prompt.after(button);
      }
      buttons.set(prompt,button);
      const exam = prompt.closest('[class*="quiz-view--container--"]');
      const mark = exam && [...exam.querySelectorAll('button')].find(node => /^(mark for review|marked for review|unmark for review)$/i.test((node.getAttribute('aria-label') || node.textContent).trim()));
      if (mark && !prompt.closest(wrapper)) {
        mark.setAttribute('data-study-mark-control','');
        if (mark.nextElementSibling !== button) mark.after(button);
      }
      align(prompt, button);
      if (!document.documentElement.hasAttribute('data-study-focus') && !prompt.closest(wrapper) && prompt.checkVisibility()) follow(prompt,questionNumber(prompt),button);
    }
    theme(); layout();
  }
  function align(prompt, button) {
    if (!prompt.getClientRects().length || !button.getClientRects().length) return;
    if (button.previousElementSibling?.hasAttribute('data-study-mark-control')) { button.style.marginLeft = '8px'; return; }
    const base = button.getBoundingClientRect().left - parseFloat(getComputedStyle(button).marginLeft);
    const textLeft = prompt.getBoundingClientRect().left + parseFloat(getComputedStyle(prompt).paddingLeft);
    button.style.marginLeft = Math.max(0, textLeft - base) + 'px';
  }
  const style = node('style'); style.textContent = `
    html{--study-notes-width:clamp(340px,30vw,440px)}
    html[data-study-notes-docked]:not([data-study-focus]) body{width:calc(100% - var(--study-notes-width) - 24px)!important}
    html[data-study-notes-docked] #udemy-study-review{right:calc(var(--study-notes-width) + 24px)!important}
    html[data-study-notes-docked]:not([data-study-focus]) :is([data-purpose="sidebar"],[class*="app--sidebar--"],[class*="sidebar--sidebar--"]){display:none!important}
    html[data-study-notes-docked]:not([data-study-focus]) [class*="app--content--"]{margin-right:0!important}
    html[data-study-notes-docked]:not([data-study-focus]) [class*="curriculum-item-footer--footer"]{right:calc(var(--study-notes-width) + 24px)!important;width:auto!important}
    [data-study-mark-control]{border-radius:20px!important;padding:8px 14px!important;font:500 14px system-ui!important;min-height:36px!important}
    html[data-study-dark] [data-study-mark-control]{color:#c1d8fa!important;background:#2a405d!important}
    .studydock-note-button{display:inline-flex;align-items:center;align-self:flex-start;justify-self:start;width:max-content!important;max-width:100%;gap:8px;margin:12px 0;padding:8px 14px;border:0;border-radius:20px;background:#dce9fc;color:#285ea8;font:500 14px system-ui;cursor:pointer}
    .studydock-note-button[hidden]{display:none!important}html[data-study-dark] .studydock-note-button{background:#2a405d!important;color:#c1d8fa!important}
    .studydock-note-button:focus-visible{outline:2px solid #81aeee;outline-offset:3px}
    .studydock-note-button svg{display:block!important;flex:0 0 20px;width:20px!important;height:20px!important;margin:0!important;fill:currentColor!important}
  `; document.head.append(style);
  let timer;
  new MutationObserver(() => { if (!timer) timer = requestAnimationFrame(() => { timer = null; scan(); }); }).observe(document.body,{childList:true,characterData:true,subtree:true});
  new MutationObserver(() => { theme(); layout(); }).observe(document.documentElement,{attributes:true,attributeFilter:['data-study-dark','data-study-focus']});
  window.addEventListener('resize', scan);
  chrome.storage.local.get({notesEnabled:true,notesPlacement:'floating'}).then(settings => { enabled = settings.notesEnabled; placement = settings.notesPlacement; scan(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.notesEnabled) { enabled = changes.notesEnabled.newValue; scan(); }
    if (area === 'local' && changes.notesPlacement) { placement = changes.notesPlacement.newValue; layout(); }
    if (current && changes[current.key] && !writes) {
      const text = changes[current.key].newValue?.text || '';
      if (shadow.querySelector('#text').value !== text) shadow.querySelector('#status').textContent = 'This note changed in another tab. Reopen Notes to load that version.';
    }
  });
  window.addEventListener('beforeunload', event => { if (writes || failed) { event.preventDefault(); event.returnValue = ''; } });
  globalThis.StudyDockNoteUI = {open, follow, close, layout, docked:() => !!host?.hasAttribute('data-docked')};
})();
