import { describe, it, expect } from 'vitest';
import {
  stripPostFromProfile,
  removePostFromProfiles,
} from '../src/lib/postDeletion.js';

const T = '2026-07-06T10:00:00.000Z';
const profile = {
  slug: 'camille-laurent',
  personaPosts: [
    { content: 'keep', createdAt: '2026-07-06T11:00:00.000Z' },
    { content: 'remove', createdAt: T },
  ],
};

describe('stripPostFromProfile', () => {
  it('removes the matching post from the matching author', () => {
    const out = stripPostFromProfile(profile, 'camille-laurent', T);
    expect(out.personaPosts).toHaveLength(1);
    expect(out.personaPosts[0].content).toBe('keep');
    expect(out).not.toBe(profile);
  });

  it('returns the same reference when author or createdAt do not match', () => {
    expect(stripPostFromProfile(profile, 'other-user', T)).toBe(profile);
    expect(stripPostFromProfile(profile, 'camille-laurent', 'nope')).toBe(profile);
    expect(stripPostFromProfile(null, 'x', T)).toBeNull();
  });

  it('matches snake_case created_at too', () => {
    const p = { slug: 's', personaPosts: [{ content: 'r', created_at: T }] };
    expect(stripPostFromProfile(p, 's', T).personaPosts).toHaveLength(0);
  });
});

describe('removePostFromProfiles', () => {
  it('maps stripPostFromProfile across a directory list', () => {
    const list = [profile, { slug: 'other', personaPosts: [{ content: 'x', createdAt: T }] }];
    const out = removePostFromProfiles(list, 'camille-laurent', T);
    expect(out[0].personaPosts).toHaveLength(1);
    expect(out[1]).toBe(list[1]);
  });
});
