import { describe, expect, it } from 'vitest';
import {
  computeGenerationParticleFrame,
  personaToGeneratingRowKey,
  personaUiColorForParticle,
} from '../src/lib/generationParticleFlight.js';

describe('generationParticleFlight', () => {
  it('maps persona keys to generating row keys', () => {
    expect(personaToGeneratingRowKey('productivite')).toBe('productivity');
    expect(personaToGeneratingRowKey('securite')).toBe('security');
    expect(personaToGeneratingRowKey('popularite')).toBe('social');
  });

  it('computes an arc between source and target rects', () => {
    const sourceRect = { x: 900, y: 400, width: 120, height: 24 };
    const targetRect = { x: 120, y: 180, width: 480, height: 120 };
    const start = computeGenerationParticleFrame({ progress: 0, sourceRect, targetRect });
    const end = computeGenerationParticleFrame({ progress: 1, sourceRect, targetRect });

    expect(start.x).toBeCloseTo(960, 0);
    expect(start.y).toBeCloseTo(412, 0);
    expect(end.x).toBeCloseTo(360, 0);
    expect(end.y).toBeCloseTo(240, 0);
    expect(start.opacity).toBe(1);
    expect(end.opacity).toBe(0);
  });

  it('returns persona colors for particles', () => {
    expect(personaUiColorForParticle('securite')).toBe('#759AEF');
    expect(personaUiColorForParticle('popularite')).toBe('#CCF847');
  });
});
