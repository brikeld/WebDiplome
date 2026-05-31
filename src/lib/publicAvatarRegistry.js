/** Slug → absolute avatar URL, refreshed whenever GET /api/profiles succeeds. */

let bySlug = Object.create(null);

export function pickProfileMediaUrl(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const candidates = [
    profile.avatarUrl,
    profile.avatar_url,
    profile.wallpaperUrl,
    profile.wallpaper_url,
    profile.avatarSrc,
    profile.avatar_src,
  ];
  for (const value of candidates) {
    if (value == null || value === '') continue;
    const raw = String(value).trim();
    if (!raw || raw === 'null' || raw === 'undefined') continue;
    if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  }
  return null;
}

export function ingestProfileAvatars(profiles) {
  const next = Object.create(null);
  for (const profile of Array.isArray(profiles) ? profiles : []) {
    const slug = profile?.slug ?? profile?.id ?? null;
    const url = pickProfileMediaUrl(profile);
    if (slug && url) next[String(slug)] = url;
  }
  bySlug = next;
}

export function avatarUrlForSlug(slug) {
  if (slug == null || slug === '') return null;
  return bySlug[String(slug)] ?? null;
}

export function normalizeProfilesFromApi(profiles) {
  return (Array.isArray(profiles) ? profiles : []).map((profile) => {
    if (!profile || typeof profile !== 'object') return profile;
    const url = pickProfileMediaUrl(profile);
    if (!url) return profile;
    return {
      ...profile,
      avatarUrl: url,
      wallpaperUrl: profile.wallpaperUrl ?? profile.wallpaper_url ?? url,
    };
  });
}
