import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('PostsTab feed ordering', () => {
  it('does not special-case COMPLIANT join posts above newer posts', () => {
    const source = readFileSync(new URL('../src/features/feed/PostsTab.jsx', import.meta.url), 'utf8');
    const sortBody = source.match(/function sortNewestFirst\(a, b\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(sortBody).not.toContain('isCompliantJoinPost');
    expect(sortBody).toContain('postCreatedAtMs');
  });
});
