(function () {
	'use strict';

	const DEBUG = false;
	const PATCH_FLAG = '__cookieEaterPrivacyPatched__';

	bootstrap();

	async function bootstrap() {
		if (window[PATCH_FLAG]) return;
		window[PATCH_FLAG] = true;

		const s = await getSettings();
		if (s.enabled === false) return;
		if (s.fingerprintProtection) applyFingerprintProtection();
		if (s.stripTrackingParams) stripTrackingParams();
		if (s.cleanLocalStorage || s.cleanSessionStorage) {
			cleanWebStorage(s.cleanLocalStorage, s.cleanSessionStorage);
		}
	}

	async function getSettings() {
		const [syncData, localData] = await Promise.all([
			new Promise(resolve => chrome.storage.sync.get('settings', resolve)),
			new Promise(resolve => chrome.storage.local.get('settings', resolve)),
		]);
		return {
			enabled: true,
			fingerprintProtection: true,
			stripTrackingParams: true,
			cleanLocalStorage: true,
			cleanSessionStorage: false,
			...(localData?.settings || {}),
			...(syncData?.settings || {}),
		};
	}

	function applyFingerprintProtection() {
		const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
		HTMLCanvasElement.prototype.toDataURL = function (type, quality) {
			noisifyCanvas(this);
			return origToDataURL.call(this, type, quality);
		};

		const origToBlob = HTMLCanvasElement.prototype.toBlob;
		if (origToBlob) {
			HTMLCanvasElement.prototype.toBlob = function (cb, type, quality) {
				noisifyCanvas(this);
				return origToBlob.call(this, cb, type, quality);
			};
		}

		const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
		CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h) {
			const data = origGetImageData.call(this, x, y, w, h);
			for (let i = 0; i < data.data.length; i += 4) {
				data.data[i] = clamp(data.data[i] + randNoise());
				data.data[i + 1] = clamp(data.data[i + 1] + randNoise());
				data.data[i + 2] = clamp(data.data[i + 2] + randNoise());
			}
			return data;
		};

		if (window.WebGLRenderingContext) {
			const getParamOrig = WebGLRenderingContext.prototype.getParameter;
			WebGLRenderingContext.prototype.getParameter = function (param) {
				if (param === 37445) return 'Intel Inc.';
				if (param === 37446) return 'Intel Iris OpenGL Engine';
				return getParamOrig.call(this, param);
			};
		}

		if (window.AudioBuffer) {
			const origGetChannelData = AudioBuffer.prototype.getChannelData;
			AudioBuffer.prototype.getChannelData = function (channel) {
				const data = origGetChannelData.call(this, channel);
				for (let i = 0; i < data.length; i += 100) {
					data[i] += (Math.random() - 0.5) * 0.0001;
				}
				return data;
			};
		}

		try {
			Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
			Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
			Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
		} catch (_) {}

		try {
			Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
			Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
		} catch (_) {}

		if (navigator.getBattery) {
			navigator.getBattery = () =>
				Promise.resolve({
					charging: true,
					chargingTime: 0,
					dischargingTime: Infinity,
					level: 1.0,
					addEventListener: () => {},
				});
		}

		try {
			Object.defineProperty(navigator, 'plugins', {
				get: () => {
					const fakePlugin = { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: '', length: 0 };
					const arr = [fakePlugin];
					arr.refresh = () => {};
					Object.setPrototypeOf(arr, PluginArray.prototype);
					return arr;
				},
			});
		} catch (_) {}
	}

	function noisifyCanvas(canvas) {
		try {
			const ctx = canvas.getContext('2d');
			if (!ctx || canvas.width === 0 || canvas.height === 0) return;
			const pixel = ctx.getImageData(0, 0, 1, 1);
			pixel.data[0] = clamp(pixel.data[0] + randNoise());
			ctx.putImageData(pixel, 0, 0);
		} catch (_) {}
	}

	function randNoise() {
		return Math.floor((Math.random() - 0.5) * 3);
	}

	function clamp(v) {
		return Math.max(0, Math.min(255, v));
	}

	const TRACKING_PARAMS = new Set([
		'utm_source',
		'utm_medium',
		'utm_campaign',
		'utm_term',
		'utm_content',
		'utm_id',
		'utm_source_platform',
		'utm_creative_format',
		'utm_marketing_tactic',
		'gclid',
		'gclsrc',
		'dclid',
		'gad_source',
		'_gl',
		'fbclid',
		'fb_action_ids',
		'fb_action_types',
		'fb_source',
		'fb_ref',
		'msclkid',
		'twclid',
		'mc_cid',
		'mc_eid',
		'_hsenc',
		'_hsmi',
		'hsa_acc',
		'hsa_cam',
		'hsa_grp',
		'hsa_ad',
		'hsa_src',
		'hsa_tgt',
		'hsa_kw',
		'hsa_mt',
		'hsa_net',
		'hsa_ver',
		'mkt_tok',
		'__s',
		'klaviyo_id',
		'sib_uid',
		'ttclid',
		'li_fat_id',
		'rdt_cid',
		'ScCid',
		'ref',
		'source',
		'affiliate',
		'partner',
		'campaign',
		'cid',
		'sid',
		'zanpid',
		'tag',
		'igshid',
		's_kwcid',
		'ef_id',
	]);

	function stripTrackingParams() {
		try {
			const url = new URL(window.location.href);
			let changed = false;
			for (const key of [...url.searchParams.keys()]) {
				if (TRACKING_PARAMS.has(key) || /^utm_/i.test(key)) {
					url.searchParams.delete(key);
					changed = true;
				}
			}
			if (changed) {
				const clean = url.toString();
				history.replaceState(history.state, '', clean);
				log('URL stripped:', window.location.href, '->', clean);
			}
		} catch (_) {}
	}

	const STORAGE_TRACKER_PATTERNS = [
		/^_ga$/i,
		/^_gid$/i,
		/^_fbp$/i,
		/^_fbc$/i,
		/^amplitude_/i,
		/^mp_/i,
		/^mixpanel_/i,
		/^ajs_/i,
		/^analytics_/i,
		/^__hstc$/i,
		/^hubspot/i,
		/^intercom\./i,
		/^hs_/i,
		/^optimizely/i,
		/^heap_/i,
		/^hotjar_/i,
		/^_hjid/i,
		/^segment_/i,
		/^td_/i,
		/^vero_/i,
		/^criteo/i,
		/^_lr_/i,
		/^fs\./i,
		/^datadog/i,
		/^dd_/i,
	];

	const STORAGE_FUNCTIONAL_PATTERNS = [
		/cart/i,
		/basket/i,
		/auth/i,
		/token/i,
		/session/i,
		/user/i,
		/account/i,
		/login/i,
		/csrf/i,
		/xsrf/i,
		/lang/i,
		/locale/i,
		/theme/i,
		/pref/i,
		/setting/i,
		/wishlist/i,
		/favorite/i,
		/draft/i,
		/remember/i,
	];

	function cleanWebStorage(cleanLocal, cleanSession) {
		let cleared = 0;

		function processStorage(storage) {
			const toDelete = [];
			for (let i = 0; i < storage.length; i++) {
				const key = storage.key(i);
				if (!key) continue;
				const isTracker = STORAGE_TRACKER_PATTERNS.some(p => p.test(key));
				const isFunctional = STORAGE_FUNCTIONAL_PATTERNS.some(p => p.test(key));
				if (isTracker && !isFunctional) toDelete.push(key);
			}
			toDelete.forEach(k => {
				storage.removeItem(k);
				cleared++;
			});
		}

		try {
			if (cleanLocal) processStorage(localStorage);
		} catch (_) {}
		try {
			if (cleanSession) processStorage(sessionStorage);
		} catch (_) {}

		if (cleared > 0) {
			log(`Cleared ${cleared} tracking storage items`);
			try {
				chrome.runtime.sendMessage({ action: 'storageCleared', count: cleared });
			} catch (_) {}
		}
	}

	function log(...args) {
		if (DEBUG) console.debug('[Cookie Eater]', ...args);
	}
})();

