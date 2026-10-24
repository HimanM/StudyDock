// Full-height behavior adapted from HimanM/Fuck-Udemy-Exam-UI (MIT).
// See LICENSE-fullheight.txt. Settings and pause-screen handling are extension additions.
(() => {
  if (globalThis.udemyStudyUI) { globalThis.udemyStudyUI(); return; }
  let settings = {fullHeight: false, hidePause: false, keepRunning: false};
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
        height: calc(100vh - ${footer?.offsetHeight || 0}px) !important;
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
      #udemy-study-height-toggle {border:0!important;border-radius:20px!important;padding:8px 14px!important;
        min-height:36px!important;background:#e7edf5!important;color:#285ea8!important;font:500 13px/1.5 system-ui!important;
        transition:background-color 160ms,color 160ms;}
      #udemy-study-height-toggle[aria-pressed=true] {background:#dce9fc!important;}
      #udemy-study-height-toggle:focus-visible {outline:2px solid #285ea8;outline-offset:3px;}
      [data-study-pause] [role=dialog] {border-radius:16px!important;background:#fff!important;color:#20252c!important;}
      [data-study-pause] [data-purpose=unpause-test] {border-radius:20px!important;background:#dce9fc!important;color:#285ea8!important;border:0!important;}
      html[data-study-dark] #udemy-study-height-toggle {background:#2c333c!important;color:#adcaff!important;}
      html[data-study-dark] #udemy-study-height-toggle[aria-pressed=true] {background:#2a405d!important;}
      html[data-study-dark] [data-study-pause] [role=dialog] {background:#20252b!important;color:#e0e4eb!important;}
      html[data-study-dark] [data-study-pause] [data-purpose=unpause-test] {background:#2a405d!important;color:#adcaff!important;}
      @media(prefers-reduced-motion:reduce) {#udemy-study-height-toggle {transition:none;}}
    `;
    if (style.textContent !== css) style.textContent = css;
    const buttonId = "udemy-study-height-toggle";
    let button = document.getElementById(buttonId);
    const expanded = document.querySelector('[data-purpose="theatre-mode-toggle-button"]');
    if (onExam && expanded && !button) {
      button = document.createElement("button");
      button.id = buttonId;
      button.type = "button";
      button.className = "ud-btn ud-btn-large ud-btn-ghost ud-btn-text-md";
      button.addEventListener("click", () => chrome.storage.local.set({fullHeight: !settings.fullHeight}));
      const anchor = expanded.closest('[class*="popper-module--popper"]') || expanded;
      anchor.after(button);
    }
    if (button) {
      const label = settings.fullHeight ? "Full height: on" : "Full height: off";
      if (button.textContent !== label) button.textContent = label;
      if (button.getAttribute("aria-pressed") !== String(settings.fullHeight)) button.setAttribute("aria-pressed", String(settings.fullHeight));
    }
  }
  function schedule() {
    if (!scheduled) { scheduled = true; queueMicrotask(apply); }
  }
  globalThis.udemyStudyUI = async () => { settings = await chrome.storage.local.get(settings); apply(); };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of ["fullHeight", "hidePause", "keepRunning"]) if (changes[key]) settings[key] = changes[key].newValue;
    if (changes.keepRunning) resumedContainer = null;
    apply();
  });
  new MutationObserver(schedule).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ["class", "data-checked"]});
  window.addEventListener("resize", schedule);
  window.addEventListener("popstate", schedule);
  void globalThis.udemyStudyUI();
})();
