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
import { normalizePersonaPercentTriplet } from './personaScores.js';

/** Matches feed persona accents (PostsTab / base.css). Charts use accent + black only. */
const BLACK = '#000000';
const PERSONA_CHART_ACCENT = {
  productivite: '#D8D8D8',
  securite: '#759AEF',
  popularite: '#CCF847',
};

function normalizeChartPersona(persona) {
  const k = String(persona ?? '').toLowerCase();
  if (k === 'securite' || k === 'security') return 'securite';
  if (k === 'popularite' || k === 'popularity' || k === 'social') return 'popularite';
  return 'productivite';
}

/** Two-color palette: black background + persona accent for all ink. */
export function chartPalette(persona) {
  const key = normalizeChartPersona(persona);
  const accent = PERSONA_CHART_ACCENT[key] ?? PERSONA_CHART_ACCENT.productivite;
  return { bg: BLACK, accent, black: BLACK };
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svgWrap(W, H, title, body, palette) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${palette.bg}" rx="8"/>
  <text x="${W / 2}" y="28" fill="${palette.accent}" font-size="13" font-weight="bold" text-anchor="middle" font-family="'SF Mono',monospace">${esc(title)}</text>
  ${body}
</svg>`;
}

function caption(W, y, text, palette) {
  return `<text x="${W / 2}" y="${y}" fill="${palette.accent}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.55">${esc(text)}</text>`;
}

function hBar({ x, y, w, h, palette, label, value, labelAnchor = 'end', labelX }) {
  const lx = labelX ?? x - 7;
  const { accent } = palette;
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${accent}" rx="2"/>
  <text x="${lx}" y="${y + h / 2 + 4}" fill="${accent}" font-size="11" text-anchor="${labelAnchor}" font-family="'SF Mono',monospace" opacity="0.55">${esc(label)}</text>
  <text x="${x + w + 6}" y="${y + h / 2 + 4}" fill="${accent}" font-size="11" font-family="'SF Mono',monospace">${esc(String(value))}</text>`;
}

// ─── Existing charts (kept) ────────────────────────────────────────────────

export function buildAppCategoryChart(appCategorySlice, persona = 'productivite') {
  const palette = chartPalette(persona);
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
    return hBar({ x: ML, y, w: bw, h: barH, palette, label: cat, value: count });
  }).join('');

  const sub = caption(W, H - 4, `${appCategorySlice?.totalInstalled || ''} apps installed`, palette);
  return { svg: svgWrap(W, H, 'App Categories', bars + sub, palette), w: W, h: H };
}

export function buildFileExtChart(recentFilesSlice, persona = 'productivite') {
  const palette = chartPalette(persona);
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
    return hBar({ x: ML, y, w: bw, h: barH, palette, label: ext || '(none)', value: count });
  }).join('');

  return { svg: svgWrap(W, H, 'Recent File Types (7 days)', bars, palette), w: W, h: H };
}

export function buildWifiTimelineChart(wifiSlice, persona = 'securite') {
  const palette = chartPalette(persona);
  const networks = (wifiSlice?.networks || []).slice(0, 20);
  if (!networks.length) return null;

  const W = 600; const H = 300;
  const colW = W / 2; const itemH = 22; const MT = 44;
  const { accent } = palette;

  const items = networks.map((name, i) => {
    const col = i < 10 ? 0 : 1;
    const row = i % 10;
    const x = col * colW + 24;
    const y = MT + row * itemH + 14;
    return `
  <circle cx="${x}" cy="${y - 4}" r="4" fill="${accent}"/>
  <text x="${x + 11}" y="${y}" fill="${accent}" font-size="11" font-family="'SF Mono',monospace">${esc(name)}</text>`;
  }).join('');

  const sub = caption(W, H - 6, `${networks.length} networks · most recent first`, palette);
  return { svg: svgWrap(W, H, 'WiFi Network History', items + sub, palette), w: W, h: H };
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

export function buildMostUsedAppsChart(data, persona = 'productivite') {
  const palette = chartPalette(persona);
  const slice = extractMostUsedAppsSlice(data);
  const apps = slice.apps.slice(0, 12);
  if (!apps.length) return null;

  const W = 600; const H = Math.max(200, 44 + apps.length * 26 + 20);
  const itemH = 22; const MT = 44; const ML = 160; const MR = 20;
  const dotR = 5;
  const { accent } = palette;

  const rows = apps.map(({ app, last_used }, i) => {
    const y = MT + i * itemH + itemH / 2;
    const dateStr = last_used ? String(last_used).slice(5, 10) : '';
    return `
  <circle cx="${ML - 14}" cy="${y}" r="${dotR}" fill="${accent}"/>
  <text x="${ML}" y="${y + 4}" fill="${accent}" font-size="11" font-family="'SF Mono',monospace">${esc(app)}</text>
  <text x="${W - MR}" y="${y + 4}" fill="${accent}" font-size="10" text-anchor="end" font-family="'SF Mono',monospace" opacity="0.55">${esc(dateStr)}</text>`;
  }).join('');

  const sub = caption(W, H - 4, `${slice.count} apps tracked · sorted by recency`, palette);
  return { svg: svgWrap(W, H, 'Recently Used Apps (7 days)', rows + sub, palette), w: W, h: H };
}

export function buildStorageChart(data, profile, persona = 'productivite') {
  const palette = chartPalette(persona);
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
  const { accent, black } = palette;

  const body = `
  <rect x="${ML}" y="${barY}" width="${barW}" height="${barH}" fill="${black}" stroke="${accent}" stroke-width="1" rx="4" opacity="0.35"/>
  <rect x="${ML}" y="${barY}" width="${fillW}" height="${barH}" fill="${accent}" rx="4"/>
  <text x="${ML + fillW / 2}" y="${barY + barH / 2 + 5}" fill="${black}" font-size="13" font-weight="bold" text-anchor="middle" font-family="'SF Mono',monospace">${pct}%</text>
  <text x="${ML}" y="${barY + barH + 20}" fill="${accent}" font-size="11" font-family="'SF Mono',monospace" opacity="0.55">Used: ${esc(used)}</text>
  <text x="${W / 2}" y="${barY + barH + 20}" fill="${accent}" font-size="11" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.55">Free: ${esc(free)}</text>
  <text x="${W - MR}" y="${barY + barH + 20}" fill="${accent}" font-size="11" text-anchor="end" font-family="'SF Mono',monospace" opacity="0.55">Total: ${esc(total)}</text>`;

  return { svg: svgWrap(W, H, 'Storage Usage', body, palette), w: W, h: H };
}

export function buildBatteryHardwareChart(data, profile, persona = 'productivite') {
  const palette = chartPalette(persona);
  const bat = extractBatterySlice(data);
  const ram = data?.MACHINE_IDENTITY?.hardware_snapshot?.ram || profile?.ram || '—';
  const uptime = profile?.uptimeDays != null ? `${profile.uptimeDays}d` : '—';
  const cycles = bat.cycleCount ?? profile?.batteryCycles ?? '—';
  const batPct = bat.percent || 0;
  const { accent, black } = palette;

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
  <rect x="${i * colW + batBarML}" y="${batBarY}" width="${batBarW}" height="${batBarH}" fill="${black}" stroke="${accent}" stroke-width="1" rx="3" opacity="0.35"/>
  <rect x="${i * colW + batBarML}" y="${batBarY}" width="${Math.round((batPct / 100) * batBarW)}" height="${batBarH}" fill="${accent}" rx="3"/>` : '';
    return `
  <text x="${cx}" y="58" fill="${accent}" font-size="11" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.55">${esc(label)}</text>
  <text x="${cx}" y="90" fill="${accent}" font-size="22" font-weight="bold" text-anchor="middle" font-family="'SF Mono',monospace">${esc(value)}</text>
  <text x="${cx}" y="110" fill="${accent}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.55">${esc(sub)}</text>
  ${extra}`;
  }).join('');

  const dividers = [1, 2, 3].map(i =>
    `<line x1="${i * colW}" y1="44" x2="${i * colW}" y2="${H - 10}" stroke="${accent}" stroke-width="1" opacity="0.25"/>`,
  ).join('');

  return { svg: svgWrap(W, H, 'Hardware Vitals', dividers + blocks, palette), w: W, h: H };
}

export function buildPersonaScoresChart(profile, persona = 'productivite') {
  const palette = chartPalette(persona);
  const scores = profile?.personaScores ? normalizePersonaPercentTriplet(profile.personaScores) : null;
  if (!scores) return null;

  const items = [
    { label: 'Productivity', value: scores.productivity ?? 0 },
    { label: 'Security', value: scores.security ?? 0 },
    { label: 'Social', value: scores.social ?? 0 },
  ];

  const W = 600; const H = 200;
  const ML = 110; const MR = 60; const MT = 44; const MB = 18;
  const CW = W - ML - MR; const CH = H - MT - MB;
  const slotH = CH / items.length; const barH = Math.max(20, slotH - 12);
  const { accent } = palette;

  const bars = items.map(({ label, value }, i) => {
    const bw = Math.round((value / 100) * CW);
    const y = MT + i * slotH + (slotH - barH) / 2;
    return `
  <rect x="${ML}" y="${y}" width="${bw}" height="${barH}" fill="${accent}" rx="3"/>
  <text x="${ML - 7}" y="${y + barH / 2 + 4}" fill="${accent}" font-size="11" text-anchor="end" font-family="'SF Mono',monospace" opacity="0.55">${esc(label)}</text>
  <text x="${ML + bw + 6}" y="${y + barH / 2 + 4}" fill="${accent}" font-size="12" font-weight="bold" font-family="'SF Mono',monospace">${value}</text>`;
  }).join('');

  const globalScore = profile?.globalScore != null
    ? caption(W, H - 4, `Global score: ${profile.globalScore}`, palette)
    : '';

  return { svg: svgWrap(W, H, 'Persona Scores', bars + globalScore, palette), w: W, h: H };
}

export function buildBrowserDomainsChart(data, persona = 'popularite') {
  const palette = chartPalette(persona);
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
    return hBar({ x: ML, y, w: bw, h: barH, palette, label: domain, value: count });
  }).join('');

  const sub = caption(W, H - 4, `${slice.totalVisits} total visits`, palette);
  return { svg: svgWrap(W, H, 'Browser Top Domains', bars + sub, palette), w: W, h: H };
}

export function buildLanguageChart(data, profile, persona = 'popularite') {
  const palette = chartPalette(persona);
  const langs = Array.isArray(data?.MACHINE_IDENTITY?.languages)
    ? data.MACHINE_IDENTITY.languages
    : (profile?.systemLanguages ?? []);
  if (!langs.length) return null;

  const W = 600; const H = 160;
  const pillH = 28; const pillPad = 12; const gap = 10; const MT = 50;
  let x = 20;
  const { accent } = palette;

  const pills = langs.map((lang) => {
    const textW = Math.max(60, String(lang).length * 8);
    const pillW = textW + pillPad * 2;
    const pill = `
  <rect x="${x}" y="${MT}" width="${pillW}" height="${pillH}" fill="${accent}" rx="14" opacity="0.2"/>
  <rect x="${x}" y="${MT}" width="${pillW}" height="${pillH}" fill="none" stroke="${accent}" stroke-width="1.5" rx="14"/>
  <text x="${x + pillW / 2}" y="${MT + pillH / 2 + 5}" fill="${accent}" font-size="12" font-weight="bold" text-anchor="middle" font-family="'SF Mono',monospace">${esc(lang)}</text>`;
    x += pillW + gap;
    return pill;
  }).join('');

  const sub = caption(W, H - 10, `${langs.length} system language${langs.length !== 1 ? 's' : ''} detected`, palette);
  return { svg: svgWrap(W, H, 'Language Fingerprint', pills + sub, palette), w: W, h: H };
}

export function buildAIToolChart(data, _profile, persona = 'popularite') {
  const palette = chartPalette(persona);
  const slice = extractAIToolsSlice(data);
  const tools = slice.tools;
  if (!slice.installedCount) return null;

  const W = 600; const H = 200;
  const cols = 5; const colW = W / cols; const rowH = 50; const MT = 50;
  const { accent, black } = palette;

  const cells = tools.map(({ name, installed, recentlyUsed }, i) => {
    const col = i % cols; const row = Math.floor(i / cols);
    const cx = col * colW + colW / 2;
    const cy = MT + row * rowH;
    const fillOpacity = !installed ? '0.05' : recentlyUsed ? '0.28' : '0.14';
    const strokeW = installed ? '1.5' : '0.5';
    const textOpacity = installed ? '1' : '0.45';
    return `
  <rect x="${col * colW + 6}" y="${cy - 14}" width="${colW - 12}" height="36" fill="${installed ? accent : black}" rx="6" opacity="${fillOpacity}"/>
  <rect x="${col * colW + 6}" y="${cy - 14}" width="${colW - 12}" height="36" fill="none" stroke="${accent}" stroke-width="${strokeW}" rx="6" opacity="${installed ? '1' : '0.35'}"/>
  <text x="${cx}" y="${cy + 10}" fill="${accent}" font-size="10" font-weight="${installed ? 'bold' : 'normal'}" text-anchor="middle" font-family="'SF Mono',monospace" opacity="${textOpacity}">${esc(name)}</text>`;
  }).join('');

  const H2 = MT + Math.ceil(tools.length / cols) * rowH + 36;
  const legend = caption(W, H2 - 8, `${slice.installedCount} installed · bold = used this week`, palette);
  return { svg: svgWrap(W, H2, 'AI Tool Exposure', cells + legend, palette), w: W, h: H2 };
}

export function buildDownloadsChart(data, _profile, persona = 'securite') {
  const palette = chartPalette(persona);
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
    return hBar({ x: ML, y, w: bw, h: barH, palette, label: name, value: sizeLabel });
  }).join('');

  return { svg: svgWrap(W, H, 'Recent Downloads (by size)', bars, palette), w: W, h: H };
}

export function buildSecurityAppsChart(data, _profile, persona = 'securite') {
  const palette = chartPalette(persona);
  const slice = extractSecuritySlice(data);
  const W = 600; const H = 240;
  const { accent, black } = palette;

  const settings = [
    { label: 'SIP', value: slice.sip, ok: /enabled/i.test(slice.sip) },
    { label: 'FileVault', value: slice.filevault, ok: /on|enabled/i.test(slice.filevault) },
    { label: 'Gatekeeper', value: slice.gatekeeper, ok: /enabled/i.test(slice.gatekeeper) },
  ];
  const colW = W / settings.length;

  const settingBlocks = settings.map(({ label, value, ok }, i) => {
    const cx = i * colW + colW / 2;
    const fillOpacity = ok ? '0.22' : '0.06';
    const strokeOpacity = ok ? '1' : '0.4';
    return `
  <text x="${cx}" y="58" fill="${accent}" font-size="11" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.55">${esc(label)}</text>
  <circle cx="${cx}" cy="88" r="14" fill="${ok ? accent : black}" opacity="${fillOpacity}"/>
  <circle cx="${cx}" cy="88" r="14" fill="none" stroke="${accent}" stroke-width="2" opacity="${strokeOpacity}"/>
  <text x="${cx}" y="93" fill="${accent}" font-size="11" font-weight="bold" text-anchor="middle" font-family="'SF Mono',monospace">${esc(value)}</text>`;
  }).join('');

  const dividers = [1, 2].map(i =>
    `<line x1="${i * colW}" y1="44" x2="${i * colW}" y2="120" stroke="${accent}" stroke-width="1" opacity="0.25"/>`,
  ).join('');

  const appsY = 140;
  const appLabels = slice.securityApps.length
    ? slice.securityApps
    : ['No security tools detected'];

  let ax = 20;
  const appPills = appLabels.map((name) => {
    const tw = Math.max(80, String(name).length * 7.5);
    const pillOpacity = slice.securityApps.length ? '0.18' : '0.08';
    const pill = `
  <rect x="${ax}" y="${appsY}" width="${tw}" height="24" fill="${accent}" rx="12" opacity="${pillOpacity}"/>
  <rect x="${ax}" y="${appsY}" width="${tw}" height="24" fill="none" stroke="${accent}" stroke-width="1" rx="12"/>
  <text x="${ax + tw / 2}" y="${appsY + 16}" fill="${accent}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace">${esc(name)}</text>`;
    ax += tw + 8;
    return pill;
  }).join('');

  const sub = caption(W, H - 6, 'Security posture · macOS system checks', palette);

  return { svg: svgWrap(W, H, 'Security Status', dividers + settingBlocks + appPills + sub, palette), w: W, h: H };
}

// ─── Chart pool + picker ───────────────────────────────────────────────────

function resolveChartPersona(entry, profile) {
  if (entry.persona) return entry.persona;
  if (entry.resolvePersna) return entry.resolvePersna(profile);
  return 'productivite';
}

const CHART_POOL = [
  {
    id: 'app_categories',
    persona: 'productivite',
    build: (data, _profile, persona) => {
      const slice = extractAppCategorySlice(data || {});
      return slice.byCategory.length ? buildAppCategoryChart(slice, persona) : null;
    },
  },
  {
    id: 'most_used_apps',
    persona: 'productivite',
    build: (data, _profile, persona) => buildMostUsedAppsChart(data, persona),
  },
  {
    id: 'file_extensions',
    persona: 'productivite',
    build: (data, _profile, persona) => {
      const slice = buildFileExtSlice(data || {});
      return slice.length ? buildFileExtChart(slice, persona) : null;
    },
  },
  {
    id: 'storage_usage',
    persona: 'productivite',
    build: (data, profile, persona) => buildStorageChart(data, profile, persona),
  },
  {
    id: 'battery_hardware',
    persona: 'productivite',
    build: (data, profile, persona) => buildBatteryHardwareChart(data, profile, persona),
  },
  {
    id: 'persona_scores',
    persona: null,
    build: (_data, profile, persona) => buildPersonaScoresChart(profile, persona),
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
    build: (data, _profile, persona) => buildBrowserDomainsChart(data, persona),
  },
  {
    id: 'language_fingerprint',
    persona: 'popularite',
    build: (data, profile, persona) => buildLanguageChart(data, profile, persona),
  },
  {
    id: 'ai_tool_exposure',
    persona: 'popularite',
    build: (data, profile, persona) => buildAIToolChart(data, profile, persona),
  },
  {
    id: 'wifi_history',
    persona: 'securite',
    build: (data, _profile, persona) => {
      const slice = extractWifiSlice(data || {});
      return slice.count >= 2 ? buildWifiTimelineChart(slice, persona) : null;
    },
  },
  {
    id: 'recent_downloads',
    persona: 'securite',
    build: (data, _profile, persona) => buildDownloadsChart(data, _profile, persona),
  },
  {
    id: 'security_apps',
    persona: 'securite',
    build: (data, _profile, persona) => buildSecurityAppsChart(data, _profile, persona),
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
  const scores = personaScores
    ? normalizePersonaPercentTriplet(personaScores)
    : (profile?.personaScores ? normalizePersonaPercentTriplet(profile.personaScores) : null);
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
      const persona = resolveChartPersona(entry, profile);
      const result = entry.build(dataJson, profile, persona);
      if (!result?.svg) continue;
      return { ...result, chartType: entry.id, persona };
    } catch {
      continue;
    }
  }
  return null;
}
