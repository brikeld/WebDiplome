import { describe, expect, it } from 'vitest';
import {
  buildHostedDemoVideoJobPayload,
  demoVideoPublicAssetUrl,
  mergeDemoVideoPostIntoProfiles,
  isLocalDemoVideoApiOrigin,
} from '../src/lib/demoVideoFeed.js';
import { getFakeUsers } from '../src/lib/demoVideoFakeUsers.js';

describe('demoVideoFeed API routing', () => {
  it('uses the local generator only for local API origins', () => {
    expect(isLocalDemoVideoApiOrigin('http://localhost:3001')).toBe(true);
    expect(isLocalDemoVideoApiOrigin('http://127.0.0.1:3001')).toBe(true);
    expect(isLocalDemoVideoApiOrigin('https://webdiplome-production.up.railway.app')).toBe(false);
  });

  it('builds public Vercel asset URLs for hosted worker jobs', () => {
    expect(
      demoVideoPublicAssetUrl(
        'Screenshot 2026-06-29 at 11.24.24.png',
        'https://web-diplome.vercel.app/',
      ),
    ).toBe('https://web-diplome.vercel.app/videoDEMO/contentFakePeople/Screenshot%202026-06-29%20at%2011.24.24.png');
  });

  it('includes a public asset URL in hosted demo-video job payloads', () => {
    const [fake] = getFakeUsers();

    expect(
      buildHostedDemoVideoJobPayload(
        { assetBasename: 'lake.webp', user: fake },
        'https://web-diplome.vercel.app',
      ),
    ).toEqual({
      assetBasename: 'lake.webp',
      fakeUserName: fake.displayName,
      assetUrl: 'https://web-diplome.vercel.app/videoDEMO/contentFakePeople/lake.webp',
    });
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
