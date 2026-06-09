import { API_ORIGIN } from '@/lib/apiClient.js';
import { isHostedApiOrigin } from '@/lib/aiJobClient.js';
import { hostedAuthHeaders } from '@/lib/hostedAccount.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistablePostId(postId) {
  return UUID_RE.test(String(postId || '').trim());
}

export async function postComment({ postId, authorProfileSlug, persona, content }) {
  if (!isHostedApiOrigin()) return null;
  const id = String(postId || '').trim();
  const slug = String(authorProfileSlug || '').trim();
  const text = String(content || '').trim();
  if (!isPersistablePostId(id) || !slug || !text) return null;

  const headers = {
    'Content-Type': 'application/json',
    ...hostedAuthHeaders(),
  };
  if (!headers.Authorization) return null;

  const res = await fetch(`${API_ORIGIN}/api/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      postId: id,
      authorProfileSlug: slug,
      persona,
      content: text,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Comment post failed (${res.status})`);
  }
  const data = await res.json();
  return data?.comment ?? null;
}

export async function fetchCommentsByPostIds(postIds) {
  if (!isHostedApiOrigin()) return {};
  const ids = [...new Set((Array.isArray(postIds) ? postIds : []).map((id) => String(id).trim()))]
    .filter(isPersistablePostId);
  if (ids.length === 0) return {};

  const res = await fetch(
    `${API_ORIGIN}/api/comments?postIds=${encodeURIComponent(ids.join(','))}`,
    { cache: 'no-store' },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Comment fetch failed (${res.status})`);
  }
  const data = await res.json();
  const byPost = data?.commentsByPostId;
  return byPost && typeof byPost === 'object' ? byPost : {};
}
