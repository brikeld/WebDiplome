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

  it('orders revealed posts across authors by global reveal sequence', () => {
    // _feedRevealSeq is a GLOBAL counter shared across authors, so it reflects
    // the real order posts were revealed. Round-robin reveal order a1, b1, a2
    // must render newest-reveal-first with B interleaved between A's two posts —
    // A's older post never clings directly below A's newer one.
    const a1 = { content: 'A first', createdAt: '2026-06-15T10:00:00Z', _feedRevealSeq: 1 };
    const b1 = { content: 'B first', createdAt: '2026-06-15T10:00:10Z', _feedRevealSeq: 2 };
    const a2 = { content: 'A second', createdAt: '2026-06-15T10:00:20Z', _feedRevealSeq: 3 };

    expect([a1, a2, b1].sort(sortNewestFirst)).toEqual([a2, b1, a1]);
  });

  it('prioritises global reveal sequence over an unreliable createdAt', () => {
    // The hosted worker/DB does not stamp createdAt monotonically across cycles,
    // so a post revealed later can carry an older timestamp. Reveal order (seq)
    // is authoritative: the later-revealed post (higher seq) stays on top even
    // though its createdAt is older.
    const revealedLater = {
      content: 'revealed later, stale timestamp',
      createdAt: '2026-06-15T09:00:00Z',
      _feedRevealSeq: 5,
    };
    const revealedEarlier = {
      content: 'revealed earlier, fresher timestamp',
      createdAt: '2026-06-15T10:00:00Z',
      _feedRevealSeq: 4,
    };

    expect([revealedEarlier, revealedLater].sort(sortNewestFirst)).toEqual([
      revealedLater,
      revealedEarlier,
    ]);
  });
});
