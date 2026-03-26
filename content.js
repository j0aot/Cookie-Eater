// Cookie Eater — Banner Rejection Content Script (v9 - Surgical Edition)
// Only acts inside detected banners to avoid "mis-clicks" on navigation links.

(function () {
	'use strict';

	chrome.storage.local.get('settings', ({ settings }) => {
		if (settings?.enabled === false) return;
		init();
	});

	// --- 1. CONFIGURATION ---

	const BANNER_SELECTORS = [
		'#didomi-host',
		'#onetrust-banner-sdk',
		'#onetrust-consent-sdk',
		'#CybotCookiebotDialog',
		'.cc-window',
		'.cc-banner',
		'[role="dialog"]',
		'[role="alertdialog"]',
		'.cookie-modal',
		'#manage-cookies-modal',
	];

	const REJECT_TEXTS = [
		'não aceito nenhum',
		'rejeitar tudo',
		'rejeitar todos',
		'recusar tudo',
		'não aceitar',
		'apenas necessários',
		'reject all',
		'decline all',
		'refuse all',
		'deny all',
		'do not accept',
		'essential only',
		'reject',
	];

	const SAVE_TEXTS = ['guardar', 'gravar', 'salvar', 'confirmar minhas escolhas', 'guardar alterações', 'save', 'save preferences', 'save changes', 'submit preferences'];

	const PREFS_TEXTS = ['saiba mais', 'saber mais', 'gerir cookies', 'personalizar', 'definições', 'preferências', 'manage cookies', 'cookie settings'];

	// --- 2. LOGIC ENGINE ---

	let isProcessing = false;
	let bannerReported = false;

	function log(msg, el) {
		console.log(`[Cookie Eater] ${msg}`, el || '');
	}

	// Finds the active cookie banner on the page
	function getActiveBanner() {
		for (const sel of BANNER_SELECTORS) {
			const el = document.querySelector(sel);
			if (el && isElementVisible(el)) return el;
		}
		return null;
	}

	function isElementVisible(el) {
		if (!el) return false;
		const s = window.getComputedStyle(el);
		const rect = el.getBoundingClientRect();
		return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && rect.width > 0;
	}

	function textOf(el) {
		return (el.innerText || el.textContent || el.getAttribute('aria-label') || '').toLowerCase().trim().replace(/\s+/g, ' ');
	}

	// Simulates a real user click
	function forceClick(el) {
		if (!el) return;
		const events = ['mousedown', 'mouseup', 'click'];
		events.forEach(type => {
			el.dispatchEvent(new MouseEvent(type, { view: window, bubbles: true, cancelable: true, buttons: 1 }));
		});
	}

	function run() {
		if (isProcessing) return;

		// IMPORTANT: Find the banner first. If no banner, DO NOTHING.
		const activeBanner = getActiveBanner();
		if (!activeBanner) return;

		// --- INSIDE THE BANNER LOGIC ---

		const allButtons = activeBanner.querySelectorAll("button, [role='button'], span, div[class*='btn']");
		let saveBtn = null;

		// 1. Check for ENABLED Save Button
		for (const el of allButtons) {
			const txt = textOf(el);
			if (SAVE_TEXTS.includes(txt) && isElementVisible(el)) {
				if (!el.disabled && el.getAttribute('aria-disabled') !== 'true') {
					saveBtn = el;
					break;
				}
			}
		}

		if (saveBtn) {
			log('Final Step: Saving changes', saveBtn);
			isProcessing = true;
			forceClick(saveBtn);
			setTimeout(() => {
				isProcessing = false;
			}, 2000);
			return;
		}

		// 2. Look for "Reject" buttons to toggle
		let clickedSomething = false;
		for (const el of allButtons) {
			// Skip links that lead to other pages
			if (el.tagName === 'A' && el.getAttribute('href') && !el.getAttribute('href').startsWith('#')) continue;

			const txt = textOf(el);
			if (REJECT_TEXTS.includes(txt) && isElementVisible(el)) {
				log('Toggling Reject option', el);
				forceClick(el);
				clickedSomething = true;
			}
		}

		if (clickedSomething) {
			isProcessing = true;
			setTimeout(() => {
				isProcessing = false;
			}, 500);
			return;
		}

		// 3. If still idle, try to open the preferences panel
		for (const el of allButtons) {
			const txt = textOf(el);
			if (PREFS_TEXTS.includes(txt) && isElementVisible(el)) {
				log('Opening preferences panel', el);
				forceClick(el);
				isProcessing = true;
				setTimeout(() => {
					isProcessing = false;
				}, 1000);
				return;
			}
		}
	}

	function init() {
		log('Surgical Scanner initialized.');
		setInterval(run, 1000);

		const obs = new MutationObserver(run);
		obs.observe(document.documentElement, { childList: true, subtree: true });
	}
})();
