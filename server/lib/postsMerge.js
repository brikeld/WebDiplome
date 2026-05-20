/** Shared post-list merge helpers — used by server.js and server-generate.js */

export function postIdentityKey(post) {
  if (!post || typeof post !== 'object') return '';
  const createdAt = post.createdAt ?? post.created_at ?? '';
  const content = String(post.content ?? '').trim();
  const persona = String(post.persona ?? '').toLowerCase();
  return `${createdAt}|${persona}|${content.slice(0, 120)}`;
}

/** Prepend new posts before baseline; dedupe by identity key. */
export function mergePostsPrepend(newPosts, baselinePosts) {
  const incoming = Array.isArray(newPosts) ? newPosts.filter(Boolean) : [];
  const baseline = Array.isArray(baselinePosts) ? baselinePosts.filter(Boolean) : [];
  const seen = new Set();
  const merged = [];
  for (const p of [...incoming, ...baseline]) {
    const key = postIdentityKey(p);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(p);
  }
  return merged;
}

/**
 * Append new posts to baseline. If dedupe would not grow the list, force-prepend
 * the incoming posts anyway (generation must never drop older entries).
 */
export function appendPostsForceGrow(newPosts, baselinePosts) {
  const incoming = Array.isArray(newPosts) ? newPosts.filter(Boolean) : [];
  const baseline = Array.isArray(baselinePosts) ? baselinePosts.filter(Boolean) : [];
  if (incoming.length === 0) return baseline;

  const merged = mergePostsPrepend(incoming, baseline);
  if (merged.length > baseline.length) return merged;

  const seen = new Set(baseline.map(postIdentityKey));
  const forced = [...incoming];
  for (const p of baseline) {
    const key = postIdentityKey(p);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    forced.push(p);
  }
  return forced;
}
