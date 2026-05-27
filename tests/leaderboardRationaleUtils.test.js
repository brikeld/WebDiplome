import { describe, expect, it } from 'vitest';
import {
  parseUserSignals,
  buildSignalExamples,
  examplesDisplayCount,
} from '../src/features/inferenceChain/leaderboardRationaleUtils.js';

describe('examplesDisplayCount', () => {
  it('shows all names for small counts', () => {
    expect(examplesDisplayCount(2)).toBe(2);
    expect(examplesDisplayCount(4)).toBe(4);
  });

  it('caps names for large counts', () => {
    expect(examplesDisplayCount(30)).toBe(4);
    expect(examplesDisplayCount(12)).toBe(3);
  });
});

describe('buildSignalExamples', () => {
  it('returns overflow when count exceeds shown sample', () => {
    const { shown, overflow } = buildSignalExamples('unique_wifi', 30, 'most_socially_isolated', 1);
    expect(shown.length).toBe(4);
    expect(overflow).toBe(26);
  });

  it('is deterministic for the same inputs', () => {
    const a = buildSignalExamples('vpn', 2, 'most_secure', 0);
    const b = buildSignalExamples('vpn', 2, 'most_secure', 0);
    expect(a).toEqual(b);
    expect(a.shown.length).toBe(2);
  });
});

describe('parseUserSignals', () => {
  it('attaches example names for vpn and café wifi chips', () => {
    const hint = '2 VPN app(s), 2 café wifi network(s), health app installed: false.';
    const signals = parseUserSignals(hint, 'most_secure');
    const vpn = signals.find((s) => s.bucket === 'vpn');
    const cafe = signals.find((s) => s.bucket === 'cafe_wifi');
    expect(vpn?.shown?.length).toBe(2);
    expect(cafe?.shown?.length).toBe(2);
    expect(vpn.shown.every((n) => typeof n === 'string' && n.length > 0)).toBe(true);
  });

  it('limits unique wifi examples with overflow', () => {
    const signals = parseUserSignals('30 unique wifi network(s).', 'most_socially_isolated');
    expect(signals[0].shown.length).toBe(4);
    expect(signals[0].overflow).toBe(26);
  });
});
