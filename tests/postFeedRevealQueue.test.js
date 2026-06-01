import { describe, expect, it, vi } from 'vitest';
import { createPostFeedRevealQueue, POST_REVEAL_GAP_MS } from '../src/lib/postFeedRevealQueue.js';

describe('createPostFeedRevealQueue', () => {
  it('reveals posts one at a time with gap', async () => {
    vi.useFakeTimers();
    const baseline = [{ content: 'old', createdAt: 1, persona: 'securite' }];
    const snapshots = [];
    const queue = createPostFeedRevealQueue({
      gapMs: 100,
      getBaseline: () => baseline,
      onPostsChange: (posts) => snapshots.push(posts.map((p) => p.content)),
    });
    queue.markBaseline(baseline);
    queue.enqueue([
      { content: 'a', createdAt: 2, persona: 'securite' },
      { content: 'b', createdAt: 3, persona: 'securite' },
    ]);

    await vi.advanceTimersByTimeAsync(0);
    expect(snapshots.at(-1)).toEqual(['a', 'old']);

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();
    await queue.waitUntilIdle();

    expect(snapshots.at(-1)).toEqual(['a', 'b', 'old']);
    vi.useRealTimers();
  });

  it('uses default gap near 2.5s', () => {
    expect(POST_REVEAL_GAP_MS).toBeGreaterThanOrEqual(2000);
    expect(POST_REVEAL_GAP_MS).toBeLessThanOrEqual(3000);
  });
});
