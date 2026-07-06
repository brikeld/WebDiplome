import { resolveApiOrigin } from './apiOrigin.js';
import { isHostedApiOrigin } from './aiJobClient.js';

const SESSION_KEY = 'compliant_web_session';
const OWNED_SLUG_KEY = 'compliant_owned_profile_slug';

const API_ORIGIN = resolveApiOrigin();

function readJson(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  if (typeof window === 'undefined') return;
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Persist Supabase session from Electron (passed once in URL hash). */
export function saveHostedSession(session) {
  if (!session?.access_token) {
    writeJson(SESSION_KEY, null);
    return;
  }
  writeJson(SESSION_KEY, {
    access_token: session.access_token,
    refresh_token: session.refresh_token ?? '',
  });
}

export function readHostedSession() {
  return readJson(SESSION_KEY);
}

export function readLinkedProfileSlug() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(OWNED_SLUG_KEY);
  } catch {
    return null;
  }
}

export function writeLinkedProfileSlug(slug) {
  if (!slug || typeof window === 'undefined') return;
  try {
    localStorage.setItem(OWNED_SLUG_KEY, String(slug));
  } catch {
    /* ignore */
  }
}

export function clearHostedAccountStorage() {
  writeJson(SESSION_KEY, null);
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(OWNED_SLUG_KEY);
  } catch {
    /* ignore */
  }
}

export function hostedAuthHeaders() {
  const token = readHostedSession()?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function shouldResetHostedSessionForProfileMeStatus(status) {
  return Number(status) === 401;
}

/** Read `#access_token=…&refresh_token=…` from Electron “View on web”, then strip hash. */
export function ingestHostedSessionFromHash() {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash?.replace(/^#/, '');
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  if (!accessToken) return false;
  saveHostedSession({
    access_token: accessToken,
    refresh_token: params.get('refresh_token') || '',
  });
  const clean = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', clean);
  return true;
}

export async function refreshHostedSession() {
  const session = readHostedSession();
  if (!session?.refresh_token) return null;
  const res = await fetch(`${API_ORIGIN}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (json?.session?.access_token) {
    saveHostedSession(json.session);
    return json.session;
  }
  return null;
}

/** fetch() with bearer auth; refreshes the Supabase session once on 401. */
export async function fetchWithHostedAuth(url, options = {}) {
  const baseHeaders = options.headers && typeof options.headers === 'object'
    ? options.headers
    : {};
  let res = await fetch(url, {
    ...options,
    headers: { ...baseHeaders, ...hostedAuthHeaders() },
  });
  if (res.status === 401) {
    await refreshHostedSession();
    res = await fetch(url, {
      ...options,
      headers: { ...baseHeaders, ...hostedAuthHeaders() },
    });
  }
  return res;
}

/** Load the profile owned by this browser’s linked Supabase session. */
export async function fetchLinkedProfile() {
  if (!readHostedSession()?.access_token) return null;

  const res = await fetchWithHostedAuth(`${API_ORIGIN}/api/profile/me`);
  if (!res.ok) return null;

  const json = await res.json();
  const profile = json?.profile ?? null;
  const slug = profile?.slug ?? profile?.id;
  if (slug && typeof window !== 'undefined') {
    try {
      localStorage.setItem(OWNED_SLUG_KEY, String(slug));
    } catch {
      /* ignore */
    }
  }
  return profile;
}

export function isHostedAccountLinked() {
  if (!isHostedApiOrigin()) return true;
  return Boolean(readHostedSession()?.access_token);
}

export function isOwnProfileForLinkedAccount(profile, linkedSlug) {
  if (!profile || !linkedSlug) return false;
  const slug = profile.slug ?? profile.id;
  return Boolean(slug && String(slug) === String(linkedSlug));
}

/** Best profile object for the linked account (React state or public directory). */
export function resolveOwnedProfileForFeatures(profile, allProfiles, linkedSlug) {
  if (profile && isOwnProfileForLinkedAccount(profile, linkedSlug)) return profile;
  const list = Array.isArray(allProfiles) ? allProfiles.filter(Boolean) : [];
  if (!linkedSlug || list.length === 0) return profile ?? null;
  return (
    list.find((p) => p?.slug === linkedSlug || p?.id === linkedSlug) ?? profile ?? null
  );
}

/**
 * Interactive AI (Update, comments) on your own profile — not when browsing others.
 * Requires a linked profile slug (from Compliant “View on web” or /api/profile/me).
 */
export function canUseHostedAccountFeatures(
  profile,
  linkedSlug,
  { viewedProfile = null, allProfiles = null } = {},
) {
  if (!isHostedApiOrigin()) return true;
  if (viewedProfile) return false;
  if (!linkedSlug) return false;
  const owned = resolveOwnedProfileForFeatures(profile, allProfiles, linkedSlug);
  return isOwnProfileForLinkedAccount(owned, linkedSlug);
}
