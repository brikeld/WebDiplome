import { describe, expect, it } from 'vitest';
import { mergeRealAndDemoPeople, selectProfileBySlug } from '../src/lib/profileDirectory.js';

describe('profile directory helpers', () => {
  it('selects requested slug before falling back to newest profile', () => {
    const profiles = [{ slug: 'one' }, { slug: 'two' }];
    expect(selectProfileBySlug(profiles, 'two')).toEqual({ slug: 'two' });
    expect(selectProfileBySlug(profiles, 'missing')).toEqual({ slug: 'one' });
  });

  it('fills public people with demo people only when there are too few real users', () => {
    const real = [{ id: 'r1', source: 'real' }, { id: 'r2', source: 'real' }];
    const demo = [{ id: 'd1', source: 'demo' }, { id: 'd2', source: 'demo' }, { id: 'd3', source: 'demo' }];
    expect(mergeRealAndDemoPeople(real, demo, 5).map((p) => p.id)).toEqual(['r1', 'r2', 'd1', 'd2', 'd3']);
    expect(mergeRealAndDemoPeople([...real, { id: 'r3' }, { id: 'r4' }, { id: 'r5' }], demo, 5).every((p) => p.source !== 'demo')).toBe(true);
  });
});
