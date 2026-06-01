import { postForPersistence } from './compliantSystemPosts.js';

import { API_ORIGIN } from '@/lib/apiClient.js';
import { isHostedApiOrigin } from '@/lib/aiJobClient.js';
import { hostedAuthHeaders } from '@/lib/hostedAccount.js';

export async function prependPersonaPosts(profileId, posts) {
  const payload = (Array.isArray(posts) ? posts : []).map(postForPersistence);
  if (payload.length === 0) return [];

  const headers = {
    'Content-Type': 'application/json',
    ...(isHostedApiOrigin() ? hostedAuthHeaders() : {}),
  };
  if (isHostedApiOrigin() && !headers.Authorization) {
    return payload;
  }

  const res = await fetch(
    `${API_ORIGIN}/api/profile/${encodeURIComponent(profileId)}/posts/prepend`,
    {
      method: 'POST',
      headers,
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
