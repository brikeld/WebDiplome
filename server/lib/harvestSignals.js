/**
 * Extract REAL "Data used" signals straight from the harvested data.json, so the
 * Tell-Me-More "Data used" panel and the chain "data" step cite concrete evidence
 * (actual apps, files, Wi‑Fi, sites) even when the LLM didn't return its own
 * ingredient breakdown. This is what makes the analysis feel like the algorithm
 * actually looked at YOU rather than reciting a template.
 */
import { compactHarvestDataForLm } from './compactHarvestData.js';

function basename(p) {
  const s = String(p || '').trim();
  if (!s) return '';
  const parts = s.split(/[\\/]/).filter(Boolean);
  return (parts[parts.length - 1] || s).trim();
}

function domainOf(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s.includes('://') ? s : `https://${s}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].trim();
  }
}

/** Pull the first readable string from an item that might be a string or object. */
function pickStr(item, keys) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'number') return String(item);
  if (typeof item === 'object') {
    for (const k of keys) {
      const v = item[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    }
  }
  return '';
}

/** Map an array to up to `n` de-duped, non-empty readable values. */
function take(arr, n, mapFn) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    const v = String(mapFn(item) || '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

/**
 * All candidate "Data used" categories that actually have values, each with real
 * data points. Returned in a stable, human-friendly order.
 * @returns {{ label: string, dataPoints: string[] }[]}
 */
export function extractHarvestSignals(dataJson) {
  const compact = compactHarvestDataForLm(dataJson);
  const id = compact.MACHINE_IDENTITY ?? {};
  const hist = compact.PAST_HISTORY ?? {};
  const browserEntries = Object.values(hist.browser_history ?? {}).flat();

  const cats = [];
  const push = (label, points) => {
    const pts = (points || []).filter(Boolean).slice(0, 8);
    if (pts.length) cats.push({ label, dataPoints: pts });
  };

  push('Apps you actually use', take(hist.app_usage_7days, 6, (i) => pickStr(i, ['app', 'app_name', 'name', 'bundle_id'])));
  push('Recent files', take(hist.recent_files_7days, 6, (i) => basename(pickStr(i, ['name', 'filename', 'path', 'file']))));
  push('Where you connect', take(hist.wifi_history, 6, (i) => pickStr(i, ['ssid', 'name', 'network'])));
  push('Sites you visited', take(browserEntries, 6, (i) => domainOf(pickStr(i, ['url', 'domain', 'title']))));
  push('Recent downloads', take(hist.recent_downloads, 5, (i) => basename(pickStr(i, ['name', 'filename', 'path']))));
  push('Apps you installed', take(id.installed_apps, 8, (i) => pickStr(i, ['name', 'app_name'])));
  push('Apps in your dock', take(id.dock_apps, 8, (i) => pickStr(i, ['name', 'app_name'])));

  return cats;
}

const PERSONA_PRIORITY = {
  productivite: ['Apps you actually use', 'Recent files', 'Recent downloads', 'Apps you installed', 'Apps in your dock'],
  securite: ['Where you connect', 'Sites you visited', 'Apps you installed', 'Apps in your dock', 'Recent downloads'],
  popularite: ['Sites you visited', 'Apps you actually use', 'Where you connect', 'Recent files', 'Apps in your dock'],
};

function personaKey(persona) {
  const k = String(persona || '').toLowerCase();
  if (k.startsWith('sec')) return 'securite';
  if (k.startsWith('pop') || k === 'social') return 'popularite';
  return 'productivite';
}

/**
 * Up to 3 real "Data used" ingredients, ordered by what matters most for this
 * persona. Returns null when the harvest carries no usable signals.
 */
export function buildSignalIngredients(dataJson, persona) {
  const cats = extractHarvestSignals(dataJson);
  if (!cats.length) return null;

  const order = PERSONA_PRIORITY[personaKey(persona)] || [];
  const rank = (label) => {
    const i = order.indexOf(label);
    return i === -1 ? 99 : i;
  };
  const top = [...cats].sort((a, b) => rank(a.label) - rank(b.label)).slice(0, 3);
  if (!top.length) return null;

  const weights = [86, 64, 44];
  return top.map((c, i) => ({
    label: c.label,
    weight: weights[i] ?? 40,
    dataPoints: c.dataPoints,
  }));
}

/** A real chain "data" step that names the strongest signal and a few examples. */
export function buildSignalDataStep(dataJson, persona) {
  const ingredients = buildSignalIngredients(dataJson, persona);
  if (!ingredients?.length) return null;
  const top = ingredients[0];
  const sample = top.dataPoints.slice(0, 3).join(', ');
  return {
    step: 'data',
    value: `The loudest thing your Mac handed over was your ${top.label.toLowerCase()} — stuff like ${sample}. That's the raw material this whole post got built from.`,
    source: top.label,
  };
}
