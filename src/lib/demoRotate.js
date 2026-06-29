import { isHostedApiOrigin } from '@/lib/aiJobClient.js';
import { displayNameFromProfile } from '@/lib/profileUtils.js';

export const DEMO_ROTATE_OPERATOR_NAME = 'brikeld hoxha';

export function canUseDemoRotateControl(profile) {
  if (!isHostedApiOrigin() || !profile) return false;
  return displayNameFromProfile(profile).trim().toLowerCase() === DEMO_ROTATE_OPERATOR_NAME;
}

/**
 * Gate for the "demo video" control. The generator endpoint + videoDEMO assets
 * live on the LOCAL machine (server-generate.js :3010), but the web app can be
 * opened either on localhost OR on the deployed site driving that local
 * generator (Chrome allows https→http://localhost). So: always available on
 * localhost, and available to the operator on a hosted origin too.
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
