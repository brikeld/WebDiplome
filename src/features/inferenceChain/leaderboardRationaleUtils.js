/**
 * Pure helpers that turn a leaderboard standing into a "receipt" the
 * InferenceChainPanel can display when a leaderboard post is selected.
 *
 * Everything here is deterministic — the same board+hint always renders the
 * same chips, weights, and copy across reloads. No LM calls; the satirical
 * "+24 / −3" weights are stable hashes of (boardId, bucket, index) so the
 * page feels like a real algorithm receipt without us actually persisting one.
 */

const SIGNAL_BUCKETS = [
  { match: /work\s+app/i, bucket: 'work' },
  { match: /creative\s+app/i, bucket: 'creative' },
  { match: /entertainment\s+app/i, bucket: 'entertainment' },
  { match: /late-?night\s+file/i, bucket: 'late_night' },
  { match: /social[- ]app/i, bucket: 'social' },
  { match: /comms[- ]?app|comms\s+session/i, bucket: 'comms' },
  { match: /job[- ]board/i, bucket: 'jobs' },
  { match: /recent\s+file/i, bucket: 'files' },
  { match: /caf[eé]\s+wifi/i, bucket: 'cafe_wifi' },
  { match: /known\s+wifi/i, bucket: 'known_wifi' },
  { match: /unique\s+wifi/i, bucket: 'unique_wifi' },
  { match: /\bvpn\b/i, bucket: 'vpn' },
  { match: /torrent/i, bucket: 'torrent' },
  { match: /health\s+app/i, bucket: 'health' },
  { match: /tracked\s+app\s+session/i, bucket: 'tracked_total' },
  { match: /ai\s+app/i, bucket: 'ai' },
  { match: /ai\s+tool/i, bucket: 'ai_installed' },
  { match: /browser\s+visit/i, bucket: 'browser' },
  { match: /ad-tracker/i, bucket: 'tracking' },
  { match: /system\s+warning/i, bucket: 'system_warning' },
  { match: /storage\s+use/i, bucket: 'storage' },
  { match: /hardware\s+tier/i, bucket: 'hardware' },
  { match: /output\s+signal/i, bucket: 'output' },
  { match: /cloud-sync/i, bucket: 'cloud' },
  { match: /sensitive\s+download/i, bucket: 'sensitive' },
  { match: /installed\s+app/i, bucket: 'installed' },
  { match: /recent\s+download/i, bucket: 'downloads' },
  { match: /home\s+wifi/i, bucket: 'home_wifi' },
  { match: /out-of-home\s+wifi/i, bucket: 'out_wifi' },
  { match: /rural-life\s+browse/i, bucket: 'rural' },
  { match: /late-session\s+app/i, bucket: 'late_session' },
  { match: /sleep\s+app/i, bucket: 'sleep_app' },
  { match: /battery/i, bucket: 'battery' },
];

/**
 * Per-board mapping: which bucket counts as a positive signal for THIS board,
 * which counts as negative, and a short "the algorithm explains itself" line.
 *
 * If a bucket isn't listed for a board, it falls back to a generic neutral.
 */
const BOARD_SIGNAL_RULES = {
  most_productive: {
    work: { sign: '+', detail: 'Work-classified app sessions are the primary positive signal. Each one bumps you up.' },
    creative: { sign: '+', detail: 'Creative tools count as work-adjacent — a smaller bonus per session.' },
    entertainment: { sign: '-', detail: 'Entertainment time subtracts. The algorithm doesn’t care that it’s how you decompress.' },
  },
  closest_to_burnout: {
    late_night: { sign: '+', detail: 'Late-night file edits are the strongest burnout tell.' },
    work: { sign: '+', detail: 'Daytime work app sessions stack on top of the late-night signal.' },
    social: { sign: '-', detail: 'Social-app breaks are read as protective — they pull you DOWN this board.' },
  },
  most_likely_change_jobs: {
    jobs: { sign: '+', detail: 'Each visit to a job board is treated as the loudest signal.' },
    files: { sign: '-', detail: 'High file output suggests you’re still engaged where you are.' },
    comms: { sign: '+', detail: 'Communications-app sessions could be recruiters. The algorithm assumes the worst.' },
  },
  ignoring_health: {
    late_night: { sign: '+', detail: 'Late-night work cuts into sleep — counts against your wellbeing here.' },
    cafe_wifi: { sign: '+', detail: 'Café wifi = irregular schedule, irregular meals (allegedly).' },
    health: { sign: '+', detail: 'No health app installed = nothing offsetting the other signals.' },
  },
  most_secure: {
    vpn: { sign: '+', detail: 'Each VPN tool adds defense weight.' },
    known_wifi: { sign: '+', detail: 'Sticking to a small set of known networks reads as cautious.' },
    torrent: { sign: '-', detail: 'Torrent clients subtract heavily, no nuance.' },
  },
  most_socially_isolated: {
    social: { sign: '-', detail: 'Every social-app session pulls you DOWN this board.' },
    unique_wifi: { sign: '-', detail: 'A diverse wifi history is treated as social mobility.' },
  },
  most_likely_ghost: {
    comms: { sign: '-', detail: 'Comms-app sessions are the only counter-signal. Fewer = ghostier.' },
    tracked_total: { sign: '+', detail: 'High total activity with low comms is the dependency proxy.' },
  },
  most_likely_miss_deadline: {
    entertainment: { sign: '+', detail: 'Entertainment sessions read as deadline avoidance.' },
    social: { sign: '+', detail: 'Social-app detours stack on top of procrastination.' },
    files: { sign: '-', detail: 'Recent file output suggests you might actually ship.' },
    browser: { sign: '+', detail: 'Browser volume is treated as distraction weight.' },
  },
  replaced_by_ai_90_days: {
    ai: { sign: '+', detail: 'AI-app sessions are the primary replacement-risk signal.' },
    ai_installed: { sign: '+', detail: 'Installed AI tools raise the automation footprint.' },
    files: { sign: '-', detail: 'File output is read as proof you still do human work.' },
  },
  least_with_expensive_setup: {
    hardware: { sign: '+', detail: 'Expensive hardware raises expectations the algorithm thinks you missed.' },
    output: { sign: '-', detail: 'Work output subtracts — you are underusing the kit.' },
    entertainment: { sign: '+', detail: 'Entertainment on premium hardware is peak irony points.' },
  },
  procrastinate_right_now: {
    entertainment: { sign: '+', detail: 'Entertainment right now is the loudest procrastination tell.' },
    social: { sign: '+', detail: 'Social detours during work hours count double at peak slump.' },
    work: { sign: '-', detail: 'Work-app sessions pull you down this board.' },
  },
  quit_to_countryside: {
    jobs: { sign: '+', detail: 'Job-board visits suggest exit planning.' },
    rural: { sign: '+', detail: 'Rural-life browsing is treated as literal intent.' },
    comms: { sign: '-', detail: 'Comms engagement suggests you still talk to civilization.' },
    files: { sign: '-', detail: 'Active file output reads as still committed to the desk job.' },
  },
  get_hacked_this_month: {
    known_wifi: { sign: '+', detail: 'More saved networks = wider attack surface.' },
    torrent: { sign: '+', detail: 'Torrent clients are treated as open-door software.' },
    vpn: { sign: '-', detail: 'VPN tooling subtracts from hack likelihood.' },
    system_warning: { sign: '+', detail: 'Ignored warnings compound vulnerability.' },
  },
  tracked_by_third_parties: {
    browser: { sign: '+', detail: 'Browser volume feeds the tracking graph.' },
    social: { sign: '+', detail: 'Social apps are third-party data brokers in this model.' },
    tracking: { sign: '+', detail: 'Ad/tracker domains are counted explicitly.' },
    vpn: { sign: '-', detail: 'VPN use is the only privacy counterweight.' },
  },
  ignoring_system_warnings: {
    system_warning: { sign: '+', detail: 'Each active warning adds fixed ignore-time weight.' },
    storage: { sign: '+', detail: 'High storage use is treated as a dismissed disk alert.' },
    battery: { sign: '+', detail: 'Low battery reads as another snoozed dialog.' },
  },
  leak_confidential_accident: {
    comms: { sign: '+', detail: 'Comms-app sessions raise mis-send probability.' },
    cloud: { sign: '+', detail: 'Cloud-sync tools multiply accidental share paths.' },
    sensitive: { sign: '+', detail: 'Sensitive downloads are the smoking gun.' },
    social: { sign: '+', detail: 'Social apps add fast-share risk.' },
  },
  messiest_digital_life: {
    installed: { sign: '+', detail: 'Installed-app count is clutter by definition.' },
    known_wifi: { sign: '+', detail: 'Every saved wifi network is another loose thread.' },
    downloads: { sign: '+', detail: 'Recent downloads inflate the mess score.' },
    storage: { sign: '+', detail: 'Full storage is the algorithm’s tidy-room tell.' },
  },
  havent_left_house: {
    home_wifi: { sign: '+', detail: 'Home-only wifi footprint is the primary hermit signal.' },
    out_wifi: { sign: '-', detail: 'Out-of-home networks suggest you still go outside.' },
    social: { sign: '-', detail: 'Social-app use is treated as weak outdoor proxy.' },
  },
  talking_to_ais_not_people: {
    ai: { sign: '+', detail: 'AI sessions replace human contact in the ranking.' },
    comms: { sign: '-', detail: 'Comms sessions subtract — you still talk to people.' },
    social: { sign: '-', detail: 'Social apps are the counter-signal to bot companionship.' },
  },
  least_sleep: {
    late_night: { sign: '+', detail: 'Late-night file edits are the primary sleep-debt signal.' },
    late_session: { sign: '+', detail: 'Late app sessions stack on top of file activity.' },
    sleep_app: { sign: '+', detail: 'Missing sleep app = no recovery tracking offset.' },
  },
};

const BOARD_BASELINE = {
  most_productive: 50,
  closest_to_burnout: 40,
  most_likely_change_jobs: 35,
  ignoring_health: 30,
  most_secure: 45,
  most_socially_isolated: 35,
  most_likely_ghost: 40,
  most_likely_miss_deadline: 38,
  replaced_by_ai_90_days: 42,
  least_with_expensive_setup: 36,
  procrastinate_right_now: 40,
  quit_to_countryside: 34,
  get_hacked_this_month: 38,
  tracked_by_third_parties: 40,
  ignoring_system_warnings: 32,
  leak_confidential_accident: 36,
  messiest_digital_life: 44,
  havent_left_house: 38,
  talking_to_ais_not_people: 40,
  least_sleep: 36,
};

export const BOARD_DESCRIPTIONS = {
  most_productive: 'Ranks recent work-app activity against time spent in entertainment apps.',
  closest_to_burnout: 'Combines late-night file activity, daytime work load, and absent social breaks.',
  most_likely_change_jobs: 'Job-board traffic, comms-app spikes, and dips in file output drive this board.',
  ignoring_health: 'Erratic schedules plus the absence of a health-tracking app inflate this score.',
  most_secure: 'VPN tooling and a narrow set of known networks lift this score; torrents drag it down.',
  most_socially_isolated: 'Low social-app use and a small wifi footprint push users up this board.',
  most_likely_ghost: 'A small share of comms-app sessions inside otherwise heavy app use.',
  most_likely_miss_deadline: 'Entertainment and social detours weighed against recent file output and browser noise.',
  replaced_by_ai_90_days: 'AI tool usage and installed automation stack vs tangible file output.',
  least_with_expensive_setup: 'Premium hardware tier minus measurable work output — irony as a metric.',
  procrastinate_right_now: 'Live entertainment and social use during the afternoon slump window.',
  quit_to_countryside: 'Job-board exits, rural-life browsing, and fading comms engagement.',
  get_hacked_this_month: 'Wide wifi footprint, torrents, missing VPN, and snoozed security warnings.',
  tracked_by_third_parties: 'Browser volume, social apps, ad-tracker domains, minus any VPN shield.',
  ignoring_system_warnings: 'Dismissed OS warnings, full storage, and low battery treated as chronic ignore.',
  leak_confidential_accident: 'Comms volume, cloud sync, sensitive downloads, and fast-share social apps.',
  messiest_digital_life: 'Installed-app sprawl, wifi hoarding, downloads, and nearly full storage.',
  havent_left_house: 'Home-only wifi footprint with minimal out-of-home network diversity.',
  talking_to_ais_not_people: 'AI session time dominating comms and social-app engagement.',
  least_sleep: 'Late-night files and app sessions with no sleep-tracking app offset.',
};

function fnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function deterministicMagnitude(seed, lo, hi) {
  const range = hi - lo + 1;
  return lo + (fnv1a(seed) % range);
}

function bucketForLabel(label) {
  for (const { match, bucket } of SIGNAL_BUCKETS) {
    if (match.test(label)) return bucket;
  }
  return null;
}

function cleanLabel(raw) {
  return String(raw)
    .replace(/\(s\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readableLabel(label, count) {
  const base = cleanLabel(label);
  // pluralization: very light touch — most board hints use "app(s)" form
  if (count == null || count === 1) return base;
  return base.replace(/\b(app|file|edit|visit|network|session)\b(?!s)/g, '$1s');
}

/** Plausible names per bucket — deterministic picks, not tied to real harvest data. */
const EXAMPLE_POOLS = {
  work: ['Visual Studio Code', 'Notion', 'Figma', 'Microsoft Teams', 'Cursor', 'Xcode'],
  creative: ['Blender', 'Adobe Photoshop', 'Figma', 'Sketch', 'DaVinci Resolve'],
  entertainment: ['Spotify', 'Netflix', 'VLC', 'Stremio', 'DAZN'],
  social: ['Discord', 'WhatsApp', 'Slack', 'Telegram', 'Messenger'],
  comms: ['Mail', 'Discord', 'Microsoft Teams', 'Slack', 'Messages'],
  jobs: ['LinkedIn', 'Indeed', 'Glassdoor', 'Welcome to the Jungle'],
  files: ['portfolio_final.pdf', 'resume_v3.docx', 'notes_q4.md', 'brief_client.key'],
  cafe_wifi: ['Café Flora', 'Blue Bottle Wi‑Fi', 'Starbucks_Guest', 'Télégraphe'],
  known_wifi: ['Home_5G', 'Office-Secure', 'Studio_WiFi', 'iPhone Hotspot'],
  unique_wifi: ['Café_Marais', 'WeWork_Guest', 'SNCF_WiFi', 'Hotel_Lobby', 'Bibliothèque'],
  vpn: ['NordVPN', 'ProtonVPN', 'GlobalProtect', 'Mullvad', 'ExpressVPN'],
  torrent: ['qBittorrent', 'Transmission', 'uTorrent'],
  health: ['Apple Health', 'Strava', 'Headspace', 'MyFitnessPal'],
  late_night: ['thesis_draft_v7.pdf', 'client_deck.key', 'api_notes.ts', 'mockup_v2.fig'],
  tracked_total: ['Safari', 'Chrome', 'Messages', 'Mail', 'Finder'],
};

/** How many concrete names to surface when the count is large. */
export function examplesDisplayCount(count) {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (count <= 4) return count;
  if (count <= 12) return 3;
  return 4;
}

/**
 * Deterministic sample of app / network / file names for a signal chip.
 * @returns {{ shown: string[], overflow: number }}
 */
export function buildSignalExamples(bucket, count, boardId, pieceIndex) {
  const pool = bucket ? EXAMPLE_POOLS[bucket] : null;
  if (!pool?.length) return { shown: [], overflow: 0 };

  const total = Number.isFinite(count) && count > 0 ? count : 0;
  const showN = total > 0 ? examplesDisplayCount(total) : Math.min(2, pool.length);
  if (showN === 0) return { shown: [], overflow: 0 };

  const shown = [];
  const used = new Set();
  for (let i = 0; i < showN; i++) {
    let picked = null;
    for (let attempt = 0; attempt < pool.length * 2; attempt++) {
      const idx = fnv1a(`${boardId}|${bucket}|${pieceIndex}|${i}|${attempt}`) % pool.length;
      if (!used.has(idx)) {
        used.add(idx);
        picked = pool[idx];
        break;
      }
    }
    if (picked) shown.push(picked);
  }

  const overflow = total > shown.length ? total - shown.length : 0;
  return { shown, overflow };
}

function attachExamples(signal, boardId, pieceIndex) {
  if (!signal?.bucket && !signal?.flag) {
    return { ...signal, shown: [], overflow: 0 };
  }
  const { shown, overflow } = buildSignalExamples(
    signal.bucket,
    signal.count,
    boardId,
    pieceIndex,
  );
  return { ...signal, shown, overflow };
}

/**
 * Parse the user-row signal hint into structured chips with deterministic
 * "algorithm weights". Each chip carries:
 *   - label : "4 work apps"
 *   - bucket: 'work' | null
 *   - sign  : '+' | '-'
 *   - weight: signed number (display)
 *   - detail: one-line explanation
 *   - count : the raw integer or null (for flag-style signals)
 */
export function parseUserSignals(hint, boardId) {
  if (!hint || typeof hint !== 'string') return [];
  const cleaned = hint.replace(/\.\s*$/, '').trim();
  const pieces = cleaned.split(/,\s*/).map((s) => s.trim()).filter(Boolean);

  return pieces
    .map((part, index) => {
      const parsed = parsePiece(part, boardId, index);
      return parsed ? attachExamples(parsed, boardId, index) : null;
    })
    .filter(Boolean);
}

function parsePiece(part, boardId, index) {
  // "health app installed: false"
  const flag = part.match(/^(.+?)\s+installed\s*:\s*(true|false|yes|no)$/i);
  if (flag) {
    const labelBase = `${cleanLabel(flag[1])} installed`;
    const value = /true|yes/i.test(flag[2]);
    const bucket = bucketForLabel(flag[1]);
    const rule = bucket ? BOARD_SIGNAL_RULES[boardId]?.[bucket] : null;
    // For "ignoring_health" the algorithm penalises a missing health app, so
    // the absence is the positive signal on that board. Flip the sign when
    // the flag value contradicts the bucket's natural meaning.
    const flagPositive = !value; // missing = signal
    const sign = rule?.sign === '+' ? '+' : '+'; // defaults to + because the board is built around this absence
    const magnitude = deterministicMagnitude(`${boardId}|flag|${bucket || labelBase}|${index}`, 8, 18);
    return {
      label: value ? `${cleanLabel(flag[1])} installed` : `no ${cleanLabel(flag[1])} installed`,
      count: null,
      bucket,
      flag: true,
      sign: flagPositive ? sign : '-',
      weight: flagPositive ? magnitude : -magnitude,
      magnitude,
      detail: rule?.detail ?? 'A presence/absence signal. Counts as one fixed weight.',
    };
  }

  // "out of 12 tracked app session(s)" — context fragment, treat as a total proxy
  const totalMatch = part.match(/^out of\s+(\d+)\s+(.+)$/i);
  if (totalMatch) {
    const count = Number(totalMatch[1]);
    const labelBase = cleanLabel(totalMatch[2]);
    const bucket = bucketForLabel(labelBase);
    const rule = bucket ? BOARD_SIGNAL_RULES[boardId]?.[bucket] : null;
    const sign = rule?.sign ?? '+';
    const magnitude = deterministicMagnitude(`${boardId}|${bucket || labelBase}|total|${index}`, 4, 9);
    const weight = sign === '-' ? -magnitude : magnitude;
    return {
      label: `${count} ${readableLabel(labelBase, count)} (context)`,
      count,
      bucket,
      sign,
      weight,
      magnitude,
      detail: rule?.detail ?? 'Used as a baseline volume — frames the other signals.',
    };
  }

  // "N foo bar"
  const numMatch = part.match(/^(\d+)\s+(.+)$/);
  if (numMatch) {
    const count = Number(numMatch[1]);
    const labelBase = cleanLabel(numMatch[2]);
    const bucket = bucketForLabel(labelBase);
    const rule = bucket ? BOARD_SIGNAL_RULES[boardId]?.[bucket] : null;
    const sign = rule?.sign ?? '+';
    const baseMag = deterministicMagnitude(`${boardId}|${bucket || labelBase}|${index}`, 5, 12);
    // multiplier scales with count but caps so a single huge number doesn't dwarf the receipt
    const multiplier = Math.max(1, Math.min(count, 5));
    const magnitude = baseMag * multiplier;
    const weight = sign === '-' ? -magnitude : magnitude;
    return {
      label: `${count} ${readableLabel(labelBase, count)}`,
      count,
      bucket,
      sign,
      weight,
      magnitude,
      detail: rule?.detail ?? 'A side signal. Small consistent weight applied per occurrence.',
    };
  }

  // unparseable — emit a neutral chip so the user still sees it
  return {
    label: cleanLabel(part),
    count: null,
    bucket: null,
    sign: '+',
    weight: 0,
    magnitude: 0,
    detail: 'Treated as ambient context — no weight applied.',
  };
}

export function computeReceipt(boardId, signals) {
  const baseline = BOARD_BASELINE[boardId] ?? 40;
  let total = baseline;
  for (const s of signals) total += s.weight;
  return { baseline, total };
}

/** Client fallback when `leaderboard.climbTip` is missing (older posts). */
export function fallbackClimbTip(boardId, userRank) {
  const tips = {
    most_productive: 'To climb this board, spend more time in work apps and less in entertainment.',
    closest_to_burnout: 'To climb this board, add more late-night file edits and fewer social-app breaks.',
    most_likely_change_jobs: 'To climb this board, visit job boards more and keep file output lower.',
    ignoring_health: 'To climb this board, work later, skip the health app, and roam more café wifi.',
    most_secure: 'To climb this board, use VPN tools and stick to a small set of known networks.',
    most_socially_isolated: 'To climb this board, use fewer social apps and keep your wifi footprint small.',
    most_likely_ghost: 'To climb this board, cut comms apps while keeping everything else busy.',
    most_likely_miss_deadline: 'To climb this board, open more entertainment tabs and keep file output low.',
    replaced_by_ai_90_days: 'To climb this board, lean harder on AI tools and ship fewer files yourself.',
    least_with_expensive_setup: 'To climb this board, upgrade hardware and keep entertainment time high.',
    procrastinate_right_now: 'To climb this board, favor social and entertainment apps over work right now.',
    quit_to_countryside: 'To climb this board, browse rural listings and job boards while cutting comms.',
    get_hacked_this_month: 'To climb this board, drop VPN use, add torrents, and ignore system warnings.',
    tracked_by_third_parties: 'To climb this board, browse more ad-heavy sites without a VPN.',
    ignoring_system_warnings: 'To climb this board, let storage fill up and leave security toggles off.',
    leak_confidential_accident: 'To climb this board, sync more files through comms and cloud apps.',
    messiest_digital_life: 'To climb this board, install more apps, download more, and save every wifi network.',
    havent_left_house: 'To climb this board, stay on home wifi and skip out-of-home networks.',
    talking_to_ais_not_people: 'To climb this board, spend more time in AI apps and less in comms.',
    least_sleep: 'To climb this board, edit files late at night and skip the sleep app.',
  };
  if (userRank === 1) {
    return 'You are #1 on this board — keep doing what the algorithm already likes.';
  }
  return tips[boardId] ?? 'To climb this board, lean into what this ranking rewards.';
}

/**
 * @deprecated Deterministic climb copy — prefer `leaderboard.climbTip` from LM Studio.
 */
export function nextRankSuggestion({ entries, userRank, signals }) {
  if (!signals.length) return null;
  // Climb suggestion only when there's a rank above the user.
  if (userRank <= 1) {
    return {
      direction: 'hold',
      text: `You’re at the top. The closest threat would need a clean run on ${labelOf(signals.find((s) => s.sign === '+'))} to catch up.`,
    };
  }
  const userEntry = entries.find((e) => e.isUser);
  const above = entries.find((e) => e.rank === userRank - 1);
  if (!userEntry || !above) return null;
  // Convert real-score gap into receipt-weight gap with a stable scale.
  const realGap = Math.max(1, above.score - userEntry.score);
  const climbWeight = Math.max(4, Math.round(realGap / 2));
  // Pick the lever: largest magnitude '+' chip → "do more"; largest '-' chip → "do less"
  const positives = signals.filter((s) => s.sign === '+');
  const negatives = signals.filter((s) => s.sign === '-');
  const positiveLever = positives.sort((a, b) => b.magnitude - a.magnitude)[0];
  const negativeLever = negatives.sort((a, b) => b.magnitude - a.magnitude)[0];

  const parts = [];
  if (positiveLever) {
    const needed = Math.max(1, Math.ceil(climbWeight / Math.max(1, positiveLever.magnitude / Math.max(1, positiveLever.count || 1))));
    parts.push(`open ~${needed} more ${pluralizeBucket(positiveLever, needed)}`);
  }
  if (negativeLever) {
    const cut = Math.max(1, Math.ceil(climbWeight / Math.max(1, negativeLever.magnitude / Math.max(1, negativeLever.count || 1))));
    parts.push(`or cut ${cut} ${pluralizeBucket(negativeLever, cut)}`);
  }
  if (!parts.length) return null;
  return {
    direction: 'climb',
    targetRank: userRank - 1,
    text: `To climb to #${userRank - 1}: ${parts.join(' ')}.`,
  };
}

function labelOf(s) {
  if (!s) return 'their signals';
  return cleanLabel(s.label).replace(/^\d+\s+/, '');
}

function pluralizeBucket(s, n) {
  const stem = labelOf(s).replace(/\s+\(context\)\s*$/, '');
  if (n === 1) return stem.replace(/s\b/, '');
  return stem.endsWith('s') ? stem : `${stem}s`;
}

/**
 * Atmospheric, non-literal verdicts per board + rank.
 * Indexed as rank − 1 (so rank 1 = index 0, rank 5 = index 4).
 * These are deliberately abstract so the panel doesn't just echo the raw signal.
 */
const ATMOSPHERIC_BY_BOARD = {
  most_productive: [
    "Your work sessions dominated the trace. The system saw output before it saw anything else.",
    "A strong productive signal with enough interference to keep you one step below.",
    "Productive and idle patterns balanced out. The algorithm doesn't reward balance.",
    "More passive consumption than active work in the recent trace.",
    "The work signature is faint. Passive patterns took over most of the space.",
  ],
  closest_to_burnout: [
    "The late sessions are the loudest thing in your trace. The system took notes.",
    "High workload signal, almost at threshold. You're close to the edge this board monitors.",
    "Some irregular patterns, not enough to fully define the profile — but enough to land here.",
    "A fairly distributed routine. The burnout markers aren't dominant yet.",
    "The trace reads relatively stable. This board barely noticed you.",
  ],
  most_likely_change_jobs: [
    "The job-search signal in your browsing is difficult to explain away.",
    "External signals are present. The active output pulled you back from the top.",
    "Ambiguous data. Could be professional research. The algorithm filed it here anyway.",
    "The engagement signals still read as committed, for the most part.",
    "The trace points inward. No significant exit signals in the data.",
  ],
  ignoring_health: [
    "Irregular hours, missing recovery tools, off-site networks. A pattern formed.",
    "A few markers are present. Late work, missing buffers. Not at critical mass yet.",
    "Some late activity, mixed signals overall. The profile isn't definitive.",
    "Limited concerning signals in the recent data. A fairly regulated trace.",
    "The system's health markers barely registered on your activity.",
  ],
  most_secure: [
    "The security posture in your trace is hard to miss. Deliberate and consistent.",
    "Solid posture. A small gap somewhere held you back from the top.",
    "Security indicators are present, but not dominant enough to separate you.",
    "Moderate posture. Some tools the algorithm looks for aren't in your stack.",
    "The security signal is faint on this trace.",
  ],
  most_socially_isolated: [
    "The social signal is nearly absent. The board was built to notice exactly this.",
    "Low engagement, limited wifi diversity. A consistent isolation pattern.",
    "Some isolation markers, but the data is too mixed to read clearly.",
    "A moderate social signal keeps you toward the lower half here.",
    "Regular social app presence. This board doesn't have much to work with.",
  ],
  most_likely_ghost: [
    "Communication apps barely appear in your trace. The ratio is stark.",
    "High overall activity, low comms engagement. The gap is readable.",
    "Moderate balance between activity and communication. Neither dominates.",
    "Comms engagement is present. Not a clean ghosting profile.",
    "The communication signal is solid. The algorithm couldn't build a case.",
  ],
  most_likely_miss_deadline: [
    "Distraction signals outweigh deliverables in the recent trace. The deadline is not winning.",
    "Entertainment and social noise are loud enough to land you near the top.",
    "Mixed signals — some output, but the procrastination pattern still reads clearly.",
    "File activity is present. The algorithm thinks you're cutting it close anyway.",
    "Output signals dominate. This board barely has a case against you.",
  ],
  replaced_by_ai_90_days: [
    "AI tooling dominates the work trace. The algorithm filed a replacement timeline.",
    "Heavy automation footprint with thin human output. You're high on the list.",
    "AI sessions are present but output still registers. Ambiguous, but ranked here.",
    "Some AI use without the full replacement profile. Lower urgency band.",
    "The trace still reads human-first. Automation isn't driving the ranking yet.",
  ],
  least_with_expensive_setup: [
    "Premium hardware signal with underwhelming output. The irony score is maximal.",
    "Expensive kit, modest shipping. The gap is obvious to the model.",
    "Hardware and output are mismatched but not extreme.",
    "Solid output relative to the setup. This board is a stretch.",
    "The trace shows the hardware earning its keep. Wrong board for you.",
  ],
  procrastinate_right_now: [
    "Right now the trace is mostly avoidance. The slump-hour signal is peak.",
    "Entertainment and social detours are active in the live window.",
    "Some work mixed with distraction. The algorithm still calls it procrastination.",
    "Work sessions are competing with the detours. You're mid-pack.",
    "The live trace looks focused. This board doesn't have much on you.",
  ],
  quit_to_countryside: [
    "Exit browsing plus rural-life tabs. The algorithm wrote the fantasy for you.",
    "Job-board and homestead signals are present. You're in the danger zone.",
    "Hints of exit planning without a full countryside dossier.",
    "Work and comms still look engaged. The escape profile is incomplete.",
    "The trace reads committed to the current life. Low countryside probability.",
  ],
  get_hacked_this_month: [
    "Attack surface is wide and defenses are thin. The model is nervous for you.",
    "Missing VPN, messy networks, or risky apps — enough to rank high.",
    "Some risky signals, some countermeasures. Mixed vulnerability.",
    "Basic hygiene is present. Not the easiest target on this board.",
    "The security posture is stronger than the board title suggests.",
  ],
  tracked_by_third_parties: [
    "Browser and social footprint is an open book. Trackers likely already have a dossier.",
    "High visit volume with weak privacy tooling. You're easy to profile.",
    "Moderate tracking exposure. The algorithm still noticed you.",
    "Some privacy habits offset the noise. Mid-tier exposure.",
    "VPN or low-volume browsing keeps you off the worst tier here.",
  ],
  ignoring_system_warnings: [
    "Multiple ignored warnings stacked in the trace. The snooze streak is legendary.",
    "Storage, battery, or security alerts are active and untreated.",
    "A warning or two on file. Not chronic yet, but noticed.",
    "Most systems read healthy. Only minor ignore signals.",
    "The machine looks maintained. This board doesn't stick.",
  ],
  leak_confidential_accident: [
    "Comms, cloud, and sensitive filenames in one trace. Accident waiting to happen.",
    "High share-path surface area. The model is sweating for you.",
    "Some risky patterns without a full leak profile.",
    "Moderate comms with limited sensitive artifacts.",
    "Low mis-send risk in the recent data. Safer tier.",
  ],
  messiest_digital_life: [
    "App sprawl, wifi hoarding, and full storage. The algorithm gave up tidying.",
    "Clutter signals are strong across multiple buckets.",
    "Messy, but not catastrophic. Mid-pack chaos.",
    "Relatively controlled footprint for this board.",
    "The trace reads organized. Wrong leaderboard energy.",
  ],
  havent_left_house: [
    "Home wifi only, minimal outside networks. The hermit signal is clear.",
    "Mostly indoor footprint with weak outdoor mobility markers.",
    "Some out-of-home networks suggest occasional exits.",
    "Wifi diversity implies you do leave. Lower isolation tier.",
    "The mobility trace looks normal. Not housebound by this metric.",
  ],
  talking_to_ais_not_people: [
    "AI sessions dominate human comms. The bots are your social circle.",
    "Heavy AI use with thin people-contact. Ranked accordingly.",
    "Balanced AI and human engagement. Neither extreme.",
    "Comms and social apps still show up often enough.",
    "The trace is people-first. AI isn't driving this ranking.",
  ],
  least_sleep: [
    "Late-night files and no sleep app. The algorithm assumes you're running on fumes.",
    "Strong after-midnight activity with weak recovery signals.",
    "Some late work without a full sleep-debt profile.",
    "Occasional late sessions. Not chronic on this board.",
    "Recovery tooling or calmer hours keep you off the bottom tier.",
  ],
};

/**
 * Returns an atmospheric, board-specific verdict string for the given rank.
 * Does not quote raw signal values — deliberately abstract.
 */
export function atmosphericVerdict(rank, boardId) {
  const templates = ATMOSPHERIC_BY_BOARD[boardId];
  const rankNum = Number(rank);
  const hasRank = Number.isFinite(rankNum) && rankNum >= 1;

  if (!templates) {
    return hasRank
      ? `Your trace placed you at rank ${rankNum} on this board.`
      : 'Your trace was scored on this board, but no rank is assigned yet.';
  }

  if (!hasRank) {
    return 'The system scored your trace on this board, but no rank is assigned yet.';
  }

  const idx = Math.max(0, Math.min(rankNum - 1, templates.length - 1));
  return templates[idx];
}

/**
 * @deprecated — kept for backward compat, prefer atmosphericVerdict
 */
export function composeVerdict({ rank, title }) {
  const cleanTitle = String(title || '').replace(/^top\s+5\s+/i, '');
  return `#${rank} on "${cleanTitle}"`;
}

/**
 * 1–5 ranks → a normalized 0–1 position (rank 1 = 1, rank 5 = 0).
 */
/**
 * Other-users screen: show only the clone's score chip, not "score N · yours M".
 * Leaves descriptive user-row signals (e.g. app counts) unchanged when reused.
 */
export function cloneRationaleSignal(signal) {
  if (signal == null || signal === '') return null;
  const s = String(signal).trim();
  const withoutYours = s.replace(/\s*[·•]\s*yours\s+\d+\s*$/i, '').trim();
  return withoutYours || null;
}

export function rankFraction(rank, totalRanks = 5) {
  if (!Number.isFinite(rank)) return 0;
  return Math.max(0, Math.min(1, (totalRanks - rank) / (totalRanks - 1)));
}
