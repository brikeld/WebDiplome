import { describe, expect, it } from 'vitest';
import {
  harvestPayloadHasContent,
  mergeGenerationRequestPayload,
  countAiGeneratedPosts,
  queuePostsJobAfterHarvestSync,
} from '../server/lib/generationQueue.js';

describe('generationQueue helpers', () => {
  it('detects empty vs real harvest payloads', () => {
    expect(harvestPayloadHasContent(null)).toBe(false);
    expect(harvestPayloadHasContent({})).toBe(false);
    expect(harvestPayloadHasContent({ user_identity: { name: 'A' } })).toBe(true);
    expect(harvestPayloadHasContent({ hostname: 'mac', model: 'MacBook' })).toBe(true);
  });

  it('merges incoming dataJson over empty queued payload', () => {
    const merged = mergeGenerationRequestPayload(
      { jobType: 'posts', dataJson: {}, user: { first_name: 'Old' } },
      { dataJson: { hostname: 'demo' }, user: { first_name: 'New' } },
    );
    expect(merged.dataJson).toEqual({ hostname: 'demo' });
    expect(merged.user.first_name).toBe('New');
  });

  it('counts only non-system posts', () => {
    const n = countAiGeneratedPosts([
      { content: 'hello', persona: 'productivite' },
      { content: 'join', compliantJoin: true },
    ]);
    expect(n).toBe(1);
  });

  it('skips harvest sync queue when dataJson is empty', async () => {
    const outcome = await queuePostsJobAfterHarvestSync({
      profileStore: { getProfileRowBySlug: async () => null },
      jobStore: {},
      profileSlug: 'demo',
      syncDataJson: {},
    });
    expect(outcome.reason).toBe('profile_not_found');
  });
});
