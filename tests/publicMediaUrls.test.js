import { describe, expect, it } from 'vitest';
import { resolveHostedPublicUrl, normalizeAttachedAssetForApi } from '../server/lib/publicMediaUrls.js';

describe('publicMediaUrls', () => {
  const hash = 'a'.repeat(64);
  const filename = `${hash}.jpg`;

  it('passes through absolute https URLs', () => {
    const url = `https://example.supabase.co/storage/v1/object/public/uploads-public/${filename}`;
    expect(resolveHostedPublicUrl(url)).toBe(url);
  });

  it('resolves bare hash filenames to Supabase when configured', () => {
    const resolved = resolveHostedPublicUrl(filename);
    expect(resolved).toContain(filename);
    expect(resolved).toMatch(/^https:\/\//);
  });

  it('normalizes attached assets with relative /uploads paths', () => {
    const out = normalizeAttachedAssetForApi({
      kind: 'image',
      filename,
      url: `/uploads/${filename}`,
    });
    expect(out.url).toMatch(/^https:\/\//);
    expect(out.url).toContain(filename);
  });
});
