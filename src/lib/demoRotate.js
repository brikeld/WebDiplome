import { isHostedApiOrigin } from '@/lib/aiJobClient.js';
import { displayNameFromProfile } from '@/lib/profileUtils.js';

export const DEMO_ROTATE_OPERATOR_NAME = 'brikeld hoxha';

export function canUseDemoRotateControl(profile) {
  if (!isHostedApiOrigin() || !profile) return false;
  return displayNameFromProfile(profile).trim().toLowerCase() === DEMO_ROTATE_OPERATOR_NAME;
}

export function isDemoRotateTargetProfile(profile) {
  if (!profile) return false;
  return displayNameFromProfile(profile).trim().toLowerCase() !== DEMO_ROTATE_OPERATOR_NAME;
}

export function listDemoRotateTargets(allProfiles) {
  return (Array.isArray(allProfiles) ? allProfiles : []).filter(isDemoRotateTargetProfile);
}
