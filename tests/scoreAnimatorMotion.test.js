import { describe, expect, it } from 'vitest';
import { getParticleFlightPlan } from '../src/features/liveScoring/ScoreAnimator.jsx';

describe('score particle motion plan', () => {
  it('splits waypoint hide motion into hit, hold, and longer score-transfer phases', () => {
    const plan = getParticleFlightPlan({
      isHide: true,
      isReveal: false,
      isLeaderboardHide: false,
      isLeaderboardReveal: false,
      hasWaypoint: true,
    });

    expect(plan.duration).toBeGreaterThanOrEqual(1600);
    expect(plan.waypoint.hitEnd).toBeLessThan(plan.waypoint.holdEnd);
    expect(plan.waypoint.holdEnd).toBeLessThan(0.5);
    expect(1 - plan.waypoint.holdEnd).toBeGreaterThan(0.5);
  });
});
