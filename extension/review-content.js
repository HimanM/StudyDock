// Shared rich content contract for live review and self-contained exports.
(() => {
  const tags = new Set('DIV P BR SPAN STRONG B EM I U S SUB SUP PRE CODE BLOCKQUOTE UL OL LI TABLE THEAD TBODY TFOOT TR TD TH H1 H2 H3 H4 H5 H6 HR A IMG'.split(' '));
  const raster = /^data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i;
  function url(value, image = false, base = location.href) {
    if (typeof value !== 'string' || !value.trim()) return '';
    if (image && raster.test(value || '')) return value;
    try { const parsed = new URL(value, base); return /^https?:$/.test(parsed.protocol) ? parsed.href : ''; } catch { return ''; }
  }
  function clean(source, base = location.href, offline = false) {
    const output = document.createElement('div');
    function append(node, parent) {
      if (node.nodeType === 3) { parent.append(document.createTextNode(node.textContent)); return; }
      if (node.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|FORM|BUTTON|INPUT|SVG|MATH|LINK|META|TEMPLATE)$/.test(node.tagName)) return;
      if (!tags.has(node.tagName)) { for (const child of node.childNodes) append(child,parent); return; }
      const copy = document.createElement(node.tagName);
      for (const name of ['alt','title','colspan','rowspan']) if (node.hasAttribute(name)) copy.setAttribute(name,node.getAttribute(name));
      if (node.tagName === 'IMG') {
        const src = url(node.getAttribute('data-src') || node.getAttribute('src') || node.currentSrc,true,base);
        if (!src) return;
        copy.src = src;
      }
      if (node.tagName === 'A') {
        const href = url(node.getAttribute('href'),false,base);
        if (href) { copy.href = href; copy.target = '_blank'; copy.rel = 'noopener noreferrer'; }
      }
      for (const child of node.childNodes) append(child,copy);
      parent.append(copy);
    }
    if (source) for (const child of source.childNodes) append(child,output);
    return output;
  }
  function fromHTML(html, fallback = '', base, offline = false) {
    if (typeof html !== 'string') { const node = document.createElement('div'); node.textContent = fallback || ''; node.style.whiteSpace = 'pre-wrap'; return node; }
    const parsed = new DOMParser().parseFromString(html,'text/html');
    return clean(parsed.body,base,offline);
  }
  function records(data, node = document.body, offline = false) {
    return data.questions.map(q => ({number:q.number,sourceNumber:q.source_number,status:q.status || 'unknown',marked:q.marked_for_review,
      prompt:fromHTML(q.question_html,q.question,data.url,offline),node,domain:q.domain,notes:q.notes,
      explanation:q.explanation || q.explanation_html ? fromHTML(q.explanation_html,q.explanation,data.url,offline) : null,
      options:q.options.map(o => ({body:fromHTML(o.text_html,o.text,data.url,offline),selected:o.selected,correct:o.correct,
        reasons:o.explanation || o.explanation_html ? [fromHTML(o.explanation_html,o.explanation,data.url,offline)] : []}))}));
  }
  const all = (selector, root) => [...root.querySelectorAll(selector)];
  const cleanMD = value => value.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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
        `${node.tagName === "OL" ? `${i + 1}.` : "-"} ${cleanMD(md(li)).replace(/\n/g, "\n  ")}`).join("\n") + "\n\n";
      case "TABLE": {
        const rows = all("tr", node).map(row => [...row.cells].map(cell => cleanMD(md(cell)).replace(/\n/g, "<br>").replace(/\|/g, "\\|")));
        if (!rows.length) return "";
        const width = Math.max(...rows.map(row => row.length));
        const line = row => "| " + Array.from({length: width}, (_, i) => row[i] || "").join(" | ") + " |";
        return "\n\n" + [line(rows[0]), line(Array(width).fill("---")), ...rows.slice(1).map(line)].join("\n") + "\n\n";
      }
      case "P": case "DIV": case "BLOCKQUOTE": return "\n\n" + body() + "\n\n";
      default: return body();
    }
  }
  globalThis.StudyDockContent = {clean,fromHTML,records,url,raster,md:node => cleanMD(md(node))};
})();
