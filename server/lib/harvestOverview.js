/**
 * Compact, display-safe overview of everything the collector harvested.
 * Built server-side from raw_profile (flat sync fields + lastHarvestDataJson)
 * and attached to API profiles as `harvestOverview` so the web UI can show
 * environment/security/network data without shipping the raw harvest JSON.
 *
 * Privacy contract: only counts, names, domains and extensions — never URLs,
 * page titles, shell commands or file paths.
 */

const WIFI_CAP = 10;
const DOCK_CAP = 8;
const APP_USAGE_CAP = 8;
const DOMAIN_CAP = 6;
const EXTENSION_CAP = 8;

function text(value) {
  const s = String(value ?? '').trim();
  return s || null;
}

function num(value) {
  if (value == null || value === '') return null;
  const m = String(value).match(/-?[\d.]+/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function prune(section) {
  if (!section || typeof section !== 'object') return null;
  const entries = Object.entries(section).filter(([, v]) => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function harvestJsonFromRaw(raw) {
  const data = raw?.lastHarvestDataJson ?? raw?.dataJson ?? raw?.data_json ?? null;
  return data && typeof data === 'object' ? data : {};
}

function domainFromUrl(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

function topBrowserDomains(browserHistory) {
  const counts = new Map();
  let total = 0;
  for (const entries of Object.values(browserHistory ?? {})) {
    for (const entry of arr(entries)) {
      const domain = domainFromUrl(entry?.url);
      if (!domain) continue;
      total += 1;
      counts.set(domain, (counts.get(domain) ?? 0) + 1);
    }
  }
  if (total === 0) return null;
  const topDomains = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, DOMAIN_CAP)
    .map(([domain, count]) => ({ domain, count }));
  return { topDomains, totalVisits: total };
}

function topFileExtensions(extensionCounts) {
  if (!extensionCounts || typeof extensionCounts !== 'object') return null;
  const extensions = Object.entries(extensionCounts)
    .map(([ext, count]) => ({ ext: String(ext).replace(/^\./, ''), count: num(count) ?? 0 }))
    .filter((e) => e.ext && e.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, EXTENSION_CAP);
  return extensions.length > 0 ? { extensions } : null;
}

function displaysFromIdentity(identity) {
  const displays = arr(identity?.peripherals?.displays)
    .map((d) => prune({ name: text(d?.name), resolution: text(d?.resolution) }))
    .filter(Boolean);
  return displays.length > 0 ? displays : null;
}

function wifiNames(wifiHistory) {
  return arr(wifiHistory)
    .map((entry) => text(typeof entry === 'object' ? entry?.ssid : entry))
    .filter(Boolean);
}

/** @param {object|null|undefined} raw raw_profile row contents */
export function buildHarvestOverview(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const data = harvestJsonFromRaw(raw);
  const identity = data.MACHINE_IDENTITY ?? {};
  const history = data.PAST_HISTORY ?? {};
  const scoring = data.SCORING_DATA ?? {};

  const machine = prune({
    name: text(identity.hostname ?? raw.machineName ?? raw.machine_name),
    model: text(identity.model ?? identity.machine_model ?? raw.machineModel ?? raw.machine_model),
    chip: text(raw.hardwareChip ?? raw.hardware_chip ?? identity.chip),
    ram: text(identity.hardware_snapshot?.total_ram ?? identity.ram ?? raw.ram),
    osVersion: text(identity.macos_version ?? raw.osVersion ?? raw.os_version),
    appearance: text(identity.ui_theme ?? raw.appearance),
    screenResolution: text(identity.screen_resolution ?? raw.screenResolution ?? raw.screen_resolution),
    locale: text(identity.locale ?? raw.locale),
    languages: arr(identity.languages ?? raw.systemLanguages ?? raw.system_languages)
      .map(text)
      .filter(Boolean),
  });

  const storageRaw = identity.storage ?? {};
  const storage = prune({
    totalGb: num(storageRaw.total ?? raw.storageTotal ?? raw.storage_total),
    usedGb: num(storageRaw.used ?? raw.storageUsed ?? raw.storage_used),
    freeGb: num(storageRaw.free),
    usePercent: num(storageRaw.use_percent) ?? (() => {
      const used = num(raw.storageUsed ?? raw.storage_used);
      const total = num(raw.storageTotal ?? raw.storage_total);
      return used != null && total > 0 ? Math.round((used / total) * 1000) / 10 : null;
    })(),
    smartStatus: text(storageRaw.smart_status),
  });

  const batteryRaw = identity.battery ?? {};
  const battery = prune({
    percent: num(batteryRaw.percent),
    charging: typeof batteryRaw.charging === 'boolean' ? batteryRaw.charging : null,
    powerSource: text(batteryRaw.source),
    cycles: num(batteryRaw.cycle_count ?? raw.batteryCycles ?? raw.battery_cycles),
    condition: text(batteryRaw.condition),
    healthPercent: num(batteryRaw.max_capacity),
  });

  const memory = prune({
    pressureLevel: text(identity.memory_pressure?.pressure_level),
    swapUsed: text(identity.memory_pressure?.swap_used),
  });

  const securityRaw = identity.security ?? {};
  const security = prune({
    sip: text(securityRaw.sip),
    filevault: text(securityRaw.filevault),
    gatekeeper: text(securityRaw.gatekeeper),
  });

  const installedApps = arr(identity.installed_apps);
  const apps = prune({
    mostUsed: arr(raw.mostUsedApps ?? raw.most_used_apps).map(text).filter(Boolean),
    dock: arr(identity.dock_apps).map(text).filter(Boolean).slice(0, DOCK_CAP),
    installedCount:
      num(raw.applications ?? raw.apps_count) ?? (installedApps.length > 0 ? installedApps.length : null),
  });

  const wifi = wifiNames(history.wifi_history);
  const network = prune({
    wifiNetworks: wifi.slice(0, WIFI_CAP),
    wifiCount: wifi.length > 0 ? wifi.length : null,
  });

  const appUsage = arr(history.app_usage_7days)
    .map((entry) => prune({ app: text(entry?.app), lastUsed: text(entry?.last_used) }))
    .filter(Boolean)
    .slice(0, APP_USAGE_CAP);
  const usage = prune({
    appUsage7d: appUsage,
    recentFilesCount: arr(history.recent_files_7days).length || null,
    downloadsCount: arr(history.recent_downloads).length || null,
    uptimeDays: num(raw.uptimeDays ?? raw.uptime_days),
  });

  const browser = topBrowserDomains(history.browser_history);
  const files = topFileExtensions(
    scoring.axe_comportement_productif?.file_creation_patterns?.extension_counts,
  );

  const errorSummary = scoring.axe_sante_numerique?.error_log_summary ?? {};
  const diagnostics = prune({
    crashCount7d:
      num(errorSummary.crash_count_7days) ?? (arr(identity.recent_crashes).length || null),
    errorCount24h: num(errorSummary.error_count_24h),
  });

  const overview = {
    machine,
    displays: displaysFromIdentity(identity),
    storage,
    battery,
    memory,
    security,
    apps,
    network,
    usage,
    browser,
    files,
    diagnostics,
  };

  return Object.values(overview).some((section) => section != null) ? overview : null;
}
