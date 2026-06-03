import { describe, expect, it } from 'vitest';
import {
  contentHashFilename,
  isBucketOnlyPublicStorageUrl,
  publicStorageObjectUrl,
  resolveAttachedAssetPublicUrl,
  resolveUploadAssetUrl,
  UPLOADS_PUBLIC_BUCKET,
} from '../src/lib/uploadPublicUrl.js';

describe('uploadPublicUrl', () => {
  const hash = 'a'.repeat(64);
  const filename = `${hash}.jpg`;
  const supabaseUrl = 'https://example.supabase.co';

  it('extracts hash filenames from /uploads paths', () => {
    expect(contentHashFilename(`/uploads/${filename}`)).toBe(filename);
    expect(contentHashFilename(filename)).toBe(filename);
  });

  it('builds Supabase public object URLs', () => {
    const url = publicStorageObjectUrl(supabaseUrl, UPLOADS_PUBLIC_BUCKET, filename);
    expect(url).toBe(
      `https://example.supabase.co/storage/v1/object/public/${UPLOADS_PUBLIC_BUCKET}/${filename}`,
    );
  });

  it('prefers Supabase over API origin for hash filenames', () => {
    const resolved = resolveUploadAssetUrl(`/uploads/${filename}`, {
      supabaseUrl,
      apiOrigin: 'https://api.example.com',
    });
    expect(resolved).toContain(supabaseUrl);
    expect(resolved).toContain(filename);
  });

  it('falls back to API origin when Supabase is unavailable', () => {
    expect(
      resolveUploadAssetUrl(`/uploads/${filename}`, { apiOrigin: 'https://api.example.com' }),
    ).toBe(`https://api.example.com/uploads/${filename}`);
  });

  it('passes through absolute URLs unchanged', () => {
    const url = `https://cdn.example/${filename}`;
    expect(resolveUploadAssetUrl(url, { supabaseUrl })).toBe(url);
  });

  it('repairs bucket-only Supabase URLs using filename', () => {
    const broken = `https://example.supabase.co/storage/v1/object/public/${UPLOADS_PUBLIC_BUCKET}`;
    expect(isBucketOnlyPublicStorageUrl(broken)).toBe(true);
    const resolved = resolveAttachedAssetPublicUrl(
      { kind: 'image', filename, url: broken },
      { supabaseUrl },
    );
    expect(resolved).toBe(
      `https://example.supabase.co/storage/v1/object/public/${UPLOADS_PUBLIC_BUCKET}/${filename}`,
    );
  });
});
