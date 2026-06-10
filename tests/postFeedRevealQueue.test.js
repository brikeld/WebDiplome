import { afterEach, describe, expect, it, vi } from 'vitest';
import { isCompliantSystemPost } from '../src/lib/mergePersonaPosts.js';
import {
  createPostFeedRevealQueue,
  POST_REVEAL_GAP_MS,
  sortPostsForReveal,
} from '../src/lib/postFeedRevealQueue.js';

describe('createPostFeedRevealQueue', () => {
  it('tracks only generated posts for completion (ignores new COMPLIANT posts)', () => {
    const baseline = [{ content: 'old', createdAt: 1, persona: 'securite' }];
    const queue = createPostFeedRevealQueue({
      gapMs: 50,
      getBaseline: () => baseline,
      onPostsChange: () => {},
    });
    queue.markBaseline(baseline);
    const apiWithCompliant = [
      ...baseline,
      {
        content: 'COMPLIANT notice',
        createdAt: 2,
        persona: 'securite',
        compliantLowScore: { uiPersonaKey: 'security', score: 12 },
      },
    ];
    expect(isCompliantSystemPost(apiWithCompliant[1])).toBe(true);
    expect(queue.allNewGeneratedRevealed(apiWithCompliant)).toBe(true);
  });

  it('does not return COMPLIANT posts as unrevealed generation posts', () => {
    const baseline = [{ content: 'old', createdAt: 1, persona: 'securite' }];
    const queue = createPostFeedRevealQueue({
      gapMs: 50,
      getBaseline: () => baseline,
      onPostsChange: () => {},
    });
    queue.markBaseline(baseline);
    const apiPosts = [
      ...baseline,
      {
        content: 'COMPLIANT notice',
        createdAt: 2,
        persona: 'securite',
        compliantLowScore: { uiPersonaKey: 'security', score: 12 },
      },
      { content: 'new generated', createdAt: 3, persona: 'productivite' },
    ];

    expect(queue.findUnrevealed(apiPosts)).toEqual([
      { content: 'new generated', createdAt: 3, persona: 'productivite' },
    ]);
  });

  it('uses default gap near 2s', () => {
    expect(POST_REVEAL_GAP_MS).toBeGreaterThanOrEqual(1800);
    expect(POST_REVEAL_GAP_MS).toBeLessThanOrEqual(2500);
  });

  it('counts new generated posts against the marked baseline', () => {
    const baseline = [{ content: 'old', createdAt: 1, persona: 'securite' }];
    const queue = createPostFeedRevealQueue({
      gapMs: 50,
      getBaseline: () => baseline,
      onPostsChange: () => {},
    });
    queue.markBaseline(baseline);
    const apiPosts = [
      ...baseline,
      { content: 'new-a', createdAt: 2, persona: 'productivite' },
      { content: 'new-b', createdAt: 3, persona: 'popularite' },
    ];
    expect(queue.countNewGeneratedInApi(apiPosts)).toBe(2);
  });

  it('sorts ISO createdAt strings from oldest to newest for reveal order', () => {
    const posts = [
      { content: 'third', createdAt: '2026-06-05T12:00:00.002Z', persona: 'popularite' },
      { content: 'first', createdAt: '2026-06-05T12:00:00.000Z', persona: 'productivite' },
      { content: 'second', createdAt: '2026-06-05T12:00:00.001Z', persona: 'securite' },
    ];

    expect(sortPostsForReveal(posts).map((p) => p.content)).toEqual(['first', 'second', 'third']);
  });

  describe('onPostRevealed (animation bridge)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('fires once per revealed post with its persona, spaced by the gap', async () => {
      vi.useFakeTimers();
      const revealed = [];
      const queue = createPostFeedRevealQueue({
        gapMs: 10,
        getBaseline: () => [],
        onPostsChange: () => {},
        onPostRevealed: (persona) => revealed.push(persona),
      });
      queue.markBaseline([]);
      queue.enqueue([
        { content: 'a', createdAt: 1, persona: 'securite' },
        { content: 'b', createdAt: 2, persona: 'popularite' },
      ]);
      // First reveal happens synchronously (no leading gap).
      expect(revealed).toEqual(['securite']);
      // Second reveal only after the configured gap elapses.
      await vi.advanceTimersByTimeAsync(10);
      expect(revealed).toEqual(['securite', 'popularite']);
    });

    it('reports the next visible post persona until that post is revealed', async () => {
      vi.useFakeTimers();
      const nextPersonas = [];
      const queue = createPostFeedRevealQueue({
        gapMs: 10,
        getBaseline: () => [],
        onPostsChange: () => {},
        onNextPostChange: (persona) => nextPersonas.push(persona),
      });
      queue.markBaseline([]);

      queue.enqueue([
        { content: 'a', createdAt: 1, persona: 'securite' },
        { content: 'b', createdAt: 2, persona: 'popularite' },
      ]);

      expect(nextPersonas).toEqual(['securite', 'popularite']);
      await vi.advanceTimersByTimeAsync(10);
      expect(nextPersonas).toEqual(['securite', 'popularite', null]);
    });

    it('commits the post to UI before firing the revealed callback', async () => {
      vi.useFakeTimers();
      const events = [];
      const queue = createPostFeedRevealQueue({
        gapMs: 10,
        getBaseline: () => [],
        onPostsChange: () => events.push('posts-change'),
        onPostRevealed: () => events.push('post-revealed'),
      });
      queue.markBaseline([]);

      queue.enqueue([{ content: 'a', createdAt: 1, persona: 'popularite' }]);

      expect(events).toEqual(['posts-change', 'post-revealed']);
    });

    it('awaits beforeRevealPost before committing the post', async () => {
      vi.useFakeTimers();
      const events = [];
      const queue = createPostFeedRevealQueue({
        gapMs: 10,
        getBaseline: () => [],
        beforeRevealPost: async () => {
          events.push('before-reveal');
          await Promise.resolve();
        },
        onPostsChange: () => events.push('posts-change'),
        onPostRevealed: () => events.push('post-revealed'),
      });
      queue.markBaseline([]);

      queue.enqueue([{ content: 'a', createdAt: 1, persona: 'popularite' }]);
      await queue.waitUntilIdle({ waitForEnterAnimation: false });

      expect(events).toEqual(['before-reveal', 'posts-change', 'post-revealed']);
    });
  });

  describe('single-post drain wedge (regression)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    // Reproduces the hosted/streaming bug: posts arrive one at a time, so the
    // first enqueue holds a single post and drains fully synchronously. A stale
    // `drainPromise` must NOT block later enqueues from draining posts 2 and 3.
    it('keeps draining when posts arrive one at a time', async () => {
      vi.useFakeTimers();
      const revealed = [];
      const queue = createPostFeedRevealQueue({
        gapMs: 10,
        getBaseline: () => [],
        onPostsChange: () => {},
        onPostRevealed: (persona) => revealed.push(persona),
      });
      queue.markBaseline([]);

      // Poll 1: one post -> synchronous drain.
      queue.enqueue([{ content: 'a', createdAt: 1, persona: 'securite' }]);
      expect(revealed).toEqual(['securite']);
      // The `.finally` microtask must null `drainPromise` so the queue is idle.
      await Promise.resolve();
      expect(queue.isIdle()).toBe(true);

      // Poll 2: a second post must start a NEW drain (the pre-fix bug dropped it).
      queue.enqueue([{ content: 'b', createdAt: 2, persona: 'popularite' }]);
      await vi.advanceTimersByTimeAsync(10);
      expect(revealed).toEqual(['securite', 'popularite']);

      // Poll 3: third post likewise reveals.
      queue.enqueue([{ content: 'c', createdAt: 3, persona: 'productivite' }]);
      await vi.advanceTimersByTimeAsync(10);
      expect(revealed).toEqual(['securite', 'popularite', 'productivite']);

      await Promise.resolve();
      expect(queue.isIdle()).toBe(true);
    });
  });
});
