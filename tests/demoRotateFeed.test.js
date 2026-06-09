import { describe, expect, it } from 'vitest';
import {
  demoSpinnerPersonaForIndex,
  personaFromGenerationJob,
  postKeyFromGenerationJob,
  sortDemoTargets,
} from '../src/lib/demoRotateFeed.js';

describe('demoRotateFeed helpers', () => {
  it('sorts demo targets alphabetically by display name', () => {
    const ordered = sortDemoTargets([
      { slug: 'lea-jonathan', displayName: 'Léa & Jonathan' },
      { slug: 'nyria', displayName: 'Nyria' },
      { slug: 'daniel-rocha', displayName: 'Daniel Rocha' },
    ]);
    expect(ordered.map((e) => e.slug)).toEqual(['daniel-rocha', 'lea-jonathan', 'nyria']);
  });

  it('picks the persona for the post currently being revealed', () => {
    const ordered = [
      { slug: 'a', generatingPersona: 'productivite' },
      { slug: 'b', generatingPersona: 'securite' },
      { slug: 'c', generatingPersona: 'popularite' },
    ];
    expect(demoSpinnerPersonaForIndex(ordered, 0)).toBe('productivite');
    expect(demoSpinnerPersonaForIndex(ordered, 1)).toBe('securite');
    expect(demoSpinnerPersonaForIndex(ordered, 2)).toBe('popularite');
    expect(demoSpinnerPersonaForIndex(ordered, 3)).toBeNull();
  });

  it('reads persona and post key from completed job posts', () => {
    const job = {
      posts: [{ id: 'post-1', persona: 'securite', content: 'hello', createdAt: '2026-01-02T00:00:00Z' }],
    };
    expect(personaFromGenerationJob(job)).toBe('securite');
    expect(postKeyFromGenerationJob(job)).toBeTruthy();
    expect(personaFromGenerationJob({ posts: [] })).toBeNull();
  });
});
