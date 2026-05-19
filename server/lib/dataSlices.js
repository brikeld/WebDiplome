// ESM mirror of Diplome_/testCreationAcc/python/post_generator/dataSlices.js

const WORK_APPS = new Set([
  'Visual Studio Code','Cursor','Windsurf','Xcode','GitHub Desktop','Figma','Notion',
  'Microsoft Teams','Keynote','Pages','Numbers','Arduino IDE','Godot','Blender',
  'Blender 4.5.3 LTS','WebStorm','PyCharm','IntelliJ IDEA','Sublime Text',
]);
const CREATIVE_APPS = new Set([
  'Adobe Photoshop 2025','Adobe Photoshop','Adobe Illustrator 2025','Adobe Illustrator',
  'Adobe After Effects 2025','Adobe After Effects','Adobe Premiere Pro 2025','Adobe Premiere Pro',
  'Adobe InDesign 2026','Adobe InDesign','Adobe Lightroom CC','Adobe Lightroom',
  'Adobe Media Encoder 2025','Adobe Media Encoder','Adobe Acrobat DC','Adobe Acrobat',
  'DiffusionBee','GoPro Player','HandBrake','ideaMaker','GIMP','Inkscape','Sketch',
]);
const AI_APPS = new Set(['ChatGPT','Claude','Codex','LM Studio','Ollama','DiffusionBee','Perplexity']);
const SOCIAL_APPS = new Set(['Discord','WhatsApp','Microsoft Teams','Slack','Telegram','Skype','Messenger']);
const ENTERTAINMENT_APPS = new Set(['Spotify','VLC','DAZN','Stremio','Epic Games Launcher','Netflix','Plex','Twitch']);
const PIRATE_APPS = new Set(['qbittorrent','uTorrent','Transmission','BitTorrent']);
const SECURITY_APPS = new Set(['NordVPN','GlobalProtect','ProtonVPN','Little Snitch','Mullvad','ExpressVPN','Wireguard']);
const BROWSER_APPS = new Set(['Google Chrome','Safari','Firefox','Brave','Arc','Opera','Microsoft Edge']);

export function categorizeApp(name) {
  const n = String(name || '');
  if (AI_APPS.has(n)) return 'AI Tools';
  if (PIRATE_APPS.has(n)) return 'Torrents';
  if (SECURITY_APPS.has(n)) return 'Security/VPN';
  if (n.startsWith('Adobe') || CREATIVE_APPS.has(n)) return 'Creative Suite';
  if (WORK_APPS.has(n)) return 'Dev & Work';
  if (SOCIAL_APPS.has(n)) return 'Social';
  if (ENTERTAINMENT_APPS.has(n)) return 'Entertainment';
  if (BROWSER_APPS.has(n)) return 'Browsers';
  return 'Other';
}

export function extractBrowserSlice(data) {
  const bh = data?.PAST_HISTORY?.browser_history || {};
  const chrome = Array.isArray(bh.chrome) ? bh.chrome : [];
  const safari = Array.isArray(bh.safari) ? bh.safari : [];
  const all = [...chrome, ...safari];
  const domains = {};
  for (const e of all) {
    try {
      const h = new URL(e.url).hostname.replace(/^www\./, '');
      domains[h] = (domains[h] || 0) + 1;
    } catch { /* skip */ }
  }
  const top = Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const recentTitles = all.slice(0, 6).map(e => e.title).filter(Boolean);
  return { topDomains: top.map(([domain, count]) => ({ domain, count })), recentTitles, totalVisits: all.length };
}

export function extractAppCategorySlice(data) {
  const installed = Array.isArray(data?.MACHINE_IDENTITY?.installed_apps) ? data.MACHINE_IDENTITY.installed_apps : [];
  const counts = {};
  for (const app of installed) {
    const cat = categorizeApp(app);
    counts[cat] = (counts[cat] || 0) + 1;
  }
  const recentlyUsed = (data?.PAST_HISTORY?.app_usage_7days || []).slice(0, 10).map(e => e.app);
  return {
    byCategory: Object.entries(counts).sort((a, b) => b[1] - a[1]),
    recentlyUsed,
    totalInstalled: installed.length,
  };
}

export function extractWifiSlice(data) {
  const wifi = Array.isArray(data?.PAST_HISTORY?.wifi_history) ? data.PAST_HISTORY.wifi_history : [];
  return { networks: wifi, count: wifi.length };
}

export function extractDownloadsSlice(data) {
  const raw = Array.isArray(data?.PAST_HISTORY?.recent_downloads) ? data.PAST_HISTORY.recent_downloads : [];
  const items = raw.filter(d => {
    const n = String(d.name || '').toLowerCase();
    return !n.startsWith('.') && n !== 'ds_store';
  });
  return { items: items.slice(0, 10) };
}

export function formatBrowserSliceAsText(slice) {
  if (!slice.topDomains.length) return null;
  const lines = [`[Browser history — ${slice.totalVisits} visits]`];
  for (const { domain, count } of slice.topDomains) {
    lines.push(`  ${domain}: ${count}x`);
  }
  if (slice.recentTitles.length) {
    lines.push(`Recent tab titles: ${slice.recentTitles.slice(0, 4).join(' | ')}`);
  }
  return lines.join('\n');
}

export function formatWifiSliceAsText(slice) {
  if (!slice.networks.length) return null;
  return `[WiFi networks — ${slice.count} known networks]\n${slice.networks.slice(0, 20).map((n, i) => `  ${i + 1}. ${n}`).join('\n')}`;
}

export function formatDownloadsAsText(slice) {
  if (!slice.items.length) return null;
  return `[Recent downloads]\n${slice.items.map(d => {
    const mb = d.size_kb ? ` (${Math.round(d.size_kb / 102.4) / 10} MB)` : '';
    return `  ${d.name}${mb}`;
  }).join('\n')}`;
}

export function formatAppCategoryAsText(slice) {
  if (!slice.byCategory.length) return null;
  const lines = [`[Installed apps — ${slice.totalInstalled} total, by category]`];
  for (const [cat, count] of slice.byCategory.slice(0, 8)) {
    lines.push(`  ${cat}: ${count}`);
  }
  if (slice.recentlyUsed.length) {
    lines.push(`Recently used: ${slice.recentlyUsed.slice(0, 6).join(', ')}`);
  }
  return lines.join('\n');
}

export function extractMostUsedAppsSlice(data) {
  const apps = Array.isArray(data?.PAST_HISTORY?.app_usage_7days)
    ? data.PAST_HISTORY.app_usage_7days
    : [];
  return { apps: apps.slice(0, 15), count: apps.length };
}

export function formatAppUsageAsText(slice) {
  if (!slice.apps.length) return null;
  const lines = [`[Recently used apps — ${slice.count} tracked over 7 days]`];
  for (const { app, last_used } of slice.apps.slice(0, 12)) {
    lines.push(`  ${app}${last_used ? ` (last: ${String(last_used).slice(0, 10)})` : ''}`);
  }
  return lines.join('\n');
}

export function extractStorageSlice(data) {
  const s = data?.MACHINE_IDENTITY?.storage || {};
  return {
    total: s.total || '',
    used: s.used || '',
    free: s.free || '',
    usePct: parseFloat(s.use_percent) || 0,
  };
}

export function extractBatterySlice(data) {
  const b = data?.MACHINE_IDENTITY?.battery || {};
  return {
    percent: parseFloat(b.percent) || 0,
    cycleCount: b.cycle_count ?? null,
    condition: b.condition || '',
    maxCapacity: b.max_capacity || '',
    charging: b.charging ?? false,
  };
}

export function extractSecuritySlice(data) {
  const sec = data?.MACHINE_IDENTITY?.security || {};
  const installed = Array.isArray(data?.MACHINE_IDENTITY?.installed_apps)
    ? data.MACHINE_IDENTITY.installed_apps
    : [];
  const KNOWN_SECURITY = [
    'NordVPN', 'GlobalProtect', 'ProtonVPN', 'Little Snitch', 'Mullvad',
    'ExpressVPN', 'Wireguard', 'NordPass', '1Password', 'Bitwarden', 'Keybase',
  ];
  const foundSecurity = KNOWN_SECURITY.filter(tool =>
    installed.some(a => a.toLowerCase().includes(tool.toLowerCase())),
  );
  return {
    sip: sec.sip || 'Unknown',
    filevault: sec.filevault || 'Unknown',
    gatekeeper: sec.gatekeeper || 'Unknown',
    securityApps: foundSecurity,
  };
}

export function extractAIToolsSlice(data) {
  const installed = Array.isArray(data?.MACHINE_IDENTITY?.installed_apps)
    ? data.MACHINE_IDENTITY.installed_apps
    : [];
  const usage = Array.isArray(data?.PAST_HISTORY?.app_usage_7days)
    ? data.PAST_HISTORY.app_usage_7days
    : [];
  const usedRecentlySet = new Set(usage.map(e => e.app));
  const KNOWN_AI = [
    'ChatGPT', 'Claude', 'Codex', 'LM Studio', 'Ollama',
    'DiffusionBee', 'Perplexity', 'Cursor', 'Windsurf', 'GitHub Copilot',
  ];
  const tools = KNOWN_AI.map(tool => ({
    name: tool,
    installed: installed.some(a => a.toLowerCase().includes(tool.toLowerCase())),
    recentlyUsed: usedRecentlySet.has(tool),
  }));
  return { tools, installedCount: tools.filter(t => t.installed).length };
}
