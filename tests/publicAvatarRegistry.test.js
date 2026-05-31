import { describe, expect, it } from 'vitest';
import {
  avatarUrlForSlug,
  ingestProfileAvatars,
  normalizeProfilesFromApi,
  pickProfileMediaUrl,
} from '../src/lib/publicAvatarRegistry.js';
import { avatarSrcFromProfile } from '../src/lib/profileUtils.js';

describe('publicAvatarRegistry', () => {
  const url =
    'https://example.supabase.co/storage/v1/object/public/uploads-public/abc.jpg';

  it('picks avatarUrl from profile payload', () => {
    expect(pickProfileMediaUrl({ avatarUrl: url })).toBe(url);
    expect(pickProfileMediaUrl({ wallpaperUrl: url })).toBe(url);
  });

  it('resolves avatars by slug after ingest', () => {
    ingestProfileAvatars([
      { slug: 'emanuel-masha-abc', avatarUrl: url, personaPosts: [] },
    ]);
    expect(avatarUrlForSlug('emanuel-masha-abc')).toBe(url);
    expect(avatarSrcFromProfile({ slug: 'emanuel-masha-abc', personaPosts: [] })).toBe(url);
  });

  it('normalizes profiles with wallpaperUrl only', () => {
    const out = normalizeProfilesFromApi([{ slug: 'a-b', wallpaperUrl: url }]);
    expect(out[0].avatarUrl).toBe(url);
    expect(out[0].wallpaperUrl).toBe(url);
  });
});
