/** e.g. "3 hours and 47 minutes ago" */
export function formatRelativeTimeAgo(isoOrDate) {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return String(isoOrDate);
  const diff = Math.max(0, Date.now() - d.getTime());
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 45) return 'just now';
  if (min < 60) {
    return min <= 1 ? '1 minute ago' : `${min} minutes ago`;
  }
  if (hr < 24) {
    const m = min % 60;
    const h = hr;
    if (m === 0) return h === 1 ? '1 hour ago' : `${h} hours ago`;
    return `${h} hour${h === 1 ? '' : 's'} and ${m} minute${m === 1 ? '' : 's'} ago`;
  }
  if (day < 14) {
    const h = hr % 24;
    if (h === 0) return day === 1 ? '1 day ago' : `${day} days ago`;
    return `${day} day${day === 1 ? '' : 's'} and ${h} hour${h === 1 ? '' : 's'} ago`;
  }
  return `${day} days ago`;
}

export function initialsFromProfile(p) {
  const a = String(p?.firstname ?? '')
    .trim()
    .charAt(0)
    .toUpperCase();
  const b = String(p?.lastname ?? '')
    .trim()
    .charAt(0)
    .toUpperCase();
  if (a && b) return `${a}${b}`;
  if (a) return a;
  return '?';
}

export function displayNameFromProfile(p) {
  if (p?.firstname && p?.lastname) return `${p.firstname} ${p.lastname}`.trim();
  if (p?.firstname) return String(p.firstname).trim();
  if (p?.lastname) return String(p.lastname).trim();
  return 'User';
}

/** Handle shown in UI, e.g. `@machine-id` (matches server camelCase + snake_case). */
export function machineHandleFromProfile(p) {
  const raw = p?.machineName ?? p?.machine_name;
  const name = raw != null ? String(raw).trim() : '';
  if (name) return `@${name}`;
  return '@—';
}

const PERSONA_ALIAS_TO_UI_KEY = {
  productivity: 'productivity',
  productivite: 'productivity',
  security: 'security',
  securite: 'security',
  popularity: 'popularity',
  popularite: 'popularity',
  social: 'popularity',
};

const PERSONA_BADGE_META = {
  productivity: {
    key: 'productivity',
    label: 'Productivity',
    glyph: 'P',
    color: '#D8D8D8',
  },
  security: {
    key: 'security',
    label: 'Security',
    glyph: 'S',
    color: '#759AEF',
  },
  popularity: {
    key: 'popularity',
    label: 'Social',
    glyph: 'O',
    color: '#CCF847',
  },
};

export function normalizePersonaKey(persona) {
  const key = String(persona ?? '').trim().toLowerCase();
  return PERSONA_ALIAS_TO_UI_KEY[key] ?? null;
}

export function resolveDominantPersonaKey(profile) {
  const explicit = normalizePersonaKey(
    profile?.dominantPersona ?? profile?.dominant_persona ?? profile?.mainPersona ?? profile?.main_persona,
  );
  if (explicit) return explicit;

  const counts = { productivity: 0, security: 0, popularity: 0 };
  const posts = Array.isArray(profile?.personaPosts)
    ? profile.personaPosts
    : Array.isArray(profile?.persona_posts)
      ? profile.persona_posts
      : [];

  for (const post of posts) {
    const key = normalizePersonaKey(post?.persona);
    if (key) counts[key] += 1;
  }

  const order = ['productivity', 'security', 'popularity'];
  const winner = order.reduce((best, key) => (counts[key] > counts[best] ? key : best), 'productivity');
  return counts[winner] > 0 ? winner : 'productivity';
}

export function getPersonaBadgeModel(profileOrPersona) {
  const key =
    typeof profileOrPersona === 'string'
      ? normalizePersonaKey(profileOrPersona) ?? 'productivity'
      : resolveDominantPersonaKey(profileOrPersona ?? {});
  return PERSONA_BADGE_META[key] ?? PERSONA_BADGE_META.productivity;
}

/**
 * Profile bio / summary for the hero: prefers profileSummary, then userDescription.
 * Accepts camelCase or snake_case (as returned from GET or sent on POST).
 */
export function profileBioText(p) {
  if (!p || typeof p !== 'object') return '';
  const summary = p.profileSummary ?? p.profile_summary;
  const desc = p.userDescription ?? p.user_description;
  const pick = (v) => {
    if (v == null) return '';
    const s = String(v).trim();
    return s;
  };
  return pick(summary) || pick(desc);
}

function profilePosts(profile) {
  if (Array.isArray(profile?.personaPosts)) return profile.personaPosts;
  if (Array.isArray(profile?.persona_posts)) return profile.persona_posts;
  return [];
}

export function profilePostCount(profile) {
  return profilePosts(profile).length;
}

export function profileRankingCount(profile) {
  const boardIds = new Set();

  profilePosts(profile).forEach((post, index) => {
    const board = post?.leaderboard;
    if (!board || typeof board !== 'object') return;

    const rank = Number(board.userRank ?? board.user_rank);
    const hasUserRank = Number.isFinite(rank);
    const hasUserEntry = Array.isArray(board.entries) && board.entries.some((entry) => entry?.isUser);
    if (!hasUserRank && !hasUserEntry) return;

    boardIds.add(String(board.boardId ?? board.board_id ?? `leaderboard-${index}`));
  });

  return boardIds.size;
}

export function getGlobalScore(p) {
  if (p?.globalScore != null && Number.isFinite(Number(p.globalScore))) return Number(p.globalScore);
  if (p?.score != null && Number.isFinite(Number(p.score))) return Number(p.score);
  return null;
}

/** 0–100 or null if missing / NaN */
export function clampPercentScore(v) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Math.max(0, Math.min(100, Number(v)));
}

/**
 * Normalize 3 numeric axis scores into integer percentages summing to 100.
 * Uses largest-remainder rounding so totals are stable and deterministic.
 */
export function normalizePersonaPercentTriplet(scores) {
  const p = clampPercentScore(scores?.productivity) ?? 0;
  const s = clampPercentScore(scores?.security) ?? 0;
  const so = clampPercentScore(scores?.social) ?? 0;
  const total = p + s + so;

  // If everything is missing/zero, default to an even split (still sums to 100).
  if (total <= 0) {
    return { productivity: 34, security: 33, social: 33 };
  }

  const raw = [
    { key: 'productivity', value: (p / total) * 100 },
    { key: 'security', value: (s / total) * 100 },
    { key: 'social', value: (so / total) * 100 },
  ];

  const floored = raw.map((r) => ({ ...r, floor: Math.floor(r.value), frac: r.value - Math.floor(r.value) }));
  let remainder = 100 - floored.reduce((acc, r) => acc + r.floor, 0);

  // Distribute remaining points to the biggest fractions.
  floored.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < floored.length && remainder > 0; i += 1) {
    floored[i].floor += 1;
    remainder -= 1;
  }

  const out = { productivity: 0, security: 0, social: 0 };
  for (const r of floored) out[r.key] = r.floor;
  return out;
}

/**
 * Server shape: `personaScores`: { productivity, security, social }.
 * Accepts French aliases; missing axes fall back to globalScore, then 0.
 */
export function getPersonaScoresNormalized(profile) {
  const raw = profile?.personaScores ?? profile?.persona_scores;
  const globalFallback = clampPercentScore(getGlobalScore(profile)) ?? 0;

  const pick = (obj, ...keys) => {
    if (!obj || typeof obj !== 'object') return null;
    for (const key of keys) {
      const c = clampPercentScore(obj[key]);
      if (c != null) return c;
    }
    return null;
  };

  if (raw && typeof raw === 'object') {
    const picked = {
      productivity: pick(raw, 'productivity', 'productivite') ?? globalFallback,
      security: pick(raw, 'security', 'securite') ?? globalFallback,
      social: pick(raw, 'social', 'popularity', 'popularite') ?? globalFallback,
    };
    return normalizePersonaPercentTriplet(picked);
  }

  return normalizePersonaPercentTriplet({
    productivity: globalFallback,
    security: globalFallback,
    social: globalFallback,
  });
}

/** Even split when persona shares sum to 100%. */
const PERSONA_EQUAL_SHARE = 100 / 3;

/**
 * Map a compositional persona % (0–100, shares sum to 100) to ring arc fill (0–100).
 * Displayed labels stay on the true %; only stroke length uses this curve so rings
 * look fuller now that each axis tops out near ~33–50 instead of 100.
 */
export function personaPercentToRingFill(percent) {
  const p = clampPercentScore(percent) ?? 0;
  if (p <= 0) return 0;
  if (p >= 100) return 100;

  const minFill = 28;
  const midFill = 52;
  const equal = PERSONA_EQUAL_SHARE;

  if (p <= equal) {
    const t = p / equal;
    return Math.round(minFill + t * (midFill - minFill));
  }

  const t = (p - equal) / (100 - equal);
  return Math.round(midFill + t * (100 - midFill));
}

/** UI axis `productivity` | `security` | `popularity` → numeric (API uses `social` for social axis). */
export function getPersonaScoreForAxis(profile, axisKey) {
  const s = getPersonaScoresNormalized(profile ?? {});
  const k = String(axisKey || '').toLowerCase();
  if (k === 'productivity') return s.productivity;
  if (k === 'security') return s.security;
  if (k === 'popularity' || k === 'social') return s.social;
  return 0;
}

/** Main score canvas rings: prod / social / sec (visual fill 0–100, not raw %). */
export function getMainScoreRingValues(profile) {
  const s = getPersonaScoresNormalized(profile ?? {});
  return {
    prod: personaPercentToRingFill(s.productivity),
    social: personaPercentToRingFill(s.social),
    sec: personaPercentToRingFill(s.security),
  };
}

/** Center number: prefer `globalScore`; else mean of the three persona scores. */
export function getCenterDisplayScore(profile) {
  const g = getGlobalScore(profile ?? {});
  if (g != null && Number.isFinite(Number(g))) {
    return Math.round(Math.max(0, Math.min(100, Number(g))));
  }
  const s = getPersonaScoresNormalized(profile ?? {});
  return Math.round((s.productivity + s.security + s.social) / 3);
}

export function formatPostDate(isoOrStr) {
  const d = new Date(isoOrStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
