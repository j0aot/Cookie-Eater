
'use strict';

const TRACKER_DOMAINS = [
	'google-analytics.com',
	'googletagmanager.com',
	'googletagservices.com',
	'doubleclick.net',
	'connect.facebook.net',
	'hotjar.com',
	'segment.com',
	'segment.io',
	'mixpanel.com',
	'amplitude.com',
	'fullstory.com',
	'mouseflow.com',
	'crazyegg.com',
	'heap.io',
	'clarity.ms',
	'analytics.twitter.com',
	'bat.bing.com',
	'analytics.tiktok.com',
	'ct.pinterest.com',
	'scorecardresearch.com',
	'comscore.com',
	'quantserve.com',
	'newrelic.com',
	'nr-data.net',
	'sentry.io',
	'bugsnag.com',
	'intercom.io',
	'datadog-browser-agent.com',
	'matomo.cloud',
	'piwik.pro',
	'logrocket.com',
	'stats.wp.com',
];

const DEFAULT_SETTINGS = {
	enabled: true,
	autoDeleteOnTabClose: true,
	maxCookieLifetimeDays: 0,
	cleanLocalStorage: true,
	cleanSessionStorage: false,
	stripTrackingParams: true,
	fingerprintProtection: true,
	scheduledCleaningIntervalHours: 0,
	showStartupReport: true,
	contextMenuEnabled: true,
	showBadgeCount: true,
	autoIncognitoThreshold: 0,
	syncSettings: false,
};

const DEFAULT_STATS = {
	cookiesDeleted: 0,
	trackersBlocked: 0,
	bannersRejected: 0,
	domainsProtected: 0,
	storageItemsCleared: 0,
	sessionsStarted: 0,
	lastReset: Date.now(),
};

const tabDomains = new Map();


chrome.runtime.onInstalled.addListener(async ({ reason }) => {
	if (reason === 'install') {
		await store({
			settings: DEFAULT_SETTINGS,
			stats: DEFAULT_STATS,
			whitelist: [],
			siteRules: [],
			profiles: [],
			activeProfile: null,
			auditLog: [],
			trackerMap: {},
			riskScores: {},
			consentReceipts: [],
			honeypots: [],
		});
	}
	setupContextMenus();
	setupAlarms();
});

chrome.runtime.onStartup.addListener(async () => {
	setupAlarms();
	await incrementStat('sessionsStarted');
	const { settings, stats } = await load(['settings', 'stats']);
	if (settings?.showStartupReport) showStartupReport(stats);
});



const SYNC_KEYS = ['settings', 'whitelist', 'siteRules', 'profiles', 'activeProfile'];

const load = keys =>
	new Promise(resolve => {
		const keysArray = Array.isArray(keys) ? keys : [keys];

		const syncKeys = keysArray.filter(k => SYNC_KEYS.includes(k));
		const localKeys = keysArray.filter(k => !SYNC_KEYS.includes(k));

		Promise.all([
			syncKeys.length ? new Promise(r => chrome.storage.sync.get(syncKeys, r)) : Promise.resolve({}),
			localKeys.length ? new Promise(r => chrome.storage.local.get(localKeys, r)) : Promise.resolve({}),
		]).then(([syncData, localData]) => {
			resolve({ ...syncData, ...localData });
		});
	});

const store = data =>
	new Promise(resolve => {
		const syncData = {};
		const localData = {};

		for (const key in data) {
			if (SYNC_KEYS.includes(key)) syncData[key] = data[key];
			else localData[key] = data[key];
		}

		Promise.all([
			Object.keys(syncData).length ? new Promise(r => chrome.storage.sync.set(syncData, r)) : Promise.resolve(),
			Object.keys(localData).length ? new Promise(r => chrome.storage.local.set(localData, r)) : Promise.resolve(),
		]).then(resolve);
	});

async function incrementStat(key, n = 1) {
	const { stats } = await load('stats');
	const s = { ...(stats || DEFAULT_STATS) };
	s[key] = (s[key] || 0) + n;
	await store({ stats: s });
}


function setupContextMenus() {
	chrome.contextMenus.removeAll(() => {
		const items = [
			{ id: 'clear-cookies', title: '🍪 Clear cookies for this domain', contexts: ['page', 'link'] },
			{ id: 'whitelist-domain', title: '✅ Add to whitelist', contexts: ['page'] },
			{ id: 'greylist-domain', title: '🔘 Add to greylist', contexts: ['page'] },
			{ id: 'view-risk', title: '🛡️ View privacy score', contexts: ['page'] },
			{ id: 'open-settings', title: '⚙️ Open settings', contexts: ['page'] },
		];
		items.forEach(i => chrome.contextMenus.create(i));
	});
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	if (!tab?.url) return;
	const domain = host(tab.url);
	switch (info.menuItemId) {
		case 'clear-cookies':
			const n = await clearDomainCookies(domain, tab.url);
			notify('🍪 Cookies cleared', `${n} cookies removed from ${domain}`);
			break;
		case 'whitelist-domain':
			await upsertWhitelist(domain, 'white');
			notify('✅ Whitelist', `${domain} added to whitelist.`);
			break;
		case 'greylist-domain':
			await upsertWhitelist(domain, 'grey');
			notify('🔘 Greylist', `${domain} added to greylist.`);
			break;
		case 'view-risk':
			chrome.tabs.create({ url: `chrome-extension://${chrome.runtime.id}/options.html#risk=${domain}` });
			break;
		case 'open-settings':
			chrome.tabs.create({ url: `chrome-extension://${chrome.runtime.id}/options.html` });
			break;
	}
});


async function setupAlarms() {
	chrome.alarms.clear('scheduled-clean');
	const { settings } = await load('settings');
	const h = settings?.scheduledCleaningIntervalHours || 0;
	if (h > 0) chrome.alarms.create('scheduled-clean', { periodInMinutes: h * 60 });
}

chrome.alarms.onAlarm.addListener(async ({ name }) => {
	if (name === 'scheduled-clean') await scheduledClean();
});

async function scheduledClean() {
	const all = await chrome.cookies.getAll({});
	const { whitelist, siteRules } = await load(['whitelist', 'siteRules']);
	let deleted = 0;
	for (const c of all) {
		const d = c.domain.replace(/^\./, '');
		if (await isWhitelisted(d, c.name, whitelist)) continue;
		const rule = getSiteRule(d, siteRules);
		if (rule === 'keep-all') continue;
		await removeCookie(c);
		deleted++;
	}
	await incrementStat('cookiesDeleted', deleted);
	await audit('scheduled-clean', 'all', `${deleted} cookies`);
	notify('📅 Scheduled cleaning', `${deleted} cookies automatically removed.`);
}


chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) return;
	if (changeInfo.status !== 'complete' && !changeInfo.url) return;
	const domain = host(tab.url);
	tabDomains.set(tabId, { domain, url: tab.url });
	const { settings } = await load('settings');
	if (settings?.showBadgeCount) updateBadge(tabId, domain);
	if (settings?.autoIncognitoThreshold > 0) checkAutoIncognito(tab, domain, settings.autoIncognitoThreshold);
});

chrome.tabs.onRemoved.addListener(async tabId => {
	const info = tabDomains.get(tabId);
	tabDomains.delete(tabId);
	if (!info) return;
	const { settings, whitelist, siteRules } = await load(['settings', 'whitelist', 'siteRules']);
	if (!settings?.enabled || !settings?.autoDeleteOnTabClose) return;
	const { domain, url } = info;
	if (await isWhitelisted(domain, '*', whitelist)) return;
	const rule = getSiteRule(domain, siteRules);
	if (rule === 'keep-all') return;
	const tabs = await chrome.tabs.query({});
	if (tabs.some(t => t.url && host(t.url) === domain)) return;
	const n = await clearDomainCookies(domain, url, whitelist, rule);
	if (n > 0) await incrementStat('domainsProtected');
});

async function updateBadge(tabId, domain) {
	try {
		const cookies = await chrome.cookies.getAll({ domain });
		const n = cookies.length;
		const text = n > 0 ? String(n) : '';
		const color = n > 20 ? '#f43f5e' : n > 8 ? '#f97316' : '#10b981';
		chrome.action.setBadgeText({ text, tabId });
		chrome.action.setBadgeBackgroundColor({ color, tabId });
	} catch (_) {}
}

async function clearDomainCookies(domain, url, whitelist, rule) {
	if (!domain) return 0;
	if (!whitelist) ({ whitelist } = await load('whitelist'));
	if (!rule) {
		const { siteRules } = await load('siteRules');
		rule = getSiteRule(domain, siteRules);
	}
	const cookies = await chrome.cookies.getAll({ domain });
	let deleted = 0;
	for (const c of cookies) {
		const cd = c.domain.replace(/^\./, '');
		if (await isWhitelisted(cd, c.name, whitelist || [])) continue;
		if (rule === 'keep-all') continue;
		if (rule === 'delete-third-party' && cd === domain) continue;
		await removeCookie(c, url);
		await audit('deleted', cd, c.name);
		deleted++;
	}
	if (deleted > 0) await incrementStat('cookiesDeleted', deleted);
	return deleted;
}

async function removeCookie(cookie, url) {
	const base = `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
	const tryUrl = url || base;
	try {
		await chrome.cookies.remove({ url: tryUrl, name: cookie.name });
	} catch (_) {
		try {
			await chrome.cookies.remove({ url: base, name: cookie.name });
		} catch (__) {}
	}
}

chrome.cookies.onChanged.addListener(async ({ removed, cookie }) => {
	if (removed) return;
	const { settings } = await load('settings');
	if (!settings?.enabled) return;
	const domain = cookie.domain.replace(/^\./, '');

	await audit('set', domain, cookie.name);

	const maxDays = settings?.maxCookieLifetimeDays || 0;
	if (maxDays > 0 && cookie.expirationDate) {
		const maxTs = Date.now() / 1000 + maxDays * 86400;
		if (cookie.expirationDate > maxTs) {
			await audit('lifetime-exceeded', domain, cookie.name);
		}
	}

	const cat = classifyCookie(cookie.name, domain);
	if (cat === 'Analytics' || cat === 'Marketing') {
		await updateRisk(domain, `${cat}: ${cookie.name}`);
	}

	detectHoneypot(cookie, domain);
});

async function isWhitelisted(domain, cookieName, whitelist) {
	if (!whitelist) ({ whitelist } = await load('whitelist'));
	for (const e of whitelist || []) {
		if (domain !== e.domain && !domain.endsWith('.' + e.domain)) continue;
		if (e.type === 'white') return true;
		if (e.type === 'grey' && (cookieName === '*' ? false : e.cookies?.includes(cookieName))) return true;
	}
	return false;
}

async function upsertWhitelist(domain, type, cookies = []) {
	const { whitelist } = await load('whitelist');
	const wl = [...(whitelist || [])];
	const idx = wl.findIndex(e => e.domain === domain);
	if (idx >= 0) wl[idx] = { domain, type, cookies };
	else wl.push({ domain, type, cookies });
	await store({ whitelist: wl });
}


function getSiteRule(domain, siteRules) {
	const r = (siteRules || []).find(r => domain === r.domain || domain.endsWith('.' + r.domain));
	return r?.rule || null;
}


async function audit(action, domain, name = '', value = '') {
	const { auditLog } = await load('auditLog');
	const log = [{ ts: Date.now(), action, domain, name, value }, ...(auditLog || [])];
	if (log.length > 1000) log.length = 1000;
	await store({ auditLog: log });
}


async function updateRisk(domain, factor) {
	const { riskScores } = await load('riskScores');
	const rs = riskScores || {};
	if (!rs[domain]) rs[domain] = { score: 0, factors: [], lastUpdated: Date.now() };
	if (!rs[domain].factors.includes(factor)) {
		rs[domain].factors.push(factor);
		rs[domain].score = Math.min(100, rs[domain].factors.length * 10);
		rs[domain].lastUpdated = Date.now();
		await store({ riskScores: rs });
	}
}

function riskLabel(score) {
	if (score >= 80) return { label: 'Critical', color: '#f43f5e' };
	if (score >= 50) return { label: 'High', color: '#f97316' };
	if (score >= 25) return { label: 'Medium', color: '#f59e0b' };
	return { label: 'Low', color: '#10b981' };
}


async function detectHoneypot(cookie, domain) {
	const { value = '', name } = cookie;
	const longRandom = value.length >= 32 && /^[a-f0-9\-_=+/A-Z]{32,}$/.test(value);
	const suspiciousName = /^_[a-z]{2,8}$/.test(name) || /^__[a-z_]+$/.test(name);
	if (!longRandom || !suspiciousName) return;
	const { honeypots } = await load('honeypots');
	const list = honeypots || [];
	if (list.find(h => h.domain === domain && h.name === name)) return;
	list.unshift({ domain, name, detected: Date.now(), value: value.slice(0, 16) + '…' });
	if (list.length > 200) list.length = 200;
	await store({ honeypots: list });
	await updateRisk(domain, `Suspicious honeypot: ${name}`);
}


async function checkAutoIncognito(tab, domain, threshold) {
	if (tab.incognito) return;
	const { riskScores } = await load('riskScores');
	const score = riskScores?.[domain]?.score || 0;
	if (score < threshold) return;
	chrome.notifications.create(`incognito-${tab.id}`, {
		type: 'basic',
		iconUrl: 'icons/icon48.png',
		title: '⚠️ High risk site detected',
		message: `${domain} has a score of ${score}/100. Open in incognito mode?`,
		buttons: [{ title: 'Open incognito' }, { title: 'Ignore' }],
		requireInteraction: true,
	});
}

chrome.notifications.onButtonClicked.addListener(async (id, btnIdx) => {
	if (id.startsWith('incognito-') && btnIdx === 0) {
		const tabId = parseInt(id.split('-')[1]);
		const tab = await chrome.tabs.get(tabId).catch(() => null);
		if (tab) chrome.windows.create({ incognito: true, url: tab.url });
	}
	chrome.notifications.clear(id);
});


chrome.webRequest.onCompleted.addListener(
	async details => {
		if (details.type === 'main_frame' || details.tabId < 0) return;
		const trackerDomain = host(details.url);
		if (!TRACKER_DOMAINS.some(t => trackerDomain === t || trackerDomain.endsWith('.' + t))) return;
		const tab = await chrome.tabs.get(details.tabId).catch(() => null);
		if (!tab?.url) return;
		const mainDomain = host(tab.url);
		if (!mainDomain || mainDomain === trackerDomain) return;
		const { trackerMap } = await load('trackerMap');
		const tm = trackerMap || {};
		if (!tm[mainDomain]) tm[mainDomain] = {};
		tm[mainDomain][trackerDomain] = (tm[mainDomain][trackerDomain] || 0) + 1;
		await store({ trackerMap: tm });
		await updateRisk(mainDomain, `Tracker: ${trackerDomain}`);
		await incrementStat('trackersBlocked');
	},
	{ urls: ['<all_urls>'], types: ['script', 'xmlhttprequest', 'image'] },
);


function showStartupReport(stats) {
	if (!stats) return;
	chrome.notifications.create('startup', {
		type: 'basic',
		iconUrl: 'icons/icon48.png',
		title: 'Cookie Eater — Session Report',
		message: `🍪 ${stats.cookiesDeleted || 0} cookies removed\n` + `🚫 ${stats.trackersBlocked || 0} trackers blocked\n` + `🛡️ ${stats.domainsProtected || 0} protected domains`,
	});
}


async function saveProfile(name) {
	const { profiles, settings, whitelist } = await load(['profiles', 'settings', 'whitelist']);
	const list = [...(profiles || [])];
	list.push({ id: Date.now().toString(), name, settings, whitelist, createdAt: Date.now() });
	await store({ profiles: list });
}

async function loadProfile(id) {
	const { profiles } = await load('profiles');
	const p = (profiles || []).find(p => p.id === id);
	if (!p) throw new Error('Profile not found');
	await store({ settings: p.settings, whitelist: p.whitelist, activeProfile: id });
	setupContextMenus();
	setupAlarms();
}


chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
	dispatch(msg)
		.then(reply)
		.catch(e => reply({ error: e.message }));
	return true;
});

async function dispatch(msg) {
	switch (msg.action) {
		case 'getStats':
			return load(['stats', 'settings']);
		case 'clearStats':
			await store({ stats: { ...DEFAULT_STATS, lastReset: Date.now() } });
			return { ok: true };

		case 'getCookies': {
			const cookies = await chrome.cookies.getAll({ domain: msg.domain });
			const { whitelist } = await load('whitelist');
			return cookies.map(c => ({
				...c,
				category: classifyCookie(c.name, c.domain),
				whitelisted: (whitelist || []).some(e => e.domain === c.domain.replace(/^\./, '') && (e.type === 'white' || e.cookies?.includes(c.name))),
			}));
		}
		case 'clearDomain': {
			const n = await clearDomainCookies(msg.domain, msg.url);
			return { count: n };
		}
		case 'clearAll': {
			const all = await chrome.cookies.getAll({});
			for (const c of all) await removeCookie(c);
			await incrementStat('cookiesDeleted', all.length);
			return { count: all.length };
		}

		case 'getSettings': {
			const { settings } = await load('settings');
			return settings || DEFAULT_SETTINGS;
		}
		case 'saveSettings': {
			const { settings } = await load('settings');
			await store({ settings: { ...settings, ...msg.settings } });
			setupContextMenus();
			setupAlarms();
			return { ok: true };
		}

		case 'getWhitelist': {
			const { whitelist } = await load('whitelist');
			return whitelist || [];
		}
		case 'saveWhitelist':
			await store({ whitelist: msg.whitelist });
			return { ok: true };

		case 'getSiteRules': {
			const { siteRules } = await load('siteRules');
			return siteRules || [];
		}
		case 'saveSiteRules':
			await store({ siteRules: msg.siteRules });
			return { ok: true };

		case 'getProfiles':
			return load(['profiles', 'activeProfile']);
		case 'saveProfile':
			await saveProfile(msg.name);
			return { ok: true };
		case 'loadProfile':
			await loadProfile(msg.id);
			return { ok: true };
		case 'deleteProfile': {
			const { profiles } = await load('profiles');
			await store({ profiles: (profiles || []).filter(p => p.id !== msg.id) });
			return { ok: true };
		}
		case 'getAuditLog': {
			const { auditLog } = await load('auditLog');
			return (auditLog || []).slice(0, msg.limit || 300);
		}
		case 'clearAuditLog':
			await store({ auditLog: [] });
			return { ok: true };

		case 'getRisk': {
			const { riskScores } = await load('riskScores');
			const d = riskScores?.[msg.domain] || { score: 0, factors: [] };
			return { ...d, ...riskLabel(d.score) };
		}
		case 'getAllRisks': {
			const { riskScores } = await load('riskScores');
			return riskScores || {};
		}
		case 'clearRisks':
			await store({ riskScores: {} });
			return { ok: true };

		case 'getTrackerMap': {
			const { trackerMap } = await load('trackerMap');
			return trackerMap || {};
		}

		case 'getReceipts': {
			const { consentReceipts } = await load('consentReceipts');
			return consentReceipts || [];
		}
		case 'clearReceipts':
			await store({ consentReceipts: [] });
			return { ok: true };

		case 'getHoneypots': {
			const { honeypots } = await load('honeypots');
			return honeypots || [];
		}

		case 'getReport': {
			const data = await load(['stats', 'riskScores', 'trackerMap', 'consentReceipts', 'honeypots', 'auditLog']);
			const trackers = data.trackerMap || {};
			const topTrackers = Object.values(trackers)
				.flatMap(t => Object.entries(t))
				.reduce((acc, [d, n]) => {
					acc[d] = (acc[d] || 0) + n;
					return acc;
				}, {});
			return {
				generatedAt: new Date().toISOString(),
				stats: data.stats || DEFAULT_STATS,
				summary: {
					highRiskDomains: Object.entries(data.riskScores || {}).filter(([, v]) => v.score >= 50).length,
					honeypots: (data.honeypots || []).length,
					receipts: (data.consentReceipts || []).length,
					topTrackers: Object.entries(topTrackers)
						.sort(([, a], [, b]) => b - a)
						.slice(0, 10)
						.map(([d, n]) => ({ d, n })),
				},
				riskScores: data.riskScores || {},
				honeypots: data.honeypots || [],
				consentReceipts: (data.consentReceipts || []).slice(0, 50),
			};
		}

		case 'export': {
			const d = await load(['settings', 'whitelist', 'siteRules', 'profiles']);
			return { config: JSON.stringify(d, null, 2) };
		}
		case 'import': {
			try {
				const p = JSON.parse(msg.config);
				const safe = {};
				['settings', 'whitelist', 'siteRules', 'profiles'].forEach(k => {
					if (p[k]) safe[k] = p[k];
				});
				await store(safe);
				setupContextMenus();
				setupAlarms();
				return { ok: true };
			} catch (e) {
				return { error: 'Invalid JSON: ' + e.message };
			}
		}

		case 'rejected':
			await incrementStat('bannersRejected');
			await audit('banner-rejected', msg.site, 'cookie-banner', msg.bannerType || 'auto');
			const { consentReceipts } = await load('consentReceipts');
			const rlist = [{ domain: msg.site, ts: Date.now(), bannerType: msg.bannerType || 'auto', proof: 'auto-clicked' }, ...(consentReceipts || [])];
			if (rlist.length > 500) rlist.length = 500;
			await store({ consentReceipts: rlist });
			return { ok: true };

		case 'storageCleared':
			await incrementStat('storageItemsCleared', msg.count || 1);
			return { ok: true };

		default:
			return { error: 'Unknown: ' + msg.action };
	}
}


function host(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch (_) {
		return '';
	}
}

function classifyCookie(name, domain) {
	const n = name.toLowerCase();
	if (/^(_ga|_gid|_gat|__utm|_gcl|amplitude_id|mp_|ajs_|heap_|__hstc|_hjid|mkto_|_mkto)/.test(n)) return 'Analytics';
	if (/^(_fbp|_fbc|fr$|tr$|__gads|ide$|nid$|__gpi|_tt_|tiktok|_pin_unauth|anj)/.test(n)) return 'Marketing';
	if (/(session|csrf|xsrf|token|auth|cart|basket|user|account|login|lang|locale|currency|theme|pref|remember)/i.test(n)) return 'Functional';
	if (/^(phpsessid|jsessionid|asp\.net_|sid$|laravel_session|connect\.sid|ci_session)$/i.test(n)) return 'Session';
	return 'Unknown';
}

function notify(title, message) {
	chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title, message });
}
