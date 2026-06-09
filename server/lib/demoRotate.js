export const DEMO_ROTATE_OPERATOR_NAME = 'brikeld hoxha';

export function profileDisplayName(profile) {
  if (!profile || typeof profile !== 'object') return '';
  const explicit = String(profile.displayName ?? profile.display_name ?? '').trim();
  if (explicit) return explicit;
  const first = String(profile.firstname ?? profile.first_name ?? '').trim();
  const last = String(profile.lastname ?? profile.last_name ?? '').trim();
  return `${first} ${last}`.trim();
}

export function isDemoRotateOperator(profile) {
  return profileDisplayName(profile).trim().toLowerCase() === DEMO_ROTATE_OPERATOR_NAME;
}

export function isDemoRotateTargetProfile(profile) {
  return profileDisplayName(profile).trim().toLowerCase() !== DEMO_ROTATE_OPERATOR_NAME;
}
