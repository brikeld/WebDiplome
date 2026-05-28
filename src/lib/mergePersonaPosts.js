/** Client-side post list merge — mirrors server/lib/postsMerge.js with system-post awareness. */

export function isCompliantSystemPost(post) {
  return Boolean(post?.compliantPersonaChange || post?.compliantLowScore);
}

export function postIdentityKey(post) {
  if (!post || typeof post !== 'object') return '';
  const id = post.id ?? post._id;
  if (id !== undefined && id !== null && String(id).trim() !== '') {
    return `id:${String(id)}`;
  }
  const createdAt = post.createdAt ?? post.created_at ?? '';
  const content = String(post.content ?? '').trim();
  const persona = String(post.persona ?? '').toLowerCase();
  return `${createdAt}|${persona}|${content.slice(0, 120)}`;
}

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
 * Merge API reload with in-memory profile without dropping COMPLIANT system posts.
 * Regular posts use the longer-list heuristic; system posts are always unioned.
 */
export function mergePersonaPostsFromApi(prevPosts, incomingPosts) {
  const prev = Array.isArray(prevPosts) ? prevPosts : [];
  const incoming = Array.isArray(incomingPosts) ? incomingPosts : [];

  const prevSystem = prev.filter(isCompliantSystemPost);
  const incomingSystem = incoming.filter(isCompliantSystemPost);
  const prevRegular = prev.filter((p) => !isCompliantSystemPost(p));
  const incomingRegular = incoming.filter((p) => !isCompliantSystemPost(p));

  const system = mergePostsPrepend(incomingSystem, prevSystem);
  const regular =
    incomingRegular.length >= prevRegular.length
      ? mergePostsPrepend(incomingRegular, prevRegular)
      : mergePostsPrepend(prevRegular, incomingRegular);

  return mergePostsPrepend(system, regular);
}
