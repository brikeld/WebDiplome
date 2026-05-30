const STORAGE_KEY = 'compliant_profile_slug';

/** Slug from `?profile=` (persisted) or localStorage — links Electron sync to the web app. */
export function readStoredProfileSlug() {
  if (typeof window === 'undefined') return null;

  const fromUrl = new URLSearchParams(window.location.search).get('profile');
  if (fromUrl) {
    const trimmed = fromUrl.trim();
    if (trimmed) {
      try {
        localStorage.setItem(STORAGE_KEY, trimmed);
      } catch {
        /* ignore quota errors */
      }
      return trimmed;
    }
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

/** Pick the profile to treat as "yours" on the landing page. */
export function resolveOwnedLandingProfile(profiles) {
  const list = Array.isArray(profiles) ? profiles.filter(Boolean) : [];
  if (list.length === 0) return null;

  const slug = readStoredProfileSlug();
  if (slug) {
    const found = list.find((p) => p?.slug === slug || p?.id === slug);
    if (found) return found;
  }

  // Small demo: one public profile → treat as the visitor's profile.
  if (list.length === 1) return list[0];

  return null;
}
