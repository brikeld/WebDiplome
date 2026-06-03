import { describe, it, expect } from 'vitest';
import {
  buildCompliantJoinPostForProfile,
  joinCreatedAtBeforeExisting,
  profileNeedsCompliantJoin,
} from '../src/lib/ensureCompliantJoin.js';

describe('ensureCompliantJoin', () => {
  it('join createdAt sorts below existing generated posts', () => {
    const posts = [
      { persona: 'productivite', content: 'hello', createdAt: 1_000 },
      { persona: 'securite', content: 'world', createdAt: 2_000 },
    ];
    const ts = joinCreatedAtBeforeExisting(posts);
    expect(ts).toBeLessThan(1_000);
  });

  it('profileNeedsCompliantJoin is false when join already exists', () => {
    const profile = {
      firstname: 'Ada',
      lastname: 'Lovelace',
      personaPosts: [{ compliantJoin: { userDisplayName: 'Ada Lovelace' }, createdAt: 1 }],
    };
    expect(profileNeedsCompliantJoin(profile)).toBe(false);
  });

  it('buildCompliantJoinPostForProfile returns a join notice', () => {
    const profile = { firstname: 'Ada', lastname: 'Lovelace', slug: 'ada-lovelace' };
    const post = buildCompliantJoinPostForProfile(profile, []);
    expect(post?.compliantJoin).toBeTruthy();
    expect(post?.content).toMatch(/COMPLIANT notice/i);
  });
});
