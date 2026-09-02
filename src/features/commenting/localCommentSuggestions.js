import { hash } from '@/lib/commentMetaStrip.js';

const PERSONA_ORDER = ['productivite', 'securite', 'popularite'];

/** Same three reply options on every post in local demo (no LM Studio). */
export const LOCAL_COMMENT_REPLY_OPTIONS = [
  {
    persona: 'productivite',
    content: 'Solid signal — the cadence here reads as deliberate output, not noise.',
    plusValue: 3,
  },
  {
    persona: 'securite',
    content: 'Worth a quick hygiene pass on what this exposes before it travels further.',
    plusValue: 2,
  },
  {
    persona: 'popularite',
    content: 'This lands well on the feed — confident tone without oversharing.',
    plusValue: 4,
  },
];

function attachPlusValues(postId, suggestions) {
  const base = hash(String(postId));
  return suggestions.map((s, i) => ({
    ...s,
    slotKey: `${s.persona}-${s.slotIndex ?? i}`,
    plusValue:
      Number(s.plusValue) ||
      ((hash(`${postId}|suggestion|${s.persona}|${i}`) + base) % 5) + 1,
  }));
}

/**
 * Fixed local-demo suggestions (one per persona track). Respects score restrictions
 * the same way hosted AI suggestions do.
 */
export function getLocalCommentSuggestions(postId, allowedPersonas) {
  const order =
    Array.isArray(allowedPersonas) && allowedPersonas.length > 0 && allowedPersonas.length < 3
      ? allowedPersonas.map((p) => String(p).toLowerCase())
      : PERSONA_ORDER;

  if (order.length === 1) {
    const persona = order[0];
    const rows = LOCAL_COMMENT_REPLY_OPTIONS.filter((s) => s.persona === persona);
    const triple =
      rows.length >= 3
        ? rows.slice(0, 3)
        : Array.from({ length: 3 }, (_, i) => ({
            ...LOCAL_COMMENT_REPLY_OPTIONS[i % LOCAL_COMMENT_REPLY_OPTIONS.length],
            persona,
            slotIndex: i,
          }));
    return attachPlusValues(postId, triple);
  }

  const byPersona = Object.fromEntries(
    LOCAL_COMMENT_REPLY_OPTIONS.map((s) => [s.persona, s]),
  );
  const ordered = order.map((persona, i) => ({
    ...(byPersona[persona] ?? LOCAL_COMMENT_REPLY_OPTIONS[i]),
    persona,
    slotIndex: i,
  }));
  return attachPlusValues(postId, ordered);
}
