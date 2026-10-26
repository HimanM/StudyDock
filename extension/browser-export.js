(() => {
  function prepare(data, full, rich = false) {
    if (data.error) throw new Error(data.error);
    if (!data.questions?.length || data.expected_count !== data.questions.length) throw new Error('The question count does not match. Open All questions and retry.');
    const result = structuredClone(data);
    result.schema_version = 1; result.exported_at = new Date().toISOString(); result.mode = full ? 'full' : 'questions_and_answers';
    if (!rich) for (const question of result.questions) for (const item of [question,...question.options]) {
      for (const key of Object.keys(item)) if (key.endsWith("_html")) delete item[key];
    }
    if (!full) for (const question of result.questions) {
      for (const key of ['correct_answers','is_correct','status','explanation','explanation_html']) delete question[key];
      question.tags = (question.tags || []).filter(tag => tag === 'marked_for_review');
      for (const option of question.options) { delete option.correct; delete option.explanation; delete option.explanation_html; }
    }
    return result;
  }
  function markdown(data) {
    const lines = [`# ${data.title}`, '', `Source: ${data.url}`, `Attempt: ${data.attempt || 'Not shown'}`, `Exported: ${data.exported_at}`,
      `Part ${data.part} of ${data.parts} · ${data.questions.length} questions`, ''];
    for (const warning of data.warnings || []) lines.push('> ' + warning, '');
    for (const q of data.questions) {
      lines.push(`## Question ${q.number}`, '', `Marked for review: **${q.marked_for_review == null ? 'Unknown' : q.marked_for_review ? 'Yes' : 'No'}**`, `Tags: ${(q.tags || []).join(', ') || 'none'}`, '', q.question, '', '### Answer choices', '');
      if (q.source_number) lines.push(`Category question: ${q.source_number} · ${q.domain || ''}`, '');
      for (const option of q.options) {
        const badges = [option.selected ? 'your answer' : '', option.correct ? 'correct answer' : ''].filter(Boolean);
        lines.push(`**${option.label}.** ${option.text}${badges.length ? ' — **' + badges.join(', ') + '**' : ''}`, '');
        if (option.explanation) lines.push('Explanation: ' + option.explanation, '');
      }
      lines.push(`Your answer(s): ${q.selected_answers == null ? 'Unknown' : q.selected_answers.join(', ') || 'None'}`);
      if ('correct_answers' in q) lines.push(`Correct answer(s): ${q.correct_answers == null ? 'Unknown' : q.correct_answers.join(', ')}`, `Result: ${q.status}`, '', '### Explanation', '', q.explanation || 'Not provided by this page.');
      if (q.notes?.text) lines.push('', '### Your notes', '', q.notes.text);
      if (q.domain) lines.push('', 'Domain: ' + q.domain);
      lines.push('', '---', '');
    }
    return lines.join('\n');
  }
  function chunks(data, format, value, full) {
    const size = /^all$/i.test(value.trim()) ? data.questions?.length : Number(value);
    if (!/^all$/i.test(value.trim()) && (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(size) || size < 5)) throw new Error('Use a whole number of 5 or more, or All.');
    const result = prepare(data, full), parts = Math.ceil(result.questions.length / size), files = [];
    const stem = `StudyDock-${data.quiz_id}-${new Date().toISOString().replace(/[:.]/g,'-')}`;
    for (let start = 0; start < result.questions.length; start += size) {
      const part = {...result, part:files.length + 1, parts, questions:result.questions.slice(start,start + size)};
      files.push({name:`${stem}-${part.part}.${format}`, text:format === 'json' ? JSON.stringify(part,null,2) : markdown(part)});
    }
    return files;
  }
  function notesFile(notes, format) {
    const records = notes.map(({quiz_id,question_number,title,source_url,text,updated_at}) => ({quiz_id,question_number,title,source_url,text,updated_at}));
    const data = {schema_version:1, exported_at:new Date().toISOString(), notes:records};
    const text = format === 'json' ? JSON.stringify(data,null,2) : ['# StudyDock notes', '', ...records.flatMap(note =>
      [`## ${note.title} · Question ${note.question_number || 'number unavailable'}`, `Test: ${note.quiz_id}`, `Source: ${note.source_url}`, `Updated: ${note.updated_at}`, '', note.text, '', '---', ''])].join('\n');
    return {name:`StudyDock-notes-${new Date().toISOString().replace(/[:.]/g,'-')}.${format}`, text};
  }
  function downloadLink(file) {
    const link = document.createElement('a'); link.download = file.name; link.textContent = file.name;
    link.href = URL.createObjectURL(new Blob([file.text], {type:file.name.endsWith('.json') ? 'application/json' : file.name.endsWith('.html') ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8'}));
    return link;
  }
  globalThis.StudyDockExport = {prepare, markdown, chunks, notesFile, downloadLink};
})();
