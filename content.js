// Cookie Guardian — Banner Rejection Content Script (v2)
// Multi-step: tries direct reject → opens preferences panel → rejects again or saves essential choices

(function () {
	'use strict';

	chrome.storage.local.get('settings', ({ settings }) => {
		if (settings?.enabled === false) return;
		init();
	});

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
		'[aria-label*="reject" i]',
		'[aria-label*="decline" i]',
		'[aria-label*="refuse" i]',
	];

	const REJECT_TEXTS = [
		/^rejeitar(\s*(tudo|todos))?$/i,
		/^recusar(\s*tudo)?$/i,
		/^não\s*aceitar(\s*tudo)?$/i,
		/^reject(\s*all(\s*cookies?)?)?$/i,
		/^decline(\s*all)?$/i,
		/^refuse(\s*all)?$/i,
		/^deny(\s*all)?$/i,
		/^negar(\s*tudo)?$/i,
		/^ablehnen(\s*alle)?$/i,
		/^tout\s*refuser$/i,
		/^tout\s*rejeter$/i,
		/^alles\s*ablehnen$/i,
		/^rechazar(\s*todo)?$/i,
		/^rifiuta(\s*tutto)?$/i,
		/accept\s*necessary\s*only/i,
		/somente\s*necess[áa]rios?/i,
		/only\s*essential/i,
		/only\s*necessary/i,
		/continue\s*without\s*accept/i,
		/continuar\s*sem\s*aceitar/i,
		/continuer\s*sans\s*accepter/i,
		/prosseguir\s*sem\s*aceitar/i,
	];

	const STEP1_SELECTORS = [
		'#onetrust-pc-btn-handler',
		'.ot-sdk-show-settings',
		'#CybotCookiebotDialogBodyButtonDetails',
		'#didomi-notice-learn-more-button',
		'.didomi-notice-learn-more-button',
		'[id*="cookie-settings"]',
		'[class*="cookie-settings"]',
		'[id*="cookie-preferences"]',
		'[class*="cookie-preferences"]',
		'[id*="manage-consent"]',
		'[class*="manage-consent"]',
	];

	const STEP1_TEXTS = [
		/saiba\s*mais/i,
		/saber\s*mais/i,
		/mais\s*informa[çc][õo]es?/i,
		/gerir\s*prefer[êe]ncias?/i,
		/gerir\s*cookies?/i,
		/personalizar(\s*cookies?)?/i,
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
		/param[eè]tres?(\s*des?\s*cookies?)?/i,
		/g[eé]rer\s*les?\s*(cookies?|pr[eé]f[eé]rences?)/i,
		/einstellungen/i,
		/mehr\s*erfahren/i,
		/ajustes?\s*de\s*cookies?/i,
		/gestionar\s*(cookies?|preferencias?)/i,
		/impostazioni(\s*cookie)?/i,
		/personalizza(\s*cookie)?/i,
	];

	// NEW: Selectors and texts to find the "Save" or "Confirm" buttons inside preferences
	const SAVE_SELECTORS = ['.save-preference', '.save-consent', '.ot-pc-save-handler', '#accept-recommended-btn-handler', '#btn-save-consent'];

	const SAVE_TEXTS = [
		/guardar\s*(defini[çc][õo]es|prefer[êe]ncias|escolhas)/i,
		/save\s*(settings|preferences|choices)/i,
		/confirmar\s*(as\s*)?minhas\s*escolhas/i,
		/confirm\s*(my\s*)?choices/i,
		/salvar\s*e\s*fechar/i,
		/save\s*(&|and)\s*close/i,
	];

	const BANNER_SELS = [
		'#onetrust-banner-sdk',
		'#onetrust-consent-sdk',
		'#CybotCookiebotDialog',
		'#cookiescript_injected',
		'#didomi-host',
		'.cc-window',
		'.cc-banner',
		'#cookie-banner',
		'#cookieBanner',
		'#cookie-consent',
		'#cookieConsent',
		'#gdpr-banner',
		'#gdpr-consent',
		'.cookie-banner',
		'.cookie-consent',
		'.cookie-notice',
		'.cookie-bar',
		'.gdpr-banner',
		'.gdpr-consent',
		'[class*="consent-banner"]',
		'[class*="cookie-modal"]',
		'[role="dialog"][aria-label*="cookie" i]',
		'[role="dialog"][aria-label*="privacy" i]',
		'[role="alertdialog"]',
	];

	let state = 'idle'; // idle | step1 | done
	let tries = 0;

	function isVisible(el) {
		if (!el) return false;
		const s = window.getComputedStyle(el);
		return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && el.offsetParent !== null;
	}

	function textOf(el) {
		return (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
	}

	function banner() {
		for (const sel of BANNER_SELS) {
			try {
				const el = document.querySelector(sel);
				if (el && isVisible(el)) return el;
			} catch (_) {}
		}
		return null;
	}

	// MODIFIED: Accepts the type of rejection for better auditing
	function markDone(type = 'auto') {
		state = 'done';
		try {
			chrome.runtime.sendMessage({ action: 'rejected', site: location.hostname, bannerType: type });
		} catch (_) {}
	}

	function tryReject() {
		if (state === 'done' || tries > 20) return false;
		tries++;
		for (const sel of REJECT_SELECTORS) {
			try {
				const el = document.querySelector(sel);
				if (el && isVisible(el)) {
					el.click();
					markDone('reject-all');
					return true;
				}
			} catch (_) {}
		}
		const scope = banner() || document;
		for (const el of scope.querySelectorAll("button,a,[role='button'],input[type='button']")) {
			if (REJECT_TEXTS.some(p => p.test(textOf(el))) && isVisible(el)) {
				el.click();
				markDone('reject-all');
				return true;
			}
		}
		return false;
	}

	function tryStep1() {
		if (state !== 'idle') return false;
		for (const sel of STEP1_SELECTORS) {
			try {
				const el = document.querySelector(sel);
				if (el && isVisible(el)) {
					el.click();
					state = 'step1';
					return true;
				}
			} catch (_) {}
		}
		const scope = banner() || document;
		for (const el of scope.querySelectorAll("button,a,[role='button']")) {
			if (STEP1_TEXTS.some(p => p.test(textOf(el))) && isVisible(el)) {
				el.click();
				state = 'step1';
				return true;
			}
		}
		return false;
	}

	// NEW: Attempts to save current settings (which rejects non-essential cookies by default)
	function trySave() {
		if (state === 'done') return false;
		for (const sel of SAVE_SELECTORS) {
			try {
				const el = document.querySelector(sel);
				if (el && isVisible(el)) {
					el.click();
					markDone('saved-essential');
					return true;
				}
			} catch (_) {}
		}
		const scope = banner() || document;
		for (const el of scope.querySelectorAll("button,a,[role='button'],input[type='button']")) {
			if (SAVE_TEXTS.some(p => p.test(textOf(el))) && isVisible(el)) {
				el.click();
				markDone('saved-essential');
				return true;
			}
		}
		return false;
	}

	// MODIFIED: Logic to try saving settings if total rejection fails inside the preferences panel
	function run() {
		if (state === 'done') return;

		// First, attempt a direct "Reject All"
		if (tryReject()) return;

		// If we are still idle, try to open the preferences pane
		if (state === 'idle') {
			if (tryStep1()) {
				// We are inside the preferences pane. Try to reject, or fallback to saving current choices
				[300, 700, 1400, 2500, 4000].forEach(d =>
					setTimeout(() => {
						if (state !== 'done') {
							if (!tryReject()) {
								trySave();
							}
						}
					}, d),
				);
			}
		}
	}

	function init() {
		run();
		[500, 1200, 2500, 4000, 6000, 9000, 13000].forEach(d => setTimeout(run, d));
		const obs = new MutationObserver(() => {
			if (state !== 'done') run();
		});
		obs.observe(document.documentElement, { childList: true, subtree: true });
		setTimeout(() => obs.disconnect(), 20000);
	}
})();
