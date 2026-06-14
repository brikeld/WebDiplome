// ESM mirror of Diplome_/testCreationAcc/python/post_generator/dataSlices.js

import { parseHarvestTimestamp } from './recencyRanking.js';

const WORK_APPS = new Set([
  'Visual Studio Code', 'Cursor', 'Windsurf', 'Xcode', 'GitHub Desktop', 'Figma', 'Notion',
  'Microsoft Teams', 'Microsoft Word', 'Microsoft Excel', 'Microsoft PowerPoint', 'Microsoft Outlook',
  'Microsoft OneNote', 'Microsoft To Do', 'Microsoft Remote Desktop', 'OneDrive',
  'Keynote', 'Pages', 'Numbers', 'Arduino IDE', 'Godot', 'Blender', 'Blender 4.5.3 LTS',
  'WebStorm', 'PyCharm', 'IntelliJ IDEA', 'Sublime Text', 'Nova', 'BBEdit', 'Coda',
  'Docker', 'Docker Desktop', 'Postman', 'Insomnia', 'TablePlus', 'DBeaver', 'MongoDB Compass',
  'Linear', 'Jira', 'Confluence', 'Obsidian', 'Bear', 'Evernote', 'Todoist', 'Things',
  'Zoom', 'Webex', 'Google Drive', 'Google Docs', 'Google Sheets', 'Google Slides',
  'Slack', 'Trello', 'Asana', 'Monday.com', 'Airtable', 'Miro', 'Excalidraw',
  'Unity', 'Unreal Engine', 'Android Studio', 'DataGrip', 'Rider', 'Fleet',
  'iTerm', 'iTerm2', 'Warp', 'Hyper', 'Kitty', 'Alacritty',
]);
const CREATIVE_APPS = new Set([
  'Adobe Photoshop 2025', 'Adobe Photoshop', 'Adobe Illustrator 2025', 'Adobe Illustrator',
  'Adobe After Effects 2025', 'Adobe After Effects', 'Adobe Premiere Pro 2025', 'Adobe Premiere Pro',
  'Adobe InDesign 2026', 'Adobe InDesign', 'Adobe Lightroom CC', 'Adobe Lightroom',
  'Adobe Media Encoder 2025', 'Adobe Media Encoder', 'Adobe Acrobat DC', 'Adobe Acrobat',
  'DiffusionBee', 'GoPro Player', 'HandBrake', 'ideaMaker', 'GIMP', 'Inkscape', 'Sketch',
  'Final Cut Pro', 'Logic Pro', 'Motion', 'Compressor', 'DaVinci Resolve', 'CapCut',
  'Autodesk Fusion', 'Autodesk Maya', 'Autodesk AutoCAD', 'Cinema 4D', 'Houdini',
  'Affinity Photo', 'Affinity Designer', 'Affinity Publisher', 'Procreate', 'Canva',
]);
const AI_APPS = new Set([
  'ChatGPT', 'Claude', 'Codex', 'LM Studio', 'Ollama', 'DiffusionBee', 'Perplexity',
  'Copilot', 'Gemini', 'Poe', 'Jan', 'GPT4All', 'AnythingLLM', 'Open WebUI',
]);
const SOCIAL_APPS = new Set([
  'Discord', 'WhatsApp', 'Microsoft Teams', 'Slack', 'Telegram', 'Skype', 'Messenger',
  'Signal', 'Viber', 'Snapchat', 'Instagram', 'Facebook', 'X', 'Threads', 'LinkedIn',
  'BeReal', 'WeChat', 'Line', 'iMessage', 'Messages',
]);
const ENTERTAINMENT_APPS = new Set([
  'Spotify', 'VLC', 'DAZN', 'Stremio', 'Epic Games Launcher', 'Netflix', 'Plex', 'Twitch',
  'Steam', 'Battle.net', 'GOG Galaxy', 'Origin', 'Ubisoft Connect', 'PlayStation',
  'Apple TV', 'Disney+', 'YouTube', 'SoundCloud', 'Tidal', 'Deezer', 'IINA', 'MPV',
]);
const PIRATE_APPS = new Set(['qbittorrent', 'uTorrent', 'Transmission', 'BitTorrent', 'Deluge', 'Vuze']);
const SECURITY_APPS = new Set([
  'NordVPN', 'GlobalProtect', 'ProtonVPN', 'Little Snitch', 'Mullvad', 'ExpressVPN', 'Wireguard',
  '1Password', 'Bitwarden', 'LastPass', 'Dashlane', 'KeePassXC', 'Malwarebytes', 'CleanMyMac X',
]);
const BROWSER_APPS = new Set([
  'Google Chrome', 'Chrome', 'Safari', 'Firefox', 'Brave', 'Arc', 'Opera', 'Microsoft Edge',
  'Vivaldi', 'Tor Browser', 'Orion', 'SigmaOS', 'Zen Browser', 'Chrome Apps.localized',
]);
const UTILITIES_APPS = new Set([
  'AltTab', 'AppCleaner', 'BetterDisplay', 'Rectangle', 'LinearMouse', 'OmniDiskSweeper',
  'The Unarchiver', 'LocalSend', 'LetsView', 'boringNotch', 'logioptionsplus', 'WattsConnected',
  'TrackWeight', 'Android File Transfer', 'Alfred', 'Raycast', 'Bartender', 'Magnet', 'Hazel',
  'CleanMyMac', 'DaisyDisk', 'GrandPerspective', 'iStat Menus', 'Stats', 'MonitorControl',
  'Amphetamine', 'KeepingYouAwake', 'Caffeine', 'Flux', 'f.lux',
  'Dropover', 'Yoink', 'Paste', 'Maccy', 'Flycut', 'Itsycal', 'Calendar 366',
]);
const SYSTEM_APPS = new Set([
  'Utilities', 'System Settings', 'System Preferences', 'Activity Monitor', 'Console',
  'Disk Utility', 'Terminal', 'Finder', 'Mail', 'Calendar', 'Contacts', 'Maps', 'Photos',
  'Music', 'Podcasts', 'News', 'Stocks', 'Weather', 'Reminders', 'Notes', 'FaceTime',
  'Preview', 'TextEdit', 'Font Book', 'Screenshot', 'Photo Booth', 'QuickTime Player',
  'Time Machine', 'Migration Assistant', 'Boot Camp Assistant', 'AirPort Utility',
  'Bluetooth File Exchange', 'ColorSync Utility', 'Digital Color Meter', 'Grapher',
  'Keychain Access', 'Script Editor', 'Stickies', 'Voice Memos', 'Chess', 'Dictionary',
  'Image Capture', 'Archive Utility', 'Automator', 'Books', 'Home', 'Shortcuts',
  'iPhone Mirroring', 'TV', 'Freeform', 'Journal', 'Tips', 'App Store',
]);
const IT_ADMIN_APPS = new Set([
  'FileWave', 'Kiosk ECAL', 'Jamf Connect', 'Jamf Self Service', 'Mosyle', 'Kandji',
  'Intune Company Portal', 'Cisco AnyConnect', 'Citrix Workspace', 'VMware Horizon Client',
]);

function isCreativeVendor(name) {
  return name.startsWith('Adobe')
    || name.startsWith('Autodesk')
    || name.startsWith('Maxon')
    || name.startsWith('Affinity ');
}

function isWorkVendor(name) {
  return name.startsWith('Microsoft ')
    && !name.includes('Edge')
    && !name.includes('Teams');
}

function isSystemArtifact(name) {
  return name.startsWith('Remove ')
    || name.endsWith(' URL Handler')
    || name.endsWith(' Service Utility');
}

function isLikelyDevApp(name) {
  const lower = name.toLowerCase();
  return lower.includes('console')
    || lower.includes('debug')
    || lower.endsWith(' test')
    || lower === 'test';
}

export function categorizeApp(name) {
  const n = String(name || '').trim();
  if (!n) return 'Other';

  const lower = n.toLowerCase();

  if (AI_APPS.has(n) || lower.startsWith('claude ') || lower.startsWith('openai ')) return 'AI Tools';
  if (PIRATE_APPS.has(lower) || PIRATE_APPS.has(n)) return 'Torrents';
  if (SECURITY_APPS.has(n)) return 'Security/VPN';
  if (BROWSER_APPS.has(n) || lower === 'chrome' || lower.startsWith('google chrome')) return 'Browsers';
  if (SYSTEM_APPS.has(n) || isSystemArtifact(n) || n.startsWith('Apple ')) return 'System';
  if (isCreativeVendor(n) || CREATIVE_APPS.has(n)) return 'Creative Suite';
  if (WORK_APPS.has(n) || isWorkVendor(n) || isLikelyDevApp(n)) return 'Dev & Work';
  if (SOCIAL_APPS.has(n)) return 'Social';
  if (ENTERTAINMENT_APPS.has(n)) return 'Entertainment';
  if (UTILITIES_APPS.has(n)) return 'Utilities';
  if (IT_ADMIN_APPS.has(n)) return 'IT & Admin';

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
  const latestVisits = [...all].sort((a, b) => {
    const ta = parseHarvestTimestamp(a?.visited ?? a?.date) ?? 0;
    const tb = parseHarvestTimestamp(b?.visited ?? b?.date) ?? 0;
    return tb - ta;
  }).slice(0, 6);
  const recentTitles = latestVisits.map((e) => e.title).filter(Boolean);
  return {
    topDomains: top.map(([domain, count]) => ({ domain, count })),
    recentTitles,
    latestVisits,
    totalVisits: all.length,
  };
}

/** Merge installed, dock, and recent-usage app names for category charts. */
export function collectAppNamesForCategorySlice(data) {
  const names = new Set();
  const identity = data?.MACHINE_IDENTITY ?? {};
  const past = data?.PAST_HISTORY ?? {};

  for (const app of identity.installed_apps ?? []) {
    const n = String(app ?? '').trim();
    if (n) names.add(n);
  }
  for (const app of identity.dock_apps ?? []) {
    const n = String(app ?? '').trim();
    if (n) names.add(n);
  }
  for (const entry of past.app_usage_7days ?? []) {
    const n = String(entry?.app ?? entry?.name ?? '').trim();
    if (n) names.add(n);
  }

  return [...names];
}

export function extractAppCategorySlice(data) {
  const installed = collectAppNamesForCategorySlice(data);
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

/** Pick a post angle, avoiding recent repeats when possible. */
export function pickPostAngle(angles, recentAngles = [], rng = Math.random) {
  if (!angles.length) return null;
  const exclude = new Set(recentAngles.filter(Boolean));
  const available = angles.filter((a) => !exclude.has(a));
  const pool = available.length > 0 ? available : angles;
  return pool[Math.floor(rng() * pool.length)];
}

export function pickWifiPostAngle(recentAngles = [], rng = Math.random) {
  return pickPostAngle(WIFI_POST_ANGLES, recentAngles, rng);
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
  }).sort((a, b) => {
    const ta = parseHarvestTimestamp(a?.modified ?? a?.date) ?? 0;
    const tb = parseHarvestTimestamp(b?.modified ?? b?.date) ?? 0;
    return tb - ta;
  });
  return { items: items.slice(0, 10) };
}

export const BROWSER_POST_ANGLES = ['top_domain', 'tab_titles', 'repeat_visitor', 'niche_sites'];

const BROWSER_ANGLE_LABELS = {
  top_domain: 'your most visited site',
  tab_titles: 'recent tab title vibes',
  repeat_visitor: 'a site you keep reopening',
  niche_sites: 'one-off or niche domains',
};

export function pickBrowserPostAngle(recentAngles = [], rng = Math.random) {
  return pickPostAngle(BROWSER_POST_ANGLES, recentAngles, rng);
}

function enrichBrowserSlice(slice) {
  const topDomains = slice.topDomains || [];
  const nicheSites = topDomains.filter(({ count }) => count === 1).map(({ domain }) => domain);
  return {
    ...slice,
    topDomain: topDomains[0] ?? null,
    nicheSites: nicheSites.slice(0, 8),
    latestVisits: slice.latestVisits || [],
  };
}

export function buildBrowserPostContext(slice, angle) {
  const enriched = enrichBrowserSlice(slice);
  const resolvedAngle = BROWSER_POST_ANGLES.includes(angle) ? angle : 'top_domain';
  const samples = resolvedAngle === 'tab_titles'
    ? enriched.recentTitles.slice(0, 4)
    : resolvedAngle === 'niche_sites'
      ? enriched.nicheSites.slice(0, 4)
      : enriched.topDomains.slice(0, 4).map(({ domain }) => domain);
  return {
    angle: resolvedAngle,
    totalVisits: enriched.totalVisits,
    samples,
  };
}

export function formatBrowserSliceAsText(slice, options = {}) {
  const enriched = enrichBrowserSlice(slice);
  if (!enriched.topDomains.length) return null;

  const angle = options.angle && BROWSER_POST_ANGLES.includes(options.angle) ? options.angle : null;
  if (!angle) {
    const lines = [`[Browser history — ${enriched.totalVisits} visits]`];
    for (const { domain, count } of enriched.topDomains) {
      lines.push(`  ${domain}: ${count}x`);
    }
    if (enriched.recentTitles.length) {
      lines.push(`Recent tab titles: ${enriched.recentTitles.slice(0, 4).join(' | ')}`);
    }
    return lines.join('\n');
  }

  const ctx = buildBrowserPostContext(enriched, angle);
  const lines = [
    `[Browser history — ${enriched.totalVisits} visits, angle: ${angle.replace(/_/g, ' ')}]`,
    `Suggested angle for this post: ${BROWSER_ANGLE_LABELS[angle]}.`,
  ];
  if (enriched.topDomain) {
    lines.push(`Top domain: ${enriched.topDomain.domain} (${enriched.topDomain.count}x)`);
  }
  if (enriched.recentTitles.length) {
    lines.push(`Recent tab titles: ${enriched.recentTitles.slice(0, 4).join(' | ')}`);
  }
  if (enriched.latestVisits.length) {
    lines.push('Latest visits (newest first):');
    for (const v of enriched.latestVisits.slice(0, 4)) {
      const when = v.visited || v.date || '';
      const label = v.title || v.url || '';
      lines.push(`  ${when} — ${String(label).slice(0, 72)}`);
    }
  }
  if (ctx.samples.length) {
    lines.push('Sample hooks for this angle:');
    ctx.samples.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
  }
  return lines.join('\n');
}

export const DOWNLOADS_POST_ANGLES = ['embarrassing_name', 'size_shock', 'random_mix'];

const DOWNLOADS_ANGLE_LABELS = {
  embarrassing_name: 'a funny or revealing filename',
  size_shock: 'a surprisingly large download',
  random_mix: 'the eclectic mix of what you grabbed',
};

export function pickDownloadsPostAngle(recentAngles = [], rng = Math.random) {
  return pickPostAngle(DOWNLOADS_POST_ANGLES, recentAngles, rng);
}

function enrichDownloadsSlice(slice) {
  const items = (slice.items || []).map((d) => {
    const name = String(d.name || '');
    const sizeKb = Number(d.size_kb) || 0;
    return { ...d, name, sizeKb, sizeMb: sizeKb ? Math.round(sizeKb / 102.4) / 10 : 0 };
  });
  const largest = [...items].sort((a, b) => b.sizeKb - a.sizeKb)[0] ?? null;
  const funny = items.filter((d) => /install|setup|crack|temp|copy|final|draft|old/i.test(d.name));
  return { items, largest, funnyNames: funny.slice(0, 5) };
}

export function buildDownloadsPostContext(slice, angle) {
  const enriched = enrichDownloadsSlice(slice);
  const resolvedAngle = DOWNLOADS_POST_ANGLES.includes(angle) ? angle : 'random_mix';
  let samples = enriched.items.slice(0, 4).map((d) => d.name);
  if (resolvedAngle === 'size_shock' && enriched.largest) samples = [enriched.largest.name];
  if (resolvedAngle === 'embarrassing_name' && enriched.funnyNames.length) {
    samples = enriched.funnyNames.map((d) => d.name);
  }
  return { angle: resolvedAngle, count: enriched.items.length, samples };
}

export function formatDownloadsAsText(slice, options = {}) {
  const enriched = enrichDownloadsSlice(slice);
  if (!enriched.items.length) return null;

  const angle = options.angle && DOWNLOADS_POST_ANGLES.includes(options.angle) ? options.angle : null;
  if (!angle) {
    return `[Recent downloads]\n${enriched.items.map((d) => {
      const mb = d.sizeKb ? ` (${d.sizeMb} MB)` : '';
      return `  ${d.name}${mb}`;
    }).join('\n')}`;
  }

  const ctx = buildDownloadsPostContext(enriched, angle);
  const lines = [
    `[Recent downloads — ${enriched.items.length} files, angle: ${angle.replace(/_/g, ' ')}]`,
    `Suggested angle for this post: ${DOWNLOADS_ANGLE_LABELS[angle]}.`,
  ];
  if (enriched.largest?.sizeMb) {
    lines.push(`Largest: ${enriched.largest.name} (${enriched.largest.sizeMb} MB)`);
  }
  lines.push('Sample downloads for this angle:');
  ctx.samples.forEach((name, i) => {
    const item = enriched.items.find((d) => d.name === name);
    const mb = item?.sizeMb ? ` (${item.sizeMb} MB)` : '';
    lines.push(`  ${i + 1}. ${name}${mb}`);
  });
  return lines.join('\n');
}

export function formatAppCategoryAsText(slice) {
  return formatAppStackAsText(slice);
}

export const APP_STACK_ANGLES = ['category_dominance', 'tool_hoarder', 'recent_vs_installed', 'creative_stack'];

const APP_STACK_ANGLE_LABELS = {
  category_dominance: 'one app category dominating the machine',
  tool_hoarder: 'sheer number of installed tools',
  recent_vs_installed: 'what you installed vs what you actually open',
  creative_stack: 'creative-suite footprint',
};

export function pickAppStackPostAngle(recentAngles = [], rng = Math.random) {
  return pickPostAngle(APP_STACK_ANGLES, recentAngles, rng);
}

export function buildAppStackPostContext(slice, angle) {
  const resolvedAngle = APP_STACK_ANGLES.includes(angle) ? angle : 'category_dominance';
  const topCat = slice.byCategory[0]?.[0] ?? null;
  const creativeCount = slice.byCategory.find(([cat]) => cat === 'Creative Suite')?.[1] ?? 0;
  return {
    angle: resolvedAngle,
    totalInstalled: slice.totalInstalled,
    topCategory: topCat,
    recentlyUsed: slice.recentlyUsed.slice(0, 5),
    creativeCount,
  };
}

export function formatAppStackAsText(slice, options = {}) {
  if (!slice.byCategory.length) return null;
  const angle = options.angle && APP_STACK_ANGLES.includes(options.angle) ? options.angle : null;
  if (!angle) return formatAppCategoryAsTextLegacy(slice);

  const ctx = buildAppStackPostContext(slice, angle);
  const lines = [
    `[Installed apps — ${slice.totalInstalled} total, angle: ${angle.replace(/_/g, ' ')}]`,
    `Suggested angle for this post: ${APP_STACK_ANGLE_LABELS[angle]}.`,
  ];
  for (const [cat, count] of slice.byCategory.slice(0, 6)) {
    lines.push(`  ${cat}: ${count}`);
  }
  if (slice.recentlyUsed.length) {
    lines.push(`Recently used: ${slice.recentlyUsed.slice(0, 6).join(', ')}`);
  }
  if (ctx.topCategory) lines.push(`Dominant category: ${ctx.topCategory}`);
  return lines.join('\n');
}

function formatAppCategoryAsTextLegacy(slice) {
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
  const sorted = [...apps].sort((a, b) => {
    const ta = parseHarvestTimestamp(a?.last_used) ?? 0;
    const tb = parseHarvestTimestamp(b?.last_used) ?? 0;
    return tb - ta;
  });
  return { apps: sorted.slice(0, 15), count: apps.length };
}

export const APP_USAGE_ANGLES = ['latest_habit', 'work_stack', 'creative_tools', 'always_open'];

const APP_USAGE_ANGLE_LABELS = {
  latest_habit: 'the app you touched most recently',
  work_stack: 'dev/work tools in rotation',
  creative_tools: 'creative apps in the mix',
  always_open: 'apps that keep showing up all week',
};

export function pickAppUsagePostAngle(recentAngles = [], rng = Math.random) {
  return pickPostAngle(APP_USAGE_ANGLES, recentAngles, rng);
}

function enrichAppUsageSlice(slice) {
  const apps = (slice.apps || []).map(({ app, last_used }) => ({
    app: String(app || ''),
    last_used: last_used || null,
    category: categorizeApp(app),
  }));
  const workApps = apps.filter((a) => a.category === 'Dev & Work' || a.category === 'AI Tools');
  const creativeApps = apps.filter((a) => a.category === 'Creative Suite');
  const sorted = [...apps].sort((a, b) => {
    const ta = a.last_used ? new Date(a.last_used).getTime() : 0;
    const tb = b.last_used ? new Date(b.last_used).getTime() : 0;
    return tb - ta;
  });
  return { ...slice, apps, latest: sorted[0] ?? null, workApps, creativeApps };
}

export function buildAppUsagePostContext(slice, angle) {
  const enriched = enrichAppUsageSlice(slice);
  const resolvedAngle = APP_USAGE_ANGLES.includes(angle) ? angle : 'latest_habit';
  let samples = enriched.apps.slice(0, 4).map((a) => a.app);
  if (resolvedAngle === 'work_stack') samples = enriched.workApps.slice(0, 4).map((a) => a.app);
  if (resolvedAngle === 'creative_tools') samples = enriched.creativeApps.slice(0, 4).map((a) => a.app);
  if (resolvedAngle === 'latest_habit' && enriched.latest) samples = [enriched.latest.app];
  return { angle: resolvedAngle, count: enriched.count, samples };
}

export function formatAppUsageAsText(slice, options = {}) {
  const enriched = enrichAppUsageSlice(slice);
  if (!enriched.apps.length) return null;

  const angle = options.angle && APP_USAGE_ANGLES.includes(options.angle) ? options.angle : null;
  if (!angle) {
    const lines = [`[Recently used apps — ${enriched.count} tracked over 7 days]`];
    for (const { app, last_used } of enriched.apps.slice(0, 12)) {
      lines.push(`  ${app}${last_used ? ` (last: ${String(last_used).slice(0, 10)})` : ''}`);
    }
    return lines.join('\n');
  }

  const ctx = buildAppUsagePostContext(enriched, angle);
  const lines = [
    `[Recently used apps — ${enriched.count} tracked, angle: ${angle.replace(/_/g, ' ')}]`,
    `Suggested angle for this post: ${APP_USAGE_ANGLE_LABELS[angle]}.`,
  ];
  if (enriched.latest) {
    lines.push(`Most recent: ${enriched.latest.app}${enriched.latest.last_used ? ` (${String(enriched.latest.last_used).slice(0, 10)})` : ''}`);
  }
  lines.push('Sample apps for this angle:');
  ctx.samples.forEach((name, i) => lines.push(`  ${i + 1}. ${name}`));
  return lines.join('\n');
}

export const RECENT_FILES_ANGLES = ['late_night', 'file_types', 'project_paths', 'sheer_volume'];

const RECENT_FILES_ANGLE_LABELS = {
  late_night: 'files touched late at night',
  file_types: 'what file types you keep creating',
  project_paths: 'project folders showing up in recent files',
  sheer_volume: 'sheer volume of recent file activity',
};

export function extractRecentFilesSlice(data) {
  const raw = Array.isArray(data?.PAST_HISTORY?.recent_files_7days)
    ? data.PAST_HISTORY.recent_files_7days
    : [];
  const items = raw.map((f) => {
    const name = String(f.name || '').trim() || String(f.path || '').split('/').pop() || '';
    const modified = f.modified || f.date || '';
    const ext = String(f.ext || (name.includes('.') ? `.${name.split('.').pop()}` : '')).toLowerCase();
    const folder = String(f.path || '').split('/').slice(-2, -1)[0] || '';
    let lateNight = false;
    const d = modified ? new Date(String(modified).replace(' ', 'T')) : null;
    if (d && !isNaN(d.getTime())) {
      const h = d.getHours();
      lateNight = h >= 22 || h <= 4;
    }
    return { name, ext, modified, folder, lateNight };
  }).filter((f) => f.name && !f.name.startsWith('.'))
    .sort((a, b) => {
      const ta = parseHarvestTimestamp(a.modified) ?? 0;
      const tb = parseHarvestTimestamp(b.modified) ?? 0;
      return tb - ta;
    });
  const extCounts = {};
  const folders = {};
  let lateNightCount = 0;
  for (const f of items) {
    const e = f.ext || '(none)';
    extCounts[e] = (extCounts[e] || 0) + 1;
    if (f.folder) folders[f.folder] = (folders[f.folder] || 0) + 1;
    if (f.lateNight) lateNightCount++;
  }
  const topExts = Object.entries(extCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topFolders = Object.entries(folders).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
  return {
    items: items.slice(0, 20),
    count: items.length,
    extCounts,
    topExts,
    topFolders,
    lateNightCount,
    lateNightFiles: items.filter((f) => f.lateNight).slice(0, 8),
  };
}

export function pickRecentFilesPostAngle(recentAngles = [], rng = Math.random) {
  return pickPostAngle(RECENT_FILES_ANGLES, recentAngles, rng);
}

export function buildRecentFilesPostContext(slice, angle) {
  const resolvedAngle = RECENT_FILES_ANGLES.includes(angle) ? angle : 'sheer_volume';
  let samples = slice.items.slice(0, 4).map((f) => f.name);
  if (resolvedAngle === 'late_night') samples = slice.lateNightFiles.map((f) => f.name).slice(0, 4);
  if (resolvedAngle === 'project_paths') samples = slice.topFolders.slice(0, 4);
  if (resolvedAngle === 'file_types') samples = slice.topExts.map(([ext, n]) => `${ext} (${n})`).slice(0, 4);
  return { angle: resolvedAngle, count: slice.count, samples, lateNightCount: slice.lateNightCount };
}

export function formatRecentFilesAsText(slice, options = {}) {
  if (!slice.items.length) return null;
  const angle = options.angle && RECENT_FILES_ANGLES.includes(options.angle) ? options.angle : null;
  if (!angle) {
    return `[Recent files — ${slice.count} in last 7 days]\n${slice.items.slice(0, 10).map((f, i) => `  ${i + 1}. ${f.name}${f.ext ? ` (${f.ext})` : ''}`).join('\n')}`;
  }
  const ctx = buildRecentFilesPostContext(slice, angle);
  const lines = [
    `[Recent files — ${slice.count} in last 7 days, angle: ${angle.replace(/_/g, ' ')}]`,
    `Suggested angle for this post: ${RECENT_FILES_ANGLE_LABELS[angle]}.`,
  ];
  if (slice.lateNightCount) lines.push(`Late-night touches: ${slice.lateNightCount}`);
  if (slice.topExts.length) {
    lines.push(`Top types: ${slice.topExts.map(([ext, n]) => `${ext} ${n}`).join(', ')}`);
  }
  lines.push('Sample hooks for this angle:');
  ctx.samples.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
  return lines.join('\n');
}

export const SECURITY_POST_ANGLES = ['lockdown', 'vpn_toolkit', 'honest_anxiety'];

const SECURITY_ANGLE_LABELS = {
  lockdown: 'macOS lockdown settings (SIP, FileVault, Gatekeeper)',
  vpn_toolkit: 'VPN/security apps installed',
  honest_anxiety: 'your honest security posture — relieved or slightly worried',
};

export function pickSecurityPostAngle(recentAngles = [], rng = Math.random) {
  return pickPostAngle(SECURITY_POST_ANGLES, recentAngles, rng);
}

export function buildSecurityPostContext(slice, angle) {
  const resolvedAngle = SECURITY_POST_ANGLES.includes(angle) ? angle : 'honest_anxiety';
  const samples = resolvedAngle === 'vpn_toolkit'
    ? slice.securityApps.slice(0, 4)
    : [slice.sip, slice.filevault, slice.gatekeeper].filter(Boolean);
  return { angle: resolvedAngle, samples, securityApps: slice.securityApps };
}

export function formatSecuritySliceAsText(slice, options = {}) {
  const angle = options.angle && SECURITY_POST_ANGLES.includes(options.angle) ? options.angle : null;
  if (!angle) {
    const lines = [`[Security posture — SIP ${slice.sip}, FileVault ${slice.filevault}, Gatekeeper ${slice.gatekeeper}]`];
    if (slice.securityApps.length) lines.push(`Security/VPN apps: ${slice.securityApps.join(', ')}`);
    return lines.join('\n');
  }
  const lines = [
    `[Security posture, angle: ${angle.replace(/_/g, ' ')}]`,
    `SIP: ${slice.sip}, FileVault: ${slice.filevault}, Gatekeeper: ${slice.gatekeeper}`,
    `Suggested angle for this post: ${SECURITY_ANGLE_LABELS[angle]}.`,
  ];
  if (slice.securityApps.length) lines.push(`Security/VPN apps: ${slice.securityApps.join(', ')}`);
  return lines.join('\n');
}

export const AI_TOOLS_ANGLES = ['installed_stack', 'recently_used', 'stack_creep'];

const AI_TOOLS_ANGLE_LABELS = {
  installed_stack: 'AI tools sitting on the machine',
  recently_used: 'AI apps you actually opened lately',
  stack_creep: 'how many AI assistants you have installed',
};

export function pickAiToolsPostAngle(recentAngles = [], rng = Math.random) {
  return pickPostAngle(AI_TOOLS_ANGLES, recentAngles, rng);
}

export function buildAiToolsPostContext(slice, angle) {
  const resolvedAngle = AI_TOOLS_ANGLES.includes(angle) ? angle : 'installed_stack';
  const installed = slice.tools.filter((t) => t.installed);
  const recent = slice.tools.filter((t) => t.recentlyUsed);
  let samples = installed.slice(0, 4).map((t) => t.name);
  if (resolvedAngle === 'recently_used') samples = recent.slice(0, 4).map((t) => t.name);
  if (resolvedAngle === 'stack_creep') samples = installed.map((t) => t.name).slice(0, 6);
  return { angle: resolvedAngle, installedCount: slice.installedCount, samples };
}

export function formatAIToolsAsText(slice, options = {}) {
  if (!slice.tools.some((t) => t.installed || t.recentlyUsed)) return null;
  const angle = options.angle && AI_TOOLS_ANGLES.includes(options.angle) ? options.angle : null;
  if (!angle) {
    const lines = [`[AI tools — ${slice.installedCount} installed on this machine]`];
    for (const t of slice.tools.filter((x) => x.installed || x.recentlyUsed).slice(0, 8)) {
      lines.push(`  ${t.name}${t.recentlyUsed ? ' (used this week)' : ''}`);
    }
    return lines.join('\n');
  }
  const ctx = buildAiToolsPostContext(slice, angle);
  const lines = [
    `[AI tools — ${slice.installedCount} installed, angle: ${angle.replace(/_/g, ' ')}]`,
    `Suggested angle for this post: ${AI_TOOLS_ANGLE_LABELS[angle]}.`,
  ];
  for (const t of slice.tools.filter((x) => x.installed).slice(0, 6)) {
    lines.push(`  ${t.name}${t.recentlyUsed ? ' (used this week)' : ''}`);
  }
  if (ctx.samples.length) {
    lines.push('Sample hooks for this angle:');
    ctx.samples.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
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
