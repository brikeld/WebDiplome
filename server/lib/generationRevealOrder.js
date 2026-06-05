export function stampPostForRevealSlot(post, slotIndex, baseTimeMs = Date.now()) {
  if (!post || typeof post !== 'object') return post;
  const index = Number.isFinite(Number(slotIndex)) ? Number(slotIndex) : 0;
  post.createdAt = new Date(baseTimeMs + Math.max(0, index)).toISOString();
  return post;
}

export function stampPostsForRevealSlots(posts, baseTimeMs = Date.now()) {
  return (Array.isArray(posts) ? posts : []).map((post, slotIndex) =>
    stampPostForRevealSlot(post, slotIndex, baseTimeMs),
  );
}
