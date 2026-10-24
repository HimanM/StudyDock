const base = "http://127.0.0.1:8765";
let token = "", busy = false, polling = false;
function applyTheme(dark) {
  document.documentElement.toggleAttribute("data-dark", dark);
  document.getElementById("theme").textContent = dark ? "Light mode" : "Dark mode";
}
chrome.storage.local.get({darkMode: matchMedia("(prefers-color-scheme: dark)").matches}).then(settings => applyTheme(settings.darkMode));
chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes.darkMode) applyTheme(changes.darkMode.newValue); });
document.getElementById("theme").addEventListener("click", () => {
  const dark = !document.documentElement.hasAttribute("data-dark");
  applyTheme(dark); void chrome.storage.local.set({darkMode: dark});
});
document.getElementById("retry").addEventListener("click", () => void poll());
async function request(path, body) {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {"Content-Type": "application/json", "X-Study-Token": token, "X-Study-Client": chrome.runtime.id},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(35000)
  });
  if (!response.ok) throw new Error(`App returned ${response.status}`);
  return response.json();
}
async function extract(command) {
  busy = true;
  let result;
  try {
    const tab = await chrome.tabs.get(command.tab_id);
    if (!/^https:\/\/([\w-]+\.)?udemy\.com\//.test(tab.url || "")) throw new Error("Select an open Udemy results tab.");
    if (tab.discarded || tab.status === "loading") {
      if (tab.discarded) await chrome.tabs.update(tab.id, {active: true});
      await new Promise((resolve, reject) => {
        const complete = (id, change) => {
          if (id === tab.id && change.status === "complete") finish();
        };
        const finish = error => {
          chrome.tabs.onUpdated.removeListener(complete);
          clearTimeout(timeout);
          if (error) reject(error); else resolve();
        };
        const timeout = setTimeout(() => finish(new Error("The tab did not finish loading. Open it in Chrome and retry.")), 45000);
        chrome.tabs.onUpdated.addListener(complete);
        void chrome.tabs.get(tab.id).then(current => { if (!current.discarded && current.status === "complete") finish(); }, finish);
      });
    }
    const injected = await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ["notes-store.js", "extractor.js"]});
    if (!injected[0]?.result) throw new Error("Udemy returned no data. Reload the results tab and retry.");
    result = {id: command.id, data: injected[0].result};
  } catch (error) {
    const hint = /Cannot access contents/.test(error.message) ? " Open this tab, reload it, and allow the extension access to Udemy, then retry." : "";
    result = {id: command.id, error: error.message + hint};
  }
  // Keep completed results until the app acknowledges them; never silently drop an export.
  for (;;) {
    try { await request("/result", result); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 2000)); token = ""; }
  }
  busy = false;
}
async function poll() {
  if (polling) return;
  polling = true;
  let connected = false;
  try {
    if (!token) token = (await request("/hello")).token;
    const groups = await chrome.tabGroups.query({});
    const tabs = (await chrome.tabs.query({url: ["https://*.udemy.com/*"]})).map(tab => ({
      id: tab.id, title: tab.title, url: tab.url,
      group: groups.find(group => group.id === tab.groupId)?.title || "Ungrouped"
    }));
    const response = await request("/poll", {tabs, busy});
    document.getElementById("status").textContent = `Connected · ${tabs.length} Udemy tab(s) available${busy ? " · Reading questions…" : ""}`;
    document.getElementById("error-details").hidden = true;
    if (response.command && !busy) void extract(response.command);
    connected = true;
  } catch (error) {
    token = "";
    document.getElementById("status").textContent = "Waiting for the desktop app";
    document.getElementById("connection-error").textContent = error.message;
    document.getElementById("error-details").hidden = false;
  } finally {
    polling = false;
    // A long-polling request wakes immediately for a command, even in a background tab.
    if (connected) void poll();
    else setTimeout(poll, 1500);
  }
}
void poll();
