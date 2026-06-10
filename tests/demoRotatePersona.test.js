import { describe, expect, it } from 'vitest';
import { resolveDemoSinglePostPersona } from '../server/lib/demoRotatePersona.js';

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

describe('resolveDemoSinglePostPersona', () => {
  it('uses slotOffset so staggered users pick different slot personas', async () => {
    const profile = {
      firstname: 'Daniel',
      lastname: 'Rocha',
      personaScores: { productivity: 80, security: 40, social: 60 },
      personaPosts: [],
    };

    const offset0 = await resolveDemoSinglePostPersona({
      profile,
      dataJson: fakeData,
      slotOffset: 0,
    });
    const offset1 = await resolveDemoSinglePostPersona({
      profile,
      dataJson: fakeData,
      slotOffset: 1,
    });
    const offset2 = await resolveDemoSinglePostPersona({
      profile,
      dataJson: fakeData,
      slotOffset: 2,
    });

    expect(offset0).toBeTruthy();
    expect(offset1).toBeTruthy();
    expect(offset2).toBeTruthy();
    expect(new Set([offset0, offset1, offset2]).size).toBe(3);
  });
});
