import { describe, expect, it } from 'vitest';
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

  it('uses default gap near 2.5s', () => {
    expect(POST_REVEAL_GAP_MS).toBeGreaterThanOrEqual(2000);
    expect(POST_REVEAL_GAP_MS).toBeLessThanOrEqual(3000);
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
});
