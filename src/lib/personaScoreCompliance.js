/** Persona score floor — below this, COMPLIANT limits hide + comments. */
export const PERSONA_SCORE_RESTRICT_THRESHOLD = 10;

const UI_PERSONA_KEYS = ['productivity', 'security', 'popularity'];

const PERSONA_TO_UI = {
  productivity: 'productivity',
  productivite: 'productivity',
  security: 'security',
  securite: 'security',
  popularity: 'popularity',
  popularite: 'popularity',
  social: 'popularity',
};

const UI_TO_POST_PERSONA = {
  productivity: 'productivite',
  security: 'securite',
  popularity: 'popularite',
};

const UI_TO_SCORE_KEY = {
  productivity: 'productivity',
  security: 'security',
  popularity: 'social',
};

const POST_PERSONA_ORDER = ['productivite', 'securite', 'popularite'];

export function personaToUiKey(persona) {
  return PERSONA_TO_UI[String(persona ?? '').toLowerCase()] ?? 'productivity';
}

export function uiKeyToPostPersona(uiKey) {
  return UI_TO_POST_PERSONA[uiKey] ?? 'productivite';
}

export function getPersonaScore(adjustedScores, persona) {
  const scoreKey = UI_TO_SCORE_KEY[personaToUiKey(persona)] ?? 'productivity';
  return Math.max(0, Math.min(100, Number(adjustedScores?.[scoreKey]) || 0));
}

export function isPersonaScoreRestricted(adjustedScores, persona) {
  return getPersonaScore(adjustedScores, persona) < PERSONA_SCORE_RESTRICT_THRESHOLD;
}

/** UI keys (productivity | security | popularity) currently below threshold. */
export function getRestrictedUiPersonas(adjustedScores) {
  return UI_PERSONA_KEYS.filter((k) => isPersonaScoreRestricted(adjustedScores, k));
}

/**
 * French post/comment persona keys the user may pick when commenting.
 * If any persona is restricted, only restricted personas are allowed.
 */
export function getAllowedCommentPersonas(adjustedScores) {
  const restricted = getRestrictedUiPersonas(adjustedScores);
  if (restricted.length === 0) return [...POST_PERSONA_ORDER];
  return restricted.map(uiKeyToPostPersona);
}

export function canHideContentForScores(contentPersona, adjustedScores) {
  return !isPersonaScoreRestricted(adjustedScores, contentPersona);
}

export function resolveHideContentPersona(post) {
  if (post?.leaderboard) {
    return post.leaderboard.persona ?? post.persona;
  }
  return post?.persona;
}
