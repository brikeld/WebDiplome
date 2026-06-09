import { describe, expect, it } from 'vitest';
import {
  isDemoRotateOperator,
  isDemoRotateTargetProfile,
  profileDisplayName,
} from '../server/lib/demoRotate.js';
import {
  canUseDemoRotateControl,
  isDemoRotateTargetProfile as isClientTarget,
  listDemoRotateTargets,
} from '../src/lib/demoRotate.js';

describe('demoRotate server helpers', () => {
  it('identifies operator by display name', () => {
    expect(isDemoRotateOperator({ firstname: 'Brikeld', lastname: 'Hoxha' })).toBe(true);
    expect(isDemoRotateOperator({ displayName: 'Brikeld Hoxha' })).toBe(true);
    expect(isDemoRotateOperator({ firstname: 'Alex', lastname: 'Johnson' })).toBe(false);
  });

  it('excludes operator from rotate targets', () => {
    expect(isDemoRotateTargetProfile({ firstname: 'Brikeld', lastname: 'Hoxha' })).toBe(false);
    expect(isDemoRotateTargetProfile({ firstname: 'Alex', lastname: 'Johnson' })).toBe(true);
  });

  it('builds display name from parts', () => {
    expect(profileDisplayName({ firstname: 'Alex', lastname: 'Johnson' })).toBe('Alex Johnson');
  });
});

describe('demoRotate client helpers', () => {
  it('filters rotate targets', () => {
    const profiles = [
      { firstname: 'Brikeld', lastname: 'Hoxha', slug: 'brikeld' },
      { firstname: 'Alex', lastname: 'Johnson', slug: 'alex' },
      { firstname: 'Sam', lastname: 'Lee', slug: 'sam' },
    ];
    const targets = listDemoRotateTargets(profiles);
    expect(targets.map((p) => p.slug)).toEqual(['alex', 'sam']);
    expect(isClientTarget(profiles[0])).toBe(false);
    expect(canUseDemoRotateControl(profiles[0])).toBe(false);
  });
});
