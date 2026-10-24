chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === "install") void chrome.tabs.create({url: "settings.html"});
});
