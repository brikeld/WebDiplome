import { describe, expect, it } from 'vitest';
import {
  canManuallyGenerateDashboardUpdate,
  isAdminProfile,
} from '../src/lib/adminProfile.js';

describe('adminProfile', () => {
  it('treats Brikeld Hoxha as the default admin', () => {
    expect(isAdminProfile({ firstname: 'Brikeld', lastname: 'Hoxha' })).toBe(true);
    expect(isAdminProfile({ displayName: 'Brikeld Hoxha' })).toBe(true);
    expect(isAdminProfile({ slug: 'brikeld-hoxha-e3733513' })).toBe(true);
  });

  it('does not treat other profiles as admins', () => {
    expect(isAdminProfile({ firstname: 'Ada', lastname: 'Lovelace', slug: 'ada-lovelace' })).toBe(false);
    expect(canManuallyGenerateDashboardUpdate({ displayName: 'Ada Lovelace' })).toBe(false);
  });
});
