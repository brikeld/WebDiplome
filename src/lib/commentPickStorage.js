const LS_PREFIX = 'comment-pick|';

function storageKey(viewerSlug, postId) {
  const viewer = String(viewerSlug || 'anonymous').trim() || 'anonymous';
  const post = String(postId || '').trim();
  if (!post) return null;
  return `${LS_PREFIX}${viewer}|${post}`;
}

export function loadCommentPick(viewerSlug, postId) {
  const key = storageKey(viewerSlug, postId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCommentPick(viewerSlug, postId, suggestion) {
  const key = storageKey(viewerSlug, postId);
  if (!key || !suggestion) return;
  try {
    localStorage.setItem(key, JSON.stringify(suggestion));
  } catch {
    /* ignore quota */
  }
}

export function clearCommentPick(viewerSlug, postId) {
  const key = storageKey(viewerSlug, postId);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Legacy session-only picks (pre viewer scoping). */
export function migrateLegacyCommentPick(viewerSlug, postId) {
  if (!postId) return null;
  try {
    const legacyKey = `comment-pick|${postId}`;
    const raw = sessionStorage.getItem(legacyKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      saveCommentPick(viewerSlug, postId, parsed);
      sessionStorage.removeItem(legacyKey);
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}
