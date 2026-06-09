/**
 * Leaderboard scoring + selection.
 *
 * Pure module. No I/O. All randomness is seeded from inputs so generation
 * is reproducible within a 10-minute "drift bucket".
 */

import { avatarSrcFromProfile } from '../../src/lib/profileUtils.js';
import { seededFloat } from '../../src/lib/seededRandom.js';
import { categorizeWifiNetwork } from './dataSlices.js';

/** Diverse clone identities — no avatarSrc so they never show a photo. */
export const CLONE_IDENTITIES = Object.freeze([
  { displayName: 'M. Laurent',  handle: '@m_laurent',  avatarInitials: 'ML' },
  { displayName: 'S. Park',     handle: '@s_park',     avatarInitials: 'SP' },
  { displayName: 'R. Chen',     handle: '@r_chen',     avatarInitials: 'RC' },
  { displayName: 'T. Müller',   handle: '@t_muller',   avatarInitials: 'TM' },
]);

/** @deprecated use CLONE_IDENTITIES[i] instead */
export const FAKE_CLONE_IDENTITY = CLONE_IDENTITIES[0];

export const FAKE_CLONE_COUNT = 4;

/** Clones re-roll their scores every 10 minutes; keeps the demo lively. */
export const CLONE_DRIFT_BUCKET_MS = 10 * 60 * 1000;

/**
 * Time-decay weight in [-1, 1].
 *   1 at peakHour, -1 twelve hours away, 0 six hours away.
 *   cos((nowHour - peakHour) * π / 12)
 */
export function decay(nowHour, peakHour) {
  const delta = (Number(nowHour) - Number(peakHour)) * (Math.PI / 12);
  return Math.cos(delta);
}

/**
 * Deterministic clone score for a given board.
 * Range tuned so clones land near the user's realistic-score range; can occasionally outrank.
 */
export function scoreCloneFor(boardId, cloneIdx, nowMs) {
  const bucket = Math.floor(nowMs / CLONE_DRIFT_BUCKET_MS);
  const f = seededFloat(`${boardId}|${cloneIdx}|${bucket}`);
  // Centered around 40 with ±35 swing; gives a 5..75 envelope shared across boards.
  return Math.round((f * 70 - 35 + 40) * 100) / 100;
}

/**
 * Deterministic "which clones have hidden their position" mask for a board.
 * Stable across reloads — uses the same seededFloat primitive as scoreCloneFor,
 * but does NOT include the drift bucket (hidden state shouldn't change every 10 min).
 */
export function cloneHiddenForBoard(boardId) {
  const mask = new Array(FAKE_CLONE_COUNT);
  for (let i = 0; i < FAKE_CLONE_COUNT; i++) {
    mask[i] = seededFloat(`hidden|${boardId}|${i}`) > 0.75;
  }
  return mask;
}

// ─── Standing assembly ────────────────────────────────────────────────────

function realUserIdentity(profile) {
  const first = String(profile?.firstname ?? '').trim();
  const last = String(profile?.lastname ?? '').trim();
  const machineName = String(profile?.machineName ?? profile?.machine_name ?? '').trim();
  const displayName = (first && last) ? `${first} ${last}` : (first || last || 'User');
  const handle = machineName ? `@${machineName}` : '@—';
  const initials = (first.charAt(0) + last.charAt(0)).toUpperCase() || (first.charAt(0).toUpperCase()) || '?';
  return {
    displayName,
    handle,
    avatarSrc: avatarSrcFromProfile(profile),
    avatarInitials: initials,
  };
}

/**
 * @returns {{ entries: Array<{ rank, name, handle, avatarSrc, avatarInitials, score, isUser }>,
 *             userRank: number,
 *             hint: string }}
 */
export function computeBoardStanding(board, dataJson, profile, nowMs) {
  const userIdent = realUserIdentity(profile);
  const userResult = board.scoreFn(dataJson, profile, nowMs);

  const rows = [];

  rows.push({
    name: userIdent.displayName,
    handle: userIdent.handle,
    avatarSrc: userIdent.avatarSrc,
    avatarInitials: userIdent.avatarInitials,
    score: Number(userResult.score) || 0,
    isUser: true,
  });

  for (let i = 0; i < FAKE_CLONE_COUNT; i++) {
    const ident = CLONE_IDENTITIES[i % CLONE_IDENTITIES.length];
    rows.push({
      name: ident.displayName,
      handle: ident.handle,
      avatarInitials: ident.avatarInitials,
      score: scoreCloneFor(board.id, i, nowMs),
      isUser: false,
    });
  }

  // Stable sort by score desc; preserves insertion order on ties so user beats clones at parity.
  rows.sort((a, b) => b.score - a.score);

  const entries = rows.map((r, i) => ({ rank: i + 1, ...r }));
  const userRank = entries.find((e) => e.isUser)?.rank ?? null;

  return { entries, userRank, hint: userResult.hint };
}

export function computeAllBoardStandings(dataJson, profile, nowMs = Date.now()) {
  return BOARDS.map((board) => {
    const standing = computeBoardStanding(board, dataJson, profile, nowMs);
    return {
      boardId: board.id,
      title: board.title,
      persona: board.persona,
      peakHour: board.peakHour,
      entries: standing.entries,
      userRank: standing.userRank,
      hint: standing.hint,
    };
  });
}

// ─── App categories used by scoring (mirrors dataSlices.js sets) ───────────

const WORK_APPS = new Set([
  'Visual Studio Code','Cursor','Windsurf','Xcode','GitHub Desktop','Figma','Notion',
  'Microsoft Teams','Keynote','Pages','Numbers','Arduino IDE','Godot','Blender',
  'Blender 4.5.3 LTS','WebStorm','PyCharm','IntelliJ IDEA','Sublime Text',
]);
const CREATIVE_APPS_PREFIX = 'Adobe';
const CREATIVE_APPS = new Set([
  'Blender','Blender 4.5.3 LTS','DiffusionBee','GoPro Player','HandBrake',
  'ideaMaker','GIMP','Inkscape','Sketch','Figma',
]);
const ENTERTAINMENT_APPS = new Set([
  'Spotify','VLC','DAZN','Stremio','Epic Games Launcher','Netflix','Plex','Twitch',
]);
const SOCIAL_APPS = new Set([
  'Discord','WhatsApp','Microsoft Teams','Slack','Telegram','Skype','Messenger','Signal',
]);
const COMMS_APPS = new Set([...SOCIAL_APPS, 'Mail']);
const VPN_APPS = new Set([
  'NordVPN','GlobalProtect','ProtonVPN','Little Snitch','Mullvad','ExpressVPN','Wireguard',
]);
const TORRENT_APPS = new Set([
  'qBittorrent','qbittorrent','uTorrent','Transmission','BitTorrent',
]);
const HEALTH_APPS = new Set([
  'Health','Strava','Apple Fitness','Sleep Cycle','MyFitnessPal','Headspace','Calm',
]);
const AI_APPS = new Set([
  'ChatGPT','Claude','Codex','LM Studio','Ollama','DiffusionBee','Perplexity',
  'Cursor','Windsurf','GitHub Copilot',
]);
const CLOUD_SYNC_APPS = new Set([
  'Dropbox','Google Drive','OneDrive','iCloud Drive','Box','Sync','Mega',
]);

function isCreative(app) {
  if (CREATIVE_APPS.has(app)) return true;
  return typeof app === 'string' && app.startsWith(CREATIVE_APPS_PREFIX);
}

function countInUsage(usage, predicate) {
  return usage.filter((u) => predicate(u?.app)).length;
}

function safeUsage(data) {
  return Array.isArray(data?.PAST_HISTORY?.app_usage_7days)
    ? data.PAST_HISTORY.app_usage_7days
    : [];
}

function safeInstalled(data) {
  return Array.isArray(data?.MACHINE_IDENTITY?.installed_apps)
    ? data.MACHINE_IDENTITY.installed_apps
    : [];
}

function safeFiles(data) {
  return Array.isArray(data?.PAST_HISTORY?.recent_files_7days)
    ? data.PAST_HISTORY.recent_files_7days
    : [];
}

function safeWifi(data) {
  return Array.isArray(data?.PAST_HISTORY?.wifi_history)
    ? data.PAST_HISTORY.wifi_history
    : [];
}

function safeBrowserUrls(data) {
  // Chrome + Safari only — add Firefox/Edge if the collector ever emits them.
  const bh = data?.PAST_HISTORY?.browser_history || {};
  const all = [
    ...(Array.isArray(bh.chrome) ? bh.chrome : []),
    ...(Array.isArray(bh.safari) ? bh.safari : []),
  ];
  return all.map((e) => String(e?.url ?? '')).filter(Boolean);
}

function lateNightFileCount(data) {
  const files = safeFiles(data);
  let n = 0;
  for (const f of files) {
    const d = f?.date ? new Date(f.date) : null;
    if (!d || isNaN(d.getTime())) continue;
    const h = d.getUTCHours();
    if (h >= 22 || h <= 4) n++;
  }
  return n;
}

function hourOf(nowMs) {
  return new Date(nowMs).getUTCHours();
}

function safeDownloads(data) {
  return Array.isArray(data?.PAST_HISTORY?.recent_downloads)
    ? data.PAST_HISTORY.recent_downloads
    : [];
}

function safeSecurity(data) {
  return data?.MACHINE_IDENTITY?.security || {};
}

function safeStorage(data) {
  return data?.MACHINE_IDENTITY?.storage || {};
}

function safeBattery(data) {
  return data?.MACHINE_IDENTITY?.battery || {};
}

function safeHardware(data) {
  return data?.MACHINE_IDENTITY?.hardware_snapshot || {};
}

function hardwareFromProfile(profile, data) {
  return {
    chip: String(profile?.hardwareChip ?? profile?.hardware_chip ?? safeHardware(data).chip ?? ''),
    ram: String(profile?.ram ?? safeHardware(data).ram ?? ''),
  };
}

function parseRamGb(profile, data) {
  const m = String(hardwareFromProfile(profile, data).ram).match(/(\d+)/);
  return m ? Number(m[1]) : 8;
}

/** Higher = more expensive kit on paper. */
function hardwareTierScore(profile, data) {
  const chip = hardwareFromProfile(profile, data).chip.toLowerCase();
  let tier = 10;
  if (/ultra|m3\s*max|m2\s*max|m1\s*max/i.test(chip)) tier += 45;
  else if (/m3\s*pro|m2\s*pro|m1\s*pro/i.test(chip)) tier += 32;
  else if (/m3|m2|m1/i.test(chip)) tier += 22;
  else if (/i9|i7/i.test(chip)) tier += 18;
  tier += Math.min(parseRamGb(profile, data), 128) * 0.6;
  return Math.round(tier * 10) / 10;
}

function countAiUsage(usage) {
  return countInUsage(usage, (a) => AI_APPS.has(a) || /copilot|ollama|chatgpt|claude/i.test(String(a)));
}

function systemWarningCount(data) {
  const sec = safeSecurity(data);
  const storage = safeStorage(data);
  const battery = safeBattery(data);
  let n = 0;
  const fv = String(sec.filevault ?? '').toLowerCase();
  const sip = String(sec.sip ?? '').toLowerCase();
  const gk = String(sec.gatekeeper ?? '').toLowerCase();
  if (fv.includes('off') || fv === 'disabled') n++;
  if (sip.includes('disabled') || sip === 'off') n++;
  if (gk.includes('disabled') || gk === 'off') n++;
  if (parseFloat(storage.use_percent) >= 85) n++;
  if (/service|replace/i.test(String(battery.condition ?? ''))) n++;
  const pct = parseFloat(battery.percent);
  if (Number.isFinite(pct) && pct > 0 && pct < 10) n++;
  return n;
}

function wifiCategoryCounts(data) {
  const wifi = safeWifi(data);
  const counts = { home: 0, outOfHome: 0, total: wifi.length };
  for (const w of wifi) {
    const cat = categorizeWifiNetwork(w);
    if (cat === 'home') counts.home++;
    else counts.outOfHome++;
  }
  return counts;
}

function ruralBrowseHits(data) {
  const urls = safeBrowserUrls(data);
  return urls.filter((u) => /homestead|off[\s-]?grid|countryside|farmhouse|tinyhouse|vanlife|permaculture|allotment|cabin|rural/i.test(u)).length;
}

function sensitiveDownloadCount(data) {
  return safeDownloads(data).filter((d) => /contract|nda|confidential|password|secret|salary|invoice|passport|resume|brief/i.test(String(d.name ?? ''))).length;
}

function productivityOutputScore(data) {
  const usage = safeUsage(data);
  const work = countInUsage(usage, (a) => WORK_APPS.has(a) || isCreative(a));
  const files = safeFiles(data).length;
  return work * 6 + files * 4;
}

// ─── BOARDS ────────────────────────────────────────────────────────────────

/**
 * @type {Array<{ id: string, title: string, persona: 'productivite'|'securite'|'popularite', peakHour: number, scoreFn: (data, profile, nowMs) => { score: number, hint: string } }>}
 * Score is unbounded and may be negative (e.g. entertainment-only user on most_productive).
 * Array order is the priority tiebreaker used by pickBoardToPost when two boards have equal rank deltas.
 */
export const BOARDS = [
  {
    id: 'most_productive',
    title: 'Top 5 Most Productive',
    persona: 'productivite',
    peakHour: 11,
    scoreFn: (data, _profile, nowMs) => {
      const usage = safeUsage(data);
      const work = countInUsage(usage, (a) => WORK_APPS.has(a));
      const creative = countInUsage(usage, isCreative);
      const ent = countInUsage(usage, (a) => ENTERTAINMENT_APPS.has(a));
      const baseline = work * 8 + creative * 6 - ent * 4;
      const d = decay(hourOf(nowMs), 11);
      return {
        score: baseline * (1 + 0.3 * d),
        hint: `${work} work app(s), ${creative} creative app(s), ${ent} entertainment app(s) used recently.`,
      };
    },
  },
  {
    id: 'closest_to_burnout',
    title: 'Top 5 Closest to Burnout',
    persona: 'productivite',
    peakHour: 23,
    scoreFn: (data, _profile, nowMs) => {
      const usage = safeUsage(data);
      const lateFiles = lateNightFileCount(data);
      const work = countInUsage(usage, (a) => WORK_APPS.has(a) || isCreative(a));
      const social = countInUsage(usage, (a) => SOCIAL_APPS.has(a));
      const baseline = lateFiles * 10 + work * 3 - social * 2;
      const d = decay(hourOf(nowMs), 23);
      return {
        score: baseline * (1 + 0.4 * d),
        hint: `${lateFiles} late-night file edit(s), ${work} work app(s), ${social} social app(s).`,
      };
    },
  },
  {
    id: 'most_likely_change_jobs',
    title: 'Top 5 Most Likely to Change Jobs',
    persona: 'productivite',
    peakHour: 15,
    scoreFn: (data, _profile, nowMs) => {
      const urls = safeBrowserUrls(data);
      const jobs = urls.filter((u) => /linkedin\.com\/jobs|indeed\.com|glassdoor\.com|welcometothejungle/i.test(u)).length;
      const filesRecent = safeFiles(data).length;
      const usage = safeUsage(data);
      const comms = countInUsage(usage, (a) => SOCIAL_APPS.has(a));
      const baseline = jobs * 15 + Math.max(0, 5 - filesRecent) * 3 + comms * 2;
      const d = decay(hourOf(nowMs), 15);
      return {
        score: baseline * (1 + 0.3 * d),
        hint: `${jobs} job-board visit(s), ${filesRecent} recent file(s), ${comms} comms-app session(s).`,
      };
    },
  },
  {
    id: 'ignoring_health',
    title: 'Top 5 Most Likely Ignoring Health',
    persona: 'productivite',
    peakHour: 1,
    scoreFn: (data, _profile, nowMs) => {
      const installed = safeInstalled(data);
      const wifi = safeWifi(data);
      const cafeWifi = wifi.filter((w) => /caf[ée]|coffee/i.test(String(w))).length;
      const hasHealth = installed.some((a) => HEALTH_APPS.has(a));
      const lateFiles = lateNightFileCount(data);
      const baseline = lateFiles * 6 + cafeWifi * 4 + (hasHealth ? 0 : 10);
      const d = decay(hourOf(nowMs), 1);
      return {
        score: baseline * (1 + 0.3 * d),
        hint: `${lateFiles} late-night file(s), ${cafeWifi} café wifi network(s), health app installed: ${hasHealth}.`,
      };
    },
  },
  {
    id: 'most_likely_miss_deadline',
    title: 'Top 5 Most Likely to Miss Their Own Deadline',
    persona: 'productivite',
    peakHour: 16,
    scoreFn: (data, _profile, nowMs) => {
      const usage = safeUsage(data);
      const ent = countInUsage(usage, (a) => ENTERTAINMENT_APPS.has(a));
      const social = countInUsage(usage, (a) => SOCIAL_APPS.has(a));
      const files = safeFiles(data).length;
      const browserVisits = safeBrowserUrls(data).length;
      const outputGap = Math.max(0, 8 - files);
      const baseline = ent * 7 + social * 5 + browserVisits * 0.8 + outputGap * 4;
      const d = decay(hourOf(nowMs), 16);
      return {
        score: baseline * (1 + 0.35 * d),
        hint: `${ent} entertainment app(s), ${social} social app(s), ${files} recent file(s), ${browserVisits} browser visit(s).`,
      };
    },
  },
  {
    id: 'replaced_by_ai_90_days',
    title: 'Top 5 Most Likely to Be Replaced by an AI in 90 Days',
    persona: 'productivite',
    peakHour: 13,
    scoreFn: (data, _profile, nowMs) => {
      const usage = safeUsage(data);
      const ai = countAiUsage(usage);
      const installed = safeInstalled(data);
      const aiInstalled = installed.filter((a) => AI_APPS.has(a) || /copilot|ollama|chatgpt|claude/i.test(String(a))).length;
      const files = safeFiles(data).length;
      const baseline = ai * 12 + aiInstalled * 8 + Math.max(0, 6 - files) * 5;
      const d = decay(hourOf(nowMs), 13);
      return {
        score: baseline * (1 + 0.3 * d),
        hint: `${ai} AI app session(s), ${aiInstalled} AI tool(s) installed, ${files} recent file(s).`,
      };
    },
  },
  {
    id: 'least_with_expensive_setup',
    title: 'Top 5 Doing Least with the Most Expensive Setup',
    persona: 'productivite',
    peakHour: 12,
    scoreFn: (data, profile, nowMs) => {
      const tier = hardwareTierScore(profile, data);
      const output = productivityOutputScore(data);
      const ent = countInUsage(safeUsage(data), (a) => ENTERTAINMENT_APPS.has(a));
      const baseline = tier * 1.4 - output * 0.6 + ent * 3;
      const d = decay(hourOf(nowMs), 12);
      return {
        score: baseline * (1 + 0.25 * d),
        hint: `hardware tier ${Math.round(tier)}, ${output} output signal, ${ent} entertainment app(s).`,
      };
    },
  },
  {
    id: 'procrastinate_right_now',
    title: 'Top 5 Most Likely to Procrastinate Right Now',
    persona: 'productivite',
    peakHour: 14,
    scoreFn: (data, _profile, nowMs) => {
      const usage = safeUsage(data);
      const ent = countInUsage(usage, (a) => ENTERTAINMENT_APPS.has(a));
      const social = countInUsage(usage, (a) => SOCIAL_APPS.has(a));
      const work = countInUsage(usage, (a) => WORK_APPS.has(a) || isCreative(a));
      const baseline = ent * 9 + social * 6 - work * 3 + Math.max(0, 4 - safeFiles(data).length) * 4;
      const d = decay(hourOf(nowMs), 14);
      return {
        score: baseline * (1 + 0.45 * d),
        hint: `${ent} entertainment app(s), ${social} social app(s), ${work} work app(s).`,
      };
    },
  },
  {
    id: 'quit_to_countryside',
    title: 'Top 5 Most Likely to Quit Everything and Move to the Countryside',
    persona: 'productivite',
    peakHour: 19,
    scoreFn: (data, _profile, nowMs) => {
      const urls = safeBrowserUrls(data);
      const jobs = urls.filter((u) => /linkedin\.com\/jobs|indeed\.com|glassdoor\.com|welcometothejungle/i.test(u)).length;
      const rural = ruralBrowseHits(data);
      const comms = countInUsage(safeUsage(data), (a) => COMMS_APPS.has(a));
      const files = safeFiles(data).length;
      const baseline = jobs * 10 + rural * 18 + Math.max(0, 5 - comms) * 3 + Math.max(0, 4 - files) * 4;
      const d = decay(hourOf(nowMs), 19);
      return {
        score: baseline * (1 + 0.3 * d),
        hint: `${jobs} job-board visit(s), ${rural} rural-life browse(s), ${comms} comms session(s), ${files} recent file(s).`,
      };
    },
  },
  {
    id: 'most_secure',
    title: 'Top 5 Most Secure',
    persona: 'securite',
    peakHour: 9,
    scoreFn: (data, _profile, nowMs) => {
      const installed = safeInstalled(data);
      const vpnCount = installed.filter((a) => VPN_APPS.has(a)).length;
      const torrentCount = installed.filter((a) => TORRENT_APPS.has(a)).length;
      const wifiCount = safeWifi(data).length;
      // Fewer wifi networks = less attack surface (deliberately reductive).
      const baseline = vpnCount * 30 + Math.max(0, 20 - wifiCount) - torrentCount * 25;
      const d = decay(hourOf(nowMs), 9);
      return {
        score: baseline * (1 + 0.2 * d),
        hint: `${vpnCount} VPN app(s), ${wifiCount} known wifi network(s), ${torrentCount} torrent app(s).`,
      };
    },
  },
  {
    id: 'get_hacked_this_month',
    title: 'Top 5 Most Likely to Get Hacked This Month',
    persona: 'securite',
    peakHour: 3,
    scoreFn: (data, _profile, nowMs) => {
      const installed = safeInstalled(data);
      const vpnCount = installed.filter((a) => VPN_APPS.has(a)).length;
      const torrentCount = installed.filter((a) => TORRENT_APPS.has(a)).length;
      const wifiCount = safeWifi(data).length;
      const warnings = systemWarningCount(data);
      const baseline = Math.max(0, 18 - wifiCount) * -1 + wifiCount * 4 + torrentCount * 22 - vpnCount * 18 + warnings * 10;
      const d = decay(hourOf(nowMs), 3);
      return {
        score: baseline * (1 + 0.35 * d),
        hint: `${wifiCount} known wifi network(s), ${torrentCount} torrent app(s), ${vpnCount} VPN app(s), ${warnings} system warning(s).`,
      };
    },
  },
  {
    id: 'tracked_by_third_parties',
    title: 'Top 5 Most Likely Already Tracked by Third Parties',
    persona: 'securite',
    peakHour: 10,
    scoreFn: (data, _profile, nowMs) => {
      const browserVisits = safeBrowserUrls(data).length;
      const social = countInUsage(safeUsage(data), (a) => SOCIAL_APPS.has(a));
      const installed = safeInstalled(data);
      const vpnCount = installed.filter((a) => VPN_APPS.has(a)).length;
      const trackingDomains = safeBrowserUrls(data).filter((u) => /google|facebook|meta|tiktok|amazon|doubleclick|analytics|ads/i.test(u)).length;
      const baseline = browserVisits * 0.6 + social * 5 + trackingDomains * 3 - vpnCount * 12;
      const d = decay(hourOf(nowMs), 10);
      return {
        score: baseline * (1 + 0.3 * d),
        hint: `${browserVisits} browser visit(s), ${social} social app(s), ${trackingDomains} ad-tracker domain(s), ${vpnCount} VPN app(s).`,
      };
    },
  },
  {
    id: 'ignoring_system_warnings',
    title: 'Top 5 Ignoring System Warnings the Longest',
    persona: 'securite',
    peakHour: 8,
    scoreFn: (data, _profile, nowMs) => {
      const warnings = systemWarningCount(data);
      const storagePct = parseFloat(safeStorage(data).use_percent) || 0;
      const batteryPct = parseFloat(safeBattery(data).percent) || 100;
      const baseline = warnings * 14 + Math.max(0, storagePct - 70) * 0.8 + Math.max(0, 20 - batteryPct) * 0.5;
      const d = decay(hourOf(nowMs), 8);
      return {
        score: baseline * (1 + 0.25 * d),
        hint: `${warnings} system warning(s), ${Math.round(storagePct)}% storage use, ${Math.round(batteryPct)}% battery.`,
      };
    },
  },
  {
    id: 'leak_confidential_accident',
    title: 'Top 5 Most Likely to Leak Something Confidential by Accident',
    persona: 'securite',
    peakHour: 17,
    scoreFn: (data, _profile, nowMs) => {
      const usage = safeUsage(data);
      const comms = countInUsage(usage, (a) => COMMS_APPS.has(a));
      const cloud = countInUsage(usage, (a) => CLOUD_SYNC_APPS.has(a));
      const sensitive = sensitiveDownloadCount(data);
      const social = countInUsage(usage, (a) => SOCIAL_APPS.has(a));
      const baseline = comms * 6 + cloud * 8 + sensitive * 12 + social * 3;
      const d = decay(hourOf(nowMs), 17);
      return {
        score: baseline * (1 + 0.3 * d),
        hint: `${comms} comms session(s), ${cloud} cloud-sync app(s), ${sensitive} sensitive download(s), ${social} social app(s).`,
      };
    },
  },
  {
    id: 'messiest_digital_life',
    title: 'Top 5 with the Messiest Digital Life',
    persona: 'securite',
    peakHour: 18,
    scoreFn: (data, _profile, nowMs) => {
      const installed = safeInstalled(data).length;
      const wifiCount = safeWifi(data).length;
      const downloads = safeDownloads(data).length;
      const files = safeFiles(data).length;
      const storagePct = parseFloat(safeStorage(data).use_percent) || 0;
      const baseline = installed * 0.8 + wifiCount * 3 + downloads * 4 + files * 2 + storagePct * 0.5;
      const d = decay(hourOf(nowMs), 18);
      return {
        score: baseline * (1 + 0.2 * d),
        hint: `${installed} installed app(s), ${wifiCount} wifi network(s), ${downloads} recent download(s), ${Math.round(storagePct)}% storage use.`,
      };
    },
  },
  {
    id: 'most_socially_isolated',
    title: 'Top 5 Most Socially Isolated',
    persona: 'popularite',
    peakHour: 22,
    scoreFn: (data, _profile, nowMs) => {
      const usage = safeUsage(data);
      const socialUse = countInUsage(usage, (a) => SOCIAL_APPS.has(a));
      const wifiDiversity = new Set(safeWifi(data)).size;
      const baseline = Math.max(0, 25 - socialUse * 5) + Math.max(0, 6 - wifiDiversity) * 4;
      const d = decay(hourOf(nowMs), 22);
      return {
        score: baseline * (1 + 0.3 * d),
        hint: `${socialUse} social-app session(s), ${wifiDiversity} unique wifi network(s).`,
      };
    },
  },
  {
    id: 'most_likely_ghost',
    title: 'Top 5 Most Likely to Ghost You',
    persona: 'popularite',
    peakHour: 20,
    scoreFn: (data, _profile, nowMs) => {
      const usage = safeUsage(data);
      const comms = countInUsage(usage, (a) => COMMS_APPS.has(a));
      const total = usage.length;
      const nonCommsRatio = total > 0 ? (total - comms) / total : 1;
      const baseline = Math.max(0, 25 - comms * 4) + nonCommsRatio * 15;
      const d = decay(hourOf(nowMs), 20);
      return {
        score: baseline * (1 + 0.3 * d),
        hint: `${comms} comms session(s) out of ${total} tracked app session(s).`,
      };
    },
  },
  {
    id: 'havent_left_house',
    title: 'Top 5 Who Haven\'t Left the House in the Longest Time',
    persona: 'popularite',
    peakHour: 21,
    scoreFn: (data, _profile, nowMs) => {
      const wifi = wifiCategoryCounts(data);
      const social = countInUsage(safeUsage(data), (a) => SOCIAL_APPS.has(a));
      const baseline = Math.max(0, 12 - wifi.outOfHome) * 5 + wifi.home * 3 - social * 2;
      const d = decay(hourOf(nowMs), 21);
      return {
        score: baseline * (1 + 0.35 * d),
        hint: `${wifi.home} home wifi network(s), ${wifi.outOfHome} out-of-home wifi network(s), ${social} social app(s).`,
      };
    },
  },
  {
    id: 'talking_to_ais_not_people',
    title: 'Top 5 Spending the Most Time Talking to AIs Instead of People',
    persona: 'popularite',
    peakHour: 22,
    scoreFn: (data, _profile, nowMs) => {
      const usage = safeUsage(data);
      const ai = countAiUsage(usage);
      const comms = countInUsage(usage, (a) => COMMS_APPS.has(a));
      const social = countInUsage(usage, (a) => SOCIAL_APPS.has(a));
      const baseline = ai * 14 + Math.max(0, 8 - comms) * 4 + Math.max(0, 6 - social) * 3;
      const d = decay(hourOf(nowMs), 22);
      return {
        score: baseline * (1 + 0.35 * d),
        hint: `${ai} AI app session(s), ${comms} comms session(s), ${social} social app(s).`,
      };
    },
  },
  {
    id: 'least_sleep',
    title: 'Top 5 Running on the Least Sleep',
    persona: 'popularite',
    peakHour: 2,
    scoreFn: (data, _profile, nowMs) => {
      const lateFiles = lateNightFileCount(data);
      const installed = safeInstalled(data);
      const hasSleepApp = installed.some((a) => /sleep|headspace|calm|fitness|health/i.test(String(a)));
      const lateApps = countInUsage(safeUsage(data), (a) => ENTERTAINMENT_APPS.has(a) || WORK_APPS.has(a));
      const baseline = lateFiles * 9 + lateApps * 2 + (hasSleepApp ? 0 : 12);
      const d = decay(hourOf(nowMs), 2);
      return {
        score: baseline * (1 + 0.4 * d),
        hint: `${lateFiles} late-night file edit(s), ${lateApps} late-session app(s), sleep app installed: ${hasSleepApp}.`,
      };
    },
  },
];

// ─── Pick logic — diff current standings vs prior posts ───────────────────

// Must exceed FAKE_CLONE_COUNT to guarantee first-appearance always wins any
// real rank-change delta. Currently: 5 > 4 ✓
const FIRST_APPEARANCE_DELTA = 5;

function priorRankByBoard(existingPosts) {
  // posts/{id}.json is newest-first; first hit per board wins.
  const out = {};
  if (!Array.isArray(existingPosts)) return out;
  for (const p of existingPosts) {
    const lb = p?.leaderboard;
    if (!lb || typeof lb.boardId !== 'string') continue;
    if (Object.prototype.hasOwnProperty.call(out, lb.boardId)) continue;
    const r = lb.userRank == null ? NaN : Number(lb.userRank);
    out[lb.boardId] = Number.isFinite(r) ? r : null;
  }
  return out;
}

/** How many leaderboard posts already exist (any board). */
export function countLeaderboardPosts(existingPosts) {
  if (!Array.isArray(existingPosts)) return 0;
  return existingPosts.filter((p) => p?.leaderboard?.boardId).length;
}

/** Stable per-profile offset so demo users don't all open on most_productive. */
export function boardRotationOffset(profile) {
  const slug = String(
    profile?.slug
    ?? profile?.id
    ?? profile?.machineName
    ?? profile?.machine_name
    ?? profile?.firstname
    ?? '',
  ).trim();
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % BOARDS.length;
}

/** True when every defined board already has at least one leaderboard post. */
export function allLeaderboardsPosted(existingPosts) {
  const priorByBoard = priorRankByBoard(existingPosts);
  return BOARDS.every((b) => Object.prototype.hasOwnProperty.call(priorByBoard, b.id));
}

/** Whether a new leaderboard post is warranted (rank moved or board never posted). */
export function hasLeaderboardToPost(dataJson, profile, existingPosts, nowMs = Date.now()) {
  return pickBoardToPost(dataJson, profile, existingPosts, nowMs) !== null;
}

/**
 * @returns {{ board, standing, prevRank: number|null } | null}
 *   null when nothing has changed since the last leaderboard post.
 */
export function pickBoardToPost(dataJson, profile, existingPosts, nowMs) {
  const priorByBoard = priorRankByBoard(existingPosts);
  const lbCount = countLeaderboardPosts(existingPosts);
  const rotation = boardRotationOffset(profile);

  let maxDelta = -1;
  const candidates = [];

  for (let i = 0; i < BOARDS.length; i += 1) {
    const board = BOARDS[i];
    const standing = computeBoardStanding(board, dataJson, profile, nowMs);
    const prev = Object.prototype.hasOwnProperty.call(priorByBoard, board.id)
      ? priorByBoard[board.id]
      : null;
    const delta = prev === null
      ? FIRST_APPEARANCE_DELTA
      : Math.abs((standing.userRank ?? 0) - prev);
    if (delta === 0) continue;

    if (delta > maxDelta) {
      maxDelta = delta;
      candidates.length = 0;
      candidates.push({ board, standing, prevRank: prev, delta, priority: i });
    } else if (delta === maxDelta) {
      candidates.push({ board, standing, prevRank: prev, delta, priority: i });
    }
  }

  // Every board was posted and no rank moved on any of them → skip leaderboard entirely.
  if (candidates.length === 0) return null;

  const neverPosted = candidates.filter(
    (c) => !Object.prototype.hasOwnProperty.call(priorByBoard, c.board.id),
  );
  const pool = neverPosted.length > 0 ? neverPosted : candidates;
  const pick = pool[(lbCount + rotation) % pool.length];

  return { board: pick.board, standing: pick.standing, prevRank: pick.prevRank };
}
