import { describe, it, expect } from 'vitest';
import { getMockCommentsFor } from '../src/features/commenting/commentingMock.js';

describe('getMockCommentsFor', () => {
  it('returns three comments, one per persona in fixed order', () => {
    const { comments } = getMockCommentsFor('post-abc');
    expect(comments).toHaveLength(3);
    expect(comments.map((c) => c.persona)).toEqual([
      'productivite',
      'securite',
      'popularite',
    ]);
  });

  it('returns three suggestions, one per persona in fixed order', () => {
    const { suggestions } = getMockCommentsFor('post-abc');
    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((s) => s.persona)).toEqual([
      'productivite',
      'securite',
      'popularite',
    ]);
  });

  it('every comment has a non-empty content string and three pill labels', () => {
    const { comments } = getMockCommentsFor('post-abc');
    for (const c of comments) {
      expect(typeof c.content).toBe('string');
      expect(c.content.length).toBeGreaterThan(0);
      expect(c.pills).toHaveLength(3);
      for (const p of c.pills) {
        expect(typeof p).toBe('string');
        expect(p.length).toBeGreaterThan(0);
      }
    }
  });

  it('every suggestion has content and a plusValue between 1 and 5', () => {
    const { suggestions } = getMockCommentsFor('post-abc');
    for (const s of suggestions) {
      expect(typeof s.content).toBe('string');
      expect(s.content.length).toBeGreaterThan(0);
      expect(Number.isInteger(s.plusValue)).toBe(true);
      expect(s.plusValue).toBeGreaterThanOrEqual(1);
      expect(s.plusValue).toBeLessThanOrEqual(5);
    }
  });

  it('is deterministic: same postId yields identical data on repeated calls', () => {
    const a = getMockCommentsFor('post-xyz');
    const b = getMockCommentsFor('post-xyz');
    expect(a).toEqual(b);
  });

  it('different postIds yield different plusValue sequences for at least some inputs', () => {
    const samples = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) =>
      getMockCommentsFor(id).suggestions.map((s) => s.plusValue).join(','),
    );
    const unique = new Set(samples);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('accepts numeric postId by coercing to string', () => {
    const a = getMockCommentsFor(42);
    const b = getMockCommentsFor('42');
    expect(a).toEqual(b);
  });
});
