import { describe, it, expect } from 'vitest';
import { shouldApplyPostImageFx } from '../src/lib/shouldApplyPostImageFx.js';

describe('shouldApplyPostImageFx', () => {
  it('skips FX for algorithm-generated charts', () => {
    expect(shouldApplyPostImageFx({ chartType: 'battery_hardware' })).toBe(false);
  });

  it('applies FX for harvested screenshots and photos', () => {
    expect(shouldApplyPostImageFx({})).toBe(true);
    expect(shouldApplyPostImageFx({ attachedAsset: { kind: 'image' } })).toBe(true);
  });
});
