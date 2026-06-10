import { describe, expect, it } from 'vitest';
import { pickThirdSlotKind, preparePersonaPostSlotPlan } from '../server/lib/personaPostGenerator.js';

const fakeProfile = { firstname: 'Test', lastname: 'User' };

const fakeData = {
  MACHINE_IDENTITY: { installed_apps: ['Cursor'] },
  PAST_HISTORY: {
    app_usage_7days: [{ app: 'Cursor', last_used: '2026-05-25T10:00:00Z' }],
    recent_files_7days: [],
    browser_history: { chrome: [], safari: [] },
    wifi_history: ['Home'],
    recent_downloads: [],
  },
};

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

    expect(plan).toHaveLength(3);
    expect(plan[0]).toMatchObject({ slotIndex: 0, id: 'text', persona: expect.any(String) });
    expect(plan[1]).toMatchObject({ slotIndex: 1, id: 'asset' });
    expect(plan[2]).toMatchObject({ slotIndex: 2, id: 'chart' });
  });

  it('plans leaderboard for slot 2 after a chart post', async () => {
    const priorTextPosts = Array.from({ length: 8 }, (_, i) => ({
      content: `warmup ${i}`,
      persona: 'productivite',
      createdAt: `2026-05-20T${String(i).padStart(2, '0')}:00:00Z`,
    }));
    const plan = await preparePersonaPostSlotPlan({
      userPayload: '{}',
      profile: fakeProfile,
      dataJson: fakeData,
      existingPosts: [{ chartType: 'browser_domains' }, ...priorTextPosts],
    });

    expect(plan[2]).toMatchObject({ slotIndex: 2, id: 'leaderboard' });
  });
});

describe('pickThirdSlotKind', () => {
  it('picks chart after leaderboard', () => {
    expect(pickThirdSlotKind([{ leaderboard: { boardId: 'most_productive' } }])).toBe('chart');
  });
});
