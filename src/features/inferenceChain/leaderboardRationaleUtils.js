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
};

const BOARD_BASELINE = {
  most_productive: 50,
  closest_to_burnout: 40,
  most_likely_change_jobs: 35,
  ignoring_health: 30,
  most_secure: 45,
  most_socially_isolated: 35,
  most_likely_ghost: 40,
};

export const BOARD_DESCRIPTIONS = {
  most_productive: 'Ranks recent work-app activity against time spent in entertainment apps.',
  closest_to_burnout: 'Combines late-night file activity, daytime work load, and absent social breaks.',
  most_likely_change_jobs: 'Job-board traffic, comms-app spikes, and dips in file output drive this board.',
  ignoring_health: 'Erratic schedules plus the absence of a health-tracking app inflate this score.',
  most_secure: 'VPN tooling and a narrow set of known networks lift this score; torrents drag it down.',
  most_socially_isolated: 'Low social-app use and a small wifi footprint push users up this board.',
  most_likely_ghost: 'A small share of comms-app sessions inside otherwise heavy app use.',
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
};

/**
 * Returns an atmospheric, board-specific verdict string for the given rank.
 * Does not quote raw signal values — deliberately abstract.
 */
export function atmosphericVerdict(rank, boardId) {
  const templates = ATMOSPHERIC_BY_BOARD[boardId];
  if (!templates) return `Your trace placed you at rank ${rank} on this board.`;
  const idx = Math.max(0, Math.min(rank - 1, templates.length - 1));
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
