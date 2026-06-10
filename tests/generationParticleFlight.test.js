import { describe, expect, it } from 'vitest';
import {
  computeGenerationParticleFrame,
  personaToGeneratingRowKey,
} from '../src/lib/generationParticleFlight.js';

describe('generationParticleFlight', () => {
  it('maps persona spellings to generating row keys', () => {
    expect(personaToGeneratingRowKey('productivite')).toBe('productivity');
    expect(personaToGeneratingRowKey('securite')).toBe('security');
    expect(personaToGeneratingRowKey('popularite')).toBe('social');
  });

  it('computes arc motion between source and target', () => {
    const frame = computeGenerationParticleFrame({
      progress: 0.5,
      sourceRect: { x: 100, y: 100, width: 40, height: 20 },
      targetRect: { x: 500, y: 300, width: 40, height: 20 },
    });
    expect(frame.x).toBeGreaterThan(100);
    expect(frame.y).toBeLessThan(300);
    expect(frame.opacity).toBe(1);
  });
});
