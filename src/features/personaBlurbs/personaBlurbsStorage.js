const LS_PREFIX = 'persona-blurbs|';

function storageKey(profileId) {
  return `${LS_PREFIX}${profileId}`;
}

export function loadPersonaBlurbs(profileId) {
  if (!profileId) return null;
  try {
    const raw = localStorage.getItem(storageKey(profileId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePersonaBlurbs(profileId, blurbs) {
  if (!profileId || !blurbs) return;
  try {
    localStorage.setItem(storageKey(profileId), JSON.stringify(blurbs));
  } catch {
    /* ignore quota */
  }
}

export function clearPersonaBlurbs(profileId) {
  if (!profileId) return;
  try {
    localStorage.removeItem(storageKey(profileId));
  } catch {
    /* ignore */
  }
}

export function profileIdFromProfile(profile) {
  if (!profile) return '';
  if (profile.id) return String(profile.id);
  const first = profile.firstname ?? profile.firstName ?? '';
  const last = profile.lastname ?? profile.lastName ?? '';
  const slug = `${first}-${last}`.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-');
  return slug.replace(/^-|-$/g, '') || 'profile';
}
