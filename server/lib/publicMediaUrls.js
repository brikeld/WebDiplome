import { resolveAttachedAssetPublicUrl, resolveUploadAssetUrl, UPLOADS_PUBLIC_BUCKET } from '../../src/lib/uploadPublicUrl.js';
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
  const resolved = resolveAttachedAssetPublicUrl(asset, {
    supabaseUrl: serverConfig.supabaseUrl,
    apiOrigin: serverConfig.publicBaseUrl,
    uploadsBucket: UPLOADS_PUBLIC_BUCKET,
  });
  if (!resolved) return asset;
  const filename =
    asset.filename && String(asset.filename).trim()
      ? asset.filename
      : resolved.split('/').pop()?.split('?')[0] ?? asset.filename;
  return { ...asset, url: resolved, filename };
}
