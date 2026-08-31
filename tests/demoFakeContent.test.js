import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEEDED_SLUGS,
  DEMO_FAKE_POSTS,
  BRIKELD_POST_COMMENTS,
} from '../scripts/fixtures/demoFakeContent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'public', 'videoDEMO', 'contentFakePeople');
const BANNED = /\b(demo|fake|scripted|prewritten|mock)\b/i;
const PERSONAS = ['productivite', 'securite', 'popularite'];

describe('demoFakeContent', () => {
  it('has 7 seeded slugs and 14 posts, all authored by seeded slugs', () => {
    expect(SEEDED_SLUGS).toHaveLength(7);
    expect(DEMO_FAKE_POSTS).toHaveLength(14);
    for (const entry of DEMO_FAKE_POSTS) {
      expect(SEEDED_SLUGS).toContain(entry.authorSlug);
      expect(entry.ageMinutes).toBeGreaterThan(0);
    }
  });

  it('every post is complete: persona, content, chain, ingredients, thinking', () => {
    for (const { post } of DEMO_FAKE_POSTS) {
      expect(PERSONAS).toContain(post.persona);
      expect(post.content.length).toBeGreaterThan(40);
      expect(post.content).not.toMatch(BANNED);
      expect(post.inferenceChain.map((s) => s.step)).toEqual([
        'data', 'classify', 'infer', 'generate',
      ]);
      expect(post.inferenceChain[3].value).toBe(post.content);
      expect(post.ingredients.length).toBeGreaterThanOrEqual(2);
      expect(post.thinking.map((t) => t.label)).toEqual([
        'WHAT I SAW', 'THE LEAP', 'WHY THIS POST',
      ]);
      for (const s of post.inferenceChain) {
        expect(JSON.stringify(s)).not.toMatch(BANNED);
      }
      for (const t of post.thinking) {
        expect(t.detail).not.toMatch(BANNED);
      }
    }
  });

  it('attached assets exist on disk and have consistent url/mime', () => {
    for (const { post } of DEMO_FAKE_POSTS) {
      if (!post.attachedAsset) continue;
      const a = post.attachedAsset;
      expect(existsSync(join(CONTENT_DIR, a.filename))).toBe(true);
      expect(a.url).toBe(`/videoDEMO/contentFakePeople/${encodeURIComponent(a.filename)}`);
      expect(['image', 'document']).toContain(a.kind);
      expect(a.mime.length).toBeGreaterThan(5);
    }
  });

  it('comments: 3-5 per post, authored by OTHER seeded users, unique ids', () => {
    const ids = new Set();
    for (const { authorSlug, post } of DEMO_FAKE_POSTS) {
      expect(post.comments.length).toBeGreaterThanOrEqual(3);
      expect(post.comments.length).toBeLessThanOrEqual(5);
      for (const c of post.comments) {
        expect(SEEDED_SLUGS).toContain(c.bySlug);
        expect(c.bySlug).not.toBe(authorSlug);
        expect(PERSONAS).toContain(c.persona);
        expect(c.content.length).toBeGreaterThan(20);
        expect(c.content).not.toMatch(BANNED);
        expect(ids.has(c.id)).toBe(false);
        ids.add(c.id);
      }
    }
  });

  it('post ageMinutes are unique (unique createdAt after seeding)', () => {
    const ages = DEMO_FAKE_POSTS.map((p) => p.ageMinutes);
    expect(new Set(ages).size).toBe(ages.length);
  });

  it('brikeld comment sets cover every local post with 3-4 cross-user comments', () => {
    const localPosts = JSON.parse(
      readFileSync(join(ROOT, 'scripts/fixtures/local-posts.json'), 'utf8'),
    );
    expect(BRIKELD_POST_COMMENTS).toHaveLength(localPosts.length);
    for (const set of BRIKELD_POST_COMMENTS) {
      expect(set.length).toBeGreaterThanOrEqual(3);
      expect(set.length).toBeLessThanOrEqual(4);
      for (const c of set) {
        expect(SEEDED_SLUGS).toContain(c.bySlug);
        expect(c.content).not.toMatch(BANNED);
      }
    }
  });
});
