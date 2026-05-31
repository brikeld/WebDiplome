import { describe, it, expect, beforeEach } from 'vitest';
import {
  requestHarvest,
  getHarvestStatus,
  markHarvestRunning,
  completeHarvest,
  resetHarvestSession,
} from '../server/lib/harvestSession.js';

describe('harvestSession per profileSlug', () => {
  beforeEach(() => {
    resetHarvestSession();
  });

  it('isolates harvest state between profile slugs', () => {
    expect(requestHarvest({ productivity: 1 }, { profileSlug: 'alice-a', dynamicOnly: true }).ok).toBe(true);
    expect(getHarvestStatus('alice-a').status).toBe('requested');
    expect(getHarvestStatus('bob-b').status).toBe('idle');

    markHarvestRunning('alice-a');
    completeHarvest('alice-a', { productivity: 2 });
    expect(getHarvestStatus('alice-a').status).toBe('done');
    expect(getHarvestStatus('bob-b').status).toBe('idle');
  });

  it('rejects harvest request without profileSlug', () => {
    const result = requestHarvest(null, { profileSlug: '' });
    expect(result.ok).toBe(false);
  });
});
