/**
 * Leaderboard scoring + selection.
 *
 * Pure module. No I/O. All randomness is seeded from inputs so generation
 * is reproducible within a 10-minute "drift bucket".
 */

import crypto from 'crypto';
import { avatarSrcFromProfile } from '../../src/lib/profileUtils.js';

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

function seededFloat(seedStr) {
  const hex = crypto.createHash('sha256').update(seedStr).digest('hex').slice(0, 8);
  // 32-bit unsigned int → [0, 1)
  return parseInt(hex, 16) / 0x1_0000_0000;
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
    title: 'Top 5 Most Likely to Change Jobs (30d)',
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

/**
 * @returns {{ board, standing, prevRank: number|null } | null}
 *   null when nothing has changed since the last leaderboard post.
 */
export function pickBoardToPost(dataJson, profile, existingPosts, nowMs) {
  const priorByBoard = priorRankByBoard(existingPosts);

  let best = null; // { board, standing, prevRank, delta, priority }
  for (let i = 0; i < BOARDS.length; i++) {
    const board = BOARDS[i];
    const standing = computeBoardStanding(board, dataJson, profile, nowMs);
    const prev = Object.prototype.hasOwnProperty.call(priorByBoard, board.id)
      ? priorByBoard[board.id]
      : null;
    const delta = prev === null
      ? FIRST_APPEARANCE_DELTA
      : Math.abs((standing.userRank ?? 0) - prev);
    if (delta === 0) continue;

    if (
      best === null
      || delta > best.delta
      || (delta === best.delta && i < best.priority)
    ) {
      best = { board, standing, prevRank: prev, delta, priority: i };
    }
  }

  if (!best) return null;
  return { board: best.board, standing: best.standing, prevRank: best.prevRank };
}
