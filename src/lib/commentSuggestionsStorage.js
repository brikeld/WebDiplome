const LS_PREFIX = 'comment-suggestions|';

function storageKey(viewerSlug, postId) {
  const viewer = String(viewerSlug || 'anonymous').trim() || 'anonymous';
  const post = String(postId || '').trim();
  if (!post) return null;
  return `${LS_PREFIX}${viewer}|${post}`;
}

export function loadCommentSuggestions(viewerSlug, postId) {
  const key = storageKey(viewerSlug, postId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCommentSuggestions(viewerSlug, postId, suggestions) {
  const key = storageKey(viewerSlug, postId);
  if (!key || !Array.isArray(suggestions)) return;
  try {
    localStorage.setItem(key, JSON.stringify(suggestions));
  } catch {
    /* ignore quota */
  }
}

export function clearCommentSuggestions(viewerSlug, postId) {
  const key = storageKey(viewerSlug, postId);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
