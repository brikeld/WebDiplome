const STORAGE_KEY = 'compliant_profile_slug';

/** Slug from `?profile=` in the current URL only (navigation hint, not ownership). */
export function readViewProfileSlugFromUrl() {
  if (typeof window === 'undefined') return null;
  const fromUrl = new URLSearchParams(window.location.search).get('profile');
  if (!fromUrl) return null;
  const trimmed = fromUrl.trim();
  return trimmed || null;
}

/** Slug from `?profile=` (persisted) or localStorage — legacy deep-link helper. */
export function readStoredProfileSlug() {
  if (typeof window === 'undefined') return null;

  const fromUrl = readViewProfileSlugFromUrl();
  if (fromUrl) {
    try {
      localStorage.setItem(STORAGE_KEY, fromUrl);
    } catch {
      /* ignore quota errors */
    }
    return fromUrl;
  }

  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function persistProfileSlug(slug) {
  if (!slug || typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, String(slug).trim());
  } catch {
    /* ignore */
  }
}

export function clearStoredProfileSlug() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Pick the profile owned by this browser (linked account slug only). */
export function resolveOwnedLandingProfile(profiles, linkedSlug = null) {
  const list = Array.isArray(profiles) ? profiles.filter(Boolean) : [];
  if (list.length === 0 || !linkedSlug) return null;

  return list.find((p) => p?.slug === linkedSlug || p?.id === linkedSlug) ?? null;
}
