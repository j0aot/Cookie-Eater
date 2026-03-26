// Cookie Rejector - Popup Script

const toggle = document.getElementById("main-toggle");
const toggleLabel = document.getElementById("toggle-label");
const statusBar = document.getElementById("status-bar");
const statusText = document.getElementById("status-text");
const statRejected = document.getElementById("stat-rejected");
const statBlocked = document.getElementById("stat-blocked");
const sitesList = document.getElementById("sites-list");
const resetBtn = document.getElementById("reset-btn");
const overlay = document.getElementById("disabled-overlay");

function updateUI(enabled, stats) {
  toggle.checked = enabled;
  toggleLabel.textContent = enabled ? "ON" : "OFF";

  if (enabled) {
    statusBar.className = "status-bar";
    statusText.textContent = "Proteção ativa";
    overlay.classList.remove("show");
  } else {
    statusBar.className = "status-bar off";
    statusText.textContent = "Proteção pausada";
    overlay.classList.add("show");
  }

  if (stats) {
    statRejected.textContent = stats.rejected || 0;
    statBlocked.textContent = stats.blocked || 0;

    if (stats.sites && stats.sites.length > 0) {
      sitesList.innerHTML = stats.sites
        .slice(0, 8)
        .map((s) => `<div class="site-item">${s}</div>`)
        .join("");
    } else {
      sitesList.innerHTML = '<div class="no-sites">Nenhum ainda — navegue um pouco!</div>';
    }
  }
}

// Load current state
chrome.storage.local.get(["stats", "enabled"], (data) => {
  const enabled = data.enabled !== false;
  updateUI(enabled, data.stats);
});

// Toggle enable/disable
toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ enabled });

  // Enable/disable all rules
  const ids = Array.from({ length: 40 }, (_, i) => i + 1);
  chrome.declarativeNetRequest.updateEnabledRulesets
    ? null // Rulesets enabled by default; we control via storage flag
    : null;

  chrome.storage.local.get(["stats"], (data) => {
    updateUI(enabled, data.stats);
  });
});

// Reset stats
resetBtn.addEventListener("click", () => {
  const fresh = { rejected: 0, blocked: 0, sites: [] };
  chrome.storage.local.set({ stats: fresh }, () => {
    updateUI(toggle.checked, fresh);
  });
});
