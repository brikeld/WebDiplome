import { describe, expect, it } from 'vitest';
import { createFeedSpectatorRevealController } from '../src/lib/feedSpectatorReveals.js';
import { postIdentityKey } from '../src/lib/mergePersonaPosts.js';
import { sortNewestFirst } from '../src/features/feed/PostsTab.jsx';

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

  it('assigns a global reveal sequence across authors so cross-author feed order follows reveal order', async () => {
    let profiles = [
      { slug: 'user-a', personaPosts: [{ id: 'a0', persona: 'productivite', content: 'a base', createdAt: '2026-01-01T00:00:00Z' }] },
      { slug: 'user-b', personaPosts: [{ id: 'b0', persona: 'securite', content: 'b base', createdAt: '2026-01-01T00:00:00Z' }] },
    ];
    const controller = createFeedSpectatorRevealController({
      setAllProfiles: (u) => { profiles = typeof u === 'function' ? u(profiles) : u; },
      gapMs: 1,
    });

    // Establish baselines for both authors (no reveals yet).
    controller.ingestProfiles(profiles);

    const reveal = async (slug, posts, newId) => {
      const newPost = posts.find((p) => p.id === newId);
      controller.setIngestAllowSlugs([slug]);
      controller.setExpectedRevealKey(slug, postIdentityKey(newPost));
      // Simulate the demo reload: the revealing author's posts come fresh from the API.
      profiles = profiles.map((p) => (p.slug === slug ? { ...p, personaPosts: posts } : p));
      controller.ingestProfiles(profiles.map((p) => ({ slug: p.slug, personaPosts: p.personaPosts })));
      await controller.waitForSlugIdle(slug, { waitForEnterAnimation: false });
      controller.setExpectedRevealKey(slug, null);
      controller.setIngestAllowSlugs(null);
    };

    // Round-robin reveal order across authors: A's first, then B's first, then A's second.
    await reveal('user-a', [
      { id: 'a1', persona: 'securite', content: 'a one', createdAt: '2026-06-15T10:00:00Z' },
      { id: 'a0', persona: 'productivite', content: 'a base', createdAt: '2026-01-01T00:00:00Z' },
    ], 'a1');
    await reveal('user-b', [
      { id: 'b1', persona: 'popularite', content: 'b one', createdAt: '2026-06-15T10:00:10Z' },
      { id: 'b0', persona: 'securite', content: 'b base', createdAt: '2026-01-01T00:00:00Z' },
    ], 'b1');
    await reveal('user-a', [
      { id: 'a2', persona: 'productivite', content: 'a two', createdAt: '2026-06-15T10:00:20Z' },
      { id: 'a1', persona: 'securite', content: 'a one', createdAt: '2026-06-15T10:00:00Z' },
      { id: 'a0', persona: 'productivite', content: 'a base', createdAt: '2026-01-01T00:00:00Z' },
    ], 'a2');

    const seqOf = (id) => {
      for (const p of profiles) {
        const found = (p.personaPosts || []).find((x) => x.id === id);
        if (found) return Number(found._feedRevealSeq ?? 0) || 0;
      }
      return 0;
    };

    // The reveal counter must be monotonic ACROSS authors: a1 < b1 < a2. With a
    // per-author counter, a1 and b1 both get seq 1, so a1's seq is not below b1's
    // and A's older post wrongly ties/outranks B's newer one in the feed.
    expect(seqOf('a1')).toBeGreaterThan(0);
    expect(seqOf('b1')).toBeGreaterThan(seqOf('a1'));
    expect(seqOf('a2')).toBeGreaterThan(seqOf('b1'));
  });

  it('reconciles a fresh API snapshot back into reveal order after a poll strips the sequence', async () => {
    let profiles = [
      { slug: 'user-a', personaPosts: [{ id: 'a0', persona: 'productivite', content: 'a base', createdAt: '2026-01-01T00:00:00Z' }] },
    ];
    const controller = createFeedSpectatorRevealController({
      setAllProfiles: (u) => { profiles = typeof u === 'function' ? u(profiles) : u; },
      gapMs: 1,
    });
    controller.ingestProfiles(profiles);

    // Reveal a fresh post whose createdAt is OLDER than the baseline — only the
    // reveal sequence (not createdAt) puts it on top.
    const newPost = { id: 'a1', persona: 'securite', content: 'fresh', createdAt: '2020-01-01T00:00:00Z' };
    controller.setIngestAllowSlugs(['user-a']);
    controller.setExpectedRevealKey('user-a', postIdentityKey(newPost));
    controller.ingestProfiles([
      { slug: 'user-a', personaPosts: [newPost, { id: 'a0', persona: 'productivite', content: 'a base', createdAt: '2026-01-01T00:00:00Z' }] },
    ]);
    await controller.waitForSlugIdle('user-a', { waitForEnterAnimation: false });

    // The directory poll returns the same posts with NO _feedRevealSeq — exactly
    // what reverts the feed to stale-createdAt order. Reconcile must restore it.
    const pollSnapshot = [
      { id: 'a0', persona: 'productivite', content: 'a base', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'a1', persona: 'securite', content: 'fresh', createdAt: '2020-01-01T00:00:00Z' },
    ];
    const reconciled = controller.reconcileRevealOrder(pollSnapshot);
    const a1 = reconciled.find((p) => p.id === 'a1');
    const a0 = reconciled.find((p) => p.id === 'a0');

    expect(Number(a1._feedRevealSeq ?? 0)).toBeGreaterThan(0); // revealed → order restored
    expect(Number(a0._feedRevealSeq ?? 0)).toBe(0); // never revealed → untouched
    // With the sequence restored, the revealed post sorts above the baseline
    // even though its createdAt is older.
    expect([a0, a1].sort(sortNewestFirst)).toEqual([a1, a0]);
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
