(() => {
  if (globalThis.StudyDockNoteUI) return;
  const promptSelector = '[id="question-prompt"],[data-purpose="question-prompt"]';
  const wrapper = '[class*="result-pane--question-result-pane-wrapper--"]';
  // Google Material edit_note, Apache 2.0; see icons/LICENSE-material-icons.txt.
  const noteIcon = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M3,10h11v2H3V10z M3,8h11V6H3V8z M3,16h7v-2H3V16z M18.01,12.87l0.71-0.71c0.39-0.39,1.02-0.39,1.41,0l0.71,0.71 c0.39,0.39,0.39,1.02,0,1.41l-0.71,0.71L18.01,12.87z M17.3,13.58l-5.3,5.3V21h2.12l5.3-5.3L17.3,13.58z"/></svg>';
  let host, shadow, current, trigger, pending = Promise.resolve(), writes = 0, failed = false, enabled = true, opening = 0;
  const node = (tag, text) => { const element = document.createElement(tag); if (text) element.textContent = text; return element; };
  function mount() {
    if (host) return;
    host = node('aside'); host.id = 'studydock-notes';
    host.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483640;visibility:visible!important;pointer-events:auto!important';
    shadow = host.attachShadow({mode:'open'});
    shadow.innerHTML = `<style>
      :host{--surface:#fff;--ink:#20252c;--muted:#596574;--line:#c6d0dd;--accent:#285ea8;--selected:#dce9fc;color-scheme:light}
      :host([data-dark]){--surface:#20252b;--ink:#eef1f6;--muted:#bbc5d3;--line:#536071;--accent:#adcaff;--selected:#2a405d;color-scheme:dark}
      *{box-sizing:border-box}[hidden]{display:none!important}
      section{width:min(390px,calc(100vw - 36px));padding:20px;background:var(--surface);color:var(--ink);font:14px/1.55 system-ui;border:1px solid var(--line);border-radius:20px;box-shadow:0 12px 48px #0004;animation:enter 160ms ease-out}
      header{display:flex;justify-content:space-between;align-items:center;gap:12px}h2{font-size:17px;margin:0}p{color:var(--muted);margin:12px 0;font-size:12px}
      textarea,input{font:inherit;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px;width:100%}
      textarea{resize:vertical;min-height:150px;max-height:45dvh;height:230px;line-height:1.65}label{display:block;margin:10px 0;font-size:12px}input{padding:6px;width:80px;margin-left:8px}
      button{font:inherit;border:0;border-radius:20px;padding:8px 12px;background:var(--selected);color:var(--accent);cursor:pointer}footer{display:flex;align-items:center;gap:10px;margin-top:8px}output{font-size:12px;color:var(--muted);flex:1}
      :focus-visible{outline:2px solid var(--accent);outline-offset:3px}@keyframes enter{from{opacity:0;transform:translateY(8px)}}@media(prefers-reduced-motion:reduce){section{animation:none}}
    </style><section role="region" aria-label="Question notes"><header><h2>Question notes</h2><button id="close" aria-label="Close notes">Close</button></header>
    <p id="context"></p><label id="number-label" hidden>Question number <input id="number" type="number" min="1" step="1"></label>
    <label for="text">Your note</label><textarea id="text" maxlength="60000" placeholder="What helped you understand this question?"></textarea>
    <footer><output id="status" role="status">Saved in this browser</output><button id="retry" hidden>Retry save</button></footer></section>`;
    document.body.append(host);
    shadow.querySelector('#close').onclick = () => { host.hidden = true; trigger?.focus(); };
    shadow.querySelector('#text').addEventListener('input', save);
    shadow.querySelector('#number').addEventListener('input', save);
    shadow.querySelector('#retry').onclick = save;
    shadow.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); host.hidden = true; trigger?.focus(); }
    });
  }
  function save() {
    if (!current) return;
    const info = {...current}, input = shadow.querySelector('#number');
    if (!info.question_number && input.value) {
      if (!input.checkValidity()) { failed = true; shadow.querySelector('#status').textContent = 'Enter a whole question number of 1 or more.'; return; }
      info.question_number = Number(input.value);
    }
    const text = shadow.querySelector('#text').value;
    writes++; failed = false; shadow.querySelector('#status').textContent = 'Saving…';
    pending = pending.then(() => StudyDockNotes.write(info, text)).then(() => {
      if (current?.key === info.key) shadow.querySelector('#status').textContent = 'Saved in this browser';
    }).catch(error => {
      failed = true; shadow.querySelector('#status').textContent = 'Not saved: ' + error.message;
    }).finally(() => { writes--; shadow.querySelector('#retry').hidden = !failed; });
  }
  async function open(prompt, number, button) {
    const request = ++opening;
    mount(); host.hidden = false; trigger = button;
    await pending;
    if (failed) { shadow.querySelector('#status').textContent = 'Save this note before opening another question. Retry save.'; return; }
    shadow.querySelector('#text').disabled = true;
    try {
      const info = await StudyDockNotes.context(prompt, number);
      const record = await StudyDockNotes.read(info.key);
      if (request !== opening) return;
      current = info;
      shadow.querySelector('h2').textContent = number ? `Question ${number} · Notes` : 'Question notes';
      shadow.querySelector('#context').textContent = info.preview;
      shadow.querySelector('#text').value = record?.text || '';
      shadow.querySelector('#number-label').hidden = !!number;
      shadow.querySelector('#number').value = record?.question_number || '';
      shadow.querySelector('#status').textContent = 'Saved in this browser · shared across attempts';
      shadow.querySelector('#text').disabled = false; shadow.querySelector('#text').focus();
    } catch (error) { current = null; shadow.querySelector('#text').disabled = true; shadow.querySelector('#status').textContent = error.message; }
    theme();
  }
  function theme() { host?.toggleAttribute('data-dark', document.documentElement.hasAttribute('data-study-dark')); }
  function scan() {
    document.querySelectorAll('.studydock-note-button').forEach(button => button.hidden = !enabled);
    if (!enabled) { if (host) host.hidden = true; return; }
    for (const prompt of document.querySelectorAll(promptSelector)) {
      if (prompt.nextElementSibling?.classList.contains('studydock-note-button')) continue;
      const button = node('button'); button.className = 'studydock-note-button'; button.type = 'button';
      button.innerHTML = noteIcon; button.append(document.createTextNode('Notes'));
      button.addEventListener('click', () => {
        const question = prompt.closest(wrapper);
        const heading = question?.querySelector('[class*="result-pane--pane-title--"]')?.textContent ||
          [...document.querySelectorAll('[data-purpose="question-number"],[class*="question-counter"],h1,h2,h3,[role="heading"]')]
            .map(element => element.textContent.trim()).find(value => /^Question\s+\d+(?:\s+of\s+\d+)?\s*$/i.test(value)) || '';
        void open(prompt, Number(heading.match(/Question\s+(\d+)/i)?.[1]) || null, button);
      });
      prompt.after(button);
    }
    theme();
  }
  const style = node('style'); style.textContent = `
    .studydock-note-button{display:inline-flex;align-items:center;align-self:flex-start;justify-self:start;width:max-content!important;max-width:100%;gap:8px;margin:12px 0;padding:8px 14px;border:0;border-radius:20px;background:#dce9fc;color:#285ea8;font:500 14px system-ui;cursor:pointer}
    .studydock-note-button[hidden]{display:none!important}html[data-study-dark] .studydock-note-button{background:#2a405d!important;color:#c1d8fa!important}
    .studydock-note-button:focus-visible{outline:2px solid #81aeee;outline-offset:3px}
  `; document.head.append(style);
  let timer;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(scan,120); }).observe(document.body,{childList:true,subtree:true});
  new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-study-dark']});
  chrome.storage.local.get({notesEnabled:true}).then(settings => { enabled = settings.notesEnabled; scan(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.notesEnabled) { enabled = changes.notesEnabled.newValue; scan(); }
    if (current && changes[current.key] && !writes) {
      const text = changes[current.key].newValue?.text || '';
      if (shadow.querySelector('#text').value !== text) shadow.querySelector('#status').textContent = 'This note changed in another tab. Reopen Notes to load that version.';
    }
  });
  window.addEventListener('beforeunload', event => { if (writes || failed) { event.preventDefault(); event.returnValue = ''; } });
  globalThis.StudyDockNoteUI = {open};
})();
