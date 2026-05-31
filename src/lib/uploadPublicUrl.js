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

/**
 * Resolve relative /uploads paths and bare hash filenames to a public URL.
 * Prefers Supabase Storage when supabaseUrl is configured; otherwise falls back to apiOrigin.
 */
export function resolveUploadAssetUrl(urlOrFilename, { supabaseUrl, apiOrigin, uploadsBucket = UPLOADS_PUBLIC_BUCKET } = {}) {
  const raw = String(urlOrFilename || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;

  const supabase = String(supabaseUrl || '').trim();
  if (supabase) {
    const filename = contentHashFilename(raw);
    if (filename) {
      return publicStorageObjectUrl(supabase, uploadsBucket, filename);
    }
  }

  const base = String(apiOrigin || 'http://localhost:3001').replace(/\/$/, '');
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`;
}
