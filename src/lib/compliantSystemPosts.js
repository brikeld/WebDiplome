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

function postCreatedAtMs(post) {
  const v = post?.createdAt ?? post?.created_at ?? 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.getTime() : 0;
}

export function shouldCreateLowScorePostOnce(posts, firedPersonas, uiPersonaKey) {
  if (!uiPersonaKey) return false;
  if (hasLowScorePostForPersona(posts, uiPersonaKey)) return false;
  const fired = Array.isArray(firedPersonas) ? firedPersonas.map(String) : [];
  return !fired.includes(String(uiPersonaKey));
}

export function shouldCreatePersonaChangePost(posts, fromPersona, toPersona) {
  if (!fromPersona || !toPersona || fromPersona === toPersona) return false;
  if (!Array.isArray(posts)) return true;

  let latest = null;
  let latestMs = -1;
  for (const p of posts) {
    if (!p?.compliantPersonaChange) continue;
    const ms = postCreatedAtMs(p);
    if (ms > latestMs) {
      latest = p;
      latestMs = ms;
    }
  }

  return latest?.compliantPersonaChange?.toPersona !== toPersona;
}

export function findLowScorePostForPersona(posts, uiPersonaKey) {
  if (!uiPersonaKey || !Array.isArray(posts)) return null;
  return posts.find((p) => p?.compliantLowScore?.uiPersonaKey === uiPersonaKey) ?? null;
}

export function hasCompliantJoinPost(posts) {
  if (!Array.isArray(posts)) return false;
  return posts.some((p) => p?.compliantJoin);
}

/** Remove prior low-score notices for one persona before prepending a fresh one. */
export function stripLowScorePostsForPersona(posts, uiPersonaKey) {
  if (!uiPersonaKey || !Array.isArray(posts)) return posts ?? [];
  return posts.filter((p) => p?.compliantLowScore?.uiPersonaKey !== uiPersonaKey);
}

function joinCopy(userDisplayName) {
  return (
    `COMPLIANT notice for ${userDisplayName}: this profile is now active on the platform. ` +
    'Machine data from their device has been linked to their public identity.'
  );
}

export function createCompliantJoinPost({
  profile,
  userDisplayName,
  dominantPersona,
  createdAt: createdAtOverride,
}) {
  const fromProfile = [profile?.firstname, profile?.lastname].filter(Boolean).join(' ').trim();
  const name = userDisplayName ?? (fromProfile || 'User');
  const persona = dominantPersona ?? profile?.dominantPersona ?? 'productivity';
  const createdAt = Number(createdAtOverride) || Date.now();

  return {
    id: `compliant-join-${createdAt}`,
    persona,
    createdAt,
    content: joinCopy(name),
    compliantJoin: {
      userDisplayName: name,
    },
    _feedEnter: true,
    _feedKey: `compliant-join-${createdAt}`,
    _feedRevealSeq: createdAt,
  };
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
