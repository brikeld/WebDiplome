import { describe, expect, it } from 'vitest';
import {
  materializeDemoVideoPost,
  mergeDemoVideoPostIntoProfiles,
} from '../src/lib/demoVideoFeed.js';
import { buildDemoVideoSchedule, getFakeUsers } from '../src/lib/demoVideoFakeUsers.js';
import { resolveAttachedAsset } from '../src/features/feed/PostsTab.jsx';

describe('demoVideoFeed static posts', () => {
  it('ships a prewritten post schedule long enough for a demo recording', () => {
    const schedule = buildDemoVideoSchedule();

    expect(schedule.length).toBeGreaterThanOrEqual(20);
    expect(schedule.every((step) => step.user?.slug && step.post?.content)).toBe(true);
    expect(new Set(schedule.map((step) => step.post.content)).size).toBe(schedule.length);
    expect(new Set(schedule.map((step) => step.user.slug)).size).toBe(schedule.length);
  });

  it('materializes a prewritten post with a public attachment path and no API payload', () => {
    const [step] = buildDemoVideoSchedule();
    const post = materializeDemoVideoPost(step, 3);

    expect(post.content).toBe(step.post.content);
    expect(post.attachedAsset.url).toBe(`/videoDEMO/contentFakePeople/${encodeURIComponent(step.assetBasename)}`);
    expect(post.createdAt).toBeTruthy();
    expect(post.id).toContain('demo-video-static');
    expect(post.inferenceChain?.length).toBeGreaterThan(0);
  });

  it('keeps demo-video public asset URLs on the website origin', () => {
    const asset = resolveAttachedAsset({
      kind: 'image',
      url: '/videoDEMO/contentFakePeople/cat.jpg',
      filename: 'cat.jpg',
    });

    expect(asset.url).toBe('/videoDEMO/contentFakePeople/cat.jpg');
  });

  it('merges generated posts into an existing fake profile', () => {
    const [fake] = getFakeUsers();
    const post = {
      id: 'demo-post-1',
      persona: 'popularite',
      content: 'Generated from local demo content.',
      createdAt: '2026-06-29T12:00:00.000Z',
    };

    const next = mergeDemoVideoPostIntoProfiles([{ ...fake, personaPosts: [] }], fake.slug, post);

    expect(next[0].personaPosts).toEqual([post]);
  });

  it('fake profiles include enough mock data to open profile pages', () => {
    const [fake] = getFakeUsers();

    expect(fake.profileSummary).toContain(fake.firstname);
    expect(fake.globalScore).toBeGreaterThan(0);
    expect(fake.machineName).toMatch(/MacBook|ThinkPad|Studio|Laptop/i);
    expect(fake.harvestOverview?.machine?.name).toBeTruthy();
    expect(fake.harvestOverview?.apps?.mostUsed.length).toBeGreaterThan(0);
  });
});
