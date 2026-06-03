import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('hosted public demo routes', () => {
  const src = readFileSync('server/routes/publicDemoRoutes.js', 'utf8');

  it('declares public profile, release, upload, and sync endpoints', () => {
    expect(src).toContain("router.get('/profiles'");
    expect(src).toContain("router.get('/profiles/:slug'");
    expect(src).toContain("router.post('/profile/sync'");
    expect(src).toContain("router.post('/upload'");
    expect(src).toContain("router.get('/app-releases/latest'");
    expect(src).toContain("router.get('/leaderboards'");
    expect(src).toContain("router.post('/comments'");
  });
});
