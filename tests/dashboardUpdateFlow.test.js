import { describe, expect, it } from 'vitest';
import {
  formatDashboardCountdown,
  getDashboardTimerRingModel,
} from '../src/features/harvest/dashboardUpdateFlow.js';

describe('dashboard update flow timer', () => {
  it('formats remaining time as padded minutes and seconds', () => {
    expect(formatDashboardCountdown(10 * 60 * 1000)).toBe('10:00');
    expect(formatDashboardCountdown(8 * 60 * 1000 + 4200)).toBe('08:05');
    expect(formatDashboardCountdown(0)).toBe('00:00');
  });

  it('clamps invalid or negative time to zero', () => {
    expect(formatDashboardCountdown(-1500)).toBe('00:00');
    expect(formatDashboardCountdown(Number.NaN)).toBe('00:00');
  });

  it('returns three concentric ring angles derived from remaining progress', () => {
    expect(getDashboardTimerRingModel(5 * 60 * 1000, 10 * 60 * 1000)).toEqual({
      outer: 205,
      middle: 150,
      inner: 95,
    });
  });

  it('keeps the ring model useful at the ends of the countdown', () => {
    expect(getDashboardTimerRingModel(10 * 60 * 1000, 10 * 60 * 1000)).toEqual({
      outer: 355,
      middle: 270,
      inner: 185,
    });
    expect(getDashboardTimerRingModel(0, 10 * 60 * 1000)).toEqual({
      outer: 55,
      middle: 30,
      inner: 5,
    });
  });
});
