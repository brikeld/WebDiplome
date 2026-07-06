import { describe, it, expect } from 'vitest';
import {
  seededSlugForFakeUser,
  mapScheduleToSeededUsers,
  SEEDED_FAKE_COUNT,
} from '../src/lib/demoVideoLocal.js';
import { buildDemoVideoSchedule } from '../src/lib/demoVideoFakeUsers.js';
import { materializeDemoVideoPost } from '../src/lib/demoVideoFeed.js';
import { SEEDED_SLUGS } from '../scripts/fixtures/demoFakeContent.js';

describe('demoVideoLocal', () => {
  it('strips the demo-video prefix', () => {
    expect(seededSlugForFakeUser({ slug: 'demo-video-camille-laurent' }))
      .toBe('camille-laurent');
  });

  it('maps every schedule step onto the 7 seeded users, cycling', () => {
    const mapped = mapScheduleToSeededUsers(buildDemoVideoSchedule());
    expect(mapped.length).toBeGreaterThan(0);
    expect(SEEDED_FAKE_COUNT).toBe(7);
    for (const step of mapped) {
      expect(SEEDED_SLUGS).toContain(step.user.slug);
      expect(step.user.id).toBe(step.user.slug);
      expect(step.user.slug.startsWith('demo-video-')).toBe(false);
    }
    expect(mapped[0].user.slug).toBe(SEEDED_SLUGS[0]);
    if (mapped.length > 7) {
      expect(mapped[7].user.slug).toBe(SEEDED_SLUGS[0]);
    }
  });
});

describe('materializeDemoVideoPost options', () => {
  const step = buildDemoVideoSchedule()[0];

  it('defaults produce the legacy static id/createdAt', () => {
    const post = materializeDemoVideoPost(step, 0);
    expect(post.id.startsWith('demo-video-static-0-')).toBe(true);
  });

  it('epochMs and runKey produce fresh unique ids and current timestamps', () => {
    const now = Date.UTC(2026, 6, 6, 12, 0, 0);
    const post = materializeDemoVideoPost(step, 0, { epochMs: now, runKey: 'r1' });
    expect(post.id).toBe(`demo-video-r1-0-${step.assetBasename}`);
    expect(new Date(post.createdAt).getTime()).toBe(now);
  });

  it('metadata text carries no meta words', () => {
    const post = materializeDemoVideoPost(step, 0);
    const banned = /\b(demo|fake|scripted|prewritten|mock)\b/i;
    for (const s of post.inferenceChain) expect(JSON.stringify(s)).not.toMatch(banned);
    for (const t of post.thinking) expect(t.detail).not.toMatch(banned);
    for (const ing of post.ingredients) expect(ing.label).not.toMatch(banned);
  });
});
