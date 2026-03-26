// Cookie Eater — Options Script
'use strict';

// ── Helpers ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const msg = (action, extra = {}) => new Promise(r => chrome.runtime.sendMessage({ action, ...extra }, r));
const fmtDate = ts => new Date(ts).toLocaleString('en-US');

// Helper para criar elementos sem usar innerHTML (Aprova na Mozilla)
function createEl(tag, attrs = {}, children = []) {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) {
		if (k === 'style') el.style.cssText = v;
		else if (k === 'className') el.className = v;
		else if (k === 'textContent') el.textContent = v;
		else if (k === 'onclick') el.onclick = v;
		else if (k === 'title') el.title = v;
		else el.setAttribute(k, v);
	}
	for (const child of children) {
		if (typeof child === 'string') el.appendChild(document.createTextNode(child));
		else if (child) el.appendChild(child);
	}
	return el;
}

let toastTimer;
function toast(text, err = false) {
	const el = $('toast');
	el.textContent = text;
	el.style.borderColor = err ? 'var(--red)' : 'var(--border)';
	el.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Navigation ────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
	item.addEventListener('click', () => {
		document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
		document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
		item.classList.add('active');
		const pageId = 'page-' + item.dataset.page;
		$(pageId).classList.add('active');
		loadPage(item.dataset.page);
	});
});

// Handle hash navigation
function handleHash() {
	const hash = location.hash.slice(1);
	if (!hash) return;
	const target = hash.includes('=') ? hash.split('=')[0] : hash;
	const navItem = document.querySelector(`[data-page="${target}"]`);
	if (navItem) navItem.click();
}
handleHash();

function loadPage(page) {
	switch (page) {
		case 'general':
			loadGeneral();
			break;
		case 'whitelist':
			loadWhitelist();
			break;
		case 'rules':
			loadRules();
			break;
		case 'schedule':
			loadSchedule();
			break;
		case 'profiles':
			loadProfiles();
			break;
		case 'risk':
			loadRisk();
			break;
		case 'trackers':
			loadTrackers();
			break;
		case 'honeypots':
			loadHoneypots();
			break;
		case 'audit':
			loadAudit();
			break;
		case 'receipts':
			loadReceipts();
			break;
		case 'report':
			loadReport();
			break;
	}
}

// ═══ GENERAL ═════════════════════════════════════════════════════
async function loadGeneral() {
	const settings = await msg('getSettings');
	document.querySelectorAll('[data-key]').forEach(el => {
		const key = el.dataset.key;
		if (el.type === 'checkbox') el.checked = settings[key] ?? true;
		else if (el.type === 'number') el.value = settings[key] ?? 0;
	});
}

$('save-general').addEventListener('click', async () => {
	const settings = {};
	document.querySelectorAll('[data-key]').forEach(el => {
		const key = el.dataset.key;
		if (el.type === 'checkbox') settings[key] = el.checked;
		else if (el.type === 'number') settings[key] = Number(el.value);
	});
	await msg('saveSettings', { settings });
	toast('✅ Settings saved!');
});

// ═══ WHITELIST ════════════════════════════════════════════════════
async function loadWhitelist() {
	const wl = await msg('getWhitelist');
	const tbody = $('wl-tbody');
	if (!wl.length) {
		tbody.replaceChildren(
			createEl('tr', {}, [createEl('td', { colSpan: '4', style: 'text-align:center;color:var(--muted);padding:20px', textContent: 'Whitelist is empty. Add domains to protect them.' })]),
		);
		return;
	}
	tbody.replaceChildren(
		...wl.map((e, i) =>
			createEl('tr', {}, [
				createEl('td', { className: 'mono', textContent: e.domain }),
				createEl('td', {}, [createEl('span', { className: `badge badge-${e.type}`, textContent: e.type === 'white' ? '⬜ Whitelist' : '🔘 Greylist' })]),
				createEl('td', { style: 'font-size:11px;color:var(--muted)', textContent: e.type === 'grey' && e.cookies?.length ? e.cookies.join(', ') : e.type === 'white' ? 'All' : '—' }),
				createEl('td', {}, [createEl('button', { className: 'btn sm danger', textContent: '🗑 Remove', onclick: () => removeWl(i) })]),
			]),
		),
	);
}

window.removeWl = async i => {
	const wl = await msg('getWhitelist');
	wl.splice(i, 1);
	await msg('saveWhitelist', { whitelist: wl });
	toast('Entry removed');
	loadWhitelist();
};

$('wl-add').addEventListener('click', async () => {
	const domain = $('wl-domain')
		.value.trim()
		.replace(/^https?:\/\//, '')
		.replace(/\/.*/, '');
	const type = $('wl-type').value;
	if (!domain) {
		toast('Enter a domain', true);
		return;
	}
	const wl = await msg('getWhitelist');
	if (wl.find(e => e.domain === domain)) {
		toast('Domain already exists', true);
		return;
	}
	wl.push({ domain, type, cookies: [] });
	await msg('saveWhitelist', { whitelist: wl });
	$('wl-domain').value = '';
	toast('✅ Added to ' + (type === 'white' ? 'whitelist' : 'greylist'));
	loadWhitelist();
});

// ═══ RULES ════════════════════════════════════════════════════════
const ruleLabels = {
	'delete-all': '🗑️ Delete all',
	'delete-third-party': '🔎 3rd-party only',
	'keep-all': '✅ Keep all',
};

async function loadRules() {
	const rules = await msg('getSiteRules');
	const tbody = $('rules-tbody');
	if (!rules.length) {
		tbody.replaceChildren(createEl('tr', {}, [createEl('td', { colSpan: '3', style: 'text-align:center;color:var(--muted);padding:20px', textContent: 'No rules defined.' })]));
		return;
	}
	tbody.replaceChildren(
		...rules.map((r, i) =>
			createEl('tr', {}, [
				createEl('td', { className: 'mono', textContent: r.domain }),
				createEl('td', { textContent: ruleLabels[r.rule] || r.rule }),
				createEl('td', {}, [createEl('button', { className: 'btn sm danger', textContent: '🗑 Remove', onclick: () => removeRule(i) })]),
			]),
		),
	);
}

window.removeRule = async i => {
	const rules = await msg('getSiteRules');
	rules.splice(i, 1);
	await msg('saveSiteRules', { siteRules: rules });
	toast('Rule removed');
	loadRules();
};

$('rule-add').addEventListener('click', async () => {
	const domain = $('rule-domain')
		.value.trim()
		.replace(/^https?:\/\//, '')
		.replace(/\/.*/, '');
	const rule = $('rule-type').value;
	if (!domain) {
		toast('Enter a domain', true);
		return;
	}
	const rules = await msg('getSiteRules');
	if (rules.find(r => r.domain === domain)) {
		toast('Rule already exists', true);
		return;
	}
	rules.push({ domain, rule });
	await msg('saveSiteRules', { siteRules: rules });
	$('rule-domain').value = '';
	toast('✅ Rule added');
	loadRules();
});

// ═══ SCHEDULE ═════════════════════════════════════════════════════
async function loadSchedule() {
	const settings = await msg('getSettings');
	const el = document.querySelector('[data-key="scheduledCleaningIntervalHours"]');
	if (el) el.value = settings.scheduledCleaningIntervalHours || 0;
}

$('save-schedule').addEventListener('click', async () => {
	const h = Number(document.querySelector('[data-key="scheduledCleaningIntervalHours"]')?.value || 0);
	await msg('saveSettings', { settings: { scheduledCleaningIntervalHours: h } });
	toast('✅ Schedule saved' + (h > 0 ? ` — clean every ${h}h` : ' — disabled'));
});

$('clean-now').addEventListener('click', async () => {
	toast('⏳ Running cleanup…');
	await msg('clearAll');
	toast('✅ Cleanup complete!');
});

// ═══ PROFILES ════════════════════════════════════════════════════
async function loadProfiles() {
	const { profiles, activeProfile } = await msg('getProfiles');
	const grid = $('profile-grid');
	if (!profiles?.length) {
		grid.replaceChildren(
			createEl('div', { className: 'empty' }, [
				createEl('div', { className: 'empty-icon', textContent: '👤' }),
				createEl('div', { className: 'empty-text' }, ['No profiles saved yet.', createEl('br'), 'Save your current settings to activate them later.']),
			]),
		);
		return;
	}
	grid.replaceChildren(
		...profiles.map(p => {
			const nameEl = createEl('div', { className: 'profile-name', textContent: p.name });
			if (p.id === activeProfile) {
				nameEl.appendChild(document.createTextNode(' '));
				nameEl.appendChild(createEl('span', { style: 'font-size:10px;color:var(--accent)', textContent: '(active)' }));
			}
			return createEl('div', { className: 'profile-card', style: p.id === activeProfile ? 'border-color:var(--accent)' : '' }, [
				nameEl,
				createEl('div', { className: 'profile-date', textContent: fmtDate(p.createdAt || Date.now()) }),
				createEl('div', { className: 'profile-actions' }, [
					createEl('button', { className: 'btn sm primary', textContent: '▶ Load', onclick: () => loadProfile(p.id) }),
					createEl('button', { className: 'btn sm danger', textContent: '🗑', onclick: () => deleteProfile(p.id) }),
				]),
			]);
		}),
	);
}

window.loadProfile = async id => {
	await msg('loadProfile', { id });
	toast('✅ Profile loaded!');
	loadProfiles();
};
window.deleteProfile = async id => {
	await msg('deleteProfile', { id });
	toast('Profile deleted');
	loadProfiles();
};

$('profile-save').addEventListener('click', async () => {
	const name = $('profile-name').value.trim();
	if (!name) {
		toast('Enter a profile name', true);
		return;
	}
	await msg('saveProfile', { name });
	$('profile-name').value = '';
	toast('✅ Profile saved!');
	loadProfiles();
});

// ═══ RISK ════════════════════════════════════════════════════════
async function loadRisk() {
	const scores = await msg('getAllRisks');
	renderRisk(scores);
	$('risk-search').addEventListener('input', () => renderRisk(scores));
}

function renderRisk(scores) {
	const q = $('risk-search').value.toLowerCase();
	const entries = Object.entries(scores)
		.filter(([d]) => !q || d.includes(q))
		.sort(([, a], [, b]) => b.score - a.score);
	const tbody = $('risk-tbody');
	if (!entries.length) {
		tbody.replaceChildren(
			createEl('tr', {}, [createEl('td', { colSpan: '5', style: 'text-align:center;color:var(--muted);padding:24px', textContent: 'No risk data yet. Browse some sites first.' })]),
		);
		return;
	}
	tbody.replaceChildren(
		...entries.map(([domain, data]) => {
			const color = data.score >= 80 ? '#f43f5e' : data.score >= 50 ? '#f97316' : data.score >= 25 ? '#eab308' : '#22c55e';
			const lbl = data.score >= 80 ? 'Critical' : data.score >= 50 ? 'High' : data.score >= 25 ? 'Medium' : 'Low';
			const factorsFull = (data.factors || []).join(', ');
			let factorsShort = (data.factors || []).slice(0, 3).join(', ');
			if ((data.factors || []).length > 3) factorsShort += '…';

			return createEl('tr', {}, [
				createEl('td', { className: 'mono', textContent: domain }),
				createEl('td', {}, [createEl('span', { style: `font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;color:${color}`, textContent: data.score }), '/100']),
				createEl('td', {}, [createEl('span', { className: 'badge', style: `color:${color};border-color:${color}40;background:${color}15`, textContent: lbl })]),
				createEl('td', { style: 'font-size:10px;color:var(--muted);max-width:200px;overflow:hidden;text-overflow:ellipsis', title: factorsFull, textContent: factorsShort }),
				createEl('td', { className: 'mono', style: 'font-size:10px;color:var(--muted)', textContent: data.lastUpdated ? fmtDate(data.lastUpdated) : '—' }),
			]);
		}),
	);
}

$('risk-clear').addEventListener('click', async () => {
	if (!confirm('Clear all risk scores?')) return;
	await msg('clearRisks');
	toast('Scores cleared');
	loadRisk();
});

// ═══ TRACKERS ════════════════════════════════════════════════════
async function loadTrackers() {
	const map = await msg('getTrackerMap');
	const q_el = $('tracker-search');
	renderTrackers(map);
	q_el.addEventListener('input', () => renderTrackers(map));
}

function renderTrackers(map) {
	const q = $('tracker-search').value.toLowerCase();
	const entries = Object.entries(map)
		.filter(([d]) => !q || d.includes(q))
		.sort(([, a], [, b]) => Object.values(b).reduce((s, n) => s + n, 0) - Object.values(a).reduce((s, n) => s + n, 0));

	const el = $('tracker-content');
	if (!entries.length) {
		el.replaceChildren(
			createEl('div', { className: 'empty' }, [
				createEl('div', { className: 'empty-icon', textContent: '🗺️' }),
				createEl('div', { className: 'empty-text' }, ['No trackers detected yet.', createEl('br'), 'Browse some sites to populate the map.']),
			]),
		);
		return;
	}

	el.replaceChildren(
		...entries.map(([site, trackers]) => {
			const total = Object.values(trackers).reduce((s, n) => s + n, 0);
			const bars = Object.entries(trackers)
				.sort(([, a], [, b]) => b - a)
				.map(([t, n]) =>
					createEl('div', { className: 'tracker-bar' }, [
						createEl('span', { className: 'tracker-name', textContent: t }),
						createEl('div', { className: 'tracker-bar-fill', style: `width:${Math.min(120, n * 8)}px` }),
						createEl('span', { className: 'tracker-count', textContent: `${n}×` }),
					]),
				);
			return createEl('div', { className: 'card', style: 'margin-bottom:12px' }, [
				createEl('div', { className: 'card-title', style: 'margin-bottom:12px' }, [
					site,
					' ',
					createEl('span', { style: "font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace", textContent: `${Object.keys(trackers).length} trackers · ${total} requests` }),
				]),
				...bars,
			]);
		}),
	);
}

// ═══ HONEYPOTS ════════════════════════════════════════════════════
async function loadHoneypots() {
	const list = await msg('getHoneypots');
	const tbody = $('honeypot-tbody');
	if (!list.length) {
		tbody.replaceChildren(createEl('tr', {}, [createEl('td', { colSpan: '4', style: 'text-align:center;color:var(--muted);padding:24px', textContent: '🎉 No honeypots detected. Nice!' })]));
		return;
	}
	tbody.replaceChildren(
		...list.map(h =>
			createEl('tr', {}, [
				createEl('td', { className: 'mono', textContent: h.domain }),
				createEl('td', { className: 'mono', style: 'color:var(--yellow)', textContent: h.name }),
				createEl('td', { className: 'mono', style: 'color:var(--muted)', textContent: h.value || '—' }),
				createEl('td', { className: 'mono', style: 'font-size:10px;color:var(--muted)', textContent: fmtDate(h.detected) }),
			]),
		),
	);
}

// ═══ AUDIT ════════════════════════════════════════════════════════
async function loadAudit() {
	const log = await msg('getAuditLog', { limit: 300 });
	renderAudit(log);
	$('audit-search').addEventListener('input', () => renderAudit(log));
}

function renderAudit(log) {
	const q = $('audit-search').value.toLowerCase();
	const filtered = log.filter(e => !q || e.domain?.includes(q) || e.action?.includes(q) || e.name?.includes(q));
	const el = $('audit-list');
	if (!filtered.length) {
		el.replaceChildren(createEl('div', { style: 'padding:20px;text-align:center;color:var(--muted)', textContent: 'No entries found.' }));
		return;
	}
	const cls = a => (a.includes('delete') || a.includes('deleted') ? 'deleted' : a.includes('set') ? 'set' : a.includes('banner') ? 'banner' : a.includes('scheduled') ? 'scheduled' : 'other');

	el.replaceChildren(
		...filtered.map(e => {
			const domainEl = createEl('span', { className: 'log-domain', textContent: e.domain || '' });
			if (e.name) {
				domainEl.appendChild(document.createTextNode(' '));
				domainEl.appendChild(createEl('span', { style: 'color:var(--muted)', textContent: e.name }));
			}
			return createEl('div', { className: 'log-row' }, [
				createEl('span', { className: 'log-ts', textContent: fmtDate(e.ts) }),
				createEl('span', { className: `log-action log-${cls(e.action)}`, textContent: e.action }),
				domainEl,
			]);
		}),
	);
}

$('audit-clear').addEventListener('click', async () => {
	if (!confirm('Clear the audit log?')) return;
	await msg('clearAuditLog');
	toast('Log cleared');
	loadAudit();
});

$('audit-export').addEventListener('click', async () => {
	const log = await msg('getAuditLog', { limit: 1000 });
	download('audit-log.json', JSON.stringify(log, null, 2));
	toast('📥 Log exported');
});

// ═══ RECEIPTS ════════════════════════════════════════════════════
async function loadReceipts() {
	const list = await msg('getReceipts');
	const tbody = $('receipts-tbody');
	if (!list.length) {
		tbody.replaceChildren(
			createEl('tr', {}, [
				createEl('td', { colSpan: '4', style: 'text-align:center;color:var(--muted);padding:24px', textContent: 'No receipts yet. Visit sites with cookie banners to generate automatic receipts.' }),
			]),
		);
		return;
	}
	tbody.replaceChildren(
		...list.map(r =>
			createEl('tr', {}, [
				createEl('td', { className: 'mono', textContent: r.domain }),
				createEl('td', { className: 'mono', style: 'font-size:11px', textContent: fmtDate(r.ts) }),
				createEl('td', {}, [createEl('span', { className: 'badge badge-Functional', textContent: r.bannerType || 'auto' })]),
				createEl('td', { style: 'font-size:10px;color:var(--muted)', textContent: r.proof || '—' }),
			]),
		),
	);
}

// ═══ REPORT ══════════════════════════════════════════════════════
async function loadReport() {
	const report = await msg('getReport');
	const stats = report.stats || {};

	const statData = [
		{ n: stats.cookiesDeleted || 0, l: 'Cookies removed', i: '🍪' },
		{ n: stats.trackersBlocked || 0, l: 'Trackers blocked', i: '🚫' },
		{ n: stats.bannersRejected || 0, l: 'Banners rejected', i: '📋' },
		{ n: stats.domainsProtected || 0, l: 'Protected domains', i: '🛡️' },
		{ n: report.summary?.highRiskDomains || 0, l: 'High risk sites', i: '⚠️' },
		{ n: report.summary?.honeypots || 0, l: 'Honeypots found', i: '🍯' },
	];

	$('report-stats').replaceChildren(
		...statData.map(s =>
			createEl('div', { className: 'stat-card' }, [
				createEl('div', { style: 'font-size:24px', textContent: s.i }),
				createEl('div', { className: 'stat-num', textContent: s.n }),
				createEl('div', { className: 'stat-name', textContent: s.l }),
			]),
		),
	);

	const top = report.summary?.topTrackers || [];
	if (top.length) {
		$('report-trackers-card').style.display = 'block';
		const max = top[0]?.n || 1;
		$('report-trackers-list').replaceChildren(
			...top.map(t =>
				createEl('div', { className: 'tracker-bar' }, [
					createEl('span', { className: 'tracker-name', textContent: t.d }),
					createEl('div', { className: 'tracker-bar-fill', style: `width:${Math.round((t.n / max) * 180)}px` }),
					createEl('span', { className: 'tracker-count', textContent: `${t.n}×` }),
				]),
			),
		);
	}
}

$('report-export').addEventListener('click', async () => {
	const report = await msg('getReport');
	download('privacy-report.json', JSON.stringify(report, null, 2));
	toast('📥 Report exported');
});
$('report-refresh').addEventListener('click', loadReport);

// ═══ ADVANCED ════════════════════════════════════════════════════
$('btn-export').addEventListener('click', async () => {
	const { config } = await msg('export');
	download('cookie-eater-config.json', config);
	toast('📤 Configuration exported');
});

$('btn-import').addEventListener('click', async () => {
	const config = $('import-json').value.trim();
	if (!config) {
		toast('Paste JSON before importing', true);
		return;
	}
	const res = await msg('import', { config });
	if (res?.error) {
		toast('❌ Error: ' + res.error, true);
		return;
	}
	$('import-json').value = '';
	toast('✅ Configuration imported successfully!');
	loadGeneral();
});

$('btn-reset-all').addEventListener('click', async () => {
	if (!confirm('⚠️ WARNING: This will delete ALL settings, whitelists, rules, profiles, stats and logs. Are you sure?')) return;
	await chrome.storage.local.clear();
	toast('🗑️ Full reset. Close and reopen the extension.', true);
});

// ── Init ─────────────────────────────────────────────────────────
loadGeneral();

// ── Utilities ────────────────────────────────────────────────────
function download(filename, text) {
	const a = document.createElement('a');
	a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
	a.download = filename;
	a.click();
}
