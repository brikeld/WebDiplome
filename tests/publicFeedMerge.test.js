import { describe, expect, it } from 'vitest';
import { mergeSummaryAndFeedProfiles } from '../src/lib/publicFeedMerge.js';

describe('mergeSummaryAndFeedProfiles', () => {
  it('keeps lightweight summaries and attaches only the recent feed posts', () => {
    const merged = mergeSummaryAndFeedProfiles(
      [
        { slug: 'brikeld', displayName: 'Brikeld Hoxha', personaPosts: [{ id: 'stale' }] },
        { slug: 'ada', displayName: 'Ada Lovelace' },
      ],
      [
        { slug: 'brikeld', personaPosts: [{ id: 'new-1', createdAt: 200 }] },
        { slug: 'ada', personaPosts: [{ id: 'new-2', createdAt: 100 }] },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged.find((p) => p.slug === 'brikeld')?.displayName).toBe('Brikeld Hoxha');
    expect(merged.find((p) => p.slug === 'brikeld')?.personaPosts).toEqual([
      { id: 'new-1', createdAt: 200 },
    ]);
    expect(merged.find((p) => p.slug === 'ada')?.personaPosts).toEqual([
      { id: 'new-2', createdAt: 100 },
    ]);
  });

  it('includes feed authors that are missing from the summary list', () => {
    const merged = mergeSummaryAndFeedProfiles([], [
      { slug: 'late', displayName: 'Late User', personaPosts: [{ id: 'p1' }] },
    ]);

    expect(merged).toEqual([
      { slug: 'late', displayName: 'Late User', personaPosts: [{ id: 'p1' }] },
    ]);
  });
});
