/**
 * Rank harvest signals by true timestamps so demo posts
 * prefer the freshest real data, not stale "most recent in a weak list" items.
 */

/** @param {unknown} value */
export function parseHarvestTimestamp(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  const s = String(value).trim();
  if (!s) return null;
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

/** Higher = fresher. Half-life ~36h for cross-slice comparison. */
export function freshnessWeight(ageMs, halfLifeMs = 36 * 3600000) {
  const age = Math.max(0, Number(ageMs) || 0);
  return 1000 * Math.exp(-age / halfLifeMs);
}

function maxTimestamp(values) {
  let best = null;
  for (const v of values) {
    const ms = parseHarvestTimestamp(v);
    if (ms != null && (best == null || ms > best)) best = ms;
  }
  return best;
}

function browserEntries(dataJson) {
  const bh = dataJson?.PAST_HISTORY?.browser_history || {};
  return [
    ...(Array.isArray(bh.chrome) ? bh.chrome : []),
    ...(Array.isArray(bh.safari) ? bh.safari : []),
  ];
}

/**
 * @param {string} sliceId
 * @param {object|null|undefined} dataJson
 * @returns {{ freshestMs: number, ageMs: number, hook: string|null }}
 */
export function scoreTextSliceFreshness(sliceId, dataJson) {
  const now = Date.now();
  const collectedMs = parseHarvestTimestamp(dataJson?.collected_at) ?? now;
  let freshestMs = collectedMs;
  let hook = null;

  switch (sliceId) {
    case 'browser': {
      const entries = browserEntries(dataJson);
      const best = maxTimestamp(entries.map((e) => e?.visited ?? e?.date));
      if (best != null) {
        freshestMs = best;
        const latest = [...entries].sort((a, b) => {
          const ta = parseHarvestTimestamp(a?.visited ?? a?.date) ?? 0;
          const tb = parseHarvestTimestamp(b?.visited ?? b?.date) ?? 0;
          return tb - ta;
        })[0];
        if (latest) {
          try {
            const host = new URL(latest.url).hostname.replace(/^www\./, '');
            hook = `${host}${latest.title ? ` — “${String(latest.title).slice(0, 40)}”` : ''}`;
          } catch {
            hook = String(latest.title || latest.url || '').slice(0, 60);
          }
        }
      }
      break;
    }
    case 'downloads': {
      const items = Array.isArray(dataJson?.PAST_HISTORY?.recent_downloads)
        ? dataJson.PAST_HISTORY.recent_downloads
        : [];
      const best = maxTimestamp(items.map((d) => d?.modified ?? d?.date));
      if (best != null) {
        freshestMs = best;
        const latest = [...items].sort((a, b) => {
          const ta = parseHarvestTimestamp(a?.modified ?? a?.date) ?? 0;
          const tb = parseHarvestTimestamp(b?.modified ?? b?.date) ?? 0;
          return tb - ta;
        })[0];
        hook = latest?.name ? String(latest.name) : null;
      }
      break;
    }
    case 'app_usage': {
      const apps = Array.isArray(dataJson?.PAST_HISTORY?.app_usage_7days)
        ? dataJson.PAST_HISTORY.app_usage_7days
        : [];
      const best = maxTimestamp(apps.map((a) => a?.last_used));
      if (best != null) {
        freshestMs = best;
        const latest = [...apps].sort((a, b) => {
          const ta = parseHarvestTimestamp(a?.last_used) ?? 0;
          const tb = parseHarvestTimestamp(b?.last_used) ?? 0;
          return tb - ta;
        })[0];
        hook = latest?.app ? String(latest.app) : null;
      }
      break;
    }
    case 'recent_files': {
      const files = Array.isArray(dataJson?.PAST_HISTORY?.recent_files_7days)
        ? dataJson.PAST_HISTORY.recent_files_7days
        : [];
      const best = maxTimestamp(files.map((f) => f?.modified ?? f?.date));
      if (best != null) {
        freshestMs = best;
        const latest = [...files].sort((a, b) => {
          const ta = parseHarvestTimestamp(a?.modified ?? a?.date) ?? 0;
          const tb = parseHarvestTimestamp(b?.modified ?? b?.date) ?? 0;
          return tb - ta;
        })[0];
        hook = latest?.name ? String(latest.name) : null;
      }
      break;
    }
    case 'app_stack': {
      const apps = Array.isArray(dataJson?.PAST_HISTORY?.app_usage_7days)
        ? dataJson.PAST_HISTORY.app_usage_7days
        : [];
      const best = maxTimestamp(apps.map((a) => a?.last_used));
      if (best != null) {
        freshestMs = best;
        hook = 'installed app mix vs recent opens';
      }
      break;
    }
    case 'ai_tools': {
      const apps = Array.isArray(dataJson?.PAST_HISTORY?.app_usage_7days)
        ? dataJson.PAST_HISTORY.app_usage_7days
        : [];
      const AI = /chatgpt|claude|codex|lm studio|ollama|cursor|windsurf|copilot|perplexity/i;
      const aiApps = apps.filter((a) => AI.test(String(a?.app || '')));
      const best = maxTimestamp(aiApps.map((a) => a?.last_used));
      if (best != null) {
        freshestMs = best;
        hook = aiApps[0]?.app ? String(aiApps[0].app) : 'AI tools';
      }
      break;
    }
    case 'wifi':
    case 'security_posture':
    default:
      freshestMs = collectedMs;
      hook = sliceId === 'wifi' ? 'saved Wi‑Fi networks' : 'machine security posture';
      break;
  }

  return {
    freshestMs,
    ageMs: Math.max(0, now - freshestMs),
    hook,
  };
}

const CHART_FRESHNESS_SLICE = {
  browser_domains: 'browser',
  recent_downloads: 'downloads',
  most_used_apps: 'app_usage',
  app_recency: 'app_usage',
  file_extensions: 'recent_files',
  app_categories: 'app_stack',
  wifi_history: 'wifi',
  security_apps: 'security_posture',
  ai_tool_exposure: 'ai_tools',
};

/** @param {string} chartId @param {object|null|undefined} dataJson */
export function scoreChartFreshness(chartId, dataJson) {
  const sliceId = CHART_FRESHNESS_SLICE[chartId] ?? 'security_posture';
  return scoreTextSliceFreshness(sliceId, dataJson);
}

export function formatRecencyLead({ freshestMs, hook }) {
  if (!freshestMs) return '';
  const when = new Date(freshestMs).toISOString().slice(0, 16).replace('T', ' ');
  const detail = hook ? ` — ${hook}` : '';
  return `[Priority: focus this post on the freshest signal (${when}${detail}). Ignore older items unless they sharpen the joke.]`;
}
