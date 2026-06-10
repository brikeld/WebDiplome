import { describe, expect, it } from 'vitest';
import {
  demoSlotOffsetForSlug,
  isDemoRotateOperator,
  isDemoRotateTargetProfile,
  profileDisplayName,
  sortDemoRotateTargets,
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

  it('staggers demo slot offsets by sorted target index', () => {
    const profiles = [
      { firstname: 'Brikeld', lastname: 'Hoxha', slug: 'brikeld-hoxha' },
      { firstname: 'Daniel', lastname: 'Rocha', slug: 'daniel-rocha' },
      { firstname: 'Jonathan', lastname: 'Vögele', slug: 'jonathan-vogele' },
      { firstname: 'Léa', lastname: 'Verboux', slug: 'lea-verboux' },
      { firstname: 'Nyria', lastname: 'Graber', slug: 'nyria-graber' },
    ];
    const ordered = sortDemoRotateTargets(profiles);
    expect(ordered.map((p) => p.slug)).toEqual([
      'daniel-rocha',
      'jonathan-vogele',
      'lea-verboux',
      'nyria-graber',
    ]);
    expect(demoSlotOffsetForSlug('daniel-rocha', profiles)).toBe(0);
    expect(demoSlotOffsetForSlug('jonathan-vogele', profiles)).toBe(1);
    expect(demoSlotOffsetForSlug('lea-verboux', profiles)).toBe(2);
    expect(demoSlotOffsetForSlug('nyria-graber', profiles)).toBe(3);
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
