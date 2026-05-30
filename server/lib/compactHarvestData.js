/**
 * Shrink harvested data.json before sending to LM Studio.
 * Full harvest JSON can exceed local context (e.g. n_ctx=4096); charts/slices
 * only need MACHINE_IDENTITY + trimmed PAST_HISTORY.
 */

const IDENTITY_KEYS = [
  'user_identity',
  'hostname',
  'model',
  'model_name',
  'machine_model',
  'macos_version',
  'ui_theme',
  'languages',
  'locale',
  'storage',
  'hardware_snapshot',
  'ram',
  'chip',
  'security',
];

function capArray(value, max) {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

function trimBrowserEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  return {
    url: entry.url ?? '',
    title: String(entry.title ?? '').slice(0, 100),
  };
}

function compactMachineIdentity(raw = {}) {
  const out = {};
  for (const key of IDENTITY_KEYS) {
    if (raw[key] !== undefined && raw[key] !== null) out[key] = raw[key];
  }
  out.installed_apps = capArray(raw.installed_apps, 25);
  out.dock_apps = capArray(raw.dock_apps, 12);
  return out;
}

function compactPastHistory(raw = {}) {
  const browser = raw.browser_history && typeof raw.browser_history === 'object'
    ? raw.browser_history
    : {};
  const browserOut = {};
  for (const [engine, entries] of Object.entries(browser)) {
    browserOut[engine] = capArray(entries, 5).map(trimBrowserEntry);
  }

  return {
    app_usage_7days: capArray(raw.app_usage_7days, 10),
    wifi_history: capArray(raw.wifi_history, 8),
    recent_files_7days: capArray(raw.recent_files_7days, 8),
    recent_downloads: capArray(raw.recent_downloads, 5),
    finder_recent_activity: capArray(raw.finder_recent_activity, 5),
    browser_history: browserOut,
  };
}

/** @param {object|null|undefined} dataJson */
export function compactHarvestDataForLm(dataJson) {
  if (!dataJson || typeof dataJson !== 'object') return {};
  return {
    collected_at: dataJson.collected_at ?? null,
    MACHINE_IDENTITY: compactMachineIdentity(dataJson.MACHINE_IDENTITY ?? {}),
    PAST_HISTORY: compactPastHistory(dataJson.PAST_HISTORY ?? {}),
  };
}

/** JSON user message payload for chat/completions ({ user, profile }). */
export function buildLmUserPayload(user, dataJson) {
  const compact = compactHarvestDataForLm(dataJson);
  const u = user && typeof user === 'object'
    ? {
        first_name: user.first_name ?? user.firstName ?? '',
        last_name: user.last_name ?? user.lastName ?? '',
      }
    : {};
  return JSON.stringify({ user: u, profile: compact });
}
