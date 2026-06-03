import { describe, expect, it } from 'vitest';
import { shouldResetHostedSessionForProfileMeStatus } from '../src/lib/hostedAccount.js';

describe('hostedAccount profile/me status handling', () => {
  it('resets hosted session only when the token is invalid', () => {
    expect(shouldResetHostedSessionForProfileMeStatus(401)).toBe(true);
    expect(shouldResetHostedSessionForProfileMeStatus(404)).toBe(false);
    expect(shouldResetHostedSessionForProfileMeStatus(500)).toBe(false);
  });
});
