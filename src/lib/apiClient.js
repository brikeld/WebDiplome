export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3001';

export async function fetchJson(path, options = {}) {
  const res = await fetch(`${API_ORIGIN}${path}`, options);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json;
}

export async function fetchProfiles() {
  return fetchJson('/api/profiles');
}

export async function fetchProfile(slug) {
  return fetchJson(`/api/profiles/${encodeURIComponent(slug)}`);
}

export async function fetchLatestMacRelease() {
  return fetchJson('/api/app-releases/latest?platform=mac');
}
