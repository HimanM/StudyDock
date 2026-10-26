// Read-only review workspace. Original Udemy nodes stay in place for the exporter.
(() => {
  if (globalThis.udemyStudyReview) { void globalThis.udemyStudyReview(); return; }
  const defaults = {focusReview: true, darkMode: matchMedia("(prefers-color-scheme: dark)").matches, explanationOpen: innerWidth > 800,
    explanationSide: "right", explanationWidth: 42, questionTrayOpen: true, reviewCursor: null, notesEnabled: true};
  const wrapper = '[class*="result-pane--question-result-pane-wrapper--"]';
  const rich = '[data-purpose="safely-set-inner-html:rich-text-viewer:html"]';
  const text = node => (node?.textContent || "").replace(/\s+/g, " ").trim();
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const source = globalThis.StudyDockReviewSource;
  const storage = globalThis.chrome?.storage;
  const isReview = () => source ? source.ready() : /\/learn\/quiz\/\d+\/results?(?:\/|$)/.test(location.pathname);
  let settings = {...defaults}, host, shadow, questions = [], active = 0, filter = "all";
  let dismissed = "", path = location.pathname, loading = false, timer;
  let rememberedFocus = null, viewer = null, pendingRender = false;
  const style = document.createElement("style");
  style.id = "udemy-study-review-page-style";
  style.textContent = `
    html[data-study-focus] {overflow:hidden!important}
    html[data-study-focus] body > :not(#udemy-study-review):not(#studydock-notes):not(script):not(style) {visibility:hidden!important;pointer-events:none!important}
    #udemy-study-review {position:fixed;inset:0;z-index:2147483600;visibility:visible!important}
    #udemy-study-review-launch {position:fixed;right:22px;bottom:24px;z-index:2147483500;border:0;
      border-radius:24px;background:#dce9fc;color:#285ea8;padding:12px 20px;font:600 14px/1.4 system-ui;cursor:pointer;box-shadow:0 3px 15px #0002}
    html[data-study-dark] {color-scheme:dark}
    html[data-study-dark] body {background:#171b20!important;color:#e0e4eb!important}
    html[data-study-dark] [data-study-native-surface] {background-color:#20252b!important;border-color:#3c4550!important}
    html[data-study-dark] [data-study-native-answer=correct],html[data-study-dark] [data-study-native-answer=correct] [data-study-native-surface] {background-color:#25382f!important}
    html[data-study-dark] [data-study-native-answer=incorrect],html[data-study-dark] [data-study-native-answer=incorrect] [data-study-native-surface] {background-color:#3b2b30!important}
    html[data-study-dark] [data-study-native-answer=correct] {border-color:#91d6ab!important}
    html[data-study-dark] [data-study-native-answer=incorrect] {border-color:#f3a5a9!important}
    html[data-study-dark] :is(label:has(input:checked),[role=radio][aria-checked=true],[role=checkbox][aria-checked=true],[data-purpose=answer][data-checked=true]) {background-color:#2a405d!important;border-color:#adcaff!important;color:#eef1f6!important}
    html[data-study-dark] [data-study-native-ink] {color:#eef1f6!important}
    html[data-study-dark] [data-study-native-ink=dark] {color:#20252c!important}
    html[data-study-dark] a[data-study-native-ink]:not(.ud-btn) {color:#b8d3fa!important}
    html[data-study-dark] a[data-study-native-ink=dark]:not(.ud-btn) {color:#1e4b89!important}
    html[data-study-dark] #udemy-study-review-launch {background:#2a405d;color:#adcaff}
    #udemy-study-review-launch:focus-visible {outline:2px solid #285ea8;outline-offset:3px}

  `;
  document.head.append(style);

  const css = `
    :host {all:initial;display:block;color-scheme:light;
      --bg:#f0f3f7;--surface:#fff;--soft:#e7edf5;--line:#d7dfe8;--ink:#20252c;--muted:#596574;
      --accent:#285ea8;--selected:#dce9fc;--ok:#226b48;--ok-bg:#eef7f1;--bad:#a9383d;--bad-bg:#fbefef;--mark:#956400;--ring:#285ea8}
    :host([data-dark]) {color-scheme:dark;--bg:#171b20;--surface:#20252b;--soft:#2c333c;--line:#3c4550;--ink:#e0e4eb;
      --muted:#acb6c4;--accent:#adcaff;--selected:#2a405d;--ok:#91d6ab;--ok-bg:#25382f;--bad:#f3a5a9;--bad-bg:#3b2b30;--mark:#e9bd65;--ring:#adcaff}
    * {box-sizing:border-box} [hidden] {display:none!important}
    .workspace {height:100dvh;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;background:var(--bg);color:var(--ink);
      font:16px/1.65 "Segoe UI",Roboto,Arial,sans-serif}
    button,select,summary {font:inherit;color:inherit} button {cursor:pointer;border:1px solid transparent;background:transparent;
      border-radius:20px;padding:8px 16px;font-size:13px;font-weight:500;line-height:1.5;min-height:40px;
      transition:background-color 160ms,color 160ms,box-shadow 160ms,transform 160ms}
    button:hover,summary:hover {background:var(--soft)} button:active {transform:scale(.97)}
    :focus-visible {outline:2px solid var(--ring);outline-offset:3px}
    button:disabled {opacity:.4;cursor:default;transform:none} button[aria-pressed=true] {background:var(--selected);color:var(--accent)}
    .icon {width:20px;height:20px;fill:currentColor;flex:none;vertical-align:middle;pointer-events:none}
    .icon-button {padding:10px;display:inline-flex;align-items:center;justify-content:center;flex:none;width:40px;height:40px}
    .top {padding:12px 24px 4px;display:flex;align-items:center;justify-content:space-between;gap:20px}
    .heading {min-width:0;display:flex;align-items:center;gap:16px}.brand {font-size:18px;font-weight:600;letter-spacing:-.03em;white-space:nowrap}
    .title {font-size:12px;color:var(--muted);max-width:46ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .controls {display:flex;align-items:center;gap:6px}.label-button {display:inline-flex;align-items:center;gap:8px}
    .settings {position:relative;flex:none;margin:0;padding:0;border:0}.settings > summary {display:flex;list-style:none;cursor:pointer;border-radius:50%;margin:0;padding:10px;width:40px;height:40px}
    .settings > summary::-webkit-details-marker {display:none}.settings[open] > summary {background:var(--soft)}
    .settings-content {position:absolute;right:0;top:48px;z-index:3;min-width:240px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px;box-shadow:0 8px 28px #0003}
    .settings-content button {width:100%;text-align:left;border-radius:8px}.shortcut-help {border-top:1px solid var(--line);margin:8px 0 0;padding:12px 8px 4px;color:var(--muted);font-size:12px;line-height:2}
    kbd {font:inherit;color:var(--ink);padding-right:6px}
    .toolbar {padding:8px 24px 12px;display:flex;align-items:center;justify-content:space-between;gap:16px}
    .filters {display:flex;gap:4px}.filters button {padding:6px 14px;border-radius:12px;min-height:36px}
    .count {font-variant-numeric:tabular-nums;font-size:12px;color:var(--muted)}.filter-count {opacity:.8;margin-left:6px;font-variant-numeric:tabular-nums}
    .panes {display:grid;grid-template-columns:minmax(0,1fr) 12px minmax(0,var(--explanation-width,42%));min-height:0;margin:0 16px;overflow:hidden}
    .panes.left {grid-template-columns:minmax(0,var(--explanation-width,42%)) 12px minmax(0,1fr)}
    .question {grid-column:1;grid-row:1}.explanation {grid-column:3;grid-row:1}.splitter {grid-column:2;grid-row:1;cursor:col-resize;touch-action:none;position:relative;border-radius:6px}
    .splitter:after {content:"";position:absolute;left:4px;top:42%;height:40px;width:3px;background:var(--line);border-radius:3px;transition:background 160ms}
    .splitter:hover:after,.splitter:focus:after {background:var(--accent)}
    .left .question {grid-column:3}.left .explanation {grid-column:1}
    .panes.closed {grid-template-columns:minmax(0,1fr)}.closed .question {grid-column:1}.closed .explanation,.closed .splitter {display:none}
    :host([data-notes-docked]) .panes{grid-template-columns:minmax(0,1fr) 12px minmax(320px,var(--explanation-width,42%))}
    :host([data-notes-docked]) .question{grid-column:1}
    :host([data-notes-docked]) .explanation{display:none}
    :host([data-notes-docked]) .splitter{display:block}
    .notes-panel{display:none;grid-column:3;grid-row:1;min-height:0;min-width:0;overflow:auto;border-radius:20px;background:var(--surface)}
    :host([data-notes-docked]) .notes-panel{display:block}
    slot[name=notes]{display:block;height:100%}
    .panel {min-width:0;min-height:0;overflow:auto;overscroll-behavior:contain;background:var(--surface);border-radius:20px;
      scrollbar-width:thin;scrollbar-color:var(--line) transparent;scroll-padding:28px}
    .reading {max-width:78ch;margin:auto;padding:28px clamp(24px,3vw,48px) 36px}
    .eyebrow {font-size:12px;font-weight:500;color:var(--muted);display:flex;align-items:center;flex-wrap:wrap;gap:14px;margin-bottom:8px}
    .eyebrow span {display:inline-flex;align-items:center;gap:4px}.eyebrow .icon {width:16px;height:16px}
    h1 {font:500 24px/1.4 "Segoe UI",Roboto,Arial,sans-serif;margin:0;color:var(--ink);letter-spacing:-.035em}
    .prompt {font-size:17px;line-height:1.8;margin:24px 0;overflow-wrap:anywhere}
    .domain {font-size:12px;line-height:1.5;color:var(--muted);margin:4px 0 18px}
    .option {display:flex;gap:14px;padding:14px 16px;margin:10px 0;border:1px solid var(--line);border-radius:12px;font-size:15px}
    .option.correct {background:var(--ok-bg);border-color:transparent;border-left:3px solid var(--ok)}
    .option.wrong {background:var(--bad-bg);border-color:transparent;border-left:3px solid var(--bad)}
    .letter {flex:none;font-size:12px;font-weight:600;width:26px;height:26px;display:grid;place-content:center;border-radius:50%;background:var(--soft);color:var(--muted)}
    .option-body {min-width:0;flex:1;overflow-wrap:anywhere}.option .rich > :last-child {margin-bottom:0}.option-label {font-size:12px;font-weight:500;color:var(--muted);margin-bottom:3px}
    .correct .option-label,.status.correct {color:var(--ok)}.wrong .option-label,.status.incorrect {color:var(--bad)}.marked {color:var(--mark)}
    .explanation .reading {padding:28px clamp(24px,2.5vw,38px) 36px;font-size:15px;line-height:1.85}
    .explanation h2 {font-size:16px;font-weight:600;line-height:1.5;margin:0 0 24px}
    .rich {overflow-wrap:anywhere}.rich p {margin:0 0 1em}.rich strong {font-weight:600}.rich ul,.rich ol {padding-left:24px}
    .rich img {display:block;max-width:100%;height:auto;margin:20px auto;border-radius:8px;cursor:zoom-in}
    .rich img:hover {outline:2px solid var(--accent);outline-offset:3px}.rich a {color:var(--accent);text-decoration:underline;text-underline-offset:3px}
    .rich table {border-collapse:collapse;display:block;overflow:auto;max-width:100%;margin:16px 0}.rich td,.rich th {border:1px solid var(--line);padding:8px 12px;text-align:left}
    .rich pre {overflow:auto;padding:14px;background:var(--soft);border-radius:8px}.rich code {font-size:.9em;font-family:Consolas,monospace}
    .rich blockquote {border-left:3px solid var(--line);margin:16px 0;padding-left:16px}
    details {border-top:1px solid var(--line);padding-top:16px;margin-top:20px} summary {cursor:pointer;font-size:13px;font-weight:500;margin-bottom:12px;border-radius:6px}
    .empty {color:var(--muted);padding:24px 0}.bottom {padding:8px 24px 12px;background:var(--bg)}
    .nav-line {display:flex;align-items:center;justify-content:space-between;gap:12px}.tray-control {display:flex;align-items:center;gap:8px}
    .tray-toggle {display:inline-flex;align-items:center;gap:8px;color:var(--muted)}.tray-toggle .expand {transition:transform 200ms}.tray-toggle[aria-expanded=true] .expand {transform:rotate(180deg)}
    .tray {display:grid;grid-template-rows:1fr;opacity:1;transition:grid-template-rows 220ms cubic-bezier(.2,0,0,1),opacity 160ms}
    .tray.collapsed {grid-template-rows:0fr;opacity:0}.tray-inner {min-height:0;overflow:hidden}
    .numbers {display:grid;grid-template-columns:repeat(auto-fill,minmax(34px,1fr));gap:4px;max-height:126px;overflow:auto;padding:8px 3px 3px;scrollbar-width:thin}
    .number {position:relative;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;height:34px;min-height:34px;padding:3px;border-radius:9px;color:var(--muted)}
    .number.correct {color:var(--ok)}.number.incorrect {color:var(--bad)}.number.dim {opacity:.38}.number.dim:hover {opacity:1}
    .number[aria-current=true] {outline:2px solid var(--accent);outline-offset:-2px;background:var(--selected);opacity:1}
    .dot {position:absolute;right:4px;top:4px;width:5px;height:5px;border-radius:50%;background:var(--mark)}
    .viewer {position:fixed;inset:0;margin:0;width:100vw;height:100dvh;max-width:none;max-height:none;border:0;padding:0;
      background:var(--bg);color:var(--ink);font:14px/1.5 "Segoe UI",Roboto,Arial,sans-serif;overflow:hidden}
    .viewer[open] {display:grid;grid-template-rows:auto minmax(0,1fr)}.viewer::backdrop {background:#000b}
    .viewer-bar {display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;background:var(--surface)}
    .viewer-title {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
    .zoom-level {min-width:48px;text-align:center;font-size:12px;font-variant-numeric:tabular-nums;color:var(--muted)}
    .image-stage {position:relative;overflow:hidden;touch-action:none;min-height:0;user-select:none}
    .image-stage.zoomed {cursor:grab}.image-stage.dragging {cursor:grabbing}
    .viewer-image {position:absolute;left:50%;top:50%;max-width:none;max-height:none;transform-origin:center;user-select:none;-webkit-user-drag:none}
    .image-status {position:absolute;inset:0;display:grid;place-content:center;padding:24px;text-align:center;color:var(--muted);pointer-events:none}
    .panel,.workspace,.bottom,.viewer,.viewer-bar {transition:background-color 180ms,color 180ms}
    @media(max-width:1000px) {.title {display:none}}
    @media(max-width:800px) {.top {padding:8px 12px 0;gap:8px}.brand {font-size:16px}.controls {gap:2px}.toolbar {padding:8px 12px}.toolbar > .count {display:none}
      .filters {width:100%;justify-content:space-between;gap:2px}.filters button {padding:6px 10px}.panes,.panes.left {grid-template-columns:minmax(0,1fr);margin:0 8px;position:relative}
      .question,.left .question {grid-column:1}.splitter {display:none}.explanation,.left .explanation {grid-column:1;z-index:1}.panes:not(.closed) .question {visibility:hidden}
      .panel {border-radius:16px}.bottom {padding:6px 10px 10px}.numbers {max-height:90px}.reading,.explanation .reading {padding:24px 20px}.prompt {font-size:16px}
      .nav-line {gap:4px}.tray-toggle {padding:8px}.tray-toggle > .icon:first-child {display:none}.nav-line .count {white-space:nowrap}
      .viewer-bar {padding:8px;gap:4px}.viewer-title {font-size:12px}.viewer-bar .controls {gap:0}.viewer-bar .icon-button {width:36px;padding:8px}.zoom-level {min-width:40px}}
    @media(prefers-reduced-motion:reduce) {* {transition:none!important;animation:none!important;scroll-behavior:auto!important}}
  `;

  function save(values) { Object.assign(settings, values); void storage?.local.set(values); }
  function el(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = content;
    return node;
  }
  function button(label, action, className = "") {
    const node = el("button", className, label); node.type = "button";
    node.addEventListener("click", action); return node;
  }
  // Material icons by Google (Apache 2.0); see icons/LICENSE-material-icons.txt.
  const icons = {"close":"<path d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z\"/>","next":"<path d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z\"/>","previous":"<path d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z\"/>","moon":"<path d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-.89 0-1.74-.2-2.5-.55C11.56 16.5 13 14.42 13 12s-1.44-4.5-3.5-5.45C10.26 6.2 11.11 6 12 6c3.31 0 6 2.69 6 6s-2.69 6-6 6z\"/>","sun":"<path d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z\"/>","panel":"<g><rect fill=\"none\" height=\"24\" width=\"24\"/><path d=\"M16,20H2V4h14V20z M18,8h4V4h-4V8z M18,20h4v-4h-4V20z M18,14h4v-4h-4V14z\"/></g>","more":"<path d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z\"/>","swap":"<path d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z\"/>","grid":"<path d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z\"/>","expand":"<path d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z\"/>","plus":"<path d=\"M0 0h24v24H0V0z\" fill=\"none\"/><path d=\"M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z\"/><path d=\"M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z\"/>","minus":"<path d=\"M0 0h24v24H0V0z\" fill=\"none\"/><path d=\"M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z\"/>","fit":"<path d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z\"/>","check":"<path d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z\"/>","mark":"<path d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z\"/>"};
  function icon(name) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    node.setAttribute("viewBox", "0 0 24 24"); node.setAttribute("aria-hidden", "true");
    node.classList.add("icon"); node.innerHTML = icons[name]; return node;
  }
  function iconButton(label, name, action) {
    const node = button("", action, "icon-button"); node.append(icon(name));
    node.setAttribute("aria-label", label); node.title = label; return node;
  }
  function motion(node, frames) {
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.animate(frames, {duration: 180, easing: "cubic-bezier(.2,0,0,1)"});
    }
  }
  function safeURL(value) { if (source?.offline && /^data:image\/(png|jpeg|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(value || "")) return value; try { const u = new URL(value, location.href); return /^https?:$/.test(u.protocol) ? u.href : ""; } catch { return ""; } }
  function copyRich(source) {
    const result = el("div", "rich");
    if (!source) return result;
    const copy = source.cloneNode(true);
    all("script,style,iframe,object,embed,form,button,input,svg,link,meta", copy).forEach(node => node.remove());
    for (const node of [copy, ...all("*", copy)]) {
      const src = node.tagName === "IMG" ? safeURL(node.getAttribute("data-src") || node.getAttribute("src")) : "";
      const href = node.tagName === "A" ? safeURL(node.getAttribute("href")) : "";
      for (const attr of [...node.attributes]) if (!["alt", "title", "colspan", "rowspan"].includes(attr.name)) node.removeAttribute(attr.name);
      if (src) {
        node.src = src; node.loading = "eager"; node.tabIndex = 0; node.setAttribute("role", "button");
        node.setAttribute("aria-label", `Enlarge image: ${node.alt || "Question diagram"}`);
        node.title = "Open image · zoom and pan";
        node.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); openImage(node); });
        node.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); openImage(node); }
        });
      }
      if (href) { node.href = href; node.target = "_blank"; node.rel = "noopener noreferrer"; }
    }
    result.append(...copy.childNodes); return result;
  }
  function closeImage(restoreFocus = true) {
    if (!viewer) return;
    const {dialog, trigger, observer, scroll} = viewer;
    viewer = null; observer.disconnect(); dialog.close(); dialog.remove();
    const rerender = pendingRender; pendingRender = false;
    if (!restoreFocus) return;
    if (rerender) render();
    const target = trigger.isConnected ? trigger : shadow?.querySelector(`[data-control="${trigger.dataset.control}"]`);
    if (target && target.checkVisibility()) target.focus({preventScroll: true});
    else shadow?.querySelector('[data-control="explanation"]')?.focus({preventScroll: true});
    all(".panel", shadow).forEach((node, i) => { node.scrollTop = scroll[i]; });
  }
  function openImage(trigger) {
    if (viewer || !shadow) return;
    const dialog = el("dialog", "viewer"); dialog.setAttribute("aria-label", "Image viewer");
    const bar = el("header", "viewer-bar"), controls = el("div", "controls");
    bar.append(el("div", "viewer-title", trigger.alt || "Question diagram"), controls);
    const stage = el("div", "image-stage"), img = el("img", "viewer-image"), status = el("div", "image-status", "Loading image…");
    img.alt = trigger.alt || "Question diagram"; img.draggable = false; img.hidden = true;
    status.setAttribute("role", "status");
    let zoom = 1, x = 0, y = 0, baseWidth = 0, baseHeight = 0, drag;
    const level = el("output", "zoom-level", "100%"); level.setAttribute("aria-label", "Zoom relative to fit");
    const paint = () => {
      const maxX = Math.max(0, (baseWidth * zoom - stage.clientWidth) / 2);
      const maxY = Math.max(0, (baseHeight * zoom - stage.clientHeight) / 2);
      x = Math.max(-maxX, Math.min(maxX, x)); y = Math.max(-maxY, Math.min(maxY, y));
      img.style.transform = `translate(${x}px,${y}px) scale(${zoom})`;
      level.value = `${Math.round(zoom * 100)}%`;
      minus.disabled = !baseWidth || zoom <= 1; plus.disabled = !baseWidth || zoom >= 6; fitButton.disabled = !baseWidth;
      stage.classList.toggle("zoomed", zoom > 1);
    };
    const fit = () => {
      if (!img.naturalWidth) return;
      const ratio = Math.min(1, Math.max(1, stage.clientWidth - 40) / img.naturalWidth, Math.max(1, stage.clientHeight - 40) / img.naturalHeight);
      baseWidth = img.naturalWidth * ratio; baseHeight = img.naturalHeight * ratio;
      Object.assign(img.style, {width: `${baseWidth}px`, height: `${baseHeight}px`, marginLeft: `${-baseWidth / 2}px`, marginTop: `${-baseHeight / 2}px`});
      zoom = 1; x = y = 0; paint();
    };
    const changeZoom = (value, px = 0, py = 0) => {
      if (!baseWidth) return;
      const next = Math.max(1, Math.min(6, value)), ratio = next / zoom;
      x = px - (px - x) * ratio; y = py - (py - y) * ratio; zoom = next; paint();
    };
    const minus = iconButton("Zoom out", "minus", () => changeZoom(zoom / 1.25));
    const plus = iconButton("Zoom in", "plus", () => changeZoom(zoom * 1.25));
    const fitButton = iconButton("Fit image", "fit", fit);
    const close = iconButton("Close image viewer", "close", () => closeImage());
    controls.append(minus, level, plus, fitButton, close); stage.append(img, status); dialog.append(bar, stage);
    const observer = new ResizeObserver(fit);
    viewer = {dialog, trigger, observer, scroll: all(".panel", shadow).map(node => node.scrollTop)};
    shadow.append(dialog); dialog.showModal(); close.focus(); observer.observe(stage); paint();
    motion(dialog, [{opacity: 0}, {opacity: 1}]);
    img.addEventListener("load", () => { if (!dialog.isConnected) return; img.hidden = false; status.hidden = true; fit(); });
    img.addEventListener("error", () => { status.textContent = "This image could not load. Close the viewer and try again."; img.hidden = true; });
    img.src = trigger.currentSrc || trigger.src;
    dialog.addEventListener("cancel", event => { event.preventDefault(); closeImage(); });
    dialog.addEventListener("keydown", event => {
      event.stopPropagation();
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Tab") {
        const stops = all("button:not(:disabled)", dialog), current = stops.indexOf(shadow.activeElement);
        if ((event.shiftKey && current <= 0) || (!event.shiftKey && current === stops.length - 1)) {
          event.preventDefault(); stops[event.shiftKey ? stops.length - 1 : 0].focus();
        }
      }
      else if (event.key === "Escape") { event.preventDefault(); closeImage(); }
      else if (["+", "=", "-", "0", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        if (event.key === "+" || event.key === "=") changeZoom(zoom * 1.25);
        else if (event.key === "-") changeZoom(zoom / 1.25);
        else if (event.key === "0") fit();
        else { x += event.key === "ArrowLeft" ? 60 : event.key === "ArrowRight" ? -60 : 0;
          y += event.key === "ArrowUp" ? 60 : event.key === "ArrowDown" ? -60 : 0; paint(); }
      }
    });
    stage.addEventListener("wheel", event => {
      event.preventDefault(); const rect = stage.getBoundingClientRect();
      changeZoom(zoom * Math.exp(-event.deltaY * .002), event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2);
    }, {passive: false});
    stage.addEventListener("pointerdown", event => {
      if (event.button !== 0 || zoom <= 1 || drag) return;
      event.preventDefault(); stage.setPointerCapture(event.pointerId);
      drag = {id: event.pointerId, startX: event.clientX, startY: event.clientY, x, y}; stage.classList.add("dragging");
    });
    stage.addEventListener("pointermove", event => {
      if (!drag || event.pointerId !== drag.id) return;
      x = drag.x + event.clientX - drag.startX; y = drag.y + event.clientY - drag.startY; paint();
    });
    const stopDrag = () => { drag = null; stage.classList.remove("dragging"); };
    stage.addEventListener("pointerup", stopDrag); stage.addEventListener("pointercancel", stopDrag); stage.addEventListener("lostpointercapture", stopDrag);
  }
  function parseQuestions() {
    return all(wrapper).map(node => {
      const number = Number(text(node.querySelector('[class*="result-pane--pane-title--"]')).match(/Question\s+(\d+)/i)?.[1]);
      const status = text(node.querySelector('[data-purpose="question-result-header-status-label"]')).toLowerCase();
      const prompt = node.querySelector('[id="question-prompt"]');
      if (!number || !prompt || !["correct", "incorrect", "skipped", "unanswered"].includes(status)) throw Error("Udemy changed its review layout. Use the original view for now.");
      const options = all('[data-purpose="answer"]', node).map(answer => {
        const label = text(answer.querySelector('[data-purpose="answer-result-header-user-label"]')).toLowerCase();
        const body = answer.querySelector('[id="answer-text"]') || answer.querySelector(`[data-purpose="answer-body"] ${rich}`);
        if (!body) throw Error("An answer is still loading. Try Focus review again.");
        const parent = answer.closest('[class*="result-pane--answer-result-pane--"]') || answer;
        return {body, selected: /^your (answer|selection)/.test(label),
          correct: label === "correct answer" || /^your (answer|selection) is correct$/.test(label) || answer.className.includes("--answer-correct--"),
          reasons: all(rich, parent).filter(item => item.id !== "answer-text" && !item.closest('[data-purpose="answer-body"]'))};
      });
      if (!options.length) throw Error("Answers are still collapsed. Expand the questions and retry.");
      return {number, status, prompt, options, node, marked: !!node.querySelector('[class*="result-pane--star-rating-icon--"]'),
        explanation: node.querySelector('[id="overall-explanation"]'), domain: text(node.querySelector('[data-purpose="domain-pane"] .ud-text-md'))};
    });
  }
  function waitFor(check) {
    return new Promise((resolve, reject) => {
      if (check()) { resolve(); return; }
      const observer = new MutationObserver(() => { if (check()) { clearTimeout(timeout); observer.disconnect(); resolve(); } });
      const timeout = setTimeout(() => { observer.disconnect(); reject(Error("Not all review questions loaded. Choose All domains / All questions, expand them, and retry.")); }, 20000);
      observer.observe(document.body, {subtree: true, childList: true});
    });
  }
  async function openReview() {
    if (host || loading || !isReview()) return;
    loading = true;
    const launch = document.getElementById("udemy-study-review-launch");
    if (launch) { launch.textContent = "Preparing review…"; launch.disabled = true; }
    try {
      if (source) {
        questions = await source.read();
        if (!questions.length || new Set(questions.map(q => q.number)).size !== questions.length) throw Error("The result contains missing or duplicate questions.");
        if (!source.ready()) return;
        active = 0; filter = "all"; mount(); return;
      }
      let filters = document.querySelector('[class*="revamped-result-page--filter-area--"]');
      if (!filters) throw Error("Open Review questions in Udemy first.");
      const allDomain = all("li button", filters).find(node => text(node) === "All domains");
      if (allDomain && text(filters.querySelector("button[aria-expanded]")) !== "All domains") {
        allDomain.click();
        await waitFor(() => text(document.querySelector('[class*="revamped-result-page--filter-area--"] button[aria-expanded]')) === "All domains");
        filters = document.querySelector('[class*="revamped-result-page--filter-area--"]');
      }
      const allLabel = all("label", filters).find(node => /^\d+\s+all$/i.test(text(node)));
      const expected = Number(text(allLabel).match(/\d+/)?.[0]);
      if (!expected) throw Error("Could not verify question totals. Use the English-language review page.");
      if (!document.getElementById(allLabel.htmlFor)?.checked) allLabel.click();
      await waitFor(() => isReview() && all(wrapper).length === expected);
      if (all(wrapper).some(node => !node.querySelector('[id="question-prompt"]'))) {
        const expand = all("button").find(node => /^(Expand|Show) all questions$/i.test(text(node)));
        if (expand) expand.click();
      }
      await waitFor(() => all(wrapper).length === expected && all(wrapper).every(node => node.querySelector('[id="question-prompt"]') && node.querySelector('[data-purpose="answer"]')));
      if (!isReview() || !settings.focusReview) return;
      questions = parseQuestions();
      if (new Set(questions.map(q => q.number)).size !== expected) throw Error("Question totals do not match. Use the original view and retry.");
      active = Math.max(0, questions.findIndex(q => settings.reviewCursor?.path === location.pathname && q.number === settings.reviewCursor.number));
      filter = "all"; mount();
    } catch (error) {
      dismissed = location.pathname;
      if (launch) { launch.textContent = `${error.message} Click to retry`; launch.title = error.message; }
    } finally {
      loading = false;
      if (launch) { launch.disabled = false; if (launch.textContent === "Preparing review…") launch.textContent = "Focus review"; }
    }
  }
  function matches(q) { return filter === "all" || (filter === "marked" ? q.marked : q.status === filter); }
  function matchingIndexes() { return questions.map((q, i) => matches(q) ? i : -1).filter(i => i !== -1); }
  function navigate(index) {
    if (!questions[index]) return;
    if (!matches(questions[index])) filter = "all";
    active = index;
    save({reviewCursor: {path: location.pathname, number: questions[active].number}});
    render();
    shadow.querySelector("h1")?.focus({preventScroll: true});
  }
  function step(direction) {
    const indexes = matchingIndexes(), position = indexes.indexOf(active);
    if (position >= 0 && indexes[position + direction] != null) navigate(indexes[position + direction]);
  }
  function closeReview() {
    closeImage(false);
    globalThis.StudyDockNoteUI?.releaseDock();
    host?.remove(); host = shadow = null;
    document.documentElement.removeAttribute("data-study-focus");
    rememberedFocus?.focus?.({preventScroll: true}); rememberedFocus = null;
  }
  function mount() {
    rememberedFocus = document.activeElement;
    host = el("div"); host.id = "udemy-study-review";
    shadow = host.attachShadow({mode: "open"});
    shadow.addEventListener("pointerdown", event => {
      const menu = shadow.querySelector(".settings[open]");
      if (menu && !menu.contains(event.target)) menu.open = false;
    });
    document.body.append(host);
    document.documentElement.setAttribute("data-study-focus", "");
    render(); shadow.querySelector("h1")?.focus({preventScroll: true});
  }
  function render() {
    if (!host) return;
    if (viewer) { pendingRender = true; applyTheme(); return; }
    const focused = shadow.activeElement?.dataset.control;
    const previousScroll = [...shadow.querySelectorAll(".panel")].map(node => node.scrollTop);
    const sameQuestion = host.dataset.question === String(questions[active]?.number);
    const layoutChanged = host.dataset.layout !== `${settings.explanationOpen}-${settings.explanationSide}`;
    host.dataset.layout = `${settings.explanationOpen}-${settings.explanationSide}`;
    host.dataset.question = String(questions[active]?.number);
    host.toggleAttribute("data-dark", !!settings.darkMode);
    shadow.replaceChildren(); const sheet = el("style"); sheet.textContent = css; shadow.append(sheet);
    const workspace = el("section", "workspace"); workspace.setAttribute("aria-label", "Focused practice test review"); shadow.append(workspace);
    const top = el("header", "top"), heading = el("div", "heading");
    heading.append(el("div", "brand", "Review"),
      el("div", "title", source?.title() || text(document.querySelector('[class*="results-header--title--"]')) || document.title.replace(/ \| Udemy$/, "")));
    top.append(heading); const controls = el("div", "controls");
    const control = (label, name, key, action, pressed) => {
      const node = iconButton(label, name, action); node.dataset.control = key;
      if (pressed != null) node.setAttribute("aria-pressed", String(pressed)); controls.append(node); return node;
    };
    const explain = control(settings.explanationOpen ? "Hide explanation" : "Show explanation", "panel", "explanation", () => {
      if (globalThis.StudyDockNoteUI?.docked()) { StudyDockNoteUI.close(); save({explanationOpen:true}); }
      else save({explanationOpen: !settings.explanationOpen});
      render();
    }, settings.explanationOpen);
    explain.className = "label-button"; explain.append(el("span", "", "Explanation"));
    if (settings.notesEnabled && globalThis.StudyDockNoteUI && matchingIndexes().length) {
      const notes = button("Notes", () => {
        const question = questions[active];
        void StudyDockNoteUI.open(question.node.querySelector('[id="question-prompt"]'), question.number, notes);
      }, "label-button");
      notes.dataset.control = 'notes';
      controls.append(notes);
      const question = questions[active];
      StudyDockNoteUI.follow(question.node.querySelector('[id="question-prompt"]'), question.number, notes);
    }
    control(settings.darkMode ? "Light mode" : "Dark mode", settings.darkMode ? "sun" : "moon", "theme", () => { save({darkMode: !settings.darkMode}); applyTheme(); });
    const menu = el("details", "settings"), summary = el("summary");
    summary.append(icon("more")); summary.setAttribute("aria-label", "Review settings and shortcuts"); summary.title = "Settings and shortcuts"; summary.dataset.control = "settings";
    const menuContent = el("div", "settings-content");
    const side = button(settings.explanationSide === "left" ? "Move explanation right" : "Move explanation left", () => {
      save({explanationSide: settings.explanationSide === "left" ? "right" : "left"}); render();
    }, "label-button"); side.prepend(icon("swap")); side.dataset.control = "side";
    const help = el("div", "shortcut-help");
    for (const [key, label] of [["← →", "Previous / next question"], ["E", "Show / hide explanation"], ["Esc", "Close image / original view"]]) {
      const line = el("div"); line.append(el("kbd", "", key), document.createTextNode(label)); help.append(line);
    }
    menuContent.append(side, help);
    if (source?.notice) menuContent.append(el("p", "shortcut-help", source.notice));
    menu.append(summary, menuContent); controls.append(menu);
    control("Original view", "close", "exit", () => { dismissed = location.pathname; closeReview(); sync(); });
    top.append(controls); workspace.append(top);
    const toolbar = el("div", "toolbar"), filters = el("nav", "filters"); filters.setAttribute("aria-label", "Filter questions");
    for (const [key, label] of [["all", "All"], ["correct", "Correct"], ["incorrect", "Wrong"], ["marked", "Marked"]]) {
      const count = questions.filter(q => key === "all" || (key === "marked" ? q.marked : q.status === key)).length;
      const node = button("", () => {
        filter = key; const indexes = matchingIndexes();
        if (!matches(questions[active]) && indexes.length) navigate(indexes[0]); else render();
      });
      node.append(document.createTextNode(`${label} `), el("span", "filter-count", count));
      node.setAttribute("aria-pressed", String(filter === key)); node.dataset.control = `filter-${key}`; filters.append(node);
    }
    toolbar.append(filters, el("span", "count", `${matchingIndexes().length} of ${questions.length} questions`)); workspace.append(toolbar);
    const panes = el("div", `panes ${settings.explanationSide === "left" ? "left" : ""} ${settings.explanationOpen ? "" : "closed"}`);
    const width = Math.max(25, Math.min(65, Number(settings.explanationWidth) || 42)); panes.style.setProperty("--explanation-width", `${width}%`);
    const qPanel = el("main", "question panel"); qPanel.setAttribute("aria-label", "Question and answer choices");
    const content = el("div", "reading"), q = questions[active];
    if (!matchingIndexes().length) {
      content.append(el("h1", "", "No questions match this filter"), el("p", "empty", "Try All questions, or select any number below."));
    } else {
      const eyebrow = el("div", "eyebrow");
      const status = el("span", `status ${q.status}`, q.status === "correct" ? "Correct" : q.status === "incorrect" ? "Wrong" : q.status === "unknown" ? "Result unavailable" : "Unanswered");
      status.prepend(icon(q.status === "correct" ? "check" : q.status === "incorrect" ? "close" : "minus")); eyebrow.append(status);
      if (q.marked == null) eyebrow.append(el("span", "", "Review mark unavailable"));
      if (q.marked) { const marked = el("span", "marked", "Marked"); marked.prepend(icon("mark")); eyebrow.append(marked); }
      const title = el("h1", "", `Question ${q.number}`); title.tabIndex = -1;
      content.append(eyebrow, title);
      if (q.domain) content.append(el("p", "domain", q.domain + (q.sourceNumber ? ` · Category question ${q.sourceNumber}` : "")));
      const prompt = copyRich(q.prompt); prompt.classList.add("prompt"); content.append(prompt);
      q.options.forEach((option, i) => {
        const row = el("div", `option ${option.correct ? "correct" : option.selected && option.correct === false ? "wrong" : ""}`);
        row.append(el("span", "letter", String.fromCharCode(65 + i)));
        const body = el("div", "option-body");
        if (option.selected || option.correct) body.append(el("div", "option-label", option.selected ? `Your answer${option.correct == null ? "" : option.correct ? " · Correct" : " · Incorrect"}` : "Correct answer"));
        body.append(copyRich(option.body)); row.append(body); content.append(row);
      });
    }
    qPanel.append(content); panes.append(qPanel);
    const splitter = el("div", "splitter"); splitter.tabIndex = 0; splitter.role = "separator";
    splitter.dataset.control = "splitter";
    splitter.setAttribute("aria-label", "Resize explanation panel"); splitter.setAttribute("aria-orientation", "vertical");
    splitter.setAttribute("aria-valuemin", "25"); splitter.setAttribute("aria-valuemax", "65"); splitter.setAttribute("aria-valuenow", String(width));
    const resize = value => { const width = Math.max(25, Math.min(65, value)); panes.style.setProperty("--explanation-width", `${width}%`); splitter.setAttribute("aria-valuenow", String(Math.round(width))); return width; };
    splitter.addEventListener("pointerdown", event => {
      if (event.button !== 0) return; event.preventDefault(); splitter.setPointerCapture(event.pointerId);
      const move = event => { const rect = panes.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width * 100; resize(settings.explanationSide === "left" && !host.hasAttribute('data-notes-docked') ? x : 100 - x); };
      const done = () => { splitter.removeEventListener("pointermove", move); splitter.removeEventListener("pointerup", done); splitter.removeEventListener("pointercancel", done); save({explanationWidth: Number(splitter.getAttribute("aria-valuenow"))}); };
      splitter.addEventListener("pointermove", move); splitter.addEventListener("pointerup", done); splitter.addEventListener("pointercancel", done);
    });
    splitter.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const change = (event.key === "ArrowRight" ? 2 : -2) * (settings.explanationSide === "left" && !host.hasAttribute('data-notes-docked') ? 1 : -1);
      const value = event.key === "Home" ? 25 : event.key === "End" ? 65 : Number(splitter.getAttribute("aria-valuenow")) + change;
      save({explanationWidth: resize(value)});
    }); panes.append(splitter);
    const explanation = el("aside", "explanation panel"); explanation.setAttribute("aria-label", "Explanation");
    const exp = el("div", "reading"); exp.append(el("h2", "", "Explanation"));
    exp.append(matchingIndexes().length ? (q.explanation ? copyRich(q.explanation) : el("p", "empty", "No overall explanation provided for this question.")) : el("p", "empty", "Choose a question to read its explanation."));
    if (matchingIndexes().length) q.options.forEach((option, i) => {
      if (!option.reasons.length) return;
      const details = el("details"); details.append(el("summary", "", `Choice ${String.fromCharCode(65 + i)} explanation`));
      option.reasons.forEach(reason => details.append(copyRich(reason))); exp.append(details);
    });
    if (q.notes?.text && !globalThis.StudyDockNoteUI) { const note = el("details"); note.append(el("summary", "", "Your saved notes"),el("p", "", q.notes.text)); exp.append(note); }
    explanation.append(exp); panes.append(explanation);
    const notesPanel = el('div','notes-panel'), notesSlot = el('slot'); notesSlot.name = 'notes'; notesPanel.append(notesSlot); panes.append(notesPanel);
    workspace.append(panes);
    const bottom = el("footer", "bottom"), nav = el("div", "nav-line"), paging = el("div", "controls");
    const indexes = matchingIndexes(), position = indexes.indexOf(active);
    const previous = iconButton("Previous question", "previous", () => step(-1)), next = iconButton("Next question", "next", () => step(1));
    previous.dataset.control = "previous"; next.dataset.control = "next";
    previous.disabled = position <= 0; next.disabled = position < 0 || position === indexes.length - 1;
    paging.append(previous, el("span", "count", position < 0 ? "0 matching" : `${position + 1} / ${indexes.length}`), next);
    const trayToggle = button("", () => { save({questionTrayOpen: !settings.questionTrayOpen}); updateTray(); }, "tray-toggle");
    trayToggle.dataset.control = "tray"; trayToggle.setAttribute("aria-controls", "question-tray");
    const expandIcon = icon("expand"); expandIcon.classList.add("expand");
    trayToggle.append(icon("grid"), el("span", "", "Questions"), expandIcon);
    nav.append(paging, trayToggle); bottom.append(nav);
    const tray = el("div", "tray"), trayInner = el("div", "tray-inner"); tray.id = "question-tray";
    const numbers = el("nav", "numbers"); numbers.setAttribute("aria-label", "Jump to question");
    questions.forEach((question, i) => {
      const label = `Question ${question.number}, ${question.status}${question.marked ? ", marked for review" : ""}${!matches(question) ? ", outside current filter" : ""}`;
      const node = button(String(question.number), () => navigate(i), `number ${question.status} ${matches(question) ? "" : "dim"}`);
      node.setAttribute("aria-label", label); node.title = label; node.setAttribute("aria-current", String(i === active && indexes.length > 0));
      if (question.marked) { const dot = el("span", "dot"); dot.setAttribute("aria-hidden", "true"); node.append(dot); } numbers.append(node);
    }); trayInner.append(numbers); tray.append(trayInner); bottom.append(tray); workspace.append(bottom); updateTray();
    globalThis.StudyDockNoteUI?.layout();
    all(".rich img", shadow).forEach((node, i) => { node.dataset.control = `image-${i}`; });
    if (!sameQuestion) all(".reading", shadow).forEach(node => motion(node, [{opacity: .3, transform: "translateY(4px)"}, {opacity: 1, transform: "translateY(0)"}]));
    else if (layoutChanged) motion(settings.explanationOpen ? explanation : qPanel, [{opacity: .4}, {opacity: 1}]);
    if (sameQuestion) [...shadow.querySelectorAll(".panel")].forEach((node, i) => { node.scrollTop = previousScroll[i] || 0; });
    if (focused) {
      const target = shadow.querySelector(`[data-control="${focused}"]`);
      if (target?.checkVisibility()) target.focus({preventScroll: true});
      else if (focused === "side") summary.focus({preventScroll: true});
    }
  }
  function updateTray() {
    const tray = shadow?.querySelector(".tray"), toggle = shadow?.querySelector('[data-control="tray"]');
    if (!tray || !toggle) return;
    tray.classList.toggle("collapsed", !settings.questionTrayOpen); tray.inert = !settings.questionTrayOpen;
    tray.setAttribute("aria-hidden", String(!settings.questionTrayOpen));
    toggle.setAttribute("aria-expanded", String(!!settings.questionTrayOpen));
    toggle.setAttribute("aria-label", settings.questionTrayOpen ? "Hide question tray" : "Show question tray");
    toggle.title = settings.questionTrayOpen ? "Hide question tray" : "Show question tray";
  }
  let themedNodes = new WeakSet();
  const dirtyThemeNodes = new Set();
  let themeFrame;
  function scheduleTheme() {
    if (!source && !themeFrame && settings.darkMode) themeFrame = requestAnimationFrame(() => { themeFrame = null; themeNativePage(); });
  }
  function themeNativePage() {
    if (!settings.darkMode) {
      all("[data-study-native-surface],[data-study-native-ink],[data-study-native-answer]").forEach(node => {
        node.removeAttribute("data-study-native-surface"); node.removeAttribute("data-study-native-ink"); node.removeAttribute('data-study-native-answer');
      });
      themedNodes = new WeakSet(); dirtyThemeNodes.clear(); return;
    }
    const answerLabel = '[data-purpose="answer-result-header-user-label"]';
    const answers = new Set([...all('[data-study-native-answer]'),...all(answerLabel).map(label =>
      label.closest('[class*="result-pane--answer-result-pane--"]') || label.closest('[data-purpose="answer"]')).filter(Boolean)]);
    for (const answer of answers) {
      const labels = all(answerLabel,answer).map(label => text(label));
      const state = labels.some(label => /\bincorrect\b/i.test(label)) ? 'incorrect' : labels.some(label => /\bcorrect\b/i.test(label)) ? 'correct' : null;
      if (answer.getAttribute('data-study-native-answer') === state) continue;
      if (state) answer.setAttribute('data-study-native-answer',state); else answer.removeAttribute('data-study-native-answer');
      for (const node of [answer,...all('*',answer)]) dirtyThemeNodes.add(node);
    }
    // Keep the old theme until replacement colors can be measured and applied before paint.
    for (const node of dirtyThemeNodes) {
      themedNodes.delete(node); node.removeAttribute('data-study-native-ink'); node.removeAttribute('data-study-native-surface');
    }
    dirtyThemeNodes.clear();
    const canvas = new OffscreenCanvas(1,1), context = canvas.getContext('2d',{willReadFrequently:true}), parsed = new Map();
    const rgb = value => {
      if (!parsed.has(value)) {
        // Udemy also uses oklch()/color-mix(); let Chrome convert CSS colors to sRGB.
        context.clearRect(0,0,1,1); context.fillStyle = value; context.fillRect(0,0,1,1);
        const [r,g,b,a] = context.getImageData(0,0,1,1).data;
        parsed.set(value,[r,g,b,a/255]);
      }
      return parsed.get(value);
    };
    const pale = color => color && (color[3] ?? 1) >= .8 && Math.max(...color.slice(0,3)) - Math.min(...color.slice(0,3)) < 45 && color.slice(0,3).reduce((a,b) => a+b)/3 > 185;
    const themeSurface = (node,color) => pale(color) && !(Math.max(...color.slice(0,3))-Math.min(...color.slice(0,3)) > 6 &&
      node.closest('[role="progressbar"],progress,meter,[class*="progress"],[class*="chart"],[data-purpose*="progress"],[data-purpose*="chart"]'));
    const darkSurface = node => {
      const state = node.closest('[data-study-native-answer]')?.getAttribute('data-study-native-answer');
      return state === 'correct' ? [37,56,47] : state === 'incorrect' ? [59,43,48] : [32,37,43];
    };
    const luminance = color => color.slice(0,3).map(value => value/255).map(value => value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4).reduce((sum,value,index) => sum + value * [.2126,.7152,.0722][index],0);
    const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
    const nodes = all('body *').filter(node => !themedNodes.has(node) && node.namespaceURI === 'http://www.w3.org/1999/xhtml' &&
      !node.closest('#udemy-study-review,#studydock-notes,script,style,video,canvas,picture') && !node.matches('img,iframe'));
    const colors = new Map();
    const read = node => {
      if (!colors.has(node)) {
        const style = getComputedStyle(node);
        colors.set(node,{background:rgb(style.backgroundColor),ink:rgb(style.color)});
      }
      return colors.get(node);
    };
    const backgroundFor = node => {
      for (let parent=node; parent; parent=parent.parentElement) {
        const color = read(parent).background;
        if (themeSurface(parent,color) || parent.hasAttribute('data-study-native-surface')) return darkSurface(parent);
        if (color && (color[3] ?? 1) >= .8) return color;
      }
      return [23,27,32];
    };
    // Set surfaces first, then repair inherited text from parent to child, including colored charts.
    const updates = nodes.map(node => ({node,pale:themeSurface(node,read(node).background),surface:backgroundFor(node)}));
    for (const update of updates) {
      themedNodes.add(update.node);
      if (update.pale) update.node.setAttribute('data-study-native-surface','');
    }
    for (const {node,surface} of updates) {
      const ink = rgb(getComputedStyle(node).color);
      const visible = ink?.slice(0,3).map((value,index) => value*(ink[3] ?? 1) + surface[index]*(1-(ink[3] ?? 1)));
      if (visible && contrast(visible,surface) < 4.5) node.setAttribute('data-study-native-ink',luminance(surface) > .179 ? 'dark' : 'light');
    }
  }
  function applyTheme() {
    document.documentElement.toggleAttribute("data-study-dark", !source && !!settings.darkMode); host?.toggleAttribute("data-dark", !!settings.darkMode);
    if (!source) themeNativePage();
    const toggle = shadow?.querySelector('[data-control="theme"]');
    if (toggle) { toggle.replaceChildren(icon(settings.darkMode ? "sun" : "moon"));
      toggle.title = settings.darkMode ? "Light mode" : "Dark mode"; toggle.setAttribute("aria-label", toggle.title); }
  }
  function sync() {
    clearTimeout(timer);
    if (path !== location.pathname) { path = location.pathname; dismissed = ""; closeReview(); }
    applyTheme();
    if (!isReview() || !settings.focusReview) closeReview();
    let launch = document.getElementById("udemy-study-review-launch");
    if (!isReview() || (!source && !document.querySelector(wrapper))) { launch?.remove(); return; }
    if (!launch) {
      launch = button("Focus review", () => { save({focusReview: true}); dismissed = ""; void openReview(); });
      launch.id = "udemy-study-review-launch"; document.body.append(launch);
    }
    if (host && !questions[active]?.node.isConnected) { dismissed = path; closeReview(); }
    if (settings.focusReview && !host && dismissed !== path && (!source || source.autoOpen)) void openReview();
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(sync, 120); };
  storage?.onChanged.addListener((changes, area) => {
    if (area !== "local" || !Object.keys(changes).some(key => key in defaults)) return;
    const changed = Object.keys(changes).filter(key => key in defaults && settings[key] !== changes[key].newValue);
    for (const key of Object.keys(defaults)) if (changes[key]) settings[key] = changes[key].newValue ?? defaults[key];
    if (changes.focusReview?.newValue) dismissed = "";
    // Own cursor writes need not rebuild the entire workspace.
    if (changed.some(key => key !== "reviewCursor")) {
      sync();
      if (host && changed.some(key => !["darkMode", "questionTrayOpen", "reviewCursor"].includes(key))) render();
      if (changed.includes("questionTrayOpen")) updateTray();
    }
  });
  document.addEventListener("keydown", event => {
    if (!host || viewer || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const target = event.composedPath()[0];
    if (target.matches?.("input,textarea,select,[contenteditable],[role=separator]") || (target.tagName === "SUMMARY" && event.key !== "Escape")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); step(event.key === "ArrowRight" ? 1 : -1); }
    if (event.key.toLowerCase() === "e") { event.preventDefault(); save({explanationOpen: !settings.explanationOpen}); render(); }
    if (event.key === "Escape") {
      const menu = shadow.querySelector(".settings[open]");
      if (menu) { menu.open = false; menu.querySelector("summary").focus(); }
      else { dismissed = path; closeReview(); sync(); }
    }
  });
  new MutationObserver(records => {
    for (const record of records) if (!source && record.type === 'attributes') {
      const root = record.target.matches('input') ? record.target.closest('label') || record.target.parentElement : record.target;
      for (const node of [root,...root.querySelectorAll('*')]) {
        dirtyThemeNodes.add(node);
      }
    }
    scheduleTheme();
    schedule();
  }).observe(document.body, {subtree: true, childList: true, attributes:true, attributeFilter:['class','style','checked','data-checked','aria-checked','aria-selected','disabled']});
  // Hover, focus and input.checked can change CSS without a DOM attribute mutation.
  for (const type of ['pointerover','pointerout','focusin','focusout','change']) document.addEventListener(type, event => {
    if (source || !settings.darkMode || !(event.target instanceof Element) || event.target.closest('#udemy-study-review,#studydock-notes')) return;
    const root = event.target.closest('label,button,a,[role=option],[role=radio],[role=checkbox],[data-purpose=answer]') || event.target;
    if (root === document.body || root === document.documentElement) return;
    for (const node of root.querySelectorAll('*')) dirtyThemeNodes.add(node);
    for (let node=root; node && node!==document.body; node=node.parentElement) dirtyThemeNodes.add(node);
    scheduleTheme();
  }, true);
  window.addEventListener("popstate", schedule);
  setInterval(() => { if (path !== location.pathname) sync(); }, 1000);
  globalThis.udemyStudyReview = async () => { settings = storage ? await storage.local.get(defaults) : {...defaults}; sync(); };
  void globalThis.udemyStudyReview();
})();
