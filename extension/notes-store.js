// Shared by content scripts, browser exports and the desktop connector.
(() => {
  if (globalThis.StudyDockNotes) return;
  const prefix = 'studydock.note.';
  function content(prompt, pageURL = location.href) {
    const text = (prompt.textContent || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
    const images = [...prompt.querySelectorAll('img')].map(image => {
      try { return new URL(image.dataset.src || image.src, pageURL).pathname; } catch { return ''; }
    });
    const scope = prompt.closest('[class*="result-pane--question-result-pane-wrapper--"],[class*="quiz-view--container--"]') || document;
    const choices = [...scope.querySelectorAll('[data-purpose="answer-body"]')].map(node =>
      (node.textContent || '').normalize('NFKC').replace(/\s+/g,' ').trim()).filter(Boolean).sort();
    return {text, images, choices};
  }
  async function context(prompt, number, pageURL = location.href) {
    const url = new URL(pageURL), quiz = url.pathname.match(/\/learn\/(?:quiz|practice)\/(\d+)/)?.[1];
    if (!quiz || !prompt) throw new Error('Cannot identify this question. Open the question in Udemy and try again.');
    const {text, images, choices} = content(prompt, pageURL);
    if (!text && !images.length) throw new Error('The question is still loading. Try again when it appears.');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([text, images, choices])));
    const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return {key: prefix + quiz + '.' + hash, quiz_id: quiz, question_number: number || null,
      title: document.querySelector('[class*="results-header--title--"]')?.textContent.trim() || document.title,
      source_url: pageURL, preview: text.slice(0,180)};
  }
  async function read(key) { return (await chrome.storage.local.get(key))[key] || null; }
  async function all() {
    return Object.entries(await chrome.storage.local.get(null)).filter(([key, value]) =>
      key.startsWith(prefix) && typeof value?.text === 'string' && value.text.trim()).map(([key, value]) => ({...value, key}));
  }
  async function write(info, text) {
    if (text.length > 60000) throw new Error('This note is too long. Keep it under 60,000 characters.');
    const record = {...info, text, updated_at: new Date().toISOString()};
    await chrome.storage.local.set({[info.key]: record});
    return record;
  }
  globalThis.StudyDockNotes = {context, content, read, all, write};
})();
