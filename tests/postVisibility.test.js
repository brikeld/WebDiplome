import { describe, expect, it } from 'vitest';
import {
  normalizePostHideKey,
  resolveViewerHideStorageKey,
  viewerPostHideKey,
} from '../src/lib/postHideKey.js';
import { resolvePostHiddenState } from '../src/lib/postVisibility.js';

describe('postHideKey', () => {
  const createdAt = '2026-06-01T12:00:00.000Z';
  const ts = normalizePostHideKey(createdAt);

  it('uses author-global key for own posts', () => {
    const post = { authorSlug: 'alice', createdAt };
    expect(resolveViewerHideStorageKey(post, 'alice')).toBe(ts);
  });

  it('uses viewer-scoped key for another user post', () => {
    const post = { authorSlug: 'bob', createdAt };
    expect(resolveViewerHideStorageKey(post, 'alice')).toBe(`viewer-hide|bob|${ts}`);
    expect(viewerPostHideKey('bob', createdAt)).toBe(`viewer-hide|bob|${ts}`);
  });
});

describe('resolvePostHiddenState', () => {
  const createdAt = '2026-06-01T12:00:00.000Z';
  const hideKey = normalizePostHideKey(createdAt);
  const post = {
    createdAt,
    authorSlug: 'alice-abc',
  };

  it('uses author live scoring records for author self-hide (global)', () => {
    const hidden = resolvePostHiddenState(post, {
      authorRecords: { [hideKey]: { persona: 'security', delta: -2, restorable: 1 } },
      viewerSlug: 'bob',
      viewerIsHidden: () => false,
    });
    expect(hidden).toBe(true);
  });

  it('hides another user post only for the viewer who curated it', () => {
    const viewerKey = viewerPostHideKey('alice-abc', createdAt);
    const hiddenForViewer = resolvePostHiddenState(post, {
      authorRecords: {},
      viewerSlug: 'bob',
      viewerIsHidden: (key) => key === viewerKey,
    });
    const hiddenForOther = resolvePostHiddenState(post, {
      authorRecords: {},
      viewerSlug: 'carol',
      viewerIsHidden: () => false,
    });
    expect(hiddenForViewer).toBe(true);
    expect(hiddenForOther).toBe(false);
  });

  it('keeps legacy viewer hides local to the viewer who curated them', () => {
    const hiddenForBob = resolvePostHiddenState(post, {
      authorRecords: {},
      viewerSlug: 'bob',
      viewerIsHidden: (key) => key === hideKey,
    });
    const hiddenForCarol = resolvePostHiddenState(post, {
      authorRecords: {},
      viewerSlug: 'carol',
      viewerIsHidden: () => false,
    });
    expect(hiddenForBob).toBe(true);
    expect(hiddenForCarol).toBe(false);
  });

  it('falls back to viewer-local hide for own posts', () => {
    const hidden = resolvePostHiddenState(
      { ...post, authorSlug: 'bob' },
      {
        authorRecords: {},
        viewerSlug: 'bob',
        viewerIsHidden: (key) => key === hideKey,
      },
    );
    expect(hidden).toBe(true);
  });

  it('prefers live viewer state over stale author records when unhiding own posts', () => {
    const ownPost = { ...post, authorSlug: 'bob' };
    const hidden = resolvePostHiddenState(ownPost, {
      authorRecords: { [hideKey]: { persona: 'security', delta: -2, restorable: 1 } },
      viewerSlug: 'bob',
      viewerIsHidden: () => false,
    });
    expect(hidden).toBe(false);
  });

  it('never hides leaderboard posts at the card level', () => {
    const leaderboardPost = {
      createdAt,
      authorSlug: 'alice-abc',
      leaderboard: { boardId: 'most_secure' },
    };
    const hidden = resolvePostHiddenState(leaderboardPost, {
      authorRecords: { 'leaderboard-self|most_secure': { persona: 'security', delta: -1 } },
      viewerSlug: 'bob',
      viewerIsHidden: () => false,
      viewerIsLeaderboardSelfHidden: () => true,
    });
    expect(hidden).toBe(false);
  });
});
