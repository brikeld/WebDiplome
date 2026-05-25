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

/** Matches feed persona accents (PostsTab / base.css). Charts: persona bg, black text, white data viz. */
const WHITE = '#ffffff';
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

/** Persona canvas, black typography, white bars/markers/lines. */
export function chartPalette(persona) {
  const key = normalizeChartPersona(persona);
  const bg = PERSONA_CHART_ACCENT[key] ?? PERSONA_CHART_ACCENT.productivite;
  return { bg, text: BLACK, viz: WHITE };
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svgWrap(W, H, title, body, palette) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${palette.bg}" rx="0"/>
  <text x="${W / 2}" y="28" fill="${palette.text}" font-size="13" font-weight="bold" text-anchor="middle" font-family="'SF Mono',monospace">${esc(title)}</text>
  ${body}
</svg>`;
}

function caption(W, y, text, palette) {
  return `<text x="${W / 2}" y="${y}" fill="${palette.text}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.55">${esc(text)}</text>`;
}

function hBar({ x, y, w, h, palette, label, value, labelAnchor = 'end', labelX }) {
  const lx = labelX ?? x - 7;
  const { text, viz } = palette;
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${viz}" rx="2"/>
  <text x="${lx}" y="${y + h / 2 + 4}" fill="${text}" font-size="11" text-anchor="${labelAnchor}" font-family="'SF Mono',monospace" opacity="0.55">${esc(label)}</text>
  <text x="${x + w + 6}" y="${y + h / 2 + 4}" fill="${text}" font-size="11" font-family="'SF Mono',monospace">${esc(String(value))}</text>`;
}

function treemapLayout(items, x, y, w, h, gap) {
  if (!items.length) return [];
  const rects = [];
  let rem = items.slice();
  let cy = y; let remH = h;
  while (rem.length > 0) {
    const remTotal = rem.reduce((s, [, v]) => s + v, 0);
    let bestN = 1; let bestAR = Infinity;
    for (let n = 1; n <= Math.min(rem.length, 4); n++) {
      const rowSum = rem.slice(0, n).reduce((s, [, v]) => s + v, 0);
      const rh = (rowSum / remTotal) * remH;
      const ar = rem.slice(0, n).reduce((worst, [, v]) => {
        const bw = (v / rowSum) * w;
        return Math.max(worst, rh > 0 && bw > 0 ? Math.max(rh / bw, bw / rh) : Infinity);
      }, 0);
      if (ar < bestAR) { bestAR = ar; bestN = n; }
    }
    const row = rem.splice(0, bestN);
    const rowSum = row.reduce((s, [, v]) => s + v, 0);
    const rh = Math.max(1, Math.round((rowSum / remTotal) * remH));
    let bx = x;
    row.forEach(([label, count], i) => {
      const isLast = i === row.length - 1;
      const bw = isLast ? (x + w - bx) : Math.round((count / rowSum) * w);
      rects.push({ x: bx, y: cy, w: Math.max(1, bw - gap), h: Math.max(1, rh - gap), label, count });
      bx += bw;
    });
    cy += rh; remH -= rh;
  }
  return rects;
}

// ─── Existing charts (kept) ────────────────────────────────────────────────

export function buildAppCategoryChart(appCategorySlice, persona = 'productivite') {
  const palette = chartPalette(persona);
  let items = (appCategorySlice?.byCategory || []).slice(0, 7);
  if (!items.length) items = [['No data', 1]];
  const { text, viz } = palette;
  const W = 640; const H = 320;
  const ML = 48; const MR = 48; const MT = 56; const MB = 60;
  const CW = W - ML - MR; const CH = H - MT - MB;
  const N = items.length;
  const colW = Math.floor(CW / N);
  const barW = Math.max(24, colW - 20);
  const maxVal = Math.max(1, ...items.map(([, v]) => v));
  const baseY = MT + CH;
  const bars = items.map(([cat, count], i) => {
    const bh = Math.round((count / maxVal) * CH);
    const bx = ML + i * colW + Math.round((colW - barW) / 2);
    const by = baseY - bh;
    const label = cat.length > 10 ? cat.slice(0, 9) + '…' : cat;
    return `
  <rect x="${bx}" y="${by}" width="${barW}" height="${bh}" fill="${viz}" rx="2"/>
  <text x="${bx + barW / 2}" y="${by - 7}" fill="${text}" font-size="11" font-weight="700" text-anchor="middle" font-family="'SF Mono',monospace">${esc(String(count))}</text>
  <text x="${bx + barW / 2}" y="${baseY + 20}" fill="${text}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.55">${esc(label)}</text>`;
  }).join('');
  const baseline = `<line x1="${ML}" y1="${baseY}" x2="${W - MR}" y2="${baseY}" stroke="${text}" stroke-width="0.8" opacity="0.15"/>`;
  const sub = `<text x="${W / 2}" y="${H - 8}" fill="${text}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.4">${esc(String(appCategorySlice?.totalInstalled || ''))} apps installed</text>`;
  return { svg: svgWrap(W, H, 'App Categories', baseline + bars + sub, palette), w: W, h: H };
}

export function buildFileExtChart(recentFilesSlice, persona = 'productivite') {
  const palette = chartPalette(persona);
  const items = (recentFilesSlice || []).slice(0, 8);
  if (!items.length) return null;
  const { text, viz } = palette;
  const W = 640; const H = 360;
  const PAD = 48; const TY = 56; const GAP = 3;
  const CW = W - PAD * 2; const CH = H - TY - PAD;
  const opacities = [1, 0.88, 0.75, 0.63, 0.52, 0.42, 0.34, 0.27];
  const tiles = treemapLayout(items, PAD, TY, CW, CH, GAP).map(({ x, y, w, h, label, count }, i) => {
    const op = opacities[i] ?? 0.27;
    const fs = Math.min(18, Math.max(9, Math.floor(w / 5)));
    const cs = Math.max(8, Math.floor(fs * 0.65));
    return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${viz}" opacity="${op}" rx="2"/>
  <text x="${x + w / 2}" y="${y + h / 2}" fill="${text}" font-size="${fs}" font-weight="800" text-anchor="middle" dominant-baseline="middle" font-family="'SF Mono',monospace">${esc(String(label || '(none)'))}</text>
  ${h >= fs * 2 + 8 ? `<text x="${x + w / 2}" y="${y + h / 2 + fs + 2}" fill="${text}" font-size="${cs}" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.6">${esc(String(count))}</text>` : ''}`;
  }).join('');
  return { svg: svgWrap(W, H, 'Recent File Types (7 days)', tiles, palette), w: W, h: H };
}

export function buildWifiTimelineChart(wifiSlice, persona = 'securite') {
  const palette = chartPalette(persona);
  const networks = (wifiSlice?.networks || []).slice(0, 10);
  if (!networks.length) return null;
  const { text, viz } = palette;
  const W = 640;
  const PAD = 48; const TY = 40; const STRIP_H = 18; const GAP = 8;
  const N = networks.length;
  const H = TY + N * (STRIP_H + GAP) + 48;
  const maxW = W - PAD * 2;
  const strips = networks.map((name, i) => {
    const sw = Math.round(maxW * Math.pow(0.87, i));
    const op = Math.max(0.15, 1 - i * 0.09);
    const sy = TY + i * (STRIP_H + GAP);
    return `
  <rect x="${PAD}" y="${sy}" width="${sw}" height="${STRIP_H}" fill="${viz}" opacity="${op.toFixed(2)}" rx="1"/>
  <text x="${PAD + 10}" y="${sy + STRIP_H * 0.7}" fill="${text}" font-size="10" font-weight="${i === 0 ? '700' : '400'}" font-family="'SF Mono',monospace">${esc(name)}</text>`;
  }).join('');
  const sub = `<text x="${W / 2}" y="${H - 10}" fill="${text}" font-size="9" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.4">${N} networks · most recent first</text>`;
  return { svg: svgWrap(W, H, 'WiFi Network History', strips + sub, palette), w: W, h: H };
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
  const apps = slice.apps.slice(0, 10).filter(a => a.last_used);
  if (!apps.length) return null;
  const { text, viz } = palette;
  const W = 640; const H = 280;
  const ML = 48; const MR = 48; const MT = 48; const MB = 56;
  const CW = W - ML - MR;
  const axisY = H - MB;
  const now = Date.now();
  const rangeMs = 7 * 24 * 60 * 60 * 1000;
  const toX = (ds) => {
    const frac = Math.max(0, Math.min(1, (new Date(ds).getTime() - (now - rangeMs)) / rangeMs));
    return Math.round(ML + frac * CW);
  };
  const axis = `<line x1="${ML}" y1="${axisY}" x2="${W - MR}" y2="${axisY}" stroke="${text}" stroke-width="0.8" opacity="0.2"/>`;
  const ticks = [{ f: 0, l: '7d ago' }, { f: 0.5, l: '3d' }, { f: 1, l: 'now' }].map(({ f, l }) => {
    const tx = ML + f * CW;
    return `<line x1="${tx}" y1="${axisY}" x2="${tx}" y2="${axisY + 6}" stroke="${text}" stroke-width="0.8" opacity="0.2"/>
  <text x="${tx}" y="${axisY + 18}" fill="${text}" font-size="9" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.45">${esc(l)}</text>`;
  }).join('');
  const rowY = [MT + 38, MT + 96];
  const dots = apps.map((a, i) => {
    const cx = toX(a.last_used);
    const cy = rowY[i % 2];
    const name = a.app.length > 13 ? a.app.slice(0, 12) + '…' : a.app;
    return `
  <line x1="${cx}" y1="${cy + 7}" x2="${cx}" y2="${axisY}" stroke="${text}" stroke-width="0.5" opacity="0.12" stroke-dasharray="3,3"/>
  <circle cx="${cx}" cy="${cy}" r="6" fill="${viz}"/>
  <text x="${cx}" y="${cy - 10}" fill="${text}" font-size="9" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.7">${esc(name)}</text>`;
  }).join('');
  const sub = `<text x="${W / 2}" y="${H - 6}" fill="${text}" font-size="9" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.38">${slice.count} apps tracked · last 7 days</text>`;
  return { svg: svgWrap(W, H, 'Recently Used Apps (7 days)', axis + ticks + dots + sub, palette), w: W, h: H };
}

export function buildStorageChart(data, profile, persona = 'productivite') {
  const palette = chartPalette(persona);
  const slice = extractStorageSlice(data);
  const used = slice.used || (profile?.storageUsed ?? '');
  const total = slice.total || (profile?.storageTotal ?? '');
  const free = slice.free || '';
  const pct = slice.usePct != null ? slice.usePct : (() => {
    const u = parseFloat(used); const t = parseFloat(total);
    return t > 0 ? Math.round((u / t) * 100) : 0;
  })();
  const { text, viz } = palette;
  const W = 640; const H = 280;
  const cx = 190; const cy = 140; const r = 90; const sw = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const ring = `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${text}" stroke-width="${sw}" opacity="0.1"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${viz}" stroke-width="${sw}"
    stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
    stroke-linecap="butt" transform="rotate(-90 ${cx} ${cy})"/>
  <text x="${cx}" y="${cy - 8}" fill="${text}" font-size="34" font-weight="800" text-anchor="middle" font-family="'SF Mono',monospace">${pct}%</text>
  <text x="${cx}" y="${cy + 14}" fill="${text}" font-size="11" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.5">used</text>`;
  const statsX = 340;
  const stats = `
  <text x="${statsX}" y="100" fill="${text}" font-size="10" font-family="'SF Mono',monospace" opacity="0.5">Used</text>
  <text x="${statsX}" y="122" fill="${text}" font-size="18" font-weight="800" font-family="'SF Mono',monospace">${esc(used)}</text>
  <line x1="${statsX}" y1="132" x2="${W - 48}" y2="132" stroke="${text}" stroke-width="0.5" opacity="0.18"/>
  <text x="${statsX}" y="152" fill="${text}" font-size="10" font-family="'SF Mono',monospace" opacity="0.5">Free</text>
  <text x="${statsX}" y="174" fill="${text}" font-size="18" font-weight="800" font-family="'SF Mono',monospace">${esc(free)}</text>
  <line x1="${statsX}" y1="184" x2="${W - 48}" y2="184" stroke="${text}" stroke-width="0.5" opacity="0.18"/>
  <text x="${statsX}" y="204" fill="${text}" font-size="10" font-family="'SF Mono',monospace" opacity="0.5">Total</text>
  <text x="${statsX}" y="226" fill="${text}" font-size="18" font-weight="800" font-family="'SF Mono',monospace">${esc(total)}</text>`;
  return { svg: svgWrap(W, H, 'Storage Usage', ring + stats, palette), w: W, h: H };
}

export function buildBatteryHardwareChart(data, profile, persona = 'productivite') {
  const palette = chartPalette(persona);
  const bat = extractBatterySlice(data);
  const ram = data?.MACHINE_IDENTITY?.hardware_snapshot?.ram
    || data?.MACHINE_IDENTITY?.ram || profile?.ram || '—';
  const chip = data?.MACHINE_IDENTITY?.hardware_snapshot?.chip
    || data?.MACHINE_IDENTITY?.chip || '—';
  const model = data?.MACHINE_IDENTITY?.model_name
    || data?.MACHINE_IDENTITY?.machine_model || profile?.machineModel || '—';
  const cycles = bat.cycleCount ?? profile?.batteryCycles ?? '—';
  const condition = bat.condition || '—';
  const { text } = palette;
  const W = 640; const H = 280;
  const mx = 320; const my = 153;
  const dividers = `
  <line x1="48" y1="${my}" x2="${W - 48}" y2="${my}" stroke="${text}" stroke-width="0.5" opacity="0.15"/>
  <line x1="${mx}" y1="40" x2="${mx}" y2="${H - 32}" stroke="${text}" stroke-width="0.5" opacity="0.15"/>`;
  const modelShort = model.length > 20 ? model.slice(0, 19) + '…' : model;
  const chipShort = chip.length > 14 ? chip.slice(0, 13) + '…' : chip;
  const quadrants = `
  <text x="64" y="58" fill="${text}" font-size="10" font-family="'SF Mono',monospace" opacity="0.45">Machine</text>
  <text x="64" y="88" fill="${text}" font-size="22" font-weight="800" font-family="'SF Mono',monospace">${esc(modelShort)}</text>
  <text x="${mx + 24}" y="58" fill="${text}" font-size="10" font-family="'SF Mono',monospace" opacity="0.45">Chip</text>
  <text x="${mx + 24}" y="88" fill="${text}" font-size="22" font-weight="800" font-family="'SF Mono',monospace">${esc(chipShort)}</text>
  <text x="64" y="${my + 28}" fill="${text}" font-size="10" font-family="'SF Mono',monospace" opacity="0.45">Memory</text>
  <text x="64" y="${my + 62}" fill="${text}" font-size="30" font-weight="800" font-family="'SF Mono',monospace">${esc(ram)}</text>
  <text x="${mx + 24}" y="${my + 28}" fill="${text}" font-size="10" font-family="'SF Mono',monospace" opacity="0.45">Battery</text>
  <text x="${mx + 24}" y="${my + 58}" fill="${text}" font-size="20" font-weight="800" font-family="'SF Mono',monospace">${esc(condition)}</text>
  <text x="${mx + 24}" y="${my + 78}" fill="${text}" font-size="11" font-family="'SF Mono',monospace" opacity="0.5">${esc(String(cycles))} cycles</text>`;
  return { svg: svgWrap(W, H, 'Hardware Spec', dividers + quadrants, palette), w: W, h: H };
}

export function buildPersonaScoresChart(profile, persona = 'productivite') {
  const palette = chartPalette(persona);
  const scores = profile?.personaScores
    ? normalizePersonaPercentTriplet(profile.personaScores) : null;
  if (!scores) return null;
  const { text, viz } = palette;
  const W = 640; const H = 340;
  const cx = 240; const cy = 176;
  const items = [
    { label: 'Productivity', value: scores.productivity ?? 0, r: 96 },
    { label: 'Security',     value: scores.security     ?? 0, r: 68 },
    { label: 'Social',       value: scores.social       ?? 0, r: 40 },
  ];
  const rings = items.map(({ value, r }) => {
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - value / 100);
    return `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${text}" stroke-width="14" opacity="0.1"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${viz}" stroke-width="14"
    stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
    stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>`;
  }).join('');
  const globalScore = profile?.globalScore
    ?? Math.round(items.reduce((s, { value }) => s + value, 0) / 3);
  const center = `
  <text x="${cx}" y="${cy - 8}" fill="${text}" font-size="36" font-weight="800" text-anchor="middle" font-family="'SF Mono',monospace">${esc(String(globalScore))}</text>
  <text x="${cx}" y="${cy + 14}" fill="${text}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.5">global</text>`;
  const legendX = 400;
  const legend = items.map(({ label, value }, i) => {
    const ly = 120 + i * 44;
    return `
  <text x="${legendX}" y="${ly}" fill="${text}" font-size="10" font-family="'SF Mono',monospace" opacity="0.5">${esc(label)}</text>
  <text x="${legendX}" y="${ly + 22}" fill="${text}" font-size="22" font-weight="800" font-family="'SF Mono',monospace">${value}</text>
  ${i < 2 ? `<line x1="${legendX}" y1="${ly + 30}" x2="${W - 48}" y2="${ly + 30}" stroke="${text}" stroke-width="0.5" opacity="0.15"/>` : ''}`;
  }).join('');
  return { svg: svgWrap(W, H, 'Persona Scores', rings + center + legend, palette), w: W, h: H };
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
  const { text, viz } = palette;

  const pills = langs.map((lang) => {
    const textW = Math.max(60, String(lang).length * 8);
    const pillW = textW + pillPad * 2;
    const pill = `
  <rect x="${x}" y="${MT}" width="${pillW}" height="${pillH}" fill="${viz}" rx="14" opacity="0.2"/>
  <rect x="${x}" y="${MT}" width="${pillW}" height="${pillH}" fill="none" stroke="${viz}" stroke-width="1.5" rx="14"/>
  <text x="${x + pillW / 2}" y="${MT + pillH / 2 + 5}" fill="${text}" font-size="12" font-weight="bold" text-anchor="middle" font-family="'SF Mono',monospace">${esc(lang)}</text>`;
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
  const { text, viz, bg } = palette;

  const cells = tools.map(({ name, installed, recentlyUsed }, i) => {
    const col = i % cols; const row = Math.floor(i / cols);
    const cx = col * colW + colW / 2;
    const cy = MT + row * rowH;
    const fillOpacity = !installed ? '0.05' : recentlyUsed ? '0.28' : '0.14';
    const strokeW = installed ? '1.5' : '0.5';
    const textOpacity = installed ? '1' : '0.45';
    return `
  <rect x="${col * colW + 6}" y="${cy - 14}" width="${colW - 12}" height="36" fill="${installed ? viz : 'none'}" rx="6" opacity="${fillOpacity}"/>
  <rect x="${col * colW + 6}" y="${cy - 14}" width="${colW - 12}" height="36" fill="none" stroke="${viz}" stroke-width="${strokeW}" rx="6" opacity="${installed ? '1' : '0.35'}"/>
  <text x="${cx}" y="${cy + 10}" fill="${text}" font-size="10" font-weight="${installed ? 'bold' : 'normal'}" text-anchor="middle" font-family="'SF Mono',monospace" opacity="${textOpacity}">${esc(name)}</text>`;
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
  const { text, viz } = palette;
  const W = 640;
  const ML = 220; const MR = 100; const PAD_V = 48; const ROW_H = 26;
  const H = PAD_V + items.length * ROW_H + 48;
  const lineW = W - ML - MR;
  const maxSize = Math.max(...items.map(d => d.size_kb));
  const lollipops = items.map((d, i) => {
    const name = String(d.name || '').slice(0, 22);
    const sizeLabel = d.size_kb >= 1024
      ? `${(d.size_kb / 1024).toFixed(1)} MB`
      : `${Math.round(d.size_kb)} KB`;
    const lx = ML + Math.round((d.size_kb / maxSize) * lineW);
    const ly = PAD_V + i * ROW_H + ROW_H / 2;
    return `
  <text x="${ML - 10}" y="${ly + 4}" fill="${text}" font-size="10" text-anchor="end" font-family="'SF Mono',monospace" opacity="0.65">${esc(name)}</text>
  <line x1="${ML}" y1="${ly}" x2="${lx - 6}" y2="${ly}" stroke="${viz}" stroke-width="1" opacity="0.5"/>
  <circle cx="${lx}" cy="${ly}" r="5" fill="${viz}"/>
  <text x="${lx + 10}" y="${ly + 4}" fill="${text}" font-size="10" font-weight="700" font-family="'SF Mono',monospace">${esc(sizeLabel)}</text>`;
  }).join('');
  const sub = `<text x="${W / 2}" y="${H - 10}" fill="${text}" font-size="9" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.4">sorted by file size</text>`;
  return { svg: svgWrap(W, H, 'Recent Downloads', lollipops + sub, palette), w: W, h: H };
}

export function buildSecurityAppsChart(data, _profile, persona = 'securite') {
  const palette = chartPalette(persona);
  const slice = extractSecuritySlice(data);
  const W = 600; const H = 240;
  const { text, viz, bg } = palette;

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
  <text x="${cx}" y="58" fill="${text}" font-size="11" text-anchor="middle" font-family="'SF Mono',monospace" opacity="0.55">${esc(label)}</text>
  <circle cx="${cx}" cy="88" r="14" fill="${ok ? viz : 'none'}" opacity="${fillOpacity}"/>
  <circle cx="${cx}" cy="88" r="14" fill="none" stroke="${viz}" stroke-width="2" opacity="${strokeOpacity}"/>
  <text x="${cx}" y="93" fill="${text}" font-size="11" font-weight="bold" text-anchor="middle" font-family="'SF Mono',monospace">${esc(value)}</text>`;
  }).join('');

  const dividers = [1, 2].map(i =>
    `<line x1="${i * colW}" y1="44" x2="${i * colW}" y2="120" stroke="${viz}" stroke-width="1" opacity="0.25"/>`,
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
  <rect x="${ax}" y="${appsY}" width="${tw}" height="24" fill="${viz}" rx="12" opacity="${pillOpacity}"/>
  <rect x="${ax}" y="${appsY}" width="${tw}" height="24" fill="none" stroke="${viz}" stroke-width="1" rx="12"/>
  <text x="${ax + tw / 2}" y="${appsY + 16}" fill="${text}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace">${esc(name)}</text>`;
    ax += tw + 8;
    return pill;
  }).join('');

  const sub = caption(W, H - 6, 'Security posture · macOS system checks', palette);

  return { svg: svgWrap(W, H, 'Security Status', dividers + settingBlocks + appPills + sub, palette), w: W, h: H };
}

export function buildFileHeatmapChart(data, persona = 'productivite') { return null; }
export function buildAppRecencyChart(data, persona = 'productivite') { return null; }

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
