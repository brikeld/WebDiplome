import crypto from 'crypto';
import path from 'path';
import { serverConfig } from './env.js';
import { normalizeImageBufferForWeb } from './normalizeImageBuffer.js';

const MIME_EXT = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/avif', '.avif'],
  ['application/pdf', '.pdf'],
  ['text/plain', '.txt'],
  ['text/markdown', '.md'],
]);

const IMAGE_MIME_PREFIX = 'image/';

export function filenameForBuffer(buffer, originalName = '', mimeType = '', extOverride = null) {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const mimeExt = extOverride || MIME_EXT.get(String(mimeType || '').toLowerCase()) || '';
  const origExt = path.extname(String(originalName || '')).toLowerCase();
  return `${hash}${mimeExt || origExt}`;
}

export function publicStorageUrl(supabaseUrl, bucket, objectPath) {
  return `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${objectPath}`;
}

export function createStorageStore({ supabase, bucket = 'uploads-public', config = serverConfig }) {
  if (!supabase) throw new Error('Supabase service client required');

  return {
    async uploadPublicAsset({ ownerUserId, buffer, originalName, mimeType, normalizeImage = true }) {
      let payload = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      let outMime = mimeType || 'application/octet-stream';
      let extOverride = null;

      if (normalizeImage && String(outMime).startsWith(IMAGE_MIME_PREFIX)) {
        try {
          const normalized = await normalizeImageBufferForWeb(payload);
          payload = normalized.buffer;
          outMime = normalized.mimeType;
          extOverride = normalized.ext;
        } catch (err) {
          console.warn('[storage] image normalize failed, storing raw', err?.message || err);
        }
      }

      const filename = filenameForBuffer(payload, originalName, outMime, extOverride);
      const objectPath = filename;
      const upload = await supabase.storage
        .from(bucket)
        .upload(objectPath, payload, { contentType: outMime, upsert: true });
      if (upload.error) throw new Error(`storage upload: ${upload.error.message}`);

      const row = {
        owner_user_id: ownerUserId,
        sha256: filename.split('.')[0],
        bucket,
        path: objectPath,
        mime_type: outMime,
        size_bytes: payload.length,
      };
      const inserted = await supabase.from('assets').upsert(row, { onConflict: 'bucket,path' }).select('*').single();
      if (inserted.error) throw new Error(`asset row: ${inserted.error.message}`);

      return {
        filename,
        path: objectPath,
        bucket,
        url: publicStorageUrl(config.supabaseUrl, bucket, objectPath),
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
      };
    },
  };
}
