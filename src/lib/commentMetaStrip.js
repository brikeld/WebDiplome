/** Deterministic small hash for mock comment metadata. */
export function hash(str) {
  const s = String(str);
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Same English labels as `PostCard` meta for French persona keys. */
export function personaLabelFromCommentPersona(persona) {
  const key = String(persona ?? '').toLowerCase();
  if (key === 'popularite' || key === 'popularity' || key === 'social') return 'Social';
  if (key === 'securite' || key === 'security') return 'Security';
  if (key === 'productivite' || key === 'productivity') return 'Productivity';
  return 'Social';
}

/** Fake “time ago” until real timestamps exist — stable per post + persona + index. */
export function mockCommentTimeAgo(postId, personaKey, commentIndex) {
  const h = hash(`${postId}|${personaKey}|${commentIndex}|ago`);
  const opts = [
    'just now',
    '2m',
    '7m',
    '14m',
    '1h',
    '3h',
    '6h',
    '11h',
    '1d',
    '2d',
  ];
  const unit = opts[h % opts.length];
  return unit === 'just now' ? unit : `${unit} ago`;
}

/** Stable 1..5 delta like feed posts’ `systemDeltaPct`. */
export function mockCommentSystemDeltaPct(postId, personaKey) {
  return (hash(`${postId}|${personaKey}|delta`) % 5) + 1;
}

export function commentMetaCenterLine(postId, personaKey) {
  const pct = mockCommentSystemDeltaPct(postId, personaKey);
  const label = personaLabelFromCommentPersona(personaKey);
  return `System note [${label}] [+${pct}%]`;
}
