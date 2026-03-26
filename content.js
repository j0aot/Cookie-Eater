// Cookie Rejector - Content Script
// Automatically clicks "Reject All" buttons on cookie consent banners

(function () {
  "use strict";

  // ─── Selectors for "Reject" buttons ───────────────────────────────────────
  const REJECT_SELECTORS = [
    // Generic text-based
    'button[id*="reject"]',
    'button[class*="reject"]',
    'button[id*="decline"]',
    'button[class*="decline"]',
    'button[id*="deny"]',
    'button[class*="deny"]',
    'button[id*="refuse"]',
    'button[class*="refuse"]',
    'a[id*="reject"]',
    'a[class*="reject"]',
    // GDPR-specific
    '#onetrust-reject-all-handler',
    '.onetrust-reject-all-handler',
    '#CybotCookiebotDialogBodyButtonDecline',
    '.cc-deny',
    '.cc-dismiss',
    '#cookiescript_reject',
    '#cookieConsentDeclineButton',
    '[data-testid="reject-all"]',
    '[aria-label*="reject" i]',
    '[aria-label*="decline" i]',
    '[aria-label*="refuse" i]',
    // Quantcast / CMP
    '.qc-cmp2-summary-buttons button:first-child',
    // Cookiebot
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
    // OneTrust
    '#onetrust-reject-all-handler',
    '.ot-pc-refuse-all-handler',
    // Didomi
    '#didomi-notice-disagree-button',
    '.didomi-components-radio__option[aria-label*="disagree" i]',
    // Sourcepoint
    'button[title*="reject" i]',
    'button[title*="decline" i]',
    // Axeptio
    '.axeptio_btn-configure',
    // Klaro
    '.cm-btn-decline',
    // Cookiehub
    '.ch2-deny-all',
    // Consent Manager
    '.cmpt-decline',
    // TrustArc
    '#truste-consent-required',
    // Piwik PRO
    '[data-cs-action="REJECT_ALL"]',
  ];

  // ─── Text patterns to match "reject all" button text ──────────────────────
  const REJECT_TEXT_PATTERNS = [
    /rejeitar\s*(tudo|todos|todas)?/i,
    /reject\s*(all|cookies)?/i,
    /recusar\s*(tudo|todos|todas)?/i,
    /refuse\s*(all)?/i,
    /decline\s*(all)?/i,
    /negar\s*(tudo)?/i,
    /deny\s*(all)?/i,
    /não\s*aceitar/i,
    /not\s*accept/i,
    /accept\s*necessary\s*only/i,
    /somente\s*necessário/i,
    /only\s*essential/i,
    /continue\s*without\s*accepting/i,
    /continuer\s*sans\s*accepter/i,
    /ablehnen/i,
    /tout\s*refuser/i,
    /tout\s*rejeter/i,
  ];

  // ─── Cookie banner container selectors ────────────────────────────────────
  const BANNER_SELECTORS = [
    "#cookie-banner",
    "#cookieBanner",
    "#cookie-consent",
    "#cookieConsent",
    "#cookie-notice",
    "#cookieNotice",
    "#cookie-bar",
    "#gdpr-banner",
    "#gdpr-consent",
    ".cookie-banner",
    ".cookie-consent",
    ".cookie-notice",
    ".cookie-bar",
    ".gdpr-banner",
    ".gdpr-consent",
    "#onetrust-banner-sdk",
    "#onetrust-consent-sdk",
    "#CybotCookiebotDialog",
    "#cookiescript_injected",
    "#didomi-host",
    ".cc-window",
    ".cc-banner",
    "[id*='consent']",
    "[class*='consent-banner']",
    "[class*='cookie-modal']",
    "[role='dialog'][aria-label*='cookie' i]",
    "[role='dialog'][aria-label*='privacy' i]",
    "[role='alertdialog']",
  ];

  let attemptCount = 0;
  const MAX_ATTEMPTS = 10;
  let found = false;

  // ─── Try to find and click a reject button ────────────────────────────────
  function tryRejectCookies() {
    if (found || attemptCount >= MAX_ATTEMPTS) return;
    attemptCount++;

    // Try selector-based approach first
    for (const selector of REJECT_SELECTORS) {
      try {
        const btn = document.querySelector(selector);
        if (btn && isVisible(btn)) {
          btn.click();
          found = true;
          log("Clicked reject button via selector:", selector);
          notifyBackground({ action: "rejected", site: location.hostname });
          return;
        }
      } catch (_) {}
    }

    // Try text-based approach on all buttons/links inside banners
    const bannerEl = findBanner();
    const scope = bannerEl || document;

    const clickables = scope.querySelectorAll("button, a, [role='button']");
    for (const el of clickables) {
      const text = (el.innerText || el.textContent || "").trim();
      if (REJECT_TEXT_PATTERNS.some((p) => p.test(text)) && isVisible(el)) {
        el.click();
        found = true;
        log("Clicked reject button via text match:", text);
        notifyBackground({ action: "rejected", site: location.hostname });
        return;
      }
    }
  }

  function findBanner() {
    for (const selector of BANNER_SELECTORS) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) return el;
      } catch (_) {}
    }
    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      el.offsetParent !== null
    );
  }

  function log(...args) {
    console.debug("[Cookie Rejector]", ...args);
  }

  function notifyBackground(data) {
    try {
      chrome.runtime.sendMessage(data);
    } catch (_) {}
  }

  // ─── Run on page load ──────────────────────────────────────────────────────
  tryRejectCookies();

  // Retry with delays to catch late-loading banners
  const delays = [500, 1500, 3000, 5000, 8000];
  delays.forEach((delay) => {
    setTimeout(tryRejectCookies, delay);
  });

  // Watch for dynamically injected banners
  const observer = new MutationObserver(() => {
    if (!found) tryRejectCookies();
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Stop observing after 15 seconds
  setTimeout(() => observer.disconnect(), 15000);
})();
