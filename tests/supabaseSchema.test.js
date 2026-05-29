import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260529_public_demo.sql', 'utf8');

describe('public demo Supabase schema', () => {
  it('declares every MVP table', () => {
    for (const table of [
      'profiles',
      'posts',
      'assets',
      'comments',
      'generation_jobs',
      'app_releases',
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
  });

  it('enables public read and authenticated owner write policies', () => {
    expect(sql).toContain('alter table public.profiles enable row level security');
    expect(sql).toContain('profiles_public_read');
    expect(sql).toContain('profiles_owner_write');
    expect(sql).toContain('posts_public_read');
    expect(sql).toContain('comments_public_read');
  });

  it('declares public storage buckets for uploads and DMG releases', () => {
    expect(sql).toContain("'uploads-public'");
    expect(sql).toContain("'app-releases'");
  });
});
