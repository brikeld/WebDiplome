import crypto from 'crypto';
import path from 'path';
import { serverConfig } from './env.js';

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

export function filenameForBuffer(buffer, originalName = '', mimeType = '') {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const mimeExt = MIME_EXT.get(String(mimeType || '').toLowerCase()) || '';
  const origExt = path.extname(String(originalName || '')).toLowerCase();
  return `${hash}${mimeExt || origExt}`;
}

export function publicStorageUrl(supabaseUrl, bucket, objectPath) {
  return `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${objectPath}`;
}

export function createStorageStore({ supabase, bucket = 'uploads-public', config = serverConfig }) {
  if (!supabase) throw new Error('Supabase service client required');

  return {
    async uploadPublicAsset({ ownerUserId, buffer, originalName, mimeType }) {
      const filename = filenameForBuffer(buffer, originalName, mimeType);
      const objectPath = filename;
      const upload = await supabase.storage
        .from(bucket)
        .upload(objectPath, buffer, { contentType: mimeType || 'application/octet-stream', upsert: true });
      if (upload.error) throw new Error(`storage upload: ${upload.error.message}`);

      const row = {
        owner_user_id: ownerUserId,
        sha256: filename.split('.')[0],
        bucket,
        path: objectPath,
        mime_type: mimeType || 'application/octet-stream',
        size_bytes: buffer.length,
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
