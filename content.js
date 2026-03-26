// Cookie Rejector - Content Script (v2)
// Handles single-step AND multi-step banners (e.g. "Saiba mais" → "Rejeitar tudo")

(function () {
  "use strict";

  // ─── Direct "Reject All" selectors ────────────────────────────────────────
  const REJECT_SELECTORS = [
    '#onetrust-reject-all-handler',
    '.onetrust-reject-all-handler',
    '.ot-pc-refuse-all-handler',
    '#CybotCookiebotDialogBodyButtonDecline',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
    '#didomi-notice-disagree-button',
    '#cookiescript_reject',
    '#cookieConsentDeclineButton',
    '.cc-deny',
    '.cc-dismiss',
    '.ch2-deny-all',
    '.cm-btn-decline',
    '.cmpt-decline',
    '.axeptio_btn-refuse',
    '#truste-consent-required',
    '[data-testid="reject-all"]',
    '[data-cs-action="REJECT_ALL"]',
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
    '[aria-label*="reject" i]',
    '[aria-label*="decline" i]',
    '[aria-label*="refuse" i]',
    '[title*="reject" i]',
    '[title*="decline" i]',
  ];

  // ─── Text patterns that mean "Reject All" ─────────────────────────────────
  const REJECT_TEXT_PATTERNS = [
    /^rejeitar\s*(tudo|todos|todas)?$/i,
    /^recusar\s*(tudo|todos|todas)?$/i,
    /^não\s*aceitar(\s*tudo)?$/i,
    /^reject\s*(all(\s*cookies?)?)?$/i,
    /^decline(\s*all)?$/i,
    /^refuse(\s*all)?$/i,
    /^deny(\s*all)?$/i,
    /^negar(\s*tudo)?$/i,
    /^ablehnen(\s*alle)?$/i,
    /^tout\s*refuser$/i,
    /^tout\s*rejeter$/i,
    /^alles\s*ablehnen$/i,
    /^rechazar\s*(todo)?$/i,
    /^rifiuta\s*(tutto)?$/i,
    /accept\s*necessary\s*only/i,
    /somente\s*necess[áa]rios?/i,
    /only\s*essential/i,
    /only\s*necessary/i,
    /continue\s*without\s*accept/i,
    /continuar\s*sem\s*aceitar/i,
    /continuer\s*sans\s*accepter/i,
    /prosseguir\s*sem\s*aceitar/i,
    /usar\s*apenas\s*o\s*essencial/i,
  ];

  // ─── "Step 1" selectors: buttons that open the preferences panel ──────────
  const STEP1_SELECTORS = [
    '#onetrust-pc-btn-handler',
    '.ot-sdk-show-settings',
    '[class*="manage-cookies"]',
    '[id*="manage-cookies"]',
    '#CybotCookiebotDialogBodyButtonDetails',
    '#didomi-notice-learn-more-button',
    '.didomi-notice-learn-more-button',
    '[id*="cookie-settings"]',
    '[class*="cookie-settings"]',
    '[id*="cookie-preferences"]',
    '[class*="cookie-preferences"]',
    '[id*="manage-consent"]',
    '[class*="manage-consent"]',
    '[data-testid*="manage"]',
    '[data-testid*="settings"]',
    '[data-testid*="preferences"]',
  ];

  // ─── Text patterns for "Step 1" (manage/settings) buttons ─────────────────
  const STEP1_TEXT_PATTERNS = [
    /saiba\s*mais/i,
    /saber\s*mais/i,
    /mais\s*informa[çc][õo]es?/i,
    /gerir\s*prefer[êe]ncias?/i,
    /gerir\s*cookies?/i,
    /personalizar(\s*cookies?)?/i,
    /personalizar\s*defini[çc][õo]es?/i,
    /defini[çc][õo]es\s*de\s*cookies?/i,
    /prefer[êe]ncias\s*de\s*cookies?/i,
    /configurar\s*cookies?/i,
    /manage\s*(cookie\s*)?(preferences?|settings?|consent)/i,
    /cookie\s*settings?/i,
    /cookie\s*preferences?/i,
    /privacy\s*settings?/i,
    /customize(\s*cookies?)?/i,
    /customise(\s*cookies?)?/i,
    /show\s*(cookie\s*)?details?/i,
    /learn\s*more/i,
    /plus\s*d.options?/i,
    /param[eè]tres?(\s*des?\s*cookies?)?/i,
    /g[eé]rer\s*les?\s*(cookies?|pr[eé]f[eé]rences?)/i,
    /einstellungen/i,
    /mehr\s*erfahren/i,
    /ajustes?\s*de\s*cookies?/i,
    /gestionar\s*(cookies?|preferencias?)/i,
    /impostazioni(\s*cookie)?/i,
    /personalizza(\s*cookie)?/i,
  ];

  // ─── Banner container selectors ───────────────────────────────────────────
  const BANNER_SELECTORS = [
    '#onetrust-banner-sdk', '#onetrust-consent-sdk',
    '#CybotCookiebotDialog', '#cookiescript_injected',
    '#didomi-host', '.cc-window', '.cc-banner',
    '#cookie-banner', '#cookieBanner', '#cookie-consent',
    '#cookieConsent', '#cookie-notice', '#cookieNotice',
    '#cookie-bar', '#gdpr-banner', '#gdpr-consent',
    '.cookie-banner', '.cookie-consent', '.cookie-notice',
    '.cookie-bar', '.gdpr-banner', '.gdpr-consent',
    '[id*="consent"]', '[class*="consent-banner"]',
    '[class*="cookie-modal"]',
    '[role="dialog"][aria-label*="cookie" i]',
    '[role="dialog"][aria-label*="privacy" i]',
    '[role="alertdialog"]',
  ];

  let state = "idle"; // idle | step1_clicked | rejected
  let attempts = 0;
  const MAX_ATTEMPTS = 15;
  let step1Attempts = 0;
  const MAX_STEP1_ATTEMPTS = 5;

  // ─── Helpers ──────────────────────────────────────────────────────────────
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

  function textOf(el) {
    return (
      el.innerText ||
      el.textContent ||
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      ""
    ).trim().replace(/\s+/g, " ");
  }

  function log(...args) {
    console.debug("[Cookie Rejector]", ...args);
  }

  function notify(action) {
    try { chrome.runtime.sendMessage({ action, site: location.hostname }); } catch (_) {}
  }

  function findBanner() {
    for (const sel of BANNER_SELECTORS) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el)) return el;
      } catch (_) {}
    }
    return null;
  }

  // ─── Try clicking a "Reject All" button ───────────────────────────────────
  function tryReject() {
    if (state === "rejected" || attempts >= MAX_ATTEMPTS) return false;
    attempts++;

    // 1) Direct selector
    for (const sel of REJECT_SELECTORS) {
      try {
        const btn = document.querySelector(sel);
        if (btn && isVisible(btn)) {
          btn.click();
          state = "rejected";
          log("✅ Rejected via selector:", sel);
          notify("rejected");
          return true;
        }
      } catch (_) {}
    }

    // 2) Text match inside banner or full document
    const scope = findBanner() || document;
    const candidates = scope.querySelectorAll(
      "button, a, [role='button'], input[type='button'], [tabindex]"
    );
    for (const el of candidates) {
      const txt = textOf(el);
      if (REJECT_TEXT_PATTERNS.some((p) => p.test(txt)) && isVisible(el)) {
        el.click();
        state = "rejected";
        log("✅ Rejected via text:", txt);
        notify("rejected");
        return true;
      }
    }

    return false;
  }

  // ─── Try clicking a "Step 1" preferences button ───────────────────────────
  function tryStep1() {
    if (state !== "idle" || step1Attempts >= MAX_STEP1_ATTEMPTS) return false;
    step1Attempts++;

    // 1) Direct selector
    for (const sel of STEP1_SELECTORS) {
      try {
        const btn = document.querySelector(sel);
        if (btn && isVisible(btn)) {
          btn.click();
          state = "step1_clicked";
          log("🔍 Step 1 via selector:", sel);
          return true;
        }
      } catch (_) {}
    }

    // 2) Text match
    const scope = findBanner() || document;
    const candidates = scope.querySelectorAll(
      "button, a, [role='button'], input[type='button']"
    );
    for (const el of candidates) {
      const txt = textOf(el);
      if (STEP1_TEXT_PATTERNS.some((p) => p.test(txt)) && isVisible(el)) {
        el.click();
        state = "step1_clicked";
        log("🔍 Step 1 via text:", txt);
        return true;
      }
    }

    return false;
  }

  // ─── Main orchestration ───────────────────────────────────────────────────
  function run() {
    if (state === "rejected") return;

    // Always try direct reject first
    if (tryReject()) return;

    // If we haven't tried step 1 yet, try opening preferences
    if (state === "idle") {
      if (tryStep1()) {
        // After opening settings panel, retry reject with increasing delays
        [300, 700, 1400, 2500, 4000].forEach((d) => {
          setTimeout(() => {
            if (state !== "rejected") tryReject();
          }, d);
        });
      }
    }
  }

  // ─── Initial + scheduled runs ─────────────────────────────────────────────
  run();
  [500, 1200, 2500, 4000, 6000, 9000, 13000].forEach((d) => setTimeout(run, d));

  // Watch for dynamically injected banners
  const observer = new MutationObserver(() => {
    if (state !== "rejected") run();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 20000);
})();
