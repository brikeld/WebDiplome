import { describe, it, expect } from 'vitest';
import { getMockCommentsFor } from '../src/features/commenting/commentingMock.js';

describe('getMockCommentsFor', () => {
  it('returns one Alex Johnson mock comment', () => {
    const { comments } = getMockCommentsFor('post-abc');
    expect(comments).toHaveLength(1);
    expect(comments[0].persona).toBe('securite');
    expect(comments[0].displayName).toBe('Alex Johnson');
    expect(comments[0].avatarSrc).toBe('/imgs/AlexP.png');
    expect(comments[0].isMock).toBe(true);
  });

  it('does not return suggestions (AI-generated on comment open)', () => {
    const data = getMockCommentsFor('post-abc');
    expect(data.suggestions).toBeUndefined();
  });

  it('every comment has a non-empty content string', () => {
    const { comments } = getMockCommentsFor('post-abc');
    for (const c of comments) {
      expect(typeof c.content).toBe('string');
      expect(c.content.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic: same postId yields identical data on repeated calls', () => {
    const a = getMockCommentsFor('post-xyz');
    const b = getMockCommentsFor('post-xyz');
    expect(a).toEqual(b);
  });

  it('accepts numeric postId by coercing to string', () => {
    const a = getMockCommentsFor(42);
    const b = getMockCommentsFor('42');
    expect(a).toEqual(b);
  });
});
