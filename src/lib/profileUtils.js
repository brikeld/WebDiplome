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

export function formatPostDate(isoOrStr) {
  const d = new Date(isoOrStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

