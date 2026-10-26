(() => {
  try { return StudyDockDojo.extract(); }
  catch (error) { return {error:error.message}; }
})();
