/** Parse human-readable sizes (e.g. "500 GB", "1.2 TB") to comparable units for %. */
export function parseStorageNumber(val) {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const s = String(val).trim();
  const match = s.match(/^([\d.]+)/);
  if (!match) return NaN;
  const n = parseFloat(match[1]);
  const lower = s.toLowerCase();
  if (lower.includes('tb')) return n * 1e12;
  if (lower.includes('gb')) return n * 1e9;
  if (lower.includes('mb')) return n * 1e6;
  if (lower.includes('kb')) return n * 1e3;
  return n;
}

export function storagePercent(p) {
  const u = p?.storageUsed ?? p?.storage_used;
  const t = p?.storageTotal ?? p?.storage_total;
  if ((u == null || u === '') && (t == null || t === '')) return null;
  const nu = parseStorageNumber(u);
  const nt = parseStorageNumber(t);
  if (!Number.isFinite(nu) || !Number.isFinite(nt) || nt <= 0) return null;
  return Math.min(100, Math.round((nu / nt) * 100));
}

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

export function getGlobalScore(p) {
  if (p?.globalScore != null && Number.isFinite(Number(p.globalScore))) return Number(p.globalScore);
  if (p?.score != null && Number.isFinite(Number(p.score))) return Number(p.score);
  return null;
}

/** "Apple M3 Max" → "M3 Max" */
export function formatChipShort(p) {
  const raw = p?.hardware_chip ?? p?.hardwareChip;
  if (raw == null || raw === '') return '—';
  const s = String(raw).trim();
  return s.replace(/^Apple\s+/i, '');
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

export function activeSinceLabel(p) {
  const raw = p?.uptimeDays ?? p?.uptime_days ?? p?.machineActiveSince ?? p?.machine_active_since;
  if (raw === '' || raw == null) return '—';
  const n = Number(raw);
  if (Number.isFinite(n)) return `${n} day${n === 1 ? '' : 's'}`;
  return String(raw);
}

export function systemLanguagesCount(p) {
  const arr = p?.systemLanguages ?? p?.system_languages ?? p?.languages;
  if (Array.isArray(arr)) return String(arr.length);
  return '—';
}

export function mostUsedAppsLine(p) {
  const arr = p?.mostUsedApps ?? p?.most_used_apps ?? p?.top_apps;
  if (!Array.isArray(arr) || arr.length === 0) return '—';
  return arr
    .map((item) =>
      typeof item === 'string' ? item : item?.name ?? item?.app ?? String(item),
    )
    .join(' · ');
}
