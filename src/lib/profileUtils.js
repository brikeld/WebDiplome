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
    return {
      productivity: pick(raw, 'productivity', 'productivite') ?? globalFallback,
      security: pick(raw, 'security', 'securite') ?? globalFallback,
      social: pick(raw, 'social', 'popularity', 'popularite') ?? globalFallback,
    };
  }

  return {
    productivity: globalFallback,
    security: globalFallback,
    social: globalFallback,
  };
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

/** Main score canvas rings: prod / social / sec */
export function getMainScoreRingValues(profile) {
  const s = getPersonaScoresNormalized(profile ?? {});
  return {
    prod: s.productivity,
    social: s.social,
    sec: s.security,
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

