import { resolveUploadAssetUrl, UPLOADS_PUBLIC_BUCKET } from '../../src/lib/uploadPublicUrl.js';
import { serverConfig } from './env.js';

/** Resolve relative /uploads paths and bare hashes to Supabase public URLs when hosted. */
export function resolveHostedPublicUrl(urlOrFilename) {
  return resolveUploadAssetUrl(urlOrFilename, {
    supabaseUrl: serverConfig.supabaseUrl,
    apiOrigin: serverConfig.publicBaseUrl,
    uploadsBucket: UPLOADS_PUBLIC_BUCKET,
  });
}

export function normalizeAttachedAssetForApi(asset) {
  if (!asset || typeof asset !== 'object') return asset;
  const resolved = resolveHostedPublicUrl(asset.url ?? asset.filename ?? null);
  if (!resolved) return asset;
  return { ...asset, url: resolved };
}
