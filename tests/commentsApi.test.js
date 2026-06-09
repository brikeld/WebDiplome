import { describe, expect, it } from 'vitest';
import { isPersistablePostId } from '../src/lib/commentsApi.js';

describe('isPersistablePostId', () => {
  it('accepts uuid post ids', () => {
    expect(isPersistablePostId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects local stable keys', () => {
    expect(isPersistablePostId('productivite|2026-06-01|hello')).toBe(false);
  });
});
