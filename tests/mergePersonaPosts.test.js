import { describe, expect, it } from 'vitest';
import {
  isCompliantSystemPost,
  mergePersonaPostsFromApi,
  mergePostsPrepend,
} from '../src/lib/mergePersonaPosts.js';

describe('mergePersonaPosts', () => {
  it('detects compliant system posts', () => {
    expect(isCompliantSystemPost({ compliantLowScore: { uiPersonaKey: 'security' } })).toBe(true);
    expect(isCompliantSystemPost({ content: 'hello' })).toBe(false);
  });

  it('dedupes by stable post id', () => {
    const a = { id: 'compliant-1', content: 'a', createdAt: 1 };
    const merged = mergePostsPrepend([a], [a]);
    expect(merged).toHaveLength(1);
  });

  it('keeps compliant posts when API returns fewer regular posts', () => {
    const system = {
      id: 'compliant-low-score-1-security',
      content: 'notice',
      createdAt: 100,
      compliantLowScore: { uiPersonaKey: 'security' },
    };
    const prev = [system, { content: 'old', createdAt: 50, persona: 'securite' }];
    const incoming = [{ content: 'new', createdAt: 60, persona: 'securite' }];
    const merged = mergePersonaPostsFromApi(prev, incoming);
    expect(merged.some((p) => p.id === system.id)).toBe(true);
    expect(merged.some((p) => p.content === 'new')).toBe(true);
  });
});
