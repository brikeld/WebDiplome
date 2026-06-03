import { clearStoredProfileSlug } from '@/lib/profileSlugStorage.js';
import { clearLowScoreFiredForProfile } from '@/lib/compliantLowScoreStorage.js';
import { clearPersonaBlurbs } from '@/features/personaBlurbs/personaBlurbsStorage.js';
import { clearAllLiveScoringStorage } from '@/lib/liveScoringStorage.js';
import { clearHostedAccountStorage } from '@/lib/hostedAccount.js';

/** Strip hosted signup suffix: `brikeld-hoxha-abc123` → `brikeld-hoxha`. */
export function profileSlugBase(slug) {
  const s = String(slug ?? '').trim().toLowerCase();
  if (!s) return '';
  const m = s.match(/^(.+)-[a-f0-9]{6,}$/i);
  return m ? m[1] : s;
}

export function slugsReferToSameAccount(a, b) {
  const left = String(a ?? '').trim();
  const right = String(b ?? '').trim();
  if (!left || !right) return false;
  if (left === right) return true;
  const baseA = profileSlugBase(left);
  const baseB = profileSlugBase(right);
  return baseA !== '' && baseA === baseB;
}

/** True when this exact browser slug was removed. */
export function isProfileSlugDeleted(slug, deletedProfileIds) {
  const needle = String(slug ?? '').trim();
  if (!needle || !Array.isArray(deletedProfileIds)) return false;
  return deletedProfileIds.some((id) => needle === String(id ?? '').trim());
}

/** Drop profiles the server marked deleted (prevents ghost feed rows). */
export function filterProfilesNotDeleted(profiles, deletedProfileIds) {
  const list = Array.isArray(profiles) ? profiles.filter(Boolean) : [];
  if (!Array.isArray(deletedProfileIds) || deletedProfileIds.length === 0) return list;
  return list.filter((p) => {
    const slug = p?.slug ?? p?.id ?? null;
    return !isProfileSlugDeleted(slug, deletedProfileIds);
  });
}

/**
 * Wipe browser-owned profile state after account deletion.
 * @param {{ profileId?: string|null, clearSession?: boolean }} opts
 */
export function purgeClientAccountState({ profileId = null, clearSession = true } = {}) {
  if (clearSession) clearHostedAccountStorage();
  clearStoredProfileSlug();
  if (profileId) {
    clearLowScoreFiredForProfile(profileId);
    clearPersonaBlurbs(profileId);
  }
  clearAllLiveScoringStorage();
}
