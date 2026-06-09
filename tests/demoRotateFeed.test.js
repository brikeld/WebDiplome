import { describe, expect, it } from 'vitest';
import {
  demoSpinnerPersonaForIndex,
  personaFromGenerationJob,
} from '../src/lib/demoRotateFeed.js';

describe('demoRotateFeed helpers', () => {
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

  it('reads persona from completed job posts', () => {
    expect(personaFromGenerationJob({
      posts: [{ persona: 'securite', content: 'hello' }],
    })).toBe('securite');
    expect(personaFromGenerationJob({ result: [{ persona: 'popularite' }] })).toBe('popularite');
    expect(personaFromGenerationJob({ posts: [] })).toBeNull();
  });
});
