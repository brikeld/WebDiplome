/**
 * Assemble the comment thread for a post: embedded (seeded) comments replace
 * the generic mock; persisted comments from the API always append at the end.
 */
export function buildThreadComments(post, realComments, getMockCommentsFor) {
  const embedded = Array.isArray(post?.comments) ? post.comments : [];
  const mock = embedded.length > 0 ? [] : getMockCommentsFor(post.id).comments;
  const persisted = Array.isArray(realComments) ? realComments : [];
  return [...mock, ...embedded, ...persisted];
}
