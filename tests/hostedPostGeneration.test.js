import { afterEach, describe, expect, it, vi } from 'vitest';
import { runHostedPostGenerationWithReveal } from '../src/lib/hostedPostGeneration.js';
import { attachApiPersonaPosts } from '../src/lib/profileReload.js';

describe('runHostedPostGenerationWithReveal', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('stops polling once the expected posts are revealed', async () => {
    vi.useFakeTimers();
    const posts = [
      { content: 'first', createdAt: '2026-06-05T12:00:00.000Z', persona: 'productivite' },
      { content: 'second', createdAt: '2026-06-05T12:00:00.001Z', persona: 'securite' },
      { content: 'third', createdAt: '2026-06-05T12:00:00.002Z', persona: 'popularite' },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        job: {
          status: 'complete',
          generationPlan: [
            { slotIndex: 0, persona: 'productivite' },
            { slotIndex: 1, persona: 'securite' },
            { slotIndex: 2, persona: 'popularite' },
          ],
          posts,
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const reloadProfileFromApi = vi.fn(async () => attachApiPersonaPosts({ personaPosts: posts }, posts));
    const revealed = [];

    const run = runHostedPostGenerationWithReveal({
      jobId: 'job-1',
      reloadProfileFromApi,
      getBaselinePosts: () => [],
      applyRevealedPosts: () => {},
      onPostRevealed: (persona) => revealed.push(persona),
      pollMs: 1000,
      timeoutMs: 10000,
    });

    await vi.advanceTimersByTimeAsync(4000);
    await run;

    expect(revealed).toEqual(['productivite', 'securite', 'popularite']);
    expect(reloadProfileFromApi).toHaveBeenCalledTimes(2);
  });
});
