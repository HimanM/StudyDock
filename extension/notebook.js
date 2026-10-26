(async () => {
  const $ = id => document.getElementById(id);
  let notes = [];
  const theme = dark => document.documentElement.toggleAttribute('data-dark', dark);
  theme((await chrome.storage.local.get({darkMode:matchMedia('(prefers-color-scheme: dark)').matches})).darkMode);
  async function tabs() {
    const current = $('tab').value; $('tab').replaceChildren();
    const groups = await chrome.tabGroups.query({});
    for (const tab of await chrome.tabs.query({url:['https://*.udemy.com/*','https://portal.tutorialsdojo.com/courses/*']})) {
      const url = new URL(tab.url), dojo = url.hostname === 'portal.tutorialsdojo.com';
      if (!dojo && !/\/learn\/quiz\/\d+\/results?(?:\/|$)/.test(url.pathname)) continue;
      const option = document.createElement('option'); option.value = tab.id;
      option.dataset.platform = dojo ? 'dojo' : 'udemy';
      const group = groups.find(group => group.id === tab.groupId)?.title;
      option.textContent = `${group ? group + ' · ' : ''}${tab.title}`; $('tab').append(option);
    }
    if ([...$('tab').options].some(option => option.value === current)) $('tab').value = current;
    $('export').disabled = !$('tab').options.length;
    $('export-status').textContent = $('tab').options.length ? 'Choose a completed attempt. For Tutorials Dojo, open its View results popup first.' : 'Open a completed Udemy test or Tutorials Dojo results popup, then refresh tabs.';
  }
  function visibleNotes() { return notes.filter(note => !$('quiz').value || note.quiz_id === $('quiz').value); }
  function renderNotes() {
    $('notes').replaceChildren(); const filtered = visibleNotes();
    $('notes-status').textContent = filtered.length ? `${filtered.length} saved note(s).` : 'No notes yet. Use Notes beside a question in Udemy.';
    $('notes-md').disabled = $('notes-json').disabled = !filtered.length;
    for (const note of filtered) {
      const article = document.createElement('article'); article.className = 'note';
      const title = document.createElement('h3'); title.textContent = `Question ${note.question_number || 'number unavailable'} · ${note.title}`;
      const text = document.createElement('pre'); text.textContent = note.text;
      const link = document.createElement('a'); link.textContent = 'Open source test';
      if (/^https:\/\/([\w-]+\.)?udemy\.com\//.test(note.source_url)) { link.href = note.source_url; link.target = '_blank'; link.rel = 'noopener'; }
      article.append(title,text,link); $('notes').append(article);
    }
  }
  async function loadNotes() {
    try {
      notes = (await StudyDockNotes.all()).sort((a,b) => a.quiz_id.localeCompare(b.quiz_id) || (a.question_number || 0) - (b.question_number || 0));
      const selected = $('quiz').value; $('quiz').replaceChildren(new Option('All tests',''));
      for (const id of new Set(notes.map(note => note.quiz_id))) $('quiz').append(new Option(`${notes.find(note => note.quiz_id === id).title} · ${id}`,id));
      if ([...$('quiz').options].some(option => option.value === selected)) $('quiz').value = selected;
      renderNotes();
    } catch(error) { $('notes-status').textContent = 'Could not read notes: ' + error.message; }
  }
  $('quiz').onchange = renderNotes;
  for (const format of ['md','json']) $('notes-' + format).onclick = () => {
    const link = StudyDockExport.downloadLink(StudyDockExport.notesFile(visibleNotes(),format));
    document.body.append(link); link.click(); setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); },60000);
  };
  $('refresh').onclick = () => tabs().catch(error => $('export-status').textContent = error.message);
  $('export').onclick = async () => {
    $('export').disabled = true; $('export-status').textContent = 'Reading questions and attaching your notes…';
    $('downloads').querySelectorAll('a').forEach(link => URL.revokeObjectURL(link.href)); $('downloads').replaceChildren();
    try {
      const tabId = Number($('tab').value);
      const dojo = $('tab').selectedOptions[0].dataset.platform === 'dojo';
      const result = await chrome.scripting.executeScript({target:{tabId},files:dojo ? ['review-content.js','dojo.js','dojo-extractor.js'] : ['review-content.js','notes-store.js','extractor.js']});
      const data = result[0]?.result; if (!data) throw new Error('No data returned. Refresh the results tab and retry.');
      if (data.error) throw new Error(data.error);
      const files = $('format').value === 'html' ? await StudyDockPortable.chunks(data,$('limit').value,$('detail').value === 'full') : StudyDockExport.chunks(data,$('format').value,$('limit').value,$('detail').value === 'full');
      files.forEach(file => $('downloads').append(StudyDockExport.downloadLink(file)));
      $('export-status').textContent = `${data.questions.length} questions ready. Click each file to save it to Downloads.${$('format').value === 'html' ? ' Linked images need internet.' : ''}`;
    } catch(error) { $('export-status').textContent = 'Export failed: ' + error.message; }
    finally { $('export').disabled = !$('tab').options.length; }
  };
  chrome.storage.onChanged.addListener((changes,area) => {
    if (area !== 'local') return;
    if (changes.darkMode) theme(changes.darkMode.newValue);
    if (Object.keys(changes).some(key => key.startsWith('studydock.note.'))) void loadNotes();
  });
  await Promise.all([tabs().catch(error => $('export-status').textContent = error.message),loadNotes()]);
})();
