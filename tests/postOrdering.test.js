import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sortNewestFirst } from '../src/features/feed/PostsTab.jsx';

describe('PostsTab feed ordering', () => {
  it('does not special-case COMPLIANT join posts above newer posts', () => {
    const source = readFileSync(new URL('../src/features/feed/PostsTab.jsx', import.meta.url), 'utf8');
    const sortBody = source.match(/function sortNewestFirst\(a, b\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(sortBody).not.toContain('isCompliantJoinPost');
    expect(sortBody).toContain('postCreatedAtMs');
  });

  it('keeps staged feed reveals ahead of older baseline posts', () => {
    const baseline = { content: 'baseline', createdAt: '2030-01-01T00:00:00.000Z' };
    const firstReveal = {
      content: 'first generated',
      createdAt: '2020-01-01T00:00:00.000Z',
      _feedRevealSeq: 1,
    };
    const secondReveal = {
      content: 'second generated',
      createdAt: '2020-01-01T00:00:01.000Z',
      _feedRevealSeq: 2,
    };

    expect([baseline, firstReveal, secondReveal].sort(sortNewestFirst)).toEqual([
      secondReveal,
      firstReveal,
      baseline,
    ]);
  });

  it('orders revealed posts across authors by real time, not per-author reveal seq', () => {
    // _feedRevealSeq is a PER-AUTHOR queue counter, so its magnitude is not
    // comparable across authors. A prolific author Y's older post carries a
    // higher seq than a quieter author X's newer post; the feed must still
    // order by actual createdAt so X's newer post stays above Y's older one.
    const yNew = {
      content: 'Y newest',
      createdAt: '2026-06-15T10:00:03.000Z',
      _feedRevealSeq: 6,
    };
    const xNew = {
      content: 'X newest',
      createdAt: '2026-06-15T10:00:02.000Z',
      _feedRevealSeq: 3,
    };
    const yOld = {
      content: 'Y older (round 1)',
      createdAt: '2026-06-15T10:00:01.000Z',
      _feedRevealSeq: 5,
    };

    expect([yOld, xNew, yNew].sort(sortNewestFirst)).toEqual([yNew, xNew, yOld]);
  });
});
