import { describe, expect, it } from 'vitest';
import { createFeedSpectatorRevealController } from '../src/lib/feedSpectatorReveals.js';
import { postIdentityKey } from '../src/lib/mergePersonaPosts.js';

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

  it('reveals only the expected post key during demo rotate', async () => {
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
      gapMs: 1,
    });

    profiles = [...profiles];
    controller.ingestProfiles(profiles);
    controller.setIngestAllowSlugs(['user-a']);
    const newPost = {
      id: 'new',
      persona: 'securite',
      content: 'fresh',
      createdAt: '2026-01-02T00:00:00Z',
    };
    controller.setExpectedRevealKey('user-a', postIdentityKey(newPost));

    controller.ingestProfiles([
      {
        slug: 'user-a',
        personaPosts: [
          newPost,
          { id: 'old', persona: 'productivite', content: 'old', createdAt: '2026-01-01T00:00:00Z' },
        ],
      },
    ]);

    expect(controller.isSlugIdle('user-a')).toBe(false);
    await controller.waitForSlugIdle('user-a', { waitForEnterAnimation: false });
    const revealed = profiles[0]?.personaPosts?.find((p) => p.id === 'new');
    expect(revealed?._feedEnterDone || revealed?._feedEnter).toBeTruthy();
  });

  it('treats setIngestAllowSlugs([]) as allow-all, not block-all', () => {
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
    controller.setIngestAllowSlugs([]);
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

  it('reveals expected post even when baseline is first established during demo', async () => {
    let profiles = [];
    const controller = createFeedSpectatorRevealController({
      setAllProfiles: (updater) => {
        profiles = typeof updater === 'function' ? updater(profiles) : updater;
      },
      gapMs: 1,
    });

    const newPost = {
      id: 'new',
      persona: 'securite',
      content: 'fresh',
      createdAt: '2026-01-02T00:00:00Z',
    };
    controller.setIngestAllowSlugs(['user-a']);
    controller.setExpectedRevealKey('user-a', postIdentityKey(newPost));
    controller.ingestProfiles([
      {
        slug: 'user-a',
        personaPosts: [
          newPost,
          { id: 'old', persona: 'productivite', content: 'old', createdAt: '2026-01-01T00:00:00Z' },
        ],
      },
    ]);

    expect(controller.isSlugIdle('user-a')).toBe(false);
    await controller.waitForSlugIdle('user-a', { waitForEnterAnimation: false });
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

  it('reports already-revealed keys so demo rotate skips the wait', async () => {
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
      gapMs: 1,
    });

    controller.ingestProfiles(profiles);
    const newPost = { id: 'new', persona: 'securite', content: 'fresh', createdAt: '2026-01-02T00:00:00Z' };
    const newKey = postIdentityKey(newPost);
    expect(controller.hasSlugRevealedKey('user-a', newKey)).toBe(false);

    // Regular directory poll reveals the post before the demo sets its key.
    controller.ingestProfiles([
      {
        slug: 'user-a',
        personaPosts: [
          newPost,
          { id: 'old', persona: 'productivite', content: 'old', createdAt: '2026-01-01T00:00:00Z' },
        ],
      },
    ]);
    await controller.waitForSlugIdle('user-a', { waitForEnterAnimation: false });

    expect(controller.hasSlugRevealedKey('user-a', newKey)).toBe(true);
    expect(controller.hasSlugRevealedKey('user-a', 'id:unknown')).toBe(false);
    expect(controller.hasSlugRevealedKey('user-b', newKey)).toBe(false);
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
