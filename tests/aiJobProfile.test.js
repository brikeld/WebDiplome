import { describe, expect, it } from 'vitest';
import { profileSlugFromBody } from '../server/lib/aiJobProfile.js';

describe('aiJobProfile', () => {
  it('reads slug from profileSlug or nested profile', () => {
    expect(profileSlugFromBody({ profileSlug: 'alice-demo' })).toBe('alice-demo');
    expect(profileSlugFromBody({ profile: { slug: 'bob-demo' } })).toBe('bob-demo');
    expect(profileSlugFromBody({ profile: { id: 'carol-demo' } })).toBe('carol-demo');
    expect(profileSlugFromBody({})).toBe('');
  });
});
