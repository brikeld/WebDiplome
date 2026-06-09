import { describe, expect, it } from 'vitest';
import { normalizePostHideKey } from '../src/lib/postHideKey.js';
import { resolvePostHiddenState } from '../src/lib/postVisibility.js';

describe('resolvePostHiddenState', () => {
  const createdAt = '2026-06-01T12:00:00.000Z';
  const hideKey = normalizePostHideKey(createdAt);
  const post = {
    createdAt,
    authorSlug: 'alice-abc',
  };

  it('uses author live scoring records for cross-user hide sync', () => {
    const hidden = resolvePostHiddenState(post, {
      authorRecords: { [hideKey]: { persona: 'security', delta: -2, restorable: 1 } },
      viewerIsHidden: () => false,
    });
    expect(hidden).toBe(true);
  });

  it('falls back to viewer-local hide for feed curation', () => {
    const hidden = resolvePostHiddenState(post, {
      authorRecords: {},
      viewerIsHidden: (key) => key === hideKey,
    });
    expect(hidden).toBe(true);
  });
});
