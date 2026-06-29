import { isHostedApiOrigin } from '@/lib/aiJobClient.js';
import { displayNameFromProfile } from '@/lib/profileUtils.js';

export const DEMO_ROTATE_OPERATOR_NAME = 'brikeld hoxha';

export function canUseDemoRotateControl(profile) {
  if (!isHostedApiOrigin() || !profile) return false;
  return displayNameFromProfile(profile).trim().toLowerCase() === DEMO_ROTATE_OPERATOR_NAME;
}

/**
 * Gate for the "demo video" control. Local development can show the control for
 * quick recording, while production restricts it to the demo operator; the API
 * route enforces the same operator check before queueing hosted worker jobs.
 */
export function canUseDemoVideoControl(profile) {
  if (!isHostedApiOrigin()) return true;
  return canUseDemoRotateControl(profile);
}

export function isDemoRotateTargetProfile(profile) {
  if (!profile) return false;
  return displayNameFromProfile(profile).trim().toLowerCase() !== DEMO_ROTATE_OPERATOR_NAME;
}

export function listDemoRotateTargets(allProfiles) {
  const targets = (Array.isArray(allProfiles) ? allProfiles : []).filter(isDemoRotateTargetProfile);
  return targets.sort((a, b) => {
    const nameA = displayNameFromProfile(a);
    const nameB = displayNameFromProfile(b);
    const byName = nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
    if (byName !== 0) return byName;
    const slugA = String(a?.slug ?? a?.id ?? '');
    const slugB = String(b?.slug ?? b?.id ?? '');
    return slugA.localeCompare(slugB);
  });
}
