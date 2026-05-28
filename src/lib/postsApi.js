import { postForPersistence } from './compliantSystemPosts.js';

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3001';

export async function prependPersonaPosts(profileId, posts) {
  const payload = (Array.isArray(posts) ? posts : []).map(postForPersistence);
  if (payload.length === 0) return [];

  const res = await fetch(
    `${API_ORIGIN}/api/profile/${encodeURIComponent(profileId)}/posts/prepend`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts: payload }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Prepend failed (${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data?.posts) ? data.posts : payload;
}

export async function deletePost(profileId, createdAt) {
  const res = await fetch(`${API_ORIGIN}/api/posts/${encodeURIComponent(profileId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ createdAt }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Delete failed (${res.status})`);
  }
  return res.json();
}
