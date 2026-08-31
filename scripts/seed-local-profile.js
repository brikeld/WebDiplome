#!/usr/bin/env node
/**
 * Seed a local profile so the app renders with real data during development.
 *
 * The web app has no profile of its own — it normally receives one from the
 * sibling Electron collector over HTTP (see CLAUDE.md). That makes it awkward to
 * preview UI changes locally. This script drops a known-good profile + posts
 * snapshot onto disk so `npm run servers` + `npm run dev` shows a fully
 * populated profile, feed, dashboard, and leaderboard analysis.
 *
 * Data source: scripts/fixtures/{local-profile,local-posts}.json — a real
 * captured profile (Brikeld Hoxha) with the harvested wallpaper portrait in
 * brikeld-wallpaper.json. Post attachments are copied from
 * /Users/brikeld/Documents/contentDemoBrikeld into
 * public/videoDEMO/contentDemoBrikeld at seed time. 24 posts including
 * leaderboard posts with inference-chain / ingredients metadata, so every
 * "tell me more" view has content.
 *
 * Idempotent: re-run any time to reset the local profile to the snapshot.
 *
 *   npm run seed:local
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeededFakeUsers, injectBrikeldComments } from './fixtures/buildDemoFakeUsers.js';
import {
  loadBrikeldHarvestedWallpaper,
  remapBrikeldPostAssets,
  syncBrikeldContentAssets,
} from './fixtures/brikeldLocalContent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FIXTURES = join(__dirname, 'fixtures');

const SLUG = 'brikeld-hoxha';
const PROFILES_DIR = join(ROOT, 'profiles');
const POSTS_DIR = join(ROOT, 'posts');
const META_PATH = join(PROFILES_DIR, '_account-meta.json');

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    if (fallback !== undefined && err.code === 'ENOENT') return fallback;
    throw err;
  }
}

mkdirSync(PROFILES_DIR, { recursive: true });
mkdirSync(POSTS_DIR, { recursive: true });

const profile = {
  ...readJson(join(FIXTURES, 'local-profile.json')),
  wallpaperBase64: loadBrikeldHarvestedWallpaper(),
};
const posts = readJson(join(FIXTURES, 'local-posts.json'));

const NOW_MS = Date.now();

// ── Remove previously seeded fake users (idempotent reset) ───────────────────
for (const file of readdirSync(PROFILES_DIR)) {
  if (!file.endsWith('.json') || file === '_account-meta.json') continue;
  const p = join(PROFILES_DIR, file);
  try {
    if (JSON.parse(readFileSync(p, 'utf8'))?.demoFake === true) {
      rmSync(p);
      const postsPath = join(POSTS_DIR, file);
      if (existsSync(postsPath)) rmSync(postsPath);
    }
  } catch {
    /* unreadable file — leave it alone */
  }
}

// ── Brikeld: contentDemoBrikeld assets, rebased timestamps + injected comments ──
syncBrikeldContentAssets(join(ROOT, 'public', 'videoDEMO', 'contentDemoBrikeld'));
const brikeldPosts = injectBrikeldComments(remapBrikeldPostAssets(posts), NOW_MS);
writeFileSync(join(PROFILES_DIR, `${SLUG}.json`), `${JSON.stringify(profile, null, 2)}\n`);
writeFileSync(join(POSTS_DIR, `${SLUG}.json`), `${JSON.stringify(brikeldPosts, null, 2)}\n`);

// ── Seeded fake users ─────────────────────────────────────────────────────────
const seeded = buildSeededFakeUsers(NOW_MS);
for (const { slug, profile: fakeProfile, posts: fakePosts } of seeded) {
  writeFileSync(join(PROFILES_DIR, `${slug}.json`), `${JSON.stringify(fakeProfile, null, 2)}\n`);
  writeFileSync(join(POSTS_DIR, `${slug}.json`), `${JSON.stringify(fakePosts, null, 2)}\n`);
}

// The server hides any slug listed in _account-meta.json → deletedProfileIds.
// Make sure our seeded slug is visible (the real account had once deleted it).
const meta = readJson(META_PATH, { lastDeletionAt: 0, deletedProfileIds: [] });
const before = Array.isArray(meta.deletedProfileIds) ? meta.deletedProfileIds : [];
const seededSlugs = new Set([SLUG, ...seeded.map((s) => s.slug)]);
meta.deletedProfileIds = before.filter(
  (id) => !seededSlugs.has(String(id).trim().toLowerCase()),
);
writeFileSync(META_PATH, `${JSON.stringify(meta, null, 2)}\n`);

console.log(`✓ Seeded "${SLUG}" (${brikeldPosts.length} posts) + ${seeded.length} demo users (${seeded.reduce((n, s) => n + s.posts.length, 0)} posts).`);
console.log('\nNext:');
console.log('  npm run demo:local   (seeds are already written; this starts servers + Vite)');
console.log('  — or manually: `npm run servers` then `npm run dev`.');
console.log('  Open the app → your Brikeld Hoxha profile is linked automatically.');
