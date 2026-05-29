import { describe, expect, it } from 'vitest';
import { extractBearerToken, isWorkerAuthorized } from '../server/lib/auth.js';

describe('auth helpers', () => {
  it('extracts bearer tokens case-insensitively', () => {
    expect(extractBearerToken('Bearer abc')).toBe('abc');
    expect(extractBearerToken('bearer xyz')).toBe('xyz');
    expect(extractBearerToken('Token abc')).toBe(null);
  });

  it('authorizes worker token only on exact match', () => {
    expect(isWorkerAuthorized('secret', 'secret')).toBe(true);
    expect(isWorkerAuthorized('secret', 'wrong')).toBe(false);
    expect(isWorkerAuthorized('', 'wrong')).toBe(false);
  });
});
