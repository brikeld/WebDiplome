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

/** Stable demo order: alphabetical by display name, then slug (matches client). */
export function sortDemoRotateTargets(profiles) {
  return [...(Array.isArray(profiles) ? profiles : [])]
    .filter(isDemoRotateTargetProfile)
    .sort((a, b) => {
      const byName = profileDisplayName(a).localeCompare(profileDisplayName(b), 'fr', {
        sensitivity: 'base',
      });
      if (byName !== 0) return byName;
      const slugA = String(a?.slug ?? a?.id ?? '');
      const slugB = String(b?.slug ?? b?.id ?? '');
      return slugA.localeCompare(slugB);
    });
}

/**
 * Round-robin slot offset (0=text, 1=asset, 2=chart) so demo users stagger post
 * types instead of all hitting the same slot each cycle.
 */
export function demoSlotOffsetForSlug(slug, profiles) {
  const needle = String(slug || '').trim();
  if (!needle) return 0;
  const ordered = sortDemoRotateTargets(profiles);
  const index = ordered.findIndex(
    (profile) => String(profile?.slug ?? profile?.id ?? '').trim() === needle,
  );
  return index >= 0 ? index : 0;
}
