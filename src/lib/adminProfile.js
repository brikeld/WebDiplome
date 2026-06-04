const DEFAULT_ADMIN_NAME = 'brikeld hoxha';
const DEFAULT_ADMIN_SLUG_PREFIX = 'brikeld-hoxha';

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function displayName(profile) {
  const explicit = normalize(profile?.displayName ?? profile?.display_name);
  if (explicit) return explicit;
  return [profile?.firstname ?? profile?.firstName, profile?.lastname ?? profile?.lastName]
    .map(normalize)
    .filter(Boolean)
    .join(' ');
}

export function isAdminProfile(profile) {
  if (!profile || typeof profile !== 'object') return false;
  const slug = normalize(profile.slug ?? profile.id);
  if (slug.startsWith(DEFAULT_ADMIN_SLUG_PREFIX)) return true;
  return displayName(profile) === DEFAULT_ADMIN_NAME;
}

export function canManuallyGenerateDashboardUpdate(profile) {
  return isAdminProfile(profile);
}
