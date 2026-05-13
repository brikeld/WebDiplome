// Mirror of Diplome_/testCreationAcc/python/post_generator/chartGenerator.js (ESM).

import { extractAppCategorySlice, extractWifiSlice } from './dataSlices.js';

const BG = '#0d0d1a';
const TEXT_MAIN = '#e2e8f0';
const TEXT_MUTED = '#7c85a2';
const BAR_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#a78bfa', '#34d399'];

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

export function buildAppCategoryChart(appCategorySlice) {
  let items = (appCategorySlice?.byCategory || []).slice(0, 7);
  if (!items.length) items = [['No category data', 1]];

  const W = 600;
  const H = 280;
  const ML = 120;
  const MR = 55;
  const MT = 44;
  const MB = 18;
  const CW = W - ML - MR;
  const CH = H - MT - MB;
  const N = items.length;
  const slotH = CH / N;
  const barH = Math.max(12, slotH - 8);
  const maxVal = items[0][1];

  const bars = items
    .map(([cat, count], i) => {
      const bw = Math.round((count / maxVal) * CW);
      const y = MT + i * slotH + (slotH - barH) / 2;
      const color = BAR_COLORS[i % BAR_COLORS.length];
      return `
    <rect x="${ML}" y="${y}" width="${bw}" height="${barH}" fill="${color}" rx="2"/>
    <text x="${ML - 7}" y="${y + barH / 2 + 4}" fill="${TEXT_MUTED}" font-size="11" text-anchor="end" font-family="'SF Mono',monospace">${esc(cat)}</text>
    <text x="${ML + bw + 6}" y="${y + barH / 2 + 4}" fill="${TEXT_MAIN}" font-size="11" font-family="'SF Mono',monospace">${count}</text>`;
    })
    .join('');

  const label = `${appCategorySlice.totalInstalled || ''} apps installed`;
  const sub = `<text x="${W / 2}" y="${H - 4}" fill="${TEXT_MUTED}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace">${esc(label)}</text>`;

  return svgWrap(W, H, 'App Categories', bars + sub);
}

export function buildFileExtChart(recentFilesSlice) {
  const items = (recentFilesSlice || []).slice(0, 7);
  if (!items.length) return null;

  const W = 600;
  const H = 260;
  const ML = 60;
  const MR = 55;
  const MT = 44;
  const MB = 18;
  const CW = W - ML - MR;
  const CH = H - MT - MB;
  const N = items.length;
  const slotH = CH / N;
  const barH = Math.max(12, slotH - 8);
  const maxVal = items[0][1];

  const bars = items
    .map(([ext, count], i) => {
      const bw = Math.round((count / maxVal) * CW);
      const y = MT + i * slotH + (slotH - barH) / 2;
      const color = BAR_COLORS[i % BAR_COLORS.length];
      return `
    <rect x="${ML}" y="${y}" width="${bw}" height="${barH}" fill="${color}" rx="2"/>
    <text x="${ML - 7}" y="${y + barH / 2 + 4}" fill="${TEXT_MUTED}" font-size="11" text-anchor="end" font-family="'SF Mono',monospace">${esc(ext || '(none)')}</text>
    <text x="${ML + bw + 6}" y="${y + barH / 2 + 4}" fill="${TEXT_MAIN}" font-size="11" font-family="'SF Mono',monospace">${count}</text>`;
    })
    .join('');

  return svgWrap(W, H, 'Recent File Types (7 days)', bars);
}

export function buildWifiTimelineChart(wifiSlice) {
  const networks = (wifiSlice?.networks || []).slice(0, 20);
  if (!networks.length) return null;

  const W = 600;
  const H = 300;
  const colW = W / 2;
  const itemH = 22;
  const MT = 44;

  const items = networks
    .map((name, i) => {
      const col = i < 10 ? 0 : 1;
      const row = i % 10;
      const x = col * colW + 24;
      const y = MT + row * itemH + 14;
      const color = BAR_COLORS[i % BAR_COLORS.length];
      return `
    <circle cx="${x}" cy="${y - 4}" r="4" fill="${color}"/>
    <text x="${x + 11}" y="${y}" fill="${TEXT_MAIN}" font-size="11" font-family="'SF Mono',monospace">${esc(name)}</text>`;
    })
    .join('');

  const sub = `<text x="${W / 2}" y="${H - 6}" fill="${TEXT_MUTED}" font-size="10" text-anchor="middle" font-family="'SF Mono',monospace">${networks.length} networks · most recent first</text>`;
  return svgWrap(W, H, 'WiFi Network History', items + sub);
}

export function buildFileExtSlice(data) {
  const files = Array.isArray(data?.PAST_HISTORY?.recent_files_7days) ? data.PAST_HISTORY.recent_files_7days : [];
  const counts = {};
  for (const f of files) {
    if (f.path && f.path.includes('node_modules')) continue;
    const ext = f.ext || '(none)';
    counts[ext] = (counts[ext] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
}

export function resolveChartRasterSpec(data) {
  const appSlice = extractAppCategorySlice(data || {});
  if (appSlice.byCategory && appSlice.byCategory.length > 0) {
    return { svg: buildAppCategoryChart(appSlice), w: 600, h: 280 };
  }
  const fileExt = buildFileExtSlice(data || {});
  if (fileExt.length > 0) {
    const svg = buildFileExtChart(fileExt);
    if (svg) return { svg, w: 600, h: 260 };
  }
  const wifiSlice = extractWifiSlice(data || {});
  if (wifiSlice.networks && wifiSlice.networks.length > 0) {
    const svg = buildWifiTimelineChart(wifiSlice);
    if (svg) return { svg, w: 600, h: 300 };
  }
  return { svg: buildAppCategoryChart(appSlice), w: 600, h: 280 };
}
