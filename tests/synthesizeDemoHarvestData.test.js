import { describe, expect, it } from 'vitest';
import { synthesizeHarvestDataFromProfile } from '../server/lib/synthesizeDemoHarvestData.js';
import { harvestPayloadHasContent } from '../server/lib/generationQueue.js';

describe('synthesizeHarvestDataFromProfile', () => {
  it('returns null when profile has no AI posts and no identity slug', () => {
    const data = synthesizeHarvestDataFromProfile(
      { display_name: 'User' },
      { personaPosts: [] },
    );
    expect(data).toBeNull();
  });

  it('builds harvest-shaped JSON from stored profile + existing posts', () => {
    const data = synthesizeHarvestDataFromProfile(
      {
        slug: 'daniel-rocha',
        display_name: 'Daniel Rocha',
        machine_name: 'Daniels-MacBook',
        raw_profile: { hardwareChip: 'M2', ram: '16 GB' },
      },
      {
        slug: 'daniel-rocha',
        displayName: 'Daniel Rocha',
        personaPosts: [
          { persona: 'productivite', content: 'Shipped a new feature today.' },
          { persona: 'securite', content: 'Enabled firewall rules.' },
        ],
      },
    );

    expect(harvestPayloadHasContent(data)).toBe(true);
    expect(data._synthesizedForRegeneration).toBe(true);
    expect(data.MACHINE_IDENTITY.hostname).toBe('Daniels-MacBook');
    expect(data.MACHINE_IDENTITY.installed_apps.length).toBeGreaterThanOrEqual(20);
    expect(data.PAST_HISTORY.browser_history.safari.length).toBeGreaterThan(0);
    expect(data.PAST_HISTORY.app_usage_7days.length).toBeGreaterThan(0);
  });
});
