import { uiKeyToPostPersona } from './personaScoreCompliance.js';

const PERSONA_LABELS = {
  productivity: 'Productivity',
  security: 'Security',
  popularity: 'Social',
};

/** Strip enter animation flags before writing to posts/{id}.json */
export function postForPersistence(post) {
  if (!post || typeof post !== 'object') return post;
  const { _feedEnter, ...rest } = post;
  return rest;
}

export function hasLowScorePostForPersona(posts, uiPersonaKey) {
  if (!uiPersonaKey || !Array.isArray(posts)) return false;
  return posts.some((p) => p?.compliantLowScore?.uiPersonaKey === uiPersonaKey);
}

export function createCompliantPersonaChangePost({
  profile,
  fromPersona,
  toPersona,
  userDisplayName,
}) {
  const fromProfile = [profile?.firstname, profile?.lastname].filter(Boolean).join(' ').trim();
  const name = userDisplayName ?? (fromProfile || 'User');
  const fromLabel = PERSONA_LABELS[fromPersona] ?? 'Unknown';
  const toLabel = PERSONA_LABELS[toPersona] ?? 'Unknown';
  const createdAt = Date.now();

  return {
    id: `compliant-persona-change-${createdAt}-${fromPersona}-${toPersona}`,
    persona: toPersona,
    createdAt,
    content: `Due to behavior on COMPLIANT, ${name}'s main persona changed from ${fromLabel} to ${toLabel}.`,
    compliantPersonaChange: {
      fromPersona,
      toPersona,
      userDisplayName: name,
      fromLabel,
      toLabel,
    },
    _feedEnter: true,
    _feedKey: `compliant-persona-change-${createdAt}`,
    _feedRevealSeq: createdAt,
  };
}

function lowScoreCopy(label, score, userDisplayName) {
  return (
    `COMPLIANT notice for ${userDisplayName}: your ${label.toLowerCase()} score is at ${score}%. ` +
    'That is below the minimum the system expects. Some features are limited until you improve this persona.'
  );
}

export function createCompliantLowScorePost({ profile, uiPersonaKey, score, userDisplayName }) {
  const personaLabel = PERSONA_LABELS[uiPersonaKey] ?? 'Social';
  const rounded = Math.round(Math.max(0, Math.min(100, Number(score) || 0)));
  const createdAt = Date.now();
  const postPersona = uiKeyToPostPersona(uiPersonaKey);

  return {
    id: `compliant-low-score-${createdAt}-${uiPersonaKey}`,
    persona: postPersona,
    createdAt,
    content: lowScoreCopy(personaLabel, rounded, userDisplayName),
    compliantLowScore: {
      uiPersonaKey,
      personaLabel,
      score: rounded,
      userDisplayName,
    },
    _feedEnter: true,
    _feedKey: `compliant-low-score-${createdAt}-${uiPersonaKey}`,
    _feedRevealSeq: createdAt,
  };
}
