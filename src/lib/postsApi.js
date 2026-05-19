const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3001';

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
