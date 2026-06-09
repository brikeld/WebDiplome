/** @returns {string|null} */
export function leaderboardBoardIdFromPost(post) {
  const id = post?.leaderboard?.boardId ?? post?.leaderboard?.board_id;
  const text = String(id ?? '').trim();
  return text || null;
}

/**
 * Feed is newest-first: keep the first (newest) post per leaderboard board.
 */
export function dedupeLeaderboardPostsNewestOnly(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return [];
  const seenBoards = new Set();
  const out = [];
  for (const post of posts) {
    const boardId = leaderboardBoardIdFromPost(post);
    if (!boardId) {
      out.push(post);
      continue;
    }
    if (seenBoards.has(boardId)) continue;
    seenBoards.add(boardId);
    out.push(post);
  }
  return out;
}
