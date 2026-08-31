import { describe, it, expect } from 'vitest';
import {
  buildSeededFakeUsers,
  expandComments,
  injectBrikeldComments,
} from '../scripts/fixtures/buildDemoFakeUsers.js';
import { SEEDED_SLUGS, BRIKELD_POST_COMMENTS } from '../scripts/fixtures/demoFakeContent.js';

const NOW = Date.UTC(2026, 6, 6, 12, 0, 0);

describe('buildSeededFakeUsers', () => {
  const seeded = buildSeededFakeUsers(NOW);

  it('produces 7 users with plain slugs and demoFake flag', () => {
    expect(seeded.map((s) => s.slug)).toEqual(SEEDED_SLUGS);
    for (const { slug, profile } of seeded) {
      expect(slug.startsWith('demo-video-')).toBe(false);
      expect(profile.slug).toBe(slug);
      expect(profile.id).toBe(slug);
      expect(profile.demoFake).toBe(true);
      expect(profile.avatarUrl.startsWith('data:image/')).toBe(true);
      expect(profile.personaPosts).toBeUndefined();
      expect(profile.__demoVideoFake).toBeUndefined();
    }
  });

  it('distributes the 14 posts with absolute ISO createdAt, newest-first per user', () => {
    const total = seeded.reduce((n, s) => n + s.posts.length, 0);
    expect(total).toBe(14);
    for (const { posts } of seeded) {
      for (let i = 1; i < posts.length; i += 1) {
        expect(new Date(posts[i - 1].createdAt).getTime())
          .toBeGreaterThan(new Date(posts[i].createdAt).getTime());
      }
      for (const p of posts) {
        expect(new Date(p.createdAt).getTime()).toBeLessThan(NOW);
        expect(p.comments.length).toBeGreaterThanOrEqual(1);
        expect(p.comments[0].displayName.length).toBeGreaterThan(3);
        expect(p.comments[0].avatarSrc.startsWith('data:image/')).toBe(true);
        expect(p.comments[0].bySlug).toBeUndefined();
      }
    }
  });
});

describe('expandComments', () => {
  it('expands bySlug into full identity fields', () => {
    const [c] = expandComments([
      { id: 'x1', bySlug: 'lea-bernard', persona: 'popularite', content: 'Nice work on this.' },
    ]);
    expect(c.displayName).toBe('Léa Bernard');
    expect(c.handle.startsWith('@')).toBe(true);
    expect(c.avatarInitials).toBe('LB');
    expect(['productivity', 'security', 'popularity']).toContain(c.personaBadgePersona);
  });
});

describe('injectBrikeldComments', () => {
  it('rebases timestamps and injects comments on every post', () => {
    const posts = [
      { persona: 'securite', content: 'a', createdAt: '2026-05-26T22:06:23.762Z' },
      { persona: 'popularite', content: 'b', createdAt: '2026-05-26T21:00:00.000Z' },
      { persona: 'productivite', content: 'c', createdAt: '2026-05-26T20:00:00.000Z' },
    ];
    const out = injectBrikeldComments(posts, NOW);
    expect(out).toHaveLength(3);
    expect(new Date(out[0].createdAt).getTime()).toBe(NOW - 45 * 60_000);
    expect(new Date(out[1].createdAt).getTime()).toBe(NOW - 80 * 60_000);
    expect(new Date(out[2].createdAt).getTime()).toBe(NOW - 115 * 60_000);
    for (let i = 0; i < out.length; i += 1) {
      expect(out[i].comments).toHaveLength(BRIKELD_POST_COMMENTS[i].length);
      expect(out[i].comments[0].displayName.length).toBeGreaterThan(3);
    }
  });
});
