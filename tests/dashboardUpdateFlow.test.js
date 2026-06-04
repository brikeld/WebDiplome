import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_UPDATE_INTERVAL_MS,
  formatDashboardCountdown,
  getDashboardCountdownNextRemaining,
  getDashboardControlLayout,
  getDashboardTimerRingModel,
  shouldAutoTriggerDashboardUpdate,
} from '../src/features/harvest/dashboardUpdateFlow.js';

describe('dashboard update flow timer', () => {
  it('uses a 5 minute update interval', () => {
    expect(DASHBOARD_UPDATE_INTERVAL_MS).toBe(5 * 60 * 1000);
  });

  it('formats remaining time as padded minutes and seconds', () => {
    expect(formatDashboardCountdown(5 * 60 * 1000)).toBe('05:00');
    expect(formatDashboardCountdown(8 * 60 * 1000 + 4200)).toBe('08:05');
    expect(formatDashboardCountdown(0)).toBe('00:00');
  });

  it('clamps invalid or negative time to zero', () => {
    expect(formatDashboardCountdown(-1500)).toBe('00:00');
    expect(formatDashboardCountdown(Number.NaN)).toBe('00:00');
  });

  it('returns three concentric ring angles derived from remaining progress', () => {
    expect(getDashboardTimerRingModel(2.5 * 60 * 1000, 5 * 60 * 1000)).toEqual({
      outer: 205,
      middle: 150,
      inner: 95,
    });
  });

  it('keeps the ring model useful at the ends of the countdown', () => {
    expect(getDashboardTimerRingModel(5 * 60 * 1000, 5 * 60 * 1000)).toEqual({
      outer: 355,
      middle: 270,
      inner: 185,
    });
    expect(getDashboardTimerRingModel(0, 5 * 60 * 1000)).toEqual({
      outer: 55,
      middle: 30,
      inner: 5,
    });
  });

  it('keeps update states in the top update slot after removing ranking', () => {
    expect(getDashboardControlLayout({ harvestPhase: 'idle', postPhase: 'idle' })).toEqual({
      actionSlot: 'timer',
    });
    expect(getDashboardControlLayout({ harvestPhase: 'harvesting', postPhase: 'idle' })).toEqual({
      actionSlot: 'harvest',
    });
    expect(getDashboardControlLayout({ harvestPhase: 'idle', postPhase: 'generating' })).toEqual({
      actionSlot: 'generating',
    });
    expect(getDashboardControlLayout({ harvestPhase: 'idle', postPhase: 'deltas' })).toEqual({
      actionSlot: 'deltas',
    });
  });

  it('only decrements countdown while the page timer is active and visible', () => {
    expect(
      getDashboardCountdownNextRemaining(5 * 60 * 1000, 1000, { active: true, visible: true }),
    ).toBe(5 * 60 * 1000 - 1000);
    expect(
      getDashboardCountdownNextRemaining(5 * 60 * 1000, 1000, { active: true, visible: false }),
    ).toBe(5 * 60 * 1000);
    expect(
      getDashboardCountdownNextRemaining(5 * 60 * 1000, 1000, { active: false, visible: true }),
    ).toBe(5 * 60 * 1000);
  });

  it('auto triggers only when the visible countdown reaches zero and generation is idle', () => {
    expect(
      shouldAutoTriggerDashboardUpdate({
        remainingMs: 0,
        timerActive: true,
        accountFeaturesEnabled: true,
        postLoading: false,
        harvestPhase: 'idle',
      }),
    ).toBe(true);
    expect(
      shouldAutoTriggerDashboardUpdate({
        remainingMs: 0,
        timerActive: false,
        accountFeaturesEnabled: true,
        postLoading: false,
        harvestPhase: 'idle',
      }),
    ).toBe(false);
    expect(
      shouldAutoTriggerDashboardUpdate({
        remainingMs: 0,
        timerActive: true,
        accountFeaturesEnabled: true,
        postLoading: true,
        harvestPhase: 'idle',
      }),
    ).toBe(false);
  });
});
