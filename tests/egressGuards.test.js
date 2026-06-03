import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Supabase egress guards', () => {
  const src = readFileSync('server/lib/publicProfileStore.js', 'utf8');
  const appSrc = readFileSync('src/app/App.jsx', 'utf8');

  it('does not select raw_profile in the high-frequency public profiles list', () => {
    const start = src.indexOf('async function listAllProfilesWithPosts()');
    const end = src.indexOf('function withMergedSiblingPosts', start);
    const body = src.slice(start, end);
    expect(src).toContain('PUBLIC_PROFILE_SELECT');
    expect(src).toContain("supabase.from('profiles').select(PUBLIC_PROFILE_SELECT)");
    expect(body).not.toContain("select('*')");
  });

  it('does not poll the public profile directory every two seconds', () => {
    expect(appSrc).not.toContain('? 2_000 : 30_000');
    expect(appSrc).toContain('? 10_000 : 30_000');
  });
});
