// Read completed LearnDash result tables only; never start, resume or submit a quiz.
(() => {
  if (globalThis.StudyDockDojo) return;
  const text = node => (node?.textContent || '').replace(/\s+/g,' ').trim();
  const root = () => document.querySelector('#wpProQuiz_user_content');
  let clickedAttempt;
  function attemptFrom(link) {
    const row = link.closest('.ld-table-list-item-preview');
    const title = [...(row?.querySelectorAll('a[href*="/quizzes/"]') || [])].map(text).find(Boolean);
    if (!title || !/^\d+$/.test(link.dataset.quizId || '') || !/^\d+$/.test(link.dataset.refId || '')) return null;
    return {title,quiz_id:'dojo-'+link.dataset.quizId,attempt:link.dataset.refId,
      date:text(row.querySelector('.ld-table-list-column-date'))};
  }
  document.addEventListener('click',event => {
    const link = event.target.closest?.('a.user_statistic');
    if (link) clickedAttempt = attemptFrom(link);
  },true);
  function identify(panel) {
    const date = text(panel.querySelectorAll(':scope > h2')[1]);
    if (clickedAttempt) {
      if (clickedAttempt.date !== date) throw Error('The selected attempt is still loading. Wait for its results and retry.');
      return clickedAttempt;
    }
    const matches = [...document.querySelectorAll('#ld-profile a.user_statistic')].map(attemptFrom).filter(a=>a?.date === date);
    if (matches.length !== 1) throw Error('Close this results popup and reopen the desired attempt so StudyDock can identify its exam name.');
    return matches[0];
  }
  function ready() {
    const panel = root();
    return !!panel?.getClientRects().length && !!panel.querySelector('a.statistic_data');
  }
  function extract() {
    if (!ready()) throw Error('Open a completed attempt using its View results icon in Tutorials Dojo first.');
    const panel = root(), info = identify(panel), table = panel.querySelector(':scope > table');
    if (!table || text(table.tHead?.rows[0]?.cells[3]) !== 'Correct' || text(table.tHead?.rows[0]?.cells[4]) !== 'Incorrect') throw Error('Tutorials Dojo changed its result columns. Export stopped.');
    const total = table.tFoot?.rows[0];
    const count = cell => { const value = text(cell).match(/^\d+(?=\s|$)/)?.[0]; return value === undefined ? NaN : Number(value); };
    const correctTotal = count(total?.cells[3]), incorrectTotal = count(total?.cells[4]), expected = correctTotal + incorrectTotal;
    if (!Number.isSafeInteger(expected) || expected < 1) throw Error('The completed result totals are missing. Wait for the popup to finish loading.');
    const questions = []; let domain = '';
    for (const row of [...table.tBodies].flatMap(body=>[...body.rows])) {
      if (row.classList.contains('categoryTr')) {
        const spans = row.querySelectorAll('th > span');
        if (/^Category:$/i.test(text(spans[0]))) domain = text(spans[1]);
        continue;
      }
      const view = row.querySelector('a.statistic_data'); if (!view) continue;
      const number = questions.length+1, detail = row.nextElementSibling;
      const list = detail?.querySelector('ul.wpProQuiz_questionList');
      if (!list) throw Error(`Question ${number} has no loaded answer choices. Click its View button and retry.`);
      const prompt = view.parentElement.cloneNode(true); prompt.querySelectorAll('a.statistic_data').forEach(a=>a.remove());
      const promptBody = StudyDockContent.clean(prompt);
      const options = [...list.children].map((li,index) => {
        const input = li.querySelector('input');
        if (!input || !['radio','checkbox'].includes(input.type) || !input.disabled) throw Error(`Question ${number} uses an unsupported answer type. No partial export was created.`);
        const body = StudyDockContent.clean(li.querySelector('label') || li);
        if (!text(body) && !body.querySelector('img')) throw Error(`Question ${number} has an empty answer choice.`);
        return {label:String.fromCharCode(65+index),text:StudyDockContent.md(body),text_html:body.innerHTML,
          selected:input.checked,correct:li.classList.contains('wpProQuiz_answerCorrect')};
      });
      const selected_answers = options.filter(o=>o.selected).map(o=>o.label), correct_answers = options.filter(o=>o.correct).map(o=>o.label);
      if (options.length < 2 || !correct_answers.length) throw Error(`Question ${number} has no reliable correct-answer labels.`);
      const correct = count(row.cells[3]), incorrect = count(row.cells[4]);
      if (![0,1].includes(correct) || ![0,1].includes(incorrect) || correct+incorrect !== 1) throw Error(`Question ${number} has an unsupported score state.`);
      const keyMatches = JSON.stringify(selected_answers) === JSON.stringify(correct_answers);
      if ((correct === 1) !== keyMatches) throw Error(`Question ${number}: selected answers disagree with the platform's result.`);
      const status = correct ? 'correct' : selected_answers.length ? 'incorrect' : 'skipped';
      const explanationNode = detail.querySelector('.wpProQuiz_response');
      if (!explanationNode) throw Error(`Question ${number}'s explanation has not loaded. Click View and retry.`);
      const explanation = StudyDockContent.clean(explanationNode);
      const marked_for_review = row.classList.contains('reviewFlagged') || detail.classList.contains('reviewFlagged');
      questions.push({number,source_number:count(row.cells[0]),question:StudyDockContent.md(promptBody),question_html:promptBody.innerHTML,
        options,selected_answers,correct_answers,status,is_correct:correct===1,marked_for_review,
        tags:[status,...(marked_for_review ? ['marked_for_review'] : [])],domain,
        explanation:StudyDockContent.md(explanation),explanation_html:explanation.innerHTML});
    }
    if (questions.length !== expected || questions.filter(q=>q.is_correct).length !== correctTotal) throw Error('The extracted question totals disagree with Tutorials Dojo. No partial export was created.');
    return {...info,platform:'tutorialsdojo',url:location.href,expected_count:expected,questions,
      warnings:['Question numbers follow the category-sorted results, not the original exam order. source_number preserves the number shown within each category.']};
  }
  globalThis.StudyDockDojo = {extract,ready};
  globalThis.StudyDockReviewSource = {autoOpen:false,ready,title:()=>identify(root()).title,
    notice:'Question numbers follow the category-sorted results; category-local numbers are preserved in exports.',
    read:async()=>StudyDockContent.records(extract(),root().querySelector(':scope > table'))};
})();
