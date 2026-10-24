(async () => {
  const text = node => (node?.textContent || "").replace(/\s+/g, " ").trim();
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const waitFor = (check, message) => new Promise((resolve, reject) => {
    if (check()) { resolve(); return; }
    const observer = new MutationObserver(() => {
      if (check()) { observer.disconnect(); clearTimeout(timeout); resolve(); }
    });
    const timeout = setTimeout(() => { observer.disconnect(); reject(new Error(message)); }, 45000);
    observer.observe(document.body, {childList: true, subtree: true, attributes: true});
  });
  const wrapper = '[class*="result-pane--question-result-pane-wrapper--"]';
  const rich = '[data-purpose="safely-set-inner-html:rich-text-viewer:html"]';
  const clean = value => value.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const url = value => {
    try { const u = new URL(value, location.href); return /^https?:$/.test(u.protocol) ? u.href : ""; }
    catch { return ""; }
  };
  // Preserve diagrams, links, tables and code instead of flattening to innerText.
  function md(node) {
    if (!node) return "";
    if (node.nodeType === 3) return node.textContent.replace(/\s+/g, " ");
    if (node.nodeType !== 1 || /^(SCRIPT|STYLE|SVG|BUTTON)$/.test(node.tagName)) return "";
    const body = () => [...node.childNodes].map(md).join("");
    switch (node.tagName) {
      case "BR": return "\n";
      case "IMG": {
        const src = url(node.getAttribute("data-src") || node.getAttribute("src") || node.currentSrc);
        return src ? `\n![${(node.alt || "Question diagram").replace(/[\[\]]/g, "")}](${src.replace(/\(/g, "%28").replace(/\)/g, "%29")})\n` : "[Image unavailable]";
      }
      case "A": { const href = url(node.getAttribute("href")); return href ? `[${body().trim()}](<${href}>)` : body(); }
      case "STRONG": case "B": return `**${body().trim()}**`;
      case "EM": case "I": return `*${body().trim()}*`;
      case "PRE": return `\n\n\`\`\`\`\n${node.textContent.trim()}\n\`\`\`\`\n\n`;
      case "CODE": return `\`\`${node.textContent.trim()}\`\``;
      case "UL": case "OL": return "\n" + [...node.children].map((li, i) =>
        `${node.tagName === "OL" ? `${i + 1}.` : "-"} ${clean(md(li)).replace(/\n/g, "\n  ")}`).join("\n") + "\n\n";
      case "TABLE": {
        const rows = all("tr", node).map(row => [...row.cells].map(cell => clean(md(cell)).replace(/\n/g, "<br>").replace(/\|/g, "\\|")));
        if (!rows.length) return "";
        const width = Math.max(...rows.map(row => row.length));
        const line = row => "| " + Array.from({length: width}, (_, i) => row[i] || "").join(" | ") + " |";
        return "\n\n" + [line(rows[0]), line(Array(width).fill("---")), ...rows.slice(1).map(line)].join("\n") + "\n\n";
      }
      case "P": case "DIV": case "BLOCKQUOTE": return "\n\n" + body() + "\n\n";
      default: return body();
    }
  }
  try {
    if (!/\/learn\/quiz\/\d+\/results?(?:\/|$)/.test(location.pathname)) {
      throw new Error("Open a completed practice test's Results or Review questions page. In-progress tests are not exported.");
    }
    if (!document.querySelector(wrapper)) {
      const buttons = all('[data-purpose="review-questions-button"]').filter(b => b.getClientRects().length);
      if (buttons.length !== 1) throw new Error("Expand the desired attempt, click Review questions in Udemy, then retry.");
      buttons[0].click();
      await waitFor(() => document.querySelector(wrapper), "The review page did not load. Open Review questions and retry.");
    }
    const review = document.querySelector('[class*="revamped-result-page--revamped-result-page--"]') || document.querySelector("main");
    const filters = review.querySelector('[class*="revamped-result-page--filter-area--"]');
    if (!filters) throw new Error("Unrecognized Udemy review layout. No export was created.");
    const domainAll = all("li button", filters).find(b => text(b) === "All domains");
    const domainTrigger = filters.querySelector('button[aria-expanded]');
    if (domainAll && text(domainTrigger) !== "All domains") {
      domainAll.click();
      await waitFor(() => text(domainTrigger) === "All domains", "Could not reset the domain filter.");
    }
    const allLabel = all("label", filters).find(label => /^\d+\s+all$/i.test(text(label)));
    if (!allLabel) throw new Error("Cannot verify the total question count. Use the English-language All questions view.");
    allLabel.click();
    const expected = Number(text(allLabel).match(/\d+/)[0]);
    const countLabel = kind => Number(text(all("label", filters).find(label => new RegExp(`^\\d+\\s+${kind}$`, "i").test(text(label)))).match(/\d+/)?.[0] ?? NaN);
    await waitFor(() => all(wrapper, review).length === expected, `Not all ${expected} questions loaded. Select All domains / All questions and retry.`);
    const expand = all("button", review).find(button => /^(Expand|Show) all questions$/i.test(text(button)));
    if (expand) expand.click();
    await waitFor(() => all(wrapper, review).every(q => q.querySelector('[id="question-prompt"]') && q.querySelector('[data-purpose="answer"]')),
      "Some questions are collapsed or still loading. Expand all questions in Udemy and retry.");
    const questions = all(wrapper, review).map((q, index) => {
      const heading = text(q.querySelector('[class*="result-pane--pane-title--"]'));
      const number = Number(heading.match(/Question\s+(\d+)/i)?.[1]);
      if (!number) throw new Error(`Cannot identify question ${index + 1}.`);
      const status = text(q.querySelector('[data-purpose="question-result-header-status-label"]')).toLowerCase();
      if (!["correct", "incorrect", "skipped", "unanswered"].includes(status)) throw new Error(`Unknown result status for question ${number}.`);
      const options = all('[data-purpose="answer"]', q).map((answer, i) => {
        const label = text(answer.querySelector('[data-purpose="answer-result-header-user-label"]')).toLowerCase();
        const optionText = clean(md(answer.querySelector('[id="answer-text"]') || answer.querySelector(`[data-purpose="answer-body"] ${rich}`)));
        if (!optionText) throw new Error(`Missing answer text in question ${number}.`);
        const correct = label === "correct answer" || /^your (answer|selection) is correct$/.test(label) || answer.className.includes("--answer-correct--");
        const selected = /^your (answer|selection)/.test(label);
        const answerContainer = answer.closest('[class*="result-pane--answer-result-pane--"]') || answer;
        const explanation = all(rich, answerContainer).filter(node => node.id !== "answer-text" && !node.closest('[data-purpose="answer-body"]'));
        return {label: String.fromCharCode(65 + i), text: optionText, selected, correct, explanation: clean(explanation.map(md).join("\n\n")) || null};
      });
      const selected_answers = options.filter(o => o.selected).map(o => o.label);
      const correct_answers = options.filter(o => o.correct).map(o => o.label);
      if (!correct_answers.length || (["correct", "incorrect"].includes(status) && !selected_answers.length)) {
        throw new Error(`Cannot reliably identify the selected/correct answers for question ${number}.`);
      }
      const matchesKey = JSON.stringify(selected_answers) === JSON.stringify(correct_answers);
      if ((status === "correct" && !matchesKey) || (status === "incorrect" && matchesKey)) {
        throw new Error(`Answer selections disagree with the result for question ${number}.`);
      }
      const marked_for_review = !!q.querySelector('[class*="result-pane--star-rating-icon--"]');
      return {number, question: clean(md(q.querySelector('[id="question-prompt"]'))), options,
        selected_answers, correct_answers, status, is_correct: status === "correct" ? true : status === "incorrect" ? false : null,
        marked_for_review, tags: [...(marked_for_review ? ["marked_for_review"] : []), status],
        explanation: clean(md(q.querySelector('[id="overall-explanation"]'))) || null,
        domain: text(q.querySelector('[data-purpose="domain-pane"] .ud-text-md')) || null};
    });
    if (new Set(questions.map(q => q.number)).size !== expected) throw new Error("Duplicate or missing question numbers; export stopped.");
    for (const [kind, actual] of [["marked", questions.filter(q => q.marked_for_review).length],
      ["correct", questions.filter(q => q.status === "correct").length], ["incorrect", questions.filter(q => q.status === "incorrect").length]]) {
      const shown = countLabel(kind);
      if (Number.isFinite(shown) && shown !== actual) throw new Error(`The ${kind} count does not match Udemy (${actual}/${shown}); export stopped.`);
    }
    const warnings = [];
    if (questions.some(q => !q.explanation)) warnings.push("Some questions have no overall explanation on this page.");
    if (questions.some(q => JSON.stringify(q).includes("!["))) warnings.push("Diagrams are preserved as image URLs. Include the images when asking an LLM about image-based questions.");
    if (globalThis.StudyDockNotes) {
      const nodes = all(wrapper, review);
      for (let index = 0; index < questions.length; index++) {
        const info = await StudyDockNotes.context(nodes[index].querySelector('[id="question-prompt"]'), questions[index].number);
        const note = await StudyDockNotes.read(info.key);
        if (note?.text?.trim()) questions[index].notes = {text:note.text, updated_at:note.updated_at};
      }
    }
    return {title: text(document.querySelector('[class*="results-header--title--"]')) || document.title,
      url: location.href, quiz_id: location.pathname.match(/\/quiz\/(\d+)/)?.[1],
      attempt: location.pathname.match(/\/result\/(\d+)/)?.[1] || new URL(location.href).searchParams.get("expanded"),
      expected_count: expected, questions, warnings};
  } catch (error) { return {error: error.message}; }
})();
