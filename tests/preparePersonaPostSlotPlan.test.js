import { describe, expect, it } from 'vitest';
import { preparePersonaPostSlotPlan } from '../server/lib/personaPostGenerator.js';

describe('preparePersonaPostSlotPlan', () => {
  it('returns ordered slot personas before LM calls', async () => {
    const plan = await preparePersonaPostSlotPlan({
      userPayload: '{}',
      profile: {
        personaScores: { productivity: 80, security: 40, social: 60 },
      },
      existingPosts: [],
      skipLeaderboard: true,
    });

    expect(plan.length).toBeGreaterThanOrEqual(3);
    expect(plan[0]).toMatchObject({ slotIndex: 0, id: 'text', persona: expect.any(String) });
    expect(plan[1]).toMatchObject({ slotIndex: 1, id: 'asset' });
    expect(plan[2]).toMatchObject({ slotIndex: 2, id: 'chart' });
  });
});
