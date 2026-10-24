(async () => {
  const settings = await chrome.storage.local.get({fullHeight: false, hidePause: false, keepRunning: false, focusReview: true, darkMode: matchMedia("(prefers-color-scheme: dark)").matches});
  document.documentElement.toggleAttribute("data-dark", settings.darkMode);
  for (const key of ["focusReview", "darkMode", "fullHeight", "hidePause", "keepRunning"]) {
    const input = document.getElementById(key);
    input.checked = settings[key];
    input.addEventListener("change", async () => {
      await chrome.storage.local.set({[key]: input.checked});
      if (key === "darkMode") document.documentElement.toggleAttribute("data-dark", input.checked);
      // Also reaches tabs opened before the extension was installed or reloaded.
      const tabs = await chrome.tabs.query({url: ["https://*.udemy.com/*"]});
      await Promise.allSettled(tabs.map(async tab => {
        const files = new URL(tab.url).pathname.startsWith("/course/") ? ["ui.js", "review.js"] : ["review.js"];
        await chrome.scripting.executeScript({target: {tabId: tab.id}, files});
      }));
      document.getElementById("status").textContent = "Saved for your Udemy tabs.";
    });
  }
  document.getElementById("connect").addEventListener("click", async () => {
    const url = chrome.runtime.getURL("connect.html");
    const tab = (await chrome.tabs.query({})).find(tab => tab.url === url);
    if (tab) await chrome.tabs.update(tab.id, {active: true});
    else await chrome.tabs.create({url});
    window.close();
  });
})();
