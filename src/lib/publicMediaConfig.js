import { resolveApiOrigin } from './apiOrigin.js';
import { UPLOADS_PUBLIC_BUCKET } from './uploadPublicUrl.js';

let cached = null;
let loadPromise = null;

export function getPublicMediaConfig() {
  return cached;
}

export function setPublicMediaConfig(config) {
  if (!config?.supabaseUrl) {
    cached = null;
    return;
  }
  cached = {
    supabaseUrl: String(config.supabaseUrl).replace(/\/$/, ''),
    uploadsBucket: config.uploadsBucket || UPLOADS_PUBLIC_BUCKET,
  };
}

/** Infer Supabase project URL from an already-resolved profile wallpaper URL. */
export function inferPublicMediaConfigFromProfiles(profiles) {
  if (cached?.supabaseUrl || !Array.isArray(profiles)) return;
  for (const profile of profiles) {
    const url = profile?.wallpaperUrl ?? profile?.wallpaper_url ?? null;
    if (!url || !/^https:\/\//i.test(String(url))) continue;
    const match = String(url).match(/^(https:\/\/[^/]+)\/storage\/v1\/object\/public\//i);
    if (match) {
      setPublicMediaConfig({ supabaseUrl: match[1], uploadsBucket: UPLOADS_PUBLIC_BUCKET });
      return;
    }
  }
}

export async function ensurePublicMediaConfig(apiOrigin = resolveApiOrigin()) {
  if (cached?.supabaseUrl) return cached;

  const envUrl = import.meta.env?.VITE_SUPABASE_URL;
  if (envUrl) {
    setPublicMediaConfig({ supabaseUrl: envUrl, uploadsBucket: UPLOADS_PUBLIC_BUCKET });
    return cached;
  }

  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const res = await fetch(`${apiOrigin}/api/public-config`);
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.supabaseUrl) {
          setPublicMediaConfig(json);
        }
      }
    } catch {
      /* offline / local-only */
    } finally {
      loadPromise = null;
    }
    return cached;
  })();

  return loadPromise;
}
