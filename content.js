(function () {
	'use strict';

	const DEBUG = false;

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
		'nao aceito nenhum',
		'não aceito nenhum',
		'rejeitar tudo',
		'rejeitar todos',
		'recusar tudo',
		'nao aceitar',
		'não aceitar',
		'apenas necessarios',
		'apenas necessários',
		'reject all',
		'decline all',
		'refuse all',
		'deny all',
		'do not accept',
		'essential only',
		'reject',
	];

	const SAVE_TEXTS = [
		'guardar',
		'gravar',
		'salvar',
		'confirmar minhas escolhas',
		'guardar alteracoes',
		'guardar alterações',
		'save',
		'save preferences',
		'save changes',
		'submit preferences',
	];

	const PREFS_TEXTS = [
		'saiba mais',
		'saber mais',
		'gerir cookies',
		'personalizar',
		'definicoes',
		'definições',
		'preferencias',
		'preferências',
		'manage cookies',
		'cookie settings',
	];

	let isProcessing = false;
	let bannerReported = false;
	let queueTimer = null;

	bootstrap();

	async function bootstrap() {
		const settings = await getSettings();
		if (settings.enabled === false) return;
		init();
	}

	async function getSettings() {
		const [syncData, localData] = await Promise.all([
			new Promise(resolve => chrome.storage.sync.get('settings', resolve)),
			new Promise(resolve => chrome.storage.local.get('settings', resolve)),
		]);

		return {
			enabled: true,
			...(localData?.settings || {}),
			...(syncData?.settings || {}),
		};
	}

	function log(...args) {
		if (DEBUG) console.debug('[Cookie Eater]', ...args);
	}

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
		return (el.innerText || el.textContent || el.getAttribute('aria-label') || '')
			.toLowerCase()
			.trim()
			.replace(/\s+/g, ' ');
	}

	function forceClick(el) {
		if (!el) return;
		const events = ['mousedown', 'mouseup', 'click'];
		events.forEach(type => {
			el.dispatchEvent(new MouseEvent(type, { view: window, bubbles: true, cancelable: true, buttons: 1 }));
		});
	}

	function reportRejection(kind = 'auto') {
		if (bannerReported) return;
		bannerReported = true;
		try {
			chrome.runtime.sendMessage({
				action: 'rejected',
				site: window.location.hostname.replace(/^www\./, ''),
				bannerType: kind,
			});
		} catch (_) {}
	}

	function run() {
		if (isProcessing) return false;

		const activeBanner = getActiveBanner();
		if (!activeBanner) return false;

		const allButtons = activeBanner.querySelectorAll("button, [role='button'], span, div[class*='btn']");
		let saveBtn = null;

		for (const el of allButtons) {
			const txt = textOf(el);
			if (SAVE_TEXTS.includes(txt) && isElementVisible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true') {
				saveBtn = el;
				break;
			}
		}

		if (saveBtn) {
			log('Final step: saving changes', saveBtn);
			isProcessing = true;
			forceClick(saveBtn);
			reportRejection('save');
			setTimeout(() => {
				isProcessing = false;
			}, 2000);
			return true;
		}

		let clickedSomething = false;
		for (const el of allButtons) {
			if (el.tagName === 'A' && el.getAttribute('href') && !el.getAttribute('href').startsWith('#')) continue;
			const txt = textOf(el);
			if (REJECT_TEXTS.includes(txt) && isElementVisible(el)) {
				log('Toggling reject option', el);
				forceClick(el);
				clickedSomething = true;
			}
		}

		if (clickedSomething) {
			isProcessing = true;
			reportRejection('reject');
			setTimeout(() => {
				isProcessing = false;
			}, 500);
			return true;
		}

		for (const el of allButtons) {
			const txt = textOf(el);
			if (PREFS_TEXTS.includes(txt) && isElementVisible(el)) {
				log('Opening preferences panel', el);
				forceClick(el);
				isProcessing = true;
				setTimeout(() => {
					isProcessing = false;
				}, 1000);
				return true;
			}
		}

		return false;
	}

	function queueRun(delay = 120) {
		if (queueTimer) return;
		queueTimer = setTimeout(() => {
			queueTimer = null;
			run();
		}, delay);
	}

	function init() {
		log('Surgical scanner initialized.');
		queueRun(50);
		queueRun(800);
		queueRun(1800);

		const observer = new MutationObserver(() => queueRun(100));
		observer.observe(document.documentElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class', 'style', 'aria-hidden', 'hidden'],
		});

		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) queueRun(120);
		});
	}
})();

