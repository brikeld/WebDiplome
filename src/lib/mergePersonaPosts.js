/** Client-side post list merge — mirrors server/lib/postsMerge.js with system-post awareness. */

export function isCompliantJoinPost(post) {
  return Boolean(post?.compliantJoin);
}

export function isCompliantSystemPost(post) {
  return Boolean(post?.compliantPersonaChange || post?.compliantLowScore || post?.compliantJoin);
}

export function isCompliantPersonaChangePost(post) {
  return Boolean(post?.compliantPersonaChange);
}

export function isCompliantLowScorePost(post) {
  return Boolean(post?.compliantLowScore);
}

function postCreatedAtMs(post) {
  const v = post?.createdAt ?? post?.created_at ?? 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.getTime() : 0;
}

/** At most one COMPLIANT persona-change post — keeps the newest by createdAt. */
export function keepLatestPersonaChangePostOnly(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return posts ?? [];

  let latest = null;
  let latestMs = -1;
  for (const p of posts) {
    if (!isCompliantPersonaChangePost(p)) continue;
    const ms = postCreatedAtMs(p);
    if (ms > latestMs) {
      latestMs = ms;
      latest = p;
    }
  }
  if (!latest) return posts;

  const latestKey = postIdentityKey(latest);
  return posts.filter((p) => !isCompliantPersonaChangePost(p) || postIdentityKey(p) === latestKey);
}

/** At most one COMPLIANT join notice — keeps the newest by createdAt. */
export function keepLatestJoinPostOnly(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return posts ?? [];

  let latest = null;
  let latestMs = -1;
  for (const p of posts) {
    if (!isCompliantJoinPost(p)) continue;
    const ms = postCreatedAtMs(p);
    if (ms > latestMs) {
      latestMs = ms;
      latest = p;
    }
  }
  if (!latest) return posts;

  const latestKey = postIdentityKey(latest);
  return posts.filter((p) => !isCompliantJoinPost(p) || postIdentityKey(p) === latestKey);
}

/** At most one low-score notice per UI persona — keeps the newest by createdAt. */
export function keepLatestLowScorePostPerPersona(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return posts ?? [];

  const latestByUi = new Map();
  for (const p of posts) {
    const ui = p?.compliantLowScore?.uiPersonaKey;
    if (!ui) continue;
    const ms = postCreatedAtMs(p);
    const prev = latestByUi.get(ui);
    if (!prev || ms > postCreatedAtMs(prev)) latestByUi.set(ui, p);
  }
  if (latestByUi.size === 0) return posts;

  return posts.filter((p) => {
    const ui = p?.compliantLowScore?.uiPersonaKey;
    if (!ui) return true;
    const latest = latestByUi.get(ui);
    return latest && postIdentityKey(p) === postIdentityKey(latest);
  });
}

function dedupeCompliantSystemPosts(posts) {
  return keepLatestLowScorePostPerPersona(
    keepLatestPersonaChangePostOnly(keepLatestJoinPostOnly(posts)),
  );
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
  return dedupeCompliantSystemPosts(merged);
}

/**
 * Merge API reload with in-memory profile without dropping COMPLIANT system posts.
 * Regular posts use the longer-list heuristic; system posts are always unioned.
 *
 * When the server returns an empty post list, treat it as authoritative (account
 * delete / wiped posts) — never resurrect stale client posts.
 */
export function mergePersonaPostsFromApi(prevPosts, incomingPosts) {
  const prev = Array.isArray(prevPosts) ? prevPosts : [];
  if (incomingPosts === undefined) return dedupeCompliantSystemPosts(prev);
  const incoming = Array.isArray(incomingPosts) ? incomingPosts : [];

  if (incoming.length === 0) {
    return dedupeCompliantSystemPosts(incoming);
  }

  const prevSystem = prev.filter(isCompliantSystemPost);
  const incomingSystem = incoming.filter(isCompliantSystemPost);
  const prevRegular = prev.filter((p) => !isCompliantSystemPost(p));
  const incomingRegular = incoming.filter((p) => !isCompliantSystemPost(p));

  const system = mergePostsPrepend(incomingSystem, prevSystem);
  const regular =
    incomingRegular.length === 0
      ? []
      : prevRegular.length > incomingRegular.length
        ? incomingRegular
        : mergePostsPrepend(incomingRegular, prevRegular);

  return dedupeCompliantSystemPosts(mergePostsPrepend(system, regular));
}
