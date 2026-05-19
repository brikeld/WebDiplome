import {
  extractAppCategorySlice,
  extractBrowserSlice,
  extractWifiSlice,
  extractMostUsedAppsSlice,
  extractStorageSlice,
  extractBatterySlice,
  extractSecuritySlice,
  extractAIToolsSlice,
} from './dataSlices.js';

const BG = '#0d0d1a';
const TEXT_MAIN = '#e2e8f0';
const TEXT_MUTED = '#7c85a2';
const BAR_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#a78bfa', '#34d399'];
const PERSONA_COLORS = { productivite: '#7c3aed', securite: '#ef4444', popularite: '#ec4899' };

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svgWrap(W, H, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${BG}" rx="8"/>
  <text x="${W / 2}" y="28" fill="${TEXT_MAIN}" font-size="13" font-weight="bold" text-anchor="middle" font-family="'SF Mono',monospace">${esc(title)}</text>
  ${body}
</svg>`;
}

function hBar({ x, y, w, h, color, label, value, labelAnchor = 'end', labelX }) {
  const lx = labelX ?? x - 7;
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" rx="2"/>
  <text x="${lx}" y="${y + h / 2 + 4}" fill="${TEXT_MUTED}" font-size="11" text-anchor="${labelAnchor}" font-family="'SF Mono',monospace">${esc(label)}</text>
  <text x="${x + w + 6}" y="${y + h / 2 + 4}" fill="${TEXT_MAIN}" font-size="11" font-family="'SF Mono',monospace">${esc(String(value))}</text>`;
}

// ─── Existing charts (kept) ────────────────────────────────────────────────

export function buildAppCategoryChart(appCategorySlice) {
  let items = (appCategorySlice?.byCategory || []).slice(0, 7);
  if (!items.length) items = [['No category data', 1]];

  const W = 600; const H = 280;
  const ML = 120; const MR = 55; const MT = 44; const MB = 18;
  const CW = W - ML - MR; const CH = H - MT - MB;
  const N = items.length;
  const slotH = CH / N; const barH = Math.max(12, slotH - 8);
  const maxVal = items[0][1];

  const bars = items.map(([cat, count], i) => {
    const bw = Math.round((count / maxVal) * CW);
    const y = MT + i * slotH + (slotH - barH) / 2;
    return hBar({ x: ML, y, w: bw, h: barH, color: BAR_COLORS[i % BAR_COLORS.length], label: cat, value: count });
  }).join('');

  const sub = `<text x="${W / 2}" y="${H - 4}" fill="${TEXT_MUTED}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace">${esc(`${appCategorySlice?.totalInstalled || ''} apps installed`)}</text>`;
  return { svg: svgWrap(W, H, 'App Categories', bars + sub), w: W, h: H };
}

export function buildFileExtChart(recentFilesSlice) {
  const items = (recentFilesSlice || []).slice(0, 7);
  if (!items.length) return null;

  const W = 600; const H = 260;
  const ML = 60; const MR = 55; const MT = 44; const MB = 18;
  const CW = W - ML - MR; const CH = H - MT - MB;
  const N = items.length; const slotH = CH / N; const barH = Math.max(12, slotH - 8);
  const maxVal = items[0][1];

  const bars = items.map(([ext, count], i) => {
    const bw = Math.round((count / maxVal) * CW);
    const y = MT + i * slotH + (slotH - barH) / 2;
    return hBar({ x: ML, y, w: bw, h: barH, color: BAR_COLORS[i % BAR_COLORS.length], label: ext || '(none)', value: count });
  }).join('');

  return { svg: svgWrap(W, H, 'Recent File Types (7 days)', bars), w: W, h: H };
}

export function buildWifiTimelineChart(wifiSlice) {
  const networks = (wifiSlice?.networks || []).slice(0, 20);
  if (!networks.length) return null;

  const W = 600; const H = 300;
  const colW = W / 2; const itemH = 22; const MT = 44;

  const items = networks.map((name, i) => {
    const col = i < 10 ? 0 : 1;
    const row = i % 10;
    const x = col * colW + 24;
    const y = MT + row * itemH + 14;
    const color = BAR_COLORS[i % BAR_COLORS.length];
    return `
  <circle cx="${x}" cy="${y - 4}" r="4" fill="${color}"/>
  <text x="${x + 11}" y="${y}" fill="${TEXT_MAIN}" font-size="11" font-family="'SF Mono',monospace">${esc(name)}</text>`;
  }).join('');

  const sub = `<text x="${W / 2}" y="${H - 6}" fill="${TEXT_MUTED}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace">${networks.length} networks · most recent first</text>`;
  return { svg: svgWrap(W, H, 'WiFi Network History', items + sub), w: W, h: H };
}

export function buildFileExtSlice(data) {
  const files = Array.isArray(data?.PAST_HISTORY?.recent_files_7days) ? data.PAST_HISTORY.recent_files_7days : [];
  const counts = {};
  for (const f of files) {
    if (f.path && f.path.includes('node_modules')) continue;
    const ext = f.ext || '(none)';
    counts[ext] = (counts[ext] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
}

// ─── New chart builders ────────────────────────────────────────────────────

export function buildMostUsedAppsChart(data) {
  const slice = extractMostUsedAppsSlice(data);
  const apps = slice.apps.slice(0, 12);
  if (!apps.length) return null;

  const W = 600; const H = Math.max(200, 44 + apps.length * 26 + 20);
  const itemH = 22; const MT = 44; const ML = 160; const MR = 20;
  const dotR = 5;

  const rows = apps.map(({ app, last_used }, i) => {
    const y = MT + i * itemH + itemH / 2;
    const color = BAR_COLORS[i % BAR_COLORS.length];
    const dateStr = last_used ? String(last_used).slice(5, 10) : '';
    return `
  <circle cx="${ML - 14}" cy="${y}" r="${dotR}" fill="${color}"/>
  <text x="${ML}" y="${y + 4}" fill="${TEXT_MAIN}" font-size="11" font-family="'SF Mono',monospace">${esc(app)}</text>
  <text x="${W - MR}" y="${y + 4}" fill="${TEXT_MUTED}" font-size="10" text-anchor="end" font-family="'SF Mono',monospace">${esc(dateStr)}</text>`;
  }).join('');

  const sub = `<text x="${W / 2}" y="${H - 4}" fill="${TEXT_MUTED}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace">${slice.count} apps tracked · sorted by recency</text>`;
  return { svg: svgWrap(W, H, 'Recently Used Apps (7 days)', rows + sub), w: W, h: H };
}

export function buildStorageChart(data, profile) {
  const slice = extractStorageSlice(data);
  const used = slice.used || (profile?.storageUsed ?? '');
  const total = slice.total || (profile?.storageTotal ?? '');
  const pct = slice.usePct || (() => {
    const u = parseFloat(used); const t = parseFloat(total);
    return t > 0 ? Math.round((u / t) * 100) : 0;
  })();
  const free = slice.free || '';

  const W = 600; const H = 180;
  const barY = 70; const barH = 36; const ML = 30; const MR = 30;
  const barW = W - ML - MR;
  const fillW = Math.round((pct / 100) * barW);
  const fillColor = pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#10b981';

  const body = `
  <rect x="${ML}" y="${barY}" width="${barW}" height="${barH}" fill="#1e1e3a" rx="4"/>
  <rect x="${ML}" y="${barY}" width="${fillW}" height="${barH}" fill="${fillColor}" rx="4"/>
  <text x="${ML + fillW / 2}" y="${barY + barH / 2 + 5}" fill="${BG}" font-size="13" font-weight="bold" text-anchor="middle" font-family="'SF Mono',monospace">${pct}%</text>
  <text x="${ML}" y="${barY + barH + 20}" fill="${TEXT_MUTED}" font-size="11" font-family="'SF Mono',monospace">Used: ${esc(used)}</text>
  <text x="${W / 2}" y="${barY + barH + 20}" fill="${TEXT_MUTED}" font-size="11" text-anchor="middle" font-family="'SF Mono',monospace">Free: ${esc(free)}</text>
  <text x="${W - MR}" y="${barY + barH + 20}" fill="${TEXT_MUTED}" font-size="11" text-anchor="end" font-family="'SF Mono',monospace">Total: ${esc(total)}</text>`;

  return { svg: svgWrap(W, H, 'Storage Usage', body), w: W, h: H };
}

export function buildBatteryHardwareChart(data, profile) {
  const bat = extractBatterySlice(data);
  const ram = data?.MACHINE_IDENTITY?.hardware_snapshot?.ram || profile?.ram || '—';
  const uptime = profile?.uptimeDays != null ? `${profile.uptimeDays}d` : '—';
  const cycles = bat.cycleCount ?? profile?.batteryCycles ?? '—';
  const batPct = bat.percent || 0;
  const fillColor = batPct < 20 ? '#ef4444' : batPct < 50 ? '#f59e0b' : '#10b981';

  const W = 600; const H = 200;
  const stats = [
    { label: 'Battery', value: `${batPct}%`, sub: bat.condition || '' },
    { label: 'Cycles', value: String(cycles), sub: bat.maxCapacity ? `cap ${bat.maxCapacity}` : '' },
    { label: 'RAM', value: String(ram), sub: '' },
    { label: 'Uptime', value: uptime, sub: '' },
  ];
  const colW = W / stats.length;

  const batBarY = 120; const batBarH = 10; const batBarML = 20; const batBarW = colW - 40;
  const blocks = stats.map(({ label, value, sub }, i) => {
    const cx = i * colW + colW / 2;
    const extra = i === 0 ? `
  <rect x="${i * colW + batBarML}" y="${batBarY}" width="${batBarW}" height="${batBarH}" fill="#1e1e3a" rx="3"/>
  <rect x="${i * colW + batBarML}" y="${batBarY}" width="${Math.round((batPct / 100) * batBarW)}" height="${batBarH}" fill="${fillColor}" rx="3"/>` : '';
    return `
  <text x="${cx}" y="58" fill="${TEXT_MUTED}" font-size="11" text-anchor="middle" font-family="'SF Mono',monospace">${esc(label)}</text>
  <text x="${cx}" y="90" fill="${TEXT_MAIN}" font-size="22" font-weight="bold" text-anchor="middle" font-family="'SF Mono',monospace">${esc(value)}</text>
  <text x="${cx}" y="110" fill="${TEXT_MUTED}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace">${esc(sub)}</text>
  ${extra}`;
  }).join('');

  const dividers = [1, 2, 3].map(i =>
    `<line x1="${i * colW}" y1="44" x2="${i * colW}" y2="${H - 10}" stroke="#1e1e3a" stroke-width="1"/>`,
  ).join('');

  return { svg: svgWrap(W, H, 'Hardware Vitals', dividers + blocks), w: W, h: H };
}

export function buildPersonaScoresChart(profile) {
  const scores = profile?.personaScores;
  if (!scores) return null;

  const items = [
    { label: 'Productivity', value: scores.productivity ?? 0, color: PERSONA_COLORS.productivite },
    { label: 'Security', value: scores.security ?? 0, color: PERSONA_COLORS.securite },
    { label: 'Social', value: scores.social ?? 0, color: PERSONA_COLORS.popularite },
  ];

  const W = 600; const H = 200;
  const ML = 110; const MR = 60; const MT = 44; const MB = 18;
  const CW = W - ML - MR; const CH = H - MT - MB;
  const slotH = CH / items.length; const barH = Math.max(20, slotH - 12);

  const bars = items.map(({ label, value, color }, i) => {
    const bw = Math.round((value / 100) * CW);
    const y = MT + i * slotH + (slotH - barH) / 2;
    return `
  <rect x="${ML}" y="${y}" width="${bw}" height="${barH}" fill="${color}" rx="3" opacity="0.85"/>
  <text x="${ML - 7}" y="${y + barH / 2 + 4}" fill="${TEXT_MUTED}" font-size="11" text-anchor="end" font-family="'SF Mono',monospace">${esc(label)}</text>
  <text x="${ML + bw + 6}" y="${y + barH / 2 + 4}" fill="${TEXT_MAIN}" font-size="12" font-weight="bold" font-family="'SF Mono',monospace">${value}</text>`;
  }).join('');

  const globalScore = profile?.globalScore != null
    ? `<text x="${W / 2}" y="${H - 4}" fill="${TEXT_MUTED}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace">Global score: ${profile.globalScore}</text>`
    : '';

  return { svg: svgWrap(W, H, 'Persona Scores', bars + globalScore), w: W, h: H };
}

export function buildBrowserDomainsChart(data) {
  const slice = extractBrowserSlice(data);
  const items = slice.topDomains.slice(0, 8);
  if (!items.length) return null;

  const W = 600; const H = 280;
  const ML = 140; const MR = 60; const MT = 44; const MB = 18;
  const CW = W - ML - MR; const CH = H - MT - MB;
  const N = items.length; const slotH = CH / N; const barH = Math.max(12, slotH - 8);
  const maxVal = items[0].count;

  const bars = items.map(({ domain, count }, i) => {
    const bw = Math.round((count / maxVal) * CW);
    const y = MT + i * slotH + (slotH - barH) / 2;
    return hBar({ x: ML, y, w: bw, h: barH, color: BAR_COLORS[i % BAR_COLORS.length], label: domain, value: count });
  }).join('');

  const sub = `<text x="${W / 2}" y="${H - 4}" fill="${TEXT_MUTED}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace">${slice.totalVisits} total visits</text>`;
  return { svg: svgWrap(W, H, 'Browser Top Domains', bars + sub), w: W, h: H };
}

export function buildLanguageChart(data, profile) {
  const langs = Array.isArray(data?.MACHINE_IDENTITY?.languages)
    ? data.MACHINE_IDENTITY.languages
    : (profile?.systemLanguages ?? []);
  if (!langs.length) return null;

  const W = 600; const H = 160;
  const pillH = 28; const pillPad = 12; const gap = 10; const MT = 50;
  let x = 20;

  const pills = langs.map((lang, i) => {
    const color = BAR_COLORS[i % BAR_COLORS.length];
    const textW = Math.max(60, String(lang).length * 8);
    const pillW = textW + pillPad * 2;
    const pill = `
  <rect x="${x}" y="${MT}" width="${pillW}" height="${pillH}" fill="${color}" rx="14" opacity="0.2"/>
  <rect x="${x}" y="${MT}" width="${pillW}" height="${pillH}" fill="none" stroke="${color}" stroke-width="1.5" rx="14"/>
  <text x="${x + pillW / 2}" y="${MT + pillH / 2 + 5}" fill="${color}" font-size="12" font-weight="bold" text-anchor="middle" font-family="'SF Mono',monospace">${esc(lang)}</text>`;
    x += pillW + gap;
    return pill;
  }).join('');

  const sub = `<text x="${W / 2}" y="${H - 10}" fill="${TEXT_MUTED}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace">${langs.length} system language${langs.length !== 1 ? 's' : ''} detected</text>`;
  return { svg: svgWrap(W, H, 'Language Fingerprint', pills + sub), w: W, h: H };
}

export function buildAIToolChart(data, profile) {
  const slice = extractAIToolsSlice(data);
  const tools = slice.tools;
  if (!slice.installedCount) return null;

  const W = 600; const H = 200;
  const cols = 5; const colW = W / cols; const rowH = 50; const MT = 50;

  const cells = tools.map(({ name, installed, recentlyUsed }, i) => {
    const col = i % cols; const row = Math.floor(i / cols);
    const cx = col * colW + colW / 2;
    const cy = MT + row * rowH;
    const color = installed ? (recentlyUsed ? '#10b981' : '#7c3aed') : '#2a2a4a';
    const textColor = installed ? TEXT_MAIN : TEXT_MUTED;
    return `
  <rect x="${col * colW + 6}" y="${cy - 14}" width="${colW - 12}" height="36" fill="${color}" rx="6" opacity="${installed ? '0.15' : '0.05'}"/>
  <rect x="${col * colW + 6}" y="${cy - 14}" width="${colW - 12}" height="36" fill="none" stroke="${color}" stroke-width="${installed ? 1.5 : 0.5}" rx="6"/>
  <text x="${cx}" y="${cy + 10}" fill="${textColor}" font-size="10" font-weight="${installed ? 'bold' : 'normal'}" text-anchor="middle" font-family="'SF Mono',monospace">${esc(name)}</text>`;
  }).join('');

  const H2 = MT + Math.ceil(tools.length / cols) * rowH + 36;
  const legend = `<text x="${W / 2}" y="${H2 - 8}" fill="${TEXT_MUTED}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace">${slice.installedCount} installed · green = used this week</text>`;
  return { svg: svgWrap(W, H2, 'AI Tool Exposure', cells + legend), w: W, h: H2 };
}

export function buildDownloadsChart(data) {
  const items = (data?.PAST_HISTORY?.recent_downloads ?? [])
    .filter(d => {
      const n = String(d.name || '').toLowerCase();
      return !n.startsWith('.') && n !== 'ds_store' && d.size_kb > 0;
    })
    .slice(0, 8);
  if (!items.length) return null;

  const W = 600; const H = 280;
  const ML = 160; const MR = 80; const MT = 44; const MB = 18;
  const CW = W - ML - MR; const CH = H - MT - MB;
  const N = items.length; const slotH = CH / N; const barH = Math.max(12, slotH - 8);
  const maxVal = Math.max(...items.map(d => d.size_kb));

  const bars = items.map((d, i) => {
    const sizeLabel = d.size_kb >= 1024
      ? `${(d.size_kb / 1024).toFixed(1)} MB`
      : `${Math.round(d.size_kb)} KB`;
    const bw = Math.max(4, Math.round((d.size_kb / maxVal) * CW));
    const y = MT + i * slotH + (slotH - barH) / 2;
    const name = String(d.name || '').slice(0, 22);
    return hBar({ x: ML, y, w: bw, h: barH, color: BAR_COLORS[i % BAR_COLORS.length], label: name, value: sizeLabel });
  }).join('');

  return { svg: svgWrap(W, H, 'Recent Downloads (by size)', bars), w: W, h: H };
}

export function buildSecurityAppsChart(data) {
  const slice = extractSecuritySlice(data);
  const W = 600; const H = 240;

  const settings = [
    { label: 'SIP', value: slice.sip, ok: /enabled/i.test(slice.sip) },
    { label: 'FileVault', value: slice.filevault, ok: /on|enabled/i.test(slice.filevault) },
    { label: 'Gatekeeper', value: slice.gatekeeper, ok: /enabled/i.test(slice.gatekeeper) },
  ];
  const colW = W / settings.length;

  const settingBlocks = settings.map(({ label, value, ok }, i) => {
    const cx = i * colW + colW / 2;
    const color = ok ? '#10b981' : '#ef4444';
    return `
  <text x="${cx}" y="58" fill="${TEXT_MUTED}" font-size="11" text-anchor="middle" font-family="'SF Mono',monospace">${esc(label)}</text>
  <circle cx="${cx}" cy="88" r="14" fill="${color}" opacity="0.2"/>
  <circle cx="${cx}" cy="88" r="14" fill="none" stroke="${color}" stroke-width="2"/>
  <text x="${cx}" y="93" fill="${color}" font-size="11" font-weight="bold" text-anchor="middle" font-family="'SF Mono',monospace">${esc(value)}</text>`;
  }).join('');

  const dividers = [1, 2].map(i =>
    `<line x1="${i * colW}" y1="44" x2="${i * colW}" y2="120" stroke="#1e1e3a" stroke-width="1"/>`,
  ).join('');

  const appsY = 140;
  const appLabels = slice.securityApps.length
    ? slice.securityApps
    : ['No security tools detected'];

  let ax = 20;
  const appPills = appLabels.map((name, i) => {
    const color = slice.securityApps.length ? '#10b981' : TEXT_MUTED;
    const tw = Math.max(80, String(name).length * 7.5);
    const pill = `
  <rect x="${ax}" y="${appsY}" width="${tw}" height="24" fill="${color}" rx="12" opacity="0.15"/>
  <rect x="${ax}" y="${appsY}" width="${tw}" height="24" fill="none" stroke="${color}" stroke-width="1" rx="12"/>
  <text x="${ax + tw / 2}" y="${appsY + 16}" fill="${color}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace">${esc(name)}</text>`;
    ax += tw + 8;
    return pill;
  }).join('');

  const sub = `<text x="${W / 2}" y="${H - 6}" fill="${TEXT_MUTED}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace">Security posture · macOS system checks</text>`;

  return { svg: svgWrap(W, H, 'Security Status', dividers + settingBlocks + appPills + sub), w: W, h: H };
}

// ─── Chart pool + picker ───────────────────────────────────────────────────

const CHART_POOL = [
  {
    id: 'app_categories',
    persona: 'productivite',
    build: (data, _profile) => {
      const slice = extractAppCategorySlice(data || {});
      return slice.byCategory.length ? buildAppCategoryChart(slice) : null;
    },
  },
  {
    id: 'most_used_apps',
    persona: 'productivite',
    build: (data, _profile) => buildMostUsedAppsChart(data),
  },
  {
    id: 'file_extensions',
    persona: 'productivite',
    build: (data, _profile) => {
      const slice = buildFileExtSlice(data || {});
      return slice.length ? buildFileExtChart(slice) : null;
    },
  },
  {
    id: 'storage_usage',
    persona: 'productivite',
    build: (data, profile) => buildStorageChart(data, profile),
  },
  {
    id: 'battery_hardware',
    persona: 'productivite',
    build: (data, profile) => buildBatteryHardwareChart(data, profile),
  },
  {
    id: 'persona_scores',
    persona: null,
    build: (_data, profile) => buildPersonaScoresChart(profile),
    resolvePersna: (profile) => {
      const s = profile?.personaScores || {};
      const max = Math.max(s.productivity ?? 0, s.security ?? 0, s.social ?? 0);
      if (max === (s.security ?? 0)) return 'securite';
      if (max === (s.social ?? 0)) return 'popularite';
      return 'productivite';
    },
  },
  {
    id: 'browser_domains',
    persona: 'popularite',
    build: (data, _profile) => buildBrowserDomainsChart(data),
  },
  {
    id: 'language_fingerprint',
    persona: 'popularite',
    build: (data, profile) => buildLanguageChart(data, profile),
  },
  {
    id: 'ai_tool_exposure',
    persona: 'popularite',
    build: (data, _profile) => buildAIToolChart(data),
  },
  {
    id: 'wifi_history',
    persona: 'securite',
    build: (data, _profile) => {
      const slice = extractWifiSlice(data || {});
      return slice.count >= 2 ? buildWifiTimelineChart(slice) : null;
    },
  },
  {
    id: 'recent_downloads',
    persona: 'securite',
    build: (data, _profile) => buildDownloadsChart(data),
  },
  {
    id: 'security_apps',
    persona: 'securite',
    build: (data, _profile) => buildSecurityAppsChart(data),
  },
];

function personaScoreFor(persona, scores) {
  if (!scores) return 50;
  if (persona === 'productivite') return scores.productivity ?? 50;
  if (persona === 'securite') return scores.security ?? 50;
  if (persona === 'popularite') return scores.social ?? 50;
  return 50;
}

function weightedPick(items, getWeight) {
  const weights = items.map((item) => Math.max(1, getWeight(item)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Pick a chart from the pool, excluding recently used types, weighted by persona scores.
 * Returns { svg, w, h, chartType, persona } or null if nothing builds.
 */
export function pickAndBuildChart(dataJson, profile, excludeTypes = [], personaScores = null) {
  const scores = personaScores ?? profile?.personaScores ?? null;
  const excludeSet = new Set(excludeTypes);
  const pool = CHART_POOL.filter(c => !excludeSet.has(c.id));
  const candidates = pool.length > 0 ? pool : CHART_POOL;

  // Build an ordered attempt list: weighted pick, remove chosen, repeat until exhausted
  const remaining = candidates.slice();
  const ordered = [];
  while (remaining.length > 0) {
    const picked = weightedPick(remaining, (entry) => {
      const persona = entry.persona ?? 'productivite';
      return personaScoreFor(persona, scores);
    });
    ordered.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
  }

  for (const entry of ordered) {
    try {
      const result = entry.build(dataJson, profile);
      if (!result?.svg) continue;
      const persona = entry.persona ?? (entry.resolvePersna ? entry.resolvePersna(profile) : 'productivite');
      return { ...result, chartType: entry.id, persona };
    } catch {
      continue;
    }
  }
  return null;
}
