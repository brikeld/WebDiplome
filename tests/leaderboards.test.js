import { describe, it, expect } from 'vitest';
import {
  decay,
  scoreCloneFor,
  FAKE_CLONE_IDENTITY,
  FAKE_CLONE_COUNT,
  CLONE_DRIFT_BUCKET_MS,
} from '../server/lib/leaderboards.js';

describe('decay(nowHour, peakHour)', () => {
  it('returns 1 at the peak hour', () => {
    expect(decay(11, 11)).toBeCloseTo(1, 5);
  });

  it('returns -1 twelve hours from peak (antipeak)', () => {
    expect(decay(23, 11)).toBeCloseTo(-1, 5);
  });

  it('returns 0 six hours from peak', () => {
    expect(decay(17, 11)).toBeCloseTo(0, 5);
    expect(decay(5, 11)).toBeCloseTo(0, 5);
  });

  it('wraps across midnight', () => {
    expect(decay(1, 23)).toBeCloseTo(decay(23, 1), 5);
  });
});

describe('FAKE_CLONE_IDENTITY + FAKE_CLONE_COUNT', () => {
  it('matches the demo commenter identity used elsewhere', () => {
    expect(FAKE_CLONE_IDENTITY.displayName).toBe('Alex Johnson');
    expect(FAKE_CLONE_IDENTITY.handle).toBe('@AlexLaptop');
    expect(FAKE_CLONE_IDENTITY.avatarSrc).toBe('/imgs/AlexP.png');
  });

  it('exposes 4 clones', () => {
    expect(FAKE_CLONE_COUNT).toBe(4);
  });
});

describe('scoreCloneFor', () => {
  it('is deterministic for the same boardId / cloneIdx / nowMs', () => {
    const t = 1_700_000_000_000;
    expect(scoreCloneFor('most_productive', 0, t)).toBe(
      scoreCloneFor('most_productive', 0, t),
    );
  });

  it('differs across cloneIdx for the same board / nowMs', () => {
    const t = 1_700_000_000_000;
    const a = scoreCloneFor('most_productive', 0, t);
    const b = scoreCloneFor('most_productive', 1, t);
    const c = scoreCloneFor('most_productive', 2, t);
    const d = scoreCloneFor('most_productive', 3, t);
    expect(new Set([a, b, c, d]).size).toBeGreaterThan(1);
  });

  it('changes when the 10-minute drift bucket advances', () => {
    const t1 = 1_700_000_000_000;
    const t2 = t1 + CLONE_DRIFT_BUCKET_MS;
    expect(scoreCloneFor('most_productive', 0, t1)).not.toBe(
      scoreCloneFor('most_productive', 0, t2),
    );
  });

  it('does NOT change inside a single 10-minute bucket', () => {
    const t1 = 1_700_000_000_000;
    const t2 = t1 + CLONE_DRIFT_BUCKET_MS - 1;
    expect(scoreCloneFor('most_productive', 0, t1)).toBe(
      scoreCloneFor('most_productive', 0, t2),
    );
  });

  it('returns a finite number', () => {
    const t = Date.now();
    for (let i = 0; i < 4; i++) {
      const s = scoreCloneFor('most_productive', i, t);
      expect(Number.isFinite(s)).toBe(true);
    }
  });
});
