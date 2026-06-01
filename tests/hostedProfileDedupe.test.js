import { describe, expect, it } from 'vitest';
import {
  dedupeProfilesWithMergedPosts,
  mergeSiblingPostsForProfile,
  profileIdentityKey,
} from '../server/lib/hostedProfileDedupe.js';

describe('hostedProfileDedupe', () => {
  const older = {
    slug: 'brikeld-hoxha-aaaa1111',
    firstname: 'Brikeld',
    lastname: 'Hoxha',
    machineName: 'Brikeld\u2019s MacBook Pro',
    updated_at: '2026-05-31T18:03:42.248+00:00',
    personaPosts: [
      { id: 'p1', content: 'older post one', createdAt: '2026-05-30T10:00:00.000Z', persona: 'productivite' },
      { id: 'p2', content: 'older post two', createdAt: '2026-05-29T10:00:00.000Z', persona: 'securite' },
    ],
  };

  const newer = {
    slug: 'brikeld-hoxha-bbbb2222',
    firstname: 'Brikeld',
    lastname: 'Hoxha',
    machineName: 'Brikeld\u2019s MacBook Pro',
    updated_at: '2026-06-01T20:32:32.347+00:00',
    personaPosts: [
      { id: 'join', content: 'joined', createdAt: '2026-06-01T20:32:32.347+00:00', compliantJoin: { userDisplayName: 'Brikeld Hoxha' } },
    ],
  };

  const grace = {
    slug: 'grace-hopper',
    firstname: 'Grace',
    lastname: 'Hopper',
    machineName: 'grace-mbp',
    updated_at: '2026-06-01T12:00:00.000Z',
    personaPosts: [{ id: 'g1', content: 'grace post', createdAt: '2026-06-01T11:00:00.000Z', persona: 'productivite' }],
  };

  it('builds a stable identity key from name + machine', () => {
    expect(profileIdentityKey(older)).toBe(profileIdentityKey(newer));
    expect(profileIdentityKey(older)).not.toBe(profileIdentityKey(grace));
  });

  it('merges sibling posts onto the requested profile', () => {
    const merged = mergeSiblingPostsForProfile(newer, [older, newer, grace]);
    expect(merged.slug).toBe('brikeld-hoxha-bbbb2222');
    expect(merged.personaPosts).toHaveLength(3);
    expect(merged.personaPosts.some((p) => p.id === 'p1')).toBe(true);
    expect(merged.personaPosts.some((p) => p.id === 'p2')).toBe(true);
  });

  it('dedupes duplicate people and keeps the newest profile row', () => {
    const out = dedupeProfilesWithMergedPosts([older, newer, grace]);
    expect(out).toHaveLength(2);
    const brikeld = out.find((p) => p.firstname === 'Brikeld');
    expect(brikeld?.slug).toBe('brikeld-hoxha-bbbb2222');
    expect(brikeld?.personaPosts).toHaveLength(3);
  });
});
