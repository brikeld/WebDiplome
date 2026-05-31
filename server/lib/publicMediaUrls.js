import { publicStorageUrl } from './storageStore.js';
import { serverConfig } from './env.js';

const UPLOADS_BUCKET = 'uploads-public';
const HASH_FILENAME = /^[a-f0-9]{64}\.[a-z0-9]+$/i;

function contentHashFilename(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (HASH_FILENAME.test(raw)) return raw;
  if (raw.startsWith('/uploads/')) {
    const base = raw.split('/').pop()?.split('?')[0] ?? '';
    return HASH_FILENAME.test(base) ? base : null;
  }
  try {
    const path = new URL(raw, 'http://local').pathname;
    const base = path.split('/').pop()?.split('?')[0] ?? '';
    return HASH_FILENAME.test(base) ? base : null;
  } catch {
    return null;
  }
}

/** Resolve relative /uploads paths and bare hashes to Supabase public URLs when hosted. */
export function resolveHostedPublicUrl(urlOrFilename) {
  const raw = String(urlOrFilename || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;

  const supabaseUrl = serverConfig.supabaseUrl;
  if (supabaseUrl) {
    const filename = contentHashFilename(raw);
    if (filename) {
      return publicStorageUrl(supabaseUrl, UPLOADS_BUCKET, filename);
    }
  }

  const base = String(serverConfig.publicBaseUrl || 'http://localhost:3001').replace(/\/$/, '');
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`;
}

export function normalizeAttachedAssetForApi(asset) {
  if (!asset || typeof asset !== 'object') return asset;
  const resolved = resolveHostedPublicUrl(asset.url ?? asset.filename ?? null);
  if (!resolved) return asset;
  return { ...asset, url: resolved };
}
