'use strict';

const $ = id => document.getElementById(id);
let currentDomain = '';
let currentTab = null;

function createEl(tag, attrs = {}, children = []) {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) {
		if (k === 'className') el.className = v;
		else if (k === 'textContent') el.textContent = v;
		else if (k === 'title') el.title = v;
		else el.setAttribute(k, v);
	}
	for (const child of children) {
		if (child) el.appendChild(child);
	}
	return el;
}

async function init() {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	currentTab = tab;
	currentDomain = tab?.url ? host(tab.url) : '';

	const settings = await msg('getSettings');
	$('toggle').checked = settings?.enabled !== false;

	if (currentDomain) {
		$('site-name').textContent = currentDomain;
		$('favicon').src = `https://www.google.com/s2/favicons?domain=${currentDomain}&sz=16`;
		loadRisk();
		loadCookies();
	} else {
		$('site-name').textContent = 'Extension / New tab';
		$('cookies-list').replaceChildren(createEl('div', { className: 'no-cookies', textContent: 'Open a website to view cookies.' }));
	}

	loadStats();
	bindEvents();
}

function bindEvents() {
	$('toggle').addEventListener('change', async () => {
		const enabled = $('toggle').checked;
		await msg('saveSettings', { settings: { enabled } });
		toast(enabled ? '✅ Protection enabled' : '⏸ Protection paused');
	});

	$('btn-clear').addEventListener('click', async () => {
		if (!currentDomain) return;
		const { count } = await msg('clearDomain', { domain: currentDomain, url: currentTab?.url });
		toast(`🧹 ${count} cookies removed`);
		loadCookies();
		loadStats();
	});

	$('btn-whitelist').addEventListener('click', async () => {
		if (!currentDomain) return;
		const wl = await msg('getWhitelist');
		const exists = wl.find(e => e.domain === currentDomain);
		if (exists) {
			const updated = wl.filter(e => e.domain !== currentDomain);
			await msg('saveWhitelist', { whitelist: updated });
			toast('❌ Removed from whitelist');
		} else {
			wl.push({ domain: currentDomain, type: 'white', cookies: [] });
			await msg('saveWhitelist', { whitelist: wl });
			toast('✅ Added to whitelist');
		}
		loadCookies();
	});

	$('btn-clear-all').addEventListener('click', async () => {
		if (!confirm('Clear ALL cookies from ALL sites?')) return;
		const { count } = await msg('clearAll');
		toast(`🗑️ ${count} cookies removed from all sites`);
		loadCookies();
		loadStats();
	});

	$('btn-settings').addEventListener('click', () => {
		chrome.tabs.create({ url: 'options.html' });
		window.close();
	});

	$('refresh-btn').addEventListener('click', () => {
		loadCookies();
		loadStats();
	});

	$('lnk-options').addEventListener('click', () => {
		chrome.tabs.create({ url: 'options.html' });
		window.close();
	});
	$('lnk-report').addEventListener('click', () => {
		chrome.tabs.create({ url: 'options.html#report' });
		window.close();
	});
	$('lnk-audit').addEventListener('click', () => {
		chrome.tabs.create({ url: 'options.html#audit' });
		window.close();
	});
	$('lnk-reset').addEventListener('click', async () => {
		if (!confirm('Clear all statistics?')) return;
		await msg('clearStats');
		toast('📊 Statistics cleared');
		loadStats();
	});
}

async function loadStats() {
	const { stats } = await msg('getStats');
	if (!stats) return;
	$('s-cookies').textContent = fmt(stats.cookiesDeleted || 0);
	$('s-trackers').textContent = fmt(stats.trackersBlocked || 0);
	$('s-banners').textContent = fmt(stats.bannersRejected || 0);
}

async function loadRisk() {
	if (!currentDomain) return;
	const risk = await msg('getRisk', { domain: currentDomain });
	const pill = $('risk-pill');
	pill.textContent = risk.label || 'Low';
	pill.style.color = risk.color || '#10b981';
	pill.style.borderColor = risk.color || '#10b981';
	pill.style.background = (risk.color || '#10b981') + '15';
}

async function loadCookies() {
	if (!currentDomain) return;
	const cookies = await msg('getCookies', { domain: currentDomain });
	const list = $('cookies-list');
	$('cookie-count-label').textContent = `${cookies.length} cookie${cookies.length !== 1 ? 's' : ''} on this site`;

	if (cookies.length === 0) {
		list.replaceChildren(createEl('div', { className: 'no-cookies', textContent: '🎉 No cookies detected!' }));
		return;
	}

	list.replaceChildren(
		...cookies.map(c => {
			const children = [
				createEl('div', { className: `cat-dot cat-${c.category}` }),
				createEl('span', { className: 'cookie-name', title: c.name, textContent: c.name }),
				createEl('span', { className: 'cookie-cat', textContent: c.category }),
			];
			if (c.whitelisted) {
				children.push(createEl('span', { className: 'cookie-wl', textContent: 'WL' }));
			}
			return createEl('div', { className: 'cookie-row' }, children);
		}),
	);
}

function msg(action, extra = {}) {
	return new Promise(r => chrome.runtime.sendMessage({ action, ...extra }, r));
}

function host(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return '';
	}
}

function fmt(n) {
	return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

let toastTimer;
function toast(msg) {
	const el = $('toast');
	el.textContent = msg;
	el.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

init();
