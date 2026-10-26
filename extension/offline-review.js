(() => {
  const data = JSON.parse(document.getElementById('studydock-data').textContent);
  document.title = data.title || 'StudyDock offline review';
  const message = document.getElementById('offline-status');
  message.textContent = 'Saved exam. Linked images need internet. Use Focus review to reopen it. ' + (data.warnings || []).join(' ');
  globalThis.StudyDockReviewSource = {
    offline:true, autoOpen:true, notice:'Saved review. Linked images need internet; questions and explanations work offline.', title:() => data.title, ready:() => true,
    read:async () => StudyDockContent.records(data,document.body,true)
  };
})();
