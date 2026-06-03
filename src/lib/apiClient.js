import { resolveApiOrigin } from './apiOrigin.js';

export { resolveApiOrigin, resolveGenerateApiOrigin, DEFAULT_HOSTED_API_ORIGIN } from './apiOrigin.js';

export const API_ORIGIN = resolveApiOrigin();

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
  try {
    return await fetchJson('/api/app-releases/latest?platform=mac');
  } catch {
    return null;
  }
}
