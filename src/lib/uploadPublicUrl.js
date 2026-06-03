/** Content-addressed uploads bucket on hosted Supabase Storage. */
export const UPLOADS_PUBLIC_BUCKET = 'uploads-public';

const HASH_FILENAME = /^[a-f0-9]{64}\.[a-z0-9]+$/i;

export function contentHashFilename(value) {
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

export function publicStorageObjectUrl(supabaseUrl, bucket, objectPath) {
  return `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${objectPath}`;
}

export function isBucketOnlyPublicStorageUrl(raw, uploadsBucket = UPLOADS_PUBLIC_BUCKET) {
  const trimmed = String(raw || '').trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(trimmed)) return false;
  return trimmed.endsWith(`/storage/v1/object/public/${uploadsBucket}`);
}

export function isCompletePublicStorageObjectUrl(raw, uploadsBucket = UPLOADS_PUBLIC_BUCKET) {
  const trimmed = String(raw || '').trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  return new RegExp(
    `/storage/v1/object/public/${uploadsBucket}/[a-f0-9]{64}\\.[a-z0-9]+$`,
    'i',
  ).test(trimmed.replace(/\/$/, ''));
}

/**
 * Resolve relative /uploads paths and bare hash filenames to a public URL.
 * Prefers Supabase Storage when supabaseUrl is configured; otherwise falls back to apiOrigin.
 */
export function resolveUploadAssetUrl(urlOrFilename, { supabaseUrl, apiOrigin, uploadsBucket = UPLOADS_PUBLIC_BUCKET } = {}) {
  const raw = String(urlOrFilename || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:')) return raw;

  const supabase = String(supabaseUrl || '').trim();
  const hashFilename = contentHashFilename(raw);

  if (/^https?:\/\//i.test(raw)) {
    if (isBucketOnlyPublicStorageUrl(raw, uploadsBucket) && hashFilename && supabase) {
      return publicStorageObjectUrl(supabase, uploadsBucket, hashFilename);
    }
    return raw;
  }

  if (supabase) {
    if (hashFilename) {
      return publicStorageObjectUrl(supabase, uploadsBucket, hashFilename);
    }
  }

  const base = String(apiOrigin || 'http://localhost:3001').replace(/\/$/, '');
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`;
}

/** Resolve attachedAsset url + filename together (handles bucket-only Supabase URLs). */
export function resolveAttachedAssetPublicUrl(asset, { supabaseUrl, apiOrigin, uploadsBucket = UPLOADS_PUBLIC_BUCKET } = {}) {
  if (!asset || typeof asset !== 'object') return null;
  const opts = { supabaseUrl, apiOrigin, uploadsBucket };
  const filename = contentHashFilename(asset.filename) ?? contentHashFilename(asset.url);
  const rawUrl = asset.url ? String(asset.url).trim() : '';

  if (filename && (!rawUrl || isBucketOnlyPublicStorageUrl(rawUrl, uploadsBucket))) {
    return resolveUploadAssetUrl(filename, opts);
  }
  return resolveUploadAssetUrl(rawUrl || filename, opts);
}
