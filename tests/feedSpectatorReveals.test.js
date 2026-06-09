import { describe, expect, it } from 'vitest';
import { createFeedSpectatorRevealController } from '../src/lib/feedSpectatorReveals.js';

describe('feedSpectatorReveals', () => {
  it('does not wipe the directory when reveal fires before React commits profiles', () => {
    let profiles = [];
    const controller = createFeedSpectatorRevealController({
      setAllProfiles: (updater) => {
        profiles = typeof updater === 'function' ? updater(profiles) : updater;
      },
    });

    const row = {
      slug: 'demo-user-abc123',
      personaPosts: [{ id: 'post-1', persona: 'productivite', content: 'hello', createdAt: '2026-01-01T00:00:00Z' }],
    };

    controller.ingestProfiles([{ slug: row.slug, personaPosts: [] }]);
    expect(profiles).toEqual([]);

    profiles = [row];
    controller.ingestProfiles([row]);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].personaPosts?.length).toBeGreaterThan(0);
  });

  it('enqueues posts that arrive after the baseline snapshot', () => {
    let profiles = [
      {
        slug: 'user-a',
        personaPosts: [{ id: 'old', persona: 'productivite', content: 'old', createdAt: '2026-01-01T00:00:00Z' }],
      },
    ];
    const controller = createFeedSpectatorRevealController({
      setAllProfiles: (updater) => {
        profiles = typeof updater === 'function' ? updater(profiles) : updater;
      },
    });

    controller.ingestProfiles(profiles);
    expect(controller.isSlugIdle('user-a')).toBe(true);

    controller.ingestProfiles([
      {
        slug: 'user-a',
        personaPosts: [
          { id: 'new', persona: 'securite', content: 'fresh', createdAt: '2026-01-02T00:00:00Z' },
          { id: 'old', persona: 'productivite', content: 'old', createdAt: '2026-01-01T00:00:00Z' },
        ],
      },
    ]);

    expect(controller.isSlugIdle('user-a')).toBe(false);
  });

  it('ignores ingest for slugs outside setIngestAllowSlugs', () => {
    let profiles = [
      {
        slug: 'user-a',
        personaPosts: [{ id: 'old-a', persona: 'productivite', content: 'old', createdAt: '2026-01-01T00:00:00Z' }],
      },
      {
        slug: 'user-b',
        personaPosts: [{ id: 'old-b', persona: 'securite', content: 'old', createdAt: '2026-01-01T00:00:00Z' }],
      },
    ];
    const controller = createFeedSpectatorRevealController({
      setAllProfiles: (updater) => {
        profiles = typeof updater === 'function' ? updater(profiles) : updater;
      },
    });

    controller.ingestProfiles(profiles);
    controller.setIngestAllowSlugs(['user-a']);
    controller.ingestProfiles([
      {
        slug: 'user-a',
        personaPosts: [
          { id: 'new-a', persona: 'productivite', content: 'fresh', createdAt: '2026-01-02T00:00:00Z' },
          { id: 'old-a', persona: 'productivite', content: 'old', createdAt: '2026-01-01T00:00:00Z' },
        ],
      },
      {
        slug: 'user-b',
        personaPosts: [
          { id: 'new-b', persona: 'popularite', content: 'early', createdAt: '2026-01-02T00:00:00Z' },
          { id: 'old-b', persona: 'securite', content: 'old', createdAt: '2026-01-01T00:00:00Z' },
        ],
      },
    ]);

    expect(controller.isSlugIdle('user-a')).toBe(false);
    expect(controller.isSlugIdle('user-b')).toBe(true);
  });

  it('keeps older API posts when revealing a new one', async () => {
    let profiles = [
      {
        slug: 'daniel-rocha',
        personaPosts: [
          { id: 'old-1', persona: 'productivite', content: 'older post one', createdAt: '2026-01-01T00:00:00Z' },
          { id: 'old-2', persona: 'securite', content: 'older post two', createdAt: '2026-01-02T00:00:00Z' },
        ],
      },
    ];
    const controller = createFeedSpectatorRevealController({
      setAllProfiles: (updater) => {
        profiles = typeof updater === 'function' ? updater(profiles) : updater;
      },
      gapMs: 1,
    });

    profiles = [...profiles];
    controller.ingestProfiles(profiles);

    controller.ingestProfiles([
      {
        slug: 'daniel-rocha',
        personaPosts: [
          { id: 'new-1', persona: 'popularite', content: 'brand new post', createdAt: '2026-06-09T12:00:00Z' },
          { id: 'old-1', persona: 'productivite', content: 'older post one', createdAt: '2026-01-01T00:00:00Z' },
          { id: 'old-2', persona: 'securite', content: 'older post two', createdAt: '2026-01-02T00:00:00Z' },
        ],
      },
    ]);

    await controller.waitForSlugIdle('daniel-rocha', { waitForEnterAnimation: false });

    const daniel = profiles.find((p) => p.slug === 'daniel-rocha');
    expect(daniel?.personaPosts?.length).toBe(3);
    expect(daniel.personaPosts.some((p) => p.id === 'old-1')).toBe(true);
    expect(daniel.personaPosts.some((p) => p.id === 'old-2')).toBe(true);
    expect(daniel.personaPosts.some((p) => p.id === 'new-1')).toBe(true);
  });
});
