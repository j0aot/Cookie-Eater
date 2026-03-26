// Cookie Rejector - Background Service Worker

const DEFAULT_STATS = { rejected: 0, blocked: 0, sites: [] };

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ stats: DEFAULT_STATS, enabled: true });
  console.log("[Cookie Rejector] Installed.");
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === "rejected") {
    chrome.storage.local.get(["stats"], ({ stats }) => {
      const s = stats || DEFAULT_STATS;
      s.rejected++;
      if (msg.site && !s.sites.includes(msg.site)) {
        s.sites.unshift(msg.site);
        if (s.sites.length > 50) s.sites.pop(); // keep last 50
      }
      chrome.storage.local.set({ stats: s });
    });
  }

  if (msg.action === "blocked") {
    chrome.storage.local.get(["stats"], ({ stats }) => {
      const s = stats || DEFAULT_STATS;
      s.blocked++;
      chrome.storage.local.set({ stats: s });
    });
  }

  if (msg.action === "getStats") {
    chrome.storage.local.get(["stats", "enabled"], (data) => {
      chrome.runtime.sendMessage({ action: "statsResponse", ...data });
    });
  }
});

// Track blocked network requests (declarativeNetRequest doesn't fire events,
// so we count via webRequest for informational purposes)
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.error === "net::ERR_BLOCKED_BY_CLIENT") {
      chrome.storage.local.get(["stats"], ({ stats }) => {
        const s = stats || DEFAULT_STATS;
        s.blocked++;
        chrome.storage.local.set({ stats: s });
      });
    }
  },
  { urls: ["<all_urls>"] }
);
