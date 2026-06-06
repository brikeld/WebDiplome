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

export const WIFI_POST_ANGLES = [
  'funny_name',
  'cafe_habit',
  'work_vs_home',
  'travel_footprint',
  'sheer_diversity',
  'security_read',
];

const WIFI_ANGLE_LABELS = {
  funny_name: 'a memorable or absurd network name',
  cafe_habit: 'a café / coffee-shop wifi pattern',
  work_vs_home: 'contrast between work/school and home networks',
  travel_footprint: 'travel, hotels, or guest networks',
  sheer_diversity: 'sheer number of different networks saved',
  security_read: 'public footprint and security vibes',
};

const WIFI_CATEGORY_ORDER = [
  'cafe', 'home', 'office', 'hotel', 'hotspot', 'guest', 'public', 'isp', 'other',
];

const WIFI_CATEGORY_PATTERNS = [
  { key: 'cafe', re: /caf[eé]|coffee|starbucks|blue\s*bottle|espresso|boulanger|brunch/i },
  { key: 'home', re: /home|fibre|fiber|livebox|freebox|bbox|sfr|wanadoo|domicile|box_/i },
  { key: 'office', re: /office|work|corp|ecal|school|university|uni|eduroam|enterprise|staff|student/i },
  { key: 'hotel', re: /hotel|ibis|marriott|hilton|airbnb|lodging|resort|hostel/i },
  { key: 'hotspot', re: /hotspot|iphone|android|tether|personal\s*area|ipad/i },
  { key: 'guest', re: /guest|visitor|invite|gratuit|free[\s_-]?wifi|wifi[\s_-]?free|public[\s_-]?wifi/i },
  { key: 'public', re: /library|biblioth|sncf|train|airport|aeroport|metro|city[\s_-]?wifi|municipal/i },
  { key: 'isp', re: /^(?:upc|ziggo|virgin|comcast|fritz|netgear|linksys|tp-link)\d|fibrebox|livebox|bbox|^\d{6,}$/i },
];

function normalizeWifiName(entry) {
  return String(entry ?? '').trim();
}

export function categorizeWifiNetwork(name) {
  const n = normalizeWifiName(name);
  if (!n) return 'other';
  for (const { key, re } of WIFI_CATEGORY_PATTERNS) {
    if (re.test(n)) return key;
  }
  return 'other';
}

function findWifiClusters(networks) {
  const byPrefix = new Map();
  for (const raw of networks) {
    const name = normalizeWifiName(raw);
    if (name.length < 4) continue;
    const prefix = name.slice(0, 4).toUpperCase();
    if (!/^[A-Z0-9]{3,4}$/.test(prefix)) continue;
    const list = byPrefix.get(prefix) ?? [];
    list.push(name);
    byPrefix.set(prefix, list);
  }
  return [...byPrefix.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([prefix, list]) => ({ prefix, networks: list }))
    .sort((a, b) => b.networks.length - a.networks.length)
    .slice(0, 4);
}

function findNotableWifiNames(networks) {
  const out = [];
  for (const raw of networks) {
    const name = normalizeWifiName(raw);
    if (!name) continue;
    const lower = name.toLowerCase();
    const reasons = [];
    if (name.length >= 22) reasons.push('long name');
    if (/[^\w\s\-'.]/.test(name)) reasons.push('unusual characters');
    if (/pretty\s*fly|fbi|surveillance|cursed|hack|password|dont.?connect|virus|free\s*virus/i.test(name)) {
      reasons.push('joke or warning tone');
    }
    if (/\d{4,}/.test(name) && name.length <= 14) reasons.push('router default vibe');
    if (/guest|gratuit|free/i.test(name) && !reasons.length) reasons.push('open-network hint');
    if (reasons.length) out.push({ name, reason: reasons[0] });
    if (out.length >= 6) break;
  }
  if (out.length < 3) {
    for (const raw of networks) {
      const name = normalizeWifiName(raw);
      if (!name || out.some((e) => e.name === name)) continue;
      if (name.length >= 12) out.push({ name, reason: 'distinctive SSID' });
      if (out.length >= 5) break;
    }
  }
  return out;
}

export function enrichWifiSlice(slice) {
  const networks = (Array.isArray(slice?.networks) ? slice.networks : [])
    .map(normalizeWifiName)
    .filter(Boolean);
  const categories = Object.fromEntries(WIFI_CATEGORY_ORDER.map((k) => [k, []]));
  for (const name of networks) {
    categories[categorizeWifiNetwork(name)].push(name);
  }
  const categoryCounts = Object.fromEntries(
    WIFI_CATEGORY_ORDER.map((k) => [k, categories[k].length]),
  );
  return {
    networks,
    count: networks.length,
    categories,
    categoryCounts,
    notableNames: findNotableWifiNames(networks),
    clusters: findWifiClusters(networks),
  };
}

export function extractWifiSlice(data) {
  const wifi = Array.isArray(data?.PAST_HISTORY?.wifi_history) ? data.PAST_HISTORY.wifi_history : [];
  return enrichWifiSlice({ networks: wifi, count: wifi.length });
}

export function pickWifiPostAngle(recentAngles = [], rng = Math.random) {
  const exclude = new Set(recentAngles.filter(Boolean));
  const available = WIFI_POST_ANGLES.filter((a) => !exclude.has(a));
  const pool = available.length > 0 ? available : WIFI_POST_ANGLES;
  const idx = Math.floor(rng() * pool.length);
  return pool[idx];
}

function wifiSamplesForAngle(enriched, angle) {
  const { categories, notableNames, clusters } = enriched;
  switch (angle) {
    case 'funny_name':
      return notableNames.map((e) => e.name).slice(0, 8);
    case 'cafe_habit':
      return categories.cafe.slice(0, 8);
    case 'work_vs_home':
      return [...categories.office, ...categories.home].slice(0, 8);
    case 'travel_footprint':
      return [...categories.hotel, ...categories.guest, ...categories.public].slice(0, 8);
    case 'security_read':
      return [...categories.guest, ...categories.public, ...categories.hotspot].slice(0, 8);
    case 'sheer_diversity':
    default:
      return enriched.networks.slice(0, 10);
  }
}

function angleContextLines(enriched, angle) {
  const lines = [];
  const { categoryCounts, clusters, notableNames } = enriched;
  const nonZero = WIFI_CATEGORY_ORDER
    .filter((k) => categoryCounts[k] > 0)
    .map((k) => `${k}: ${categoryCounts[k]}`);
  if (nonZero.length) lines.push(`Category mix: ${nonZero.join(', ')}`);
  if (clusters.length) {
    lines.push(`Name clusters: ${clusters.map((c) => `${c.prefix}* (${c.networks.length})`).join(', ')}`);
  }
  if (notableNames.length) {
    lines.push(`Notable SSIDs: ${notableNames.map((e) => e.name).slice(0, 5).join(', ')}`);
  }
  switch (angle) {
    case 'cafe_habit':
      if (categoryCounts.cafe > 0) lines.push(`Café/coffee networks spotted: ${categoryCounts.cafe}`);
      break;
    case 'work_vs_home':
      lines.push(`Work/school: ${categoryCounts.office}, home: ${categoryCounts.home}`);
      break;
    case 'travel_footprint':
      lines.push(`Travel/guest/public combined: ${categoryCounts.hotel + categoryCounts.guest + categoryCounts.public}`);
      break;
    case 'sheer_diversity':
      lines.push(`Total saved networks: ${enriched.count}`);
      break;
    case 'security_read':
      lines.push(`Public/guest/hotspot combined: ${categoryCounts.guest + categoryCounts.public + categoryCounts.hotspot}`);
      break;
    default:
      break;
  }
  return lines;
}

export function formatWifiSliceAsText(slice, options = {}) {
  const enriched = enrichWifiSlice(slice);
  if (!enriched.networks.length) return null;

  const angle = options.angle && WIFI_POST_ANGLES.includes(options.angle) ? options.angle : null;
  if (!angle) {
    return `[WiFi networks — ${enriched.count} known networks]\n${enriched.networks.slice(0, 20).map((n, i) => `  ${i + 1}. ${n}`).join('\n')}`;
  }

  const lines = [
    `[WiFi networks — ${enriched.count} known, angle: ${angle.replace(/_/g, ' ')}]`,
    ...angleContextLines(enriched, angle),
    `Suggested angle for this post: ${WIFI_ANGLE_LABELS[angle]}.`,
    'Sample networks for this angle:',
  ];
  const samples = wifiSamplesForAngle(enriched, angle);
  if (samples.length) {
    samples.forEach((n, i) => lines.push(`  ${i + 1}. ${n}`));
  } else {
    enriched.networks.slice(0, 8).forEach((n, i) => lines.push(`  ${i + 1}. ${n}`));
  }
  return lines.join('\n');
}

export function buildWifiPostContext(slice, angle) {
  const enriched = enrichWifiSlice(slice);
  const resolvedAngle = WIFI_POST_ANGLES.includes(angle) ? angle : 'sheer_diversity';
  return {
    angle: resolvedAngle,
    count: enriched.count,
    categoryCounts: enriched.categoryCounts,
    clusters: enriched.clusters.map((c) => c.prefix),
    samples: wifiSamplesForAngle(enriched, resolvedAngle),
  };
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

export function extractFileHeatmapSlice(data) {
  const files = Array.isArray(data?.PAST_HISTORY?.recent_files_7days)
    ? data.PAST_HISTORY.recent_files_7days : [];
  const counts = new Array(24).fill(0);
  for (const f of files) {
    const d = f.date ? new Date(f.date) : null;
    if (d && !isNaN(d.getTime())) counts[d.getHours()]++;
  }
  return { counts, total: files.length };
}

export function extractAppRecencySlice(data) {
  const apps = Array.isArray(data?.PAST_HISTORY?.app_usage_7days)
    ? data.PAST_HISTORY.app_usage_7days : [];
  const now = Date.now();
  return apps.slice(0, 8).map(({ app, last_used }) => {
    const d = last_used ? new Date(last_used) : null;
    const daysAgo = d && !isNaN(d.getTime())
      ? Math.round((now - d.getTime()) / 86400000) : null;
    return { app, daysAgo };
  });
}
