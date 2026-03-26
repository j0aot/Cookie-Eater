'use strict';

const $ = id => document.getElementById(id);
let currentDomain = '';
let currentTab = null;

// ── Init ──────────────────────────────────────────────────────────
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  currentDomain = tab?.url ? host(tab.url) : '';

  // Toggle state
  const settings = await msg('getSettings');
  $('toggle').checked = settings?.enabled !== false;

  // Site info
  if (currentDomain) {
    $('site-name').textContent = currentDomain;
    $('favicon').src = `https://www.google.com/s2/favicons?domain=${currentDomain}&sz=16`;
    loadRisk();
    loadCookies();
  } else {
    $('site-name').textContent = 'Extensão / Nova tab';
    $('cookies-list').innerHTML = '<div class="no-cookies">Abra um website para ver cookies.</div>';
  }

  loadStats();
  bindEvents();
}

function bindEvents() {
  $('toggle').addEventListener('change', async () => {
    const enabled = $('toggle').checked;
    await msg('saveSettings', { settings: { enabled } });
    toast(enabled ? '✅ Proteção ativada' : '⏸ Proteção pausada');
  });

  $('btn-clear').addEventListener('click', async () => {
    if (!currentDomain) return;
    const { count } = await msg('clearDomain', { domain: currentDomain, url: currentTab?.url });
    toast(`🧹 ${count} cookies removidos`);
    loadCookies(); loadStats();
  });

  $('btn-whitelist').addEventListener('click', async () => {
    if (!currentDomain) return;
    const wl = await msg('getWhitelist');
    const exists = wl.find(e => e.domain === currentDomain);
    if (exists) {
      const updated = wl.filter(e => e.domain !== currentDomain);
      await msg('saveWhitelist', { whitelist: updated });
      toast('❌ Removido do whitelist');
    } else {
      wl.push({ domain: currentDomain, type: 'white', cookies: [] });
      await msg('saveWhitelist', { whitelist: wl });
      toast('✅ Adicionado ao whitelist');
    }
    loadCookies();
  });

  $('btn-clear-all').addEventListener('click', async () => {
    if (!confirm('Limpar TODOS os cookies de TODOS os sites?')) return;
    const { count } = await msg('clearAll');
    toast(`🗑️ ${count} cookies removidos de todos os sites`);
    loadCookies(); loadStats();
  });

  $('btn-settings').addEventListener('click', () => {
    chrome.tabs.create({ url: 'options.html' });
    window.close();
  });

  $('refresh-btn').addEventListener('click', () => { loadCookies(); loadStats(); });

  $('lnk-options').addEventListener('click', () => { chrome.tabs.create({ url: 'options.html' }); window.close(); });
  $('lnk-report').addEventListener('click', () => { chrome.tabs.create({ url: 'options.html#report' }); window.close(); });
  $('lnk-audit').addEventListener('click', () => { chrome.tabs.create({ url: 'options.html#audit' }); window.close(); });
  $('lnk-reset').addEventListener('click', async () => {
    if (!confirm('Limpar todas as estatísticas?')) return;
    await msg('clearStats');
    toast('📊 Estatísticas limpas');
    loadStats();
  });
}

// ── Data loaders ──────────────────────────────────────────────────
async function loadStats() {
  const { stats } = await msg('getStats');
  if (!stats) return;
  $('s-cookies').textContent  = fmt(stats.cookiesDeleted  || 0);
  $('s-trackers').textContent = fmt(stats.trackersBlocked || 0);
  $('s-banners').textContent  = fmt(stats.bannersRejected || 0);
}

async function loadRisk() {
  if (!currentDomain) return;
  const risk = await msg('getRisk', { domain: currentDomain });
  const pill = $('risk-pill');
  pill.textContent = risk.label || 'Baixo';
  pill.style.color = risk.color || '#10b981';
  pill.style.borderColor = risk.color || '#10b981';
  pill.style.background = (risk.color || '#10b981') + '15';
}

async function loadCookies() {
  if (!currentDomain) return;
  const cookies = await msg('getCookies', { domain: currentDomain });
  const list = $('cookies-list');
  $('cookie-count-label').textContent = `${cookies.length} cookie${cookies.length !== 1 ? 's' : ''} neste site`;

  if (cookies.length === 0) {
    list.innerHTML = '<div class="no-cookies">🎉 Nenhum cookie detectado!</div>';
    return;
  }

  list.innerHTML = cookies.map(c => `
    <div class="cookie-row">
      <div class="cat-dot cat-${c.category}"></div>
      <span class="cookie-name" title="${escHtml(c.name)}">${escHtml(c.name)}</span>
      <span class="cookie-cat">${c.category}</span>
      ${c.whitelisted ? '<span class="cookie-wl">WL</span>' : ''}
    </div>
  `).join('');
}

// ── Helpers ───────────────────────────────────────────────────────
function msg(action, extra = {}) {
  return new Promise(r => chrome.runtime.sendMessage({ action, ...extra }, r));
}

function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function fmt(n) { return n >= 1000 ? (n/1000).toFixed(1)+'k' : String(n); }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

init();
