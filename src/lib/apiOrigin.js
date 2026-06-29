/** Hosted API used when the SPA is deployed but VITE_* was not set at build time. */
export const DEFAULT_HOSTED_API_ORIGIN = 'https://webdiplome-production.up.railway.app';

export function resolveApiOrigin() {
  const fromEnv = import.meta.env.VITE_API_ORIGIN;
  if (fromEnv) return String(fromEnv).replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return DEFAULT_HOSTED_API_ORIGIN;
    }
  }

  return 'http://localhost:3001';
}

export function resolveGenerateApiOrigin() {
  const fromEnv = import.meta.env.VITE_GENERATE_API_ORIGIN;
  if (fromEnv) return String(fromEnv).replace(/\/$/, '');
  return resolveApiOrigin();
}

/**
 * Origin for the LOCAL demo-video generator endpoint. This is a local-only tool
 * (the `/api/demo-video/generate-post` route + the videoDEMO assets live only on
 * the dev machine), so it always targets the local generator on :3010 — never the
 * hosted API or server.js (:3001) — regardless of how the general API origin is
 * configured. Override with VITE_DEMO_VIDEO_GENERATE_ORIGIN if the generator runs
 * on a non-default port.
 */
export function resolveDemoVideoGenerateOrigin() {
  const fromEnv = import.meta.env.VITE_DEMO_VIDEO_GENERATE_ORIGIN;
  if (fromEnv) return String(fromEnv).replace(/\/$/, '');
  return 'http://localhost:3010';
}
