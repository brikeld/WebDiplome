import { describe, expect, it } from 'vitest';
import { getProfileTabs, PROFILE_TABS } from '../src/features/profile/profileTabs.js';

describe('profileTabs', () => {
  it('uses Profile on hosted production', () => {
    const hosted = getProfileTabs({ local: false });
    expect(hosted.find((t) => t.id === 'profile')?.label).toBe('Profile');
    expect(PROFILE_TABS.find((t) => t.id === 'profile')?.label).toBe('Profile');
  });

  it('uses Data for the profile tab in local demo', () => {
    const local = getProfileTabs({ local: true });
    expect(local.find((t) => t.id === 'profile')?.label).toBe('Data');
    expect(local.find((t) => t.id === 'profile')?.paneLabel).toBe('data');
  });
});
