import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PUBLIC_ASSET_CACHE_CONTROL,
  filenameForBuffer,
  publicStorageUrl,
} from '../server/lib/storageStore.js';

describe('storage helpers', () => {
  it('uses sha256 content addressing', () => {
    const result = filenameForBuffer(Buffer.from('hello'), 'photo.png', 'image/png');
    expect(result).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824.png');
  });

  it('builds Supabase public storage URLs', () => {
    expect(publicStorageUrl('https://demo.supabase.co', 'uploads-public', 'a.png')).toBe(
      'https://demo.supabase.co/storage/v1/object/public/uploads-public/a.png',
    );
  });

  it('uses long cache headers for content-addressed public assets', () => {
    expect(DEFAULT_PUBLIC_ASSET_CACHE_CONTROL).toBe('31536000');
  });
});
