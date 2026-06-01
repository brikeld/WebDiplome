/** Fresh personaPosts from the last API reload (not the client display list). */
export const API_PERSONA_POSTS = Symbol('apiPersonaPosts');

export function attachApiPersonaPosts(profile, apiPersonaPosts) {
  if (!profile || typeof profile !== 'object') return profile;
  return Object.defineProperty(profile, API_PERSONA_POSTS, {
    value: Array.isArray(apiPersonaPosts) ? apiPersonaPosts : [],
    enumerable: false,
    configurable: true,
  });
}

export function readApiPersonaPosts(profile) {
  if (!profile || typeof profile !== 'object') return [];
  return profile[API_PERSONA_POSTS] ?? profile.personaPosts ?? [];
}

/**
 * Merge profile fields from API while keeping the current on-screen post list.
 */
export function mergeProfilePreservePosts(prev, incoming) {
  if (!incoming) return prev ?? null;
  if (!prev) return incoming;
  return { ...incoming, personaPosts: prev.personaPosts ?? [] };
}
