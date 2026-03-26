'use strict';

// ── Helpers ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const msg = (action, extra={}) => new Promise(r => chrome.runtime.sendMessage({action,...extra}, r));
const fmtDate = ts => new Date(ts).toLocaleString('pt-PT');
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

let toastTimer;
function toast(text, err=false) {
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
  switch(page) {
    case 'general':    loadGeneral();  break;
    case 'whitelist':  loadWhitelist();break;
    case 'rules':      loadRules();    break;
    case 'schedule':   loadSchedule(); break;
    case 'profiles':   loadProfiles(); break;
    case 'risk':       loadRisk();     break;
    case 'trackers':   loadTrackers(); break;
    case 'honeypots':  loadHoneypots();break;
    case 'audit':      loadAudit();    break;
    case 'receipts':   loadReceipts(); break;
    case 'report':     loadReport();   break;
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
  toast('✅ Definições guardadas!');
});

// ═══ WHITELIST ════════════════════════════════════════════════════
async function loadWhitelist() {
  const wl = await msg('getWhitelist');
  const tbody = $('wl-tbody');
  if (!wl.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">Whitelist vazia. Adiciona domínios para os proteger.</td></tr>';
    return;
  }
  tbody.innerHTML = wl.map((e,i) => `
    <tr>
      <td class="mono">${esc(e.domain)}</td>
      <td><span class="badge badge-${e.type}">${e.type==='white'?'⬜ Whitelist':'🔘 Greylist'}</span></td>
      <td style="font-size:11px;color:var(--muted)">${e.type==='grey'&&e.cookies?.length ? esc(e.cookies.join(', ')) : e.type==='white' ? 'Todos' : '—'}</td>
      <td><button class="btn sm danger" onclick="removeWl(${i})">🗑 Remover</button></td>
    </tr>
  `).join('');
}

window.removeWl = async (i) => {
  const wl = await msg('getWhitelist');
  wl.splice(i, 1);
  await msg('saveWhitelist', { whitelist: wl });
  toast('Entrada removida');
  loadWhitelist();
};

$('wl-add').addEventListener('click', async () => {
  const domain = $('wl-domain').value.trim().replace(/^https?:\/\//,'').replace(/\/.*/,'');
  const type = $('wl-type').value;
  if (!domain) { toast('Insere um domínio', true); return; }
  const wl = await msg('getWhitelist');
  if (wl.find(e => e.domain === domain)) { toast('Domínio já existe', true); return; }
  wl.push({ domain, type, cookies: [] });
  await msg('saveWhitelist', { whitelist: wl });
  $('wl-domain').value = '';
  toast('✅ Adicionado ao ' + (type==='white'?'whitelist':'greylist'));
  loadWhitelist();
});

// ═══ RULES ════════════════════════════════════════════════════════
const ruleLabels = {
  'delete-all': '🗑️ Apagar tudo',
  'delete-third-party': '🔎 Só third-party',
  'keep-all': '✅ Manter tudo',
};

async function loadRules() {
  const rules = await msg('getSiteRules');
  const tbody = $('rules-tbody');
  if (!rules.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px">Nenhuma regra definida.</td></tr>';
    return;
  }
  tbody.innerHTML = rules.map((r,i) => `
    <tr>
      <td class="mono">${esc(r.domain)}</td>
      <td>${ruleLabels[r.rule]||r.rule}</td>
      <td><button class="btn sm danger" onclick="removeRule(${i})">🗑 Remover</button></td>
    </tr>
  `).join('');
}

window.removeRule = async (i) => {
  const rules = await msg('getSiteRules');
  rules.splice(i,1);
  await msg('saveSiteRules',{siteRules:rules});
  toast('Regra removida'); loadRules();
};

$('rule-add').addEventListener('click', async () => {
  const domain = $('rule-domain').value.trim().replace(/^https?:\/\//,'').replace(/\/.*/,'');
  const rule = $('rule-type').value;
  if (!domain) { toast('Insere um domínio', true); return; }
  const rules = await msg('getSiteRules');
  if (rules.find(r=>r.domain===domain)) { toast('Regra já existe', true); return; }
  rules.push({domain, rule});
  await msg('saveSiteRules',{siteRules:rules});
  $('rule-domain').value='';
  toast('✅ Regra adicionada'); loadRules();
});

// ═══ SCHEDULE ═════════════════════════════════════════════════════
async function loadSchedule() {
  const settings = await msg('getSettings');
  const el = document.querySelector('[data-key="scheduledCleaningIntervalHours"]');
  if (el) el.value = settings.scheduledCleaningIntervalHours || 0;
}

$('save-schedule').addEventListener('click', async () => {
  const h = Number(document.querySelector('[data-key="scheduledCleaningIntervalHours"]')?.value || 0);
  await msg('saveSettings',{settings:{scheduledCleaningIntervalHours:h}});
  toast('✅ Agenda guardada' + (h>0 ? ` — limpeza a cada ${h}h` : ' — desativada'));
});

$('clean-now').addEventListener('click', async () => {
  toast('⏳ A executar limpeza…');
  // Trigger via alarm or direct message
  await msg('clearAll');
  toast('✅ Limpeza executada!');
});

// ═══ PROFILES ════════════════════════════════════════════════════
async function loadProfiles() {
  const {profiles, activeProfile} = await msg('getProfiles');
  const grid = $('profile-grid');
  if (!profiles?.length) {
    grid.innerHTML = '<div class="empty"><div class="empty-icon">👤</div><div class="empty-text">Nenhum perfil guardado ainda.<br>Guarda as tuas definições atuais para as ativar mais tarde.</div></div>';
    return;
  }
  grid.innerHTML = profiles.map(p => `
    <div class="profile-card" style="${p.id===activeProfile?'border-color:var(--accent)':''}">
      <div class="profile-name">${esc(p.name)} ${p.id===activeProfile?'<span style="font-size:10px;color:var(--accent)">(ativo)</span>':''}</div>
      <div class="profile-date">${fmtDate(p.createdAt||Date.now())}</div>
      <div class="profile-actions">
        <button class="btn sm primary" onclick="loadProfile('${p.id}')">▶ Carregar</button>
        <button class="btn sm danger" onclick="deleteProfile('${p.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

window.loadProfile = async (id) => {
  await msg('loadProfile',{id});
  toast('✅ Perfil carregado!');
  loadProfiles();
};
window.deleteProfile = async (id) => {
  await msg('deleteProfile',{id});
  toast('Perfil eliminado'); loadProfiles();
};

$('profile-save').addEventListener('click', async () => {
  const name = $('profile-name').value.trim();
  if (!name) { toast('Insere um nome para o perfil', true); return; }
  await msg('saveProfile',{name});
  $('profile-name').value='';
  toast('✅ Perfil guardado!'); loadProfiles();
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
    .filter(([d])=> !q || d.includes(q))
    .sort(([,a],[,b])=>b.score-a.score);
  const tbody = $('risk-tbody');
  if (!entries.length) {
    tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">Nenhum dado de risco ainda. Navega em alguns sites primeiro.</td></tr>';
    return;
  }
  const labels = {score:0,label:'Baixo',color:'#22c55e'};
  tbody.innerHTML = entries.map(([domain,data]) => {
    const color = data.score>=80?'#f43f5e':data.score>=50?'#f97316':data.score>=25?'#eab308':'#22c55e';
    const lbl = data.score>=80?'Crítico':data.score>=50?'Alto':data.score>=25?'Médio':'Baixo';
    return `<tr>
      <td class="mono">${esc(domain)}</td>
      <td><span style="font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;color:${color}">${data.score}</span>/100</td>
      <td><span class="badge" style="color:${color};border-color:${color}40;background:${color}15">${lbl}</span></td>
      <td style="font-size:10px;color:var(--muted);max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${esc((data.factors||[]).join(', '))}">${esc((data.factors||[]).slice(0,3).join(', '))}${(data.factors||[]).length>3?'…':''}</td>
      <td class="mono" style="font-size:10px;color:var(--muted)">${data.lastUpdated?fmtDate(data.lastUpdated):'—'}</td>
    </tr>`;
  }).join('');
}

$('risk-clear').addEventListener('click', async () => {
  if (!confirm('Limpar todos os scores de risco?')) return;
  await msg('clearRisks');
  toast('Scores limpos'); loadRisk();
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
    .filter(([d])=> !q || d.includes(q))
    .sort(([,a],[,b])=>Object.values(b).reduce((s,n)=>s+n,0)-Object.values(a).reduce((s,n)=>s+n,0));

  const el = $('tracker-content');
  if (!entries.length) {
    el.innerHTML='<div class="empty"><div class="empty-icon">🗺️</div><div class="empty-text">Nenhum tracker detectado ainda.<br>Navega em alguns sites para ver o mapa.</div></div>';
    return;
  }

  el.innerHTML = entries.map(([site, trackers]) => {
    const total = Object.values(trackers).reduce((s,n)=>s+n,0);
    const bars = Object.entries(trackers).sort(([,a],[,b])=>b-a).map(([t,n])=>`
      <div class="tracker-bar">
        <span class="tracker-name">${esc(t)}</span>
        <div class="tracker-bar-fill" style="width:${Math.min(120,n*8)}px"></div>
        <span class="tracker-count">${n}×</span>
      </div>
    `).join('');
    return `<div class="card" style="margin-bottom:12px">
      <div class="card-title" style="margin-bottom:12px">${esc(site)} <span style="font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace">${Object.keys(trackers).length} trackers · ${total} pedidos</span></div>
      ${bars}
    </div>`;
  }).join('');
}

// ═══ HONEYPOTS ════════════════════════════════════════════════════
async function loadHoneypots() {
  const list = await msg('getHoneypots');
  const tbody = $('honeypot-tbody');
  if (!list.length) {
    tbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px">🎉 Nenhum honeypot detectado. Boa!</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(h=>`<tr>
    <td class="mono">${esc(h.domain)}</td>
    <td class="mono" style="color:var(--yellow)">${esc(h.name)}</td>
    <td class="mono" style="color:var(--muted)">${esc(h.value||'—')}</td>
    <td class="mono" style="font-size:10px;color:var(--muted)">${fmtDate(h.detected)}</td>
  </tr>`).join('');
}

// ═══ AUDIT ════════════════════════════════════════════════════════
async function loadAudit() {
  const log = await msg('getAuditLog', {limit:300});
  renderAudit(log);
  $('audit-search').addEventListener('input', () => renderAudit(log));
}

function renderAudit(log) {
  const q = $('audit-search').value.toLowerCase();
  const filtered = log.filter(e=> !q || e.domain?.includes(q) || e.action?.includes(q) || e.name?.includes(q));
  const el = $('audit-list');
  if (!filtered.length) {
    el.innerHTML='<div style="padding:20px;text-align:center;color:var(--muted)">Nenhuma entrada encontrada.</div>';
    return;
  }
  const cls = a => a.includes('delete')||a.includes('deleted')?'deleted':a.includes('set')?'set':a.includes('banner')?'banner':a.includes('scheduled')?'scheduled':'other';
  el.innerHTML = filtered.map(e=>`
    <div class="log-row">
      <span class="log-ts">${fmtDate(e.ts)}</span>
      <span class="log-action log-${cls(e.action)}">${esc(e.action)}</span>
      <span class="log-domain">${esc(e.domain||'')} ${e.name?'<span style="color:var(--muted)">'+esc(e.name)+'</span>':''}</span>
    </div>
  `).join('');
}

$('audit-clear').addEventListener('click', async () => {
  if (!confirm('Limpar o log de auditoria?')) return;
  await msg('clearAuditLog');
  toast('Log limpo'); loadAudit();
});

$('audit-export').addEventListener('click', async () => {
  const log = await msg('getAuditLog',{limit:1000});
  download('audit-log.json', JSON.stringify(log,null,2));
  toast('📥 Log exportado');
});

// ═══ RECEIPTS ════════════════════════════════════════════════════
async function loadReceipts() {
  const list = await msg('getReceipts');
  const tbody = $('receipts-tbody');
  if (!list.length) {
    tbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px">Nenhum recibo ainda. Visita sites com banners de cookies para gerar recibos automáticos.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(r=>`<tr>
    <td class="mono">${esc(r.domain)}</td>
    <td class="mono" style="font-size:11px">${fmtDate(r.ts)}</td>
    <td><span class="badge badge-Functional">${esc(r.bannerType||'auto')}</span></td>
    <td style="font-size:10px;color:var(--muted)">${esc(r.proof||'—')}</td>
  </tr>`).join('');
}

// ═══ REPORT ══════════════════════════════════════════════════════
async function loadReport() {
  const report = await msg('getReport');
  const stats = report.stats || {};
  $('report-stats').innerHTML = [
    {n:stats.cookiesDeleted||0,  l:'Cookies removidos',  i:'🍪'},
    {n:stats.trackersBlocked||0, l:'Trackers bloqueados', i:'🚫'},
    {n:stats.bannersRejected||0, l:'Banners rejeitados',  i:'📋'},
    {n:stats.domainsProtected||0,l:'Domínios protegidos', i:'🛡️'},
    {n:report.summary?.highRiskDomains||0, l:'Sites de alto risco', i:'⚠️'},
    {n:report.summary?.honeypots||0, l:'Honeypots detectados', i:'🍯'},
  ].map(s=>`<div class="stat-card"><div style="font-size:24px">${s.i}</div><div class="stat-num">${s.n}</div><div class="stat-name">${s.l}</div></div>`).join('');

  const top = report.summary?.topTrackers || [];
  if (top.length) {
    $('report-trackers-card').style.display='block';
    const max = top[0]?.n || 1;
    $('report-trackers-list').innerHTML = top.map(t=>`
      <div class="tracker-bar">
        <span class="tracker-name">${esc(t.d)}</span>
        <div class="tracker-bar-fill" style="width:${Math.round(t.n/max*180)}px"></div>
        <span class="tracker-count">${t.n}×</span>
      </div>
    `).join('');
  }
}

$('report-export').addEventListener('click', async () => {
  const report = await msg('getReport');
  download('privacy-report.json', JSON.stringify(report,null,2));
  toast('📥 Relatório exportado');
});
$('report-refresh').addEventListener('click', loadReport);

// ═══ ADVANCED ════════════════════════════════════════════════════
$('btn-export').addEventListener('click', async () => {
  const {config} = await msg('export');
  download('cookie-guardian-config.json', config);
  toast('📤 Configuração exportada');
});

$('btn-import').addEventListener('click', async () => {
  const config = $('import-json').value.trim();
  if (!config) { toast('Cola o JSON antes de importar', true); return; }
  const res = await msg('import',{config});
  if (res?.error) { toast('❌ Erro: ' + res.error, true); return; }
  $('import-json').value='';
  toast('✅ Configuração importada com sucesso!');
  loadGeneral();
});

$('btn-reset-all').addEventListener('click', async () => {
  if (!confirm('⚠️ ATENÇÃO: Isto vai apagar TODAS as definições, whitelist, regras, perfis, estatísticas e logs. Tens a certeza?')) return;
  await chrome.storage.local.clear();
  toast('🗑️ Reset completo. Fecha e reabre a extensão.', true);
});

// ── Init ─────────────────────────────────────────────────────────
loadGeneral();

// ── Utilities ────────────────────────────────────────────────────
function download(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type:'application/json'}));
  a.download = filename;
  a.click();
}
