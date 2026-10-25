export const questions = [
  {number:1, question:'A practice answer was wrong. What is the most useful thing to keep for your next review?', options:['The reason the correct choice works','Only the letter of the correct answer'], selected:'B', correct:'A', explanation:'A short explanation gives you something to apply when the same idea appears in a different question.', marked:true},
  {number:2, question:'Where does StudyDock keep the question notes you write in the extension?', options:['In your Chrome profile on this device','In a shared cloud notebook'], selected:'A', correct:'A', explanation:'Notes use local extension storage. You can include them in an export or download notes by themselves.', marked:false},
];
export function exportExample(notes, format) {
  const records = questions.map(q => ({number:q.number, question:q.question, options:q.options.map((text,i)=>({label:String.fromCharCode(65+i),text})), selected_answers:[q.selected], correct_answers:[q.correct], explanation:q.explanation, marked_for_review:q.marked, notes:{text:notes[q.number] || ''}}));
  if (format === 'json') return JSON.stringify({title:'StudyDock illustrative example',questions:records},null,2);
  return '# StudyDock illustrative example\n\n' + records.map(q => `## Question ${q.number}${q.marked_for_review?' · Marked for review':''}\n\n${q.question}\n\n${q.options.map(o=>`- **${o.label}.** ${o.text}`).join('\n')}\n\nYour answer: ${q.selected_answers.join(', ')}\n\nCorrect answer: ${q.correct_answers.join(', ')}\n\n### Explanation\n\n${q.explanation}\n\n### Your notes\n\n${q.notes.text || '(No note)'}`).join('\n\n---\n\n');
}
