import { describe, expect, it } from 'vitest';
import {
  mergeStaticProfileFields,
  normalizeProfilePayload,
} from '../server/lib/profileNormalization.js';

describe('profile normalization', () => {
  it('normalizes hardware identity aliases to camelCase storage keys', () => {
    const result = normalizeProfilePayload({
      firstname: 'Brikeld',
      lastname: 'Hoxha',
      machine_name: 'Brikeld’s MacBook Pro',
      hardware_chip: 'Apple M3 Max',
      machine_model: 'MacBook Pro 14',
    });

    expect(result.machineName).toBe('Brikeld’s MacBook Pro');
    expect(result.hardwareChip).toBe('Apple M3 Max');
    expect(result.machineModel).toBe('MacBook Pro 14');
    expect(result).not.toHaveProperty('machine_name');
    expect(result).not.toHaveProperty('hardware_chip');
    expect(result).not.toHaveProperty('machine_model');
  });

  it('preserves cached static hardware fields when a harvest update omits them', () => {
    const existing = {
      firstname: 'Brikeld',
      lastname: 'Hoxha',
      machineName: 'Brikeld’s MacBook Pro',
      hardwareChip: 'Apple M3 Max',
      machineModel: 'MacBook Pro 14',
      ram: '36 GB',
      systemLanguages: ['en-CH', 'fr-CH'],
      wallpaperBase64: 'data:image/jpeg;base64,abc',
    };
    const incoming = normalizeProfilePayload({
      firstname: 'Brikeld',
      lastname: 'Hoxha',
      persona_scores: { productivite: 39, securite: 22, popularite: 39 },
      batteryCycles: 244,
    });

    expect(mergeStaticProfileFields(incoming, existing)).toMatchObject({
      machineName: 'Brikeld’s MacBook Pro',
      hardwareChip: 'Apple M3 Max',
      machineModel: 'MacBook Pro 14',
      ram: '36 GB',
      systemLanguages: ['en-CH', 'fr-CH'],
      wallpaperBase64: 'data:image/jpeg;base64,abc',
      batteryCycles: 244,
    });
  });
});
