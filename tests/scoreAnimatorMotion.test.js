import { describe, expect, it } from 'vitest';
import { getParticleFlightPlan } from '../src/features/liveScoring/ScoreAnimator.jsx';

describe('score particle motion plan', () => {
  it('launches normal post hide from the confirm action before redacting the post', () => {
    const plan = getParticleFlightPlan({
      isHide: true,
      isReveal: false,
      isLeaderboardHide: false,
      isLeaderboardReveal: false,
      hasWaypoint: true,
    });

    expect(plan.startDelay).toBeLessThanOrEqual(80);
    expect(plan.duration).toBeGreaterThanOrEqual(980);
    expect(plan.duration).toBeLessThanOrEqual(1220);
    expect(plan.waypoint.hitEnd).toBeGreaterThanOrEqual(0.24);
    expect(plan.waypoint.hitEnd).toBeLessThanOrEqual(0.36);
    expect(plan.waypoint.hitEnd).toBeLessThan(plan.waypoint.holdEnd);
    expect(plan.waypoint.holdEnd).toBeLessThanOrEqual(0.48);
  });

  it('does not delay leaderboard hide before the row redaction begins', () => {
    const plan = getParticleFlightPlan({
      isHide: true,
      isReveal: false,
      isLeaderboardHide: true,
      isLeaderboardReveal: false,
      hasWaypoint: true,
    });

    expect(plan.startDelay).toBeLessThanOrEqual(80);
    expect(plan.duration).toBeGreaterThanOrEqual(980);
    expect(plan.duration).toBeLessThanOrEqual(1240);
    expect(plan.waypoint.hitEnd).toBeGreaterThanOrEqual(0.24);
    expect(plan.waypoint.hitEnd).toBeLessThanOrEqual(0.38);
    expect(plan.waypoint.holdEnd).toBeGreaterThan(plan.waypoint.hitEnd);
    expect(plan.waypoint.holdEnd).toBeLessThanOrEqual(0.56);
  });
});
