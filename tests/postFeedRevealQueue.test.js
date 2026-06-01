import { afterEach, describe, expect, it, vi } from 'vitest';
import { isCompliantSystemPost } from '../src/lib/mergePersonaPosts.js';
import { createPostFeedRevealQueue, POST_REVEAL_GAP_MS } from '../src/lib/postFeedRevealQueue.js';

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
  });
});
