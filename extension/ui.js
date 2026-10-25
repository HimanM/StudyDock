// Full-height behavior adapted from HimanM/Fuck-Udemy-Exam-UI (MIT).
// See LICENSE-fullheight.txt. Settings and pause-screen handling are extension additions.
(() => {
  if (globalThis.udemyStudyUI) { globalThis.udemyStudyUI(); return; }
  let settings = {fullHeight: false, hidePause: false, keepRunning: false, examToolbar: true};
  let scheduled = false;
  let pauseContainer = null;
  let resumedContainer = null;
  const changedAttributes = [];
  const styleId = "udemy-study-ui-style";
  function restorePause() {
    pauseContainer?.removeAttribute("data-study-pause");
    for (const [node, name, previous, applied] of changedAttributes) {
      if (node.getAttribute(name) === applied) {
        if (previous === null) node.removeAttribute(name);
        else node.setAttribute(name, previous);
      }
    }
    changedAttributes.length = 0;
    pauseContainer = null;
  }
  function setAttribute(node, name, value) {
    if (!node || node.getAttribute(name) === value) return;
    changedAttributes.push([node, name, node.getAttribute(name), value]);
    node.setAttribute(name, value);
  }
  function apply() {
    scheduled = false;
    const onExam = /\/learn\/(quiz|practice)\//.test(location.pathname);
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    const footer = document.querySelector('[class*="curriculum-item-footer--footer"]');
    let css = onExam && settings.fullHeight ? `
      [class*="curriculum-item-view--scaled-height-limiter"] {
        max-block-size: none !important;
        height: calc(100dvh - ${footer?.offsetHeight || 0}px) !important;
      }` : "";
    const resume = document.querySelector('[data-purpose="unpause-test"]');
    const container = resume?.closest('[class*="modal-module--dialog-container--"]');
    const isPaused = onExam && container?.className.includes("--is-open--");
    if (!isPaused) resumedContainer = null;
    if (isPaused && settings.keepRunning && resumedContainer !== container) {
      resumedContainer = container;
      resume.click();
    }
    const paused = isPaused && settings.hidePause && !settings.keepRunning;
    if (pauseContainer && (!paused || pauseContainer !== container)) restorePause();
    if (paused) {
      if (pauseContainer !== container) {
        pauseContainer = container;
        container.setAttribute("data-study-pause", "");
        setAttribute(resume.closest('[role="dialog"]'), "aria-modal", "false");
        const question = container.parentElement.querySelector('[class*="quiz-view--container--"]');
        if (question?.getAttribute("aria-hidden") === "true") setAttribute(question, "aria-hidden", "false");
      }
      css += `
        [data-study-pause] {background: transparent !important; backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important; pointer-events: none !important;}
        [data-study-pause] [class*="modal-module--scroll-wrapper--"] {pointer-events: none !important;}
        [data-study-pause] [role="dialog"] {position: fixed !important; inset: auto 20px 20px auto !important;
          transform: none !important; margin: 0 !important; width: auto !important; min-width: 0 !important;
          max-width: calc(100vw - 40px) !important; padding: 10px !important; font-size: 0 !important;
          pointer-events: auto !important; box-shadow: 0 2px 12px #0004;}
        [data-study-pause] [role="dialog"] > :not(.ud-footer-btns) {display: none !important;}
        [data-study-pause] .ud-footer-btns {margin: 0 !important; padding: 0 !important;}
        [data-study-pause] .ud-footer-btns::before {content: "Paused — "; font: 14px system-ui;}
      `;
    }
    css += `
      [data-studydock-footer] {background:#fff!important;color:#20252c!important;border-color:#d7dfe8!important;gap:8px!important;}
      [data-studydock-controls] {display:flex!important;align-items:center!important;gap:6px!important;flex-wrap:wrap;padding:4px!important;}
      [data-studydock-controls] > * {flex-shrink:0;}
      [data-studydock-footer] button {display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px;border-radius:12px!important;height:40px!important;min-height:40px!important;min-width:40px!important;padding:8px 12px!important;color:#285ea8!important;background:transparent!important;border:0!important;transition:background-color 160ms,color 160ms;}
      [data-studydock-footer] button.ud-btn-icon {width:40px!important;padding:10px!important;}
      [data-studydock-footer] button:hover {background:#dce9fc!important;}
      [data-studydock-footer] button:focus-visible {outline:2px solid #285ea8!important;outline-offset:3px;}
      [data-studydock-footer] button:disabled {opacity:.55;cursor:default;}
      html[data-study-dark] [data-studydock-footer] {background:#20252b!important;color:#eef1f6!important;border-color:#536071!important;}
      html[data-study-dark] [data-studydock-footer] button {background:transparent!important;color:#c1d8fa!important;}
      html[data-study-dark] [data-studydock-footer] button:hover {background:#2a405d!important;}
      [data-studydock-footer] button svg {display:block!important;flex:0 0 20px!important;width:20px!important;height:20px!important;margin:0!important;fill:currentColor!important;color:inherit!important;}
      #udemy-study-height-toggle {border:0!important;border-radius:12px!important;padding:8px 14px!important;
        min-height:40px!important;background:#e7edf5!important;color:#285ea8!important;font:500 13px/1.5 system-ui!important;
        transition:background-color 160ms,color 160ms;}
      #udemy-study-height-toggle[aria-pressed=true] {background:#dce9fc!important;}
      #udemy-study-height-toggle:focus-visible {outline:2px solid #285ea8;outline-offset:3px;}
      [data-study-pause] [role=dialog] {border-radius:16px!important;background:#fff!important;color:#20252c!important;}
      [data-study-pause] [data-purpose=unpause-test] {border-radius:20px!important;background:#dce9fc!important;color:#285ea8!important;border:0!important;}
      html[data-study-dark] #udemy-study-height-toggle {background:#2c333c!important;color:#adcaff!important;}
      html[data-study-dark] #udemy-study-height-toggle[aria-pressed=true] {background:#2a405d!important;}
      html[data-study-dark] [data-study-pause] [role=dialog] {background:#20252b!important;color:#e0e4eb!important;}
      html[data-study-dark] [data-study-pause] [data-purpose=unpause-test] {background:#2a405d!important;color:#adcaff!important;}
      #udemy-study-height-toggle {display:inline-flex!important;align-items:center;gap:7px;white-space:nowrap;}
      #udemy-study-height-toggle[hidden] {display:none!important;}
      @media(prefers-reduced-motion:reduce) {#udemy-study-height-toggle,[data-studydock-footer] button {transition:none;}}
    `;
    if (onExam) footer?.setAttribute('data-studydock-footer','');
    else document.querySelectorAll('[data-studydock-footer]').forEach(node => node.removeAttribute('data-studydock-footer'));
    if (style.textContent !== css) style.textContent = css;
    const buttonId = "udemy-study-height-toggle";
    let button = document.getElementById(buttonId);
    const expanded = document.querySelector('[data-purpose="theatre-mode-toggle-button"]');
    const anchor = expanded?.closest('[class*="popper-module--popper"]') || expanded;
    if (onExam && anchor) anchor.parentElement.setAttribute('data-studydock-controls','');
    else document.querySelectorAll('[data-studydock-controls]').forEach(node => node.removeAttribute('data-studydock-controls'));
    if (onExam && expanded && !button) {
      button = document.createElement("button");
      button.id = buttonId;
      button.type = "button";
      button.className = "ud-btn ud-btn-large ud-btn-ghost ud-btn-text-md";
      // Google Material unfold_more (Apache 2.0).
      button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg><span></span>';
      button.addEventListener("click", () => chrome.storage.local.set({fullHeight: !settings.fullHeight}));
      anchor.after(button);
    }
    if (button) {
      button.hidden = !onExam || !settings.examToolbar;
      const label = settings.fullHeight ? "Full height on" : "Full height";
      if (button.querySelector('span').textContent !== label) button.querySelector('span').textContent = label;
      button.title = settings.fullHeight ? 'Restore normal question height' : 'Use the full available height';
      if (button.getAttribute("aria-pressed") !== String(settings.fullHeight)) button.setAttribute("aria-pressed", String(settings.fullHeight));
    }
  }
  function schedule() {
    if (!scheduled) { scheduled = true; queueMicrotask(apply); }
  }
  globalThis.udemyStudyUI = async () => { settings = await chrome.storage.local.get(settings); apply(); };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of ["fullHeight", "hidePause", "keepRunning", "examToolbar"]) if (changes[key]) settings[key] = changes[key].newValue;
    if (changes.keepRunning) resumedContainer = null;
    apply();
  });
  new MutationObserver(schedule).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ["class", "data-checked"]});
  window.addEventListener("resize", schedule);
  window.addEventListener("popstate", schedule);
  void globalThis.udemyStudyUI();
})();
