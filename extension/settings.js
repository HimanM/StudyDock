(async () => {
  const defaults = {desktopIntegration:true, notesEnabled:true, examToolbar:true, focusReview:true, fullHeight:false,
    hidePause:false, keepRunning:false, darkMode:matchMedia('(prefers-color-scheme: dark)').matches};
  const values = await chrome.storage.local.get(defaults);
  const theme = dark => document.documentElement.toggleAttribute('data-dark', dark);
  theme(values.darkMode);
  const placement = document.getElementById('notesPlacement');
  placement.value = (await chrome.storage.local.get({notesPlacement:'floating'})).notesPlacement;
  placement.onchange = async () => {
    try { await chrome.storage.local.set({notesPlacement:placement.value}); document.getElementById('status').textContent = 'Notes view saved.'; }
    catch(error) { document.getElementById('status').textContent = 'Could not save: ' + error.message; placement.value = (await chrome.storage.local.get({notesPlacement:'floating'})).notesPlacement; }
  };
  document.getElementById('version').textContent = chrome.runtime.getManifest().version;
  for (const key of Object.keys(defaults)) {
    const input = document.getElementById(key); input.checked = values[key];
    input.onchange = async () => {
      try {
        await chrome.storage.local.set({[key]:input.checked});
        if (key === 'darkMode') theme(input.checked);
        document.getElementById('status').textContent = 'Saved. Open Udemy tabs update automatically.';
      } catch(error) { input.checked = !input.checked; document.getElementById('status').textContent = 'Could not save: ' + error.message; }
    };
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.notesPlacement) placement.value = changes.notesPlacement.newValue;
    for (const key of Object.keys(defaults)) if (changes[key]) document.getElementById(key).checked = changes[key].newValue;
    if (changes.darkMode) theme(changes.darkMode.newValue);
  });
})();
