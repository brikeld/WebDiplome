const LS_PREFIX = 'comment-pick|';

function storageKey(postId) {
  return `${LS_PREFIX}${postId}`;
}

export function loadCommentPick(postId) {
  if (!postId) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(postId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCommentPick(postId, suggestion) {
  if (!postId || !suggestion) return;
  try {
    sessionStorage.setItem(storageKey(postId), JSON.stringify(suggestion));
  } catch {
    /* ignore quota */
  }
}

export function clearCommentPick(postId) {
  if (!postId) return;
  try {
    sessionStorage.removeItem(storageKey(postId));
  } catch {
    /* ignore */
  }
}
