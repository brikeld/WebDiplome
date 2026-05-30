import { describe, expect, it } from 'vitest';
import {
  buildLmUserPayload,
  compactHarvestDataForLm,
} from '../server/lib/compactHarvestData.js';

describe('compactHarvestDataForLm', () => {
  it('drops SCORING_DATA and HARVESTED_ASSETS and caps arrays', () => {
    const huge = {
      collected_at: '2026-05-30',
      MACHINE_IDENTITY: {
        hostname: 'demo',
        installed_apps: Array.from({ length: 200 }, (_, i) => `App ${i}`),
        profile_picture: 'data:image/jpeg;base64,' + 'A'.repeat(20_000),
      },
      PAST_HISTORY: {
        browser_history: {
          chrome: Array.from({ length: 50 }, (_, i) => ({
            url: `https://example.com/${i}`,
            title: 'x'.repeat(200),
          })),
        },
        wifi_history: Array.from({ length: 40 }, (_, i) => `net-${i}`),
      },
      SCORING_DATA: { axe_sommeil_rythme: { sleep_rhythm_signals: 'x'.repeat(10_000) } },
      HARVESTED_ASSETS: { recent_images: ['a.jpg'] },
    };

    const compact = compactHarvestDataForLm(huge);
    expect(compact.SCORING_DATA).toBeUndefined();
    expect(compact.HARVESTED_ASSETS).toBeUndefined();
    expect(compact.MACHINE_IDENTITY.installed_apps).toHaveLength(25);
    expect(compact.MACHINE_IDENTITY.profile_picture).toBeUndefined();
    expect(compact.PAST_HISTORY.browser_history.chrome).toHaveLength(5);
    expect(compact.PAST_HISTORY.wifi_history).toHaveLength(8);
    expect(JSON.stringify(compact).length).toBeLessThan(8000);
  });

  it('buildLmUserPayload stays small enough for modest context windows', () => {
    const payload = buildLmUserPayload(
      { first_name: 'Ada', last_name: 'Lovelace' },
      {
        MACHINE_IDENTITY: { hostname: 'mac', installed_apps: ['Safari', 'Xcode'] },
        PAST_HISTORY: { app_usage_7days: [{ app: 'Safari', minutes: 10 }] },
        SCORING_DATA: { big: 'x'.repeat(50_000) },
      },
    );
    expect(payload.length).toBeLessThan(6000);
    expect(JSON.parse(payload).profile.SCORING_DATA).toBeUndefined();
  });
});
