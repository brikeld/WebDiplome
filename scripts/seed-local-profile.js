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
 * captured profile (Brikeld Hoxha) with the heavy wallpaper blob replaced by a
 * lightweight placeholder avatar. 24 posts including leaderboard posts with
 * inference-chain / ingredients metadata, so every "tell me more" view has
 * content.
 *
 * Idempotent: re-run any time to reset the local profile to the snapshot.
 *
 *   npm run seed:local
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const profile = readJson(join(FIXTURES, 'local-profile.json'));
const posts = readJson(join(FIXTURES, 'local-posts.json'));

writeFileSync(join(PROFILES_DIR, `${SLUG}.json`), `${JSON.stringify(profile, null, 2)}\n`);
writeFileSync(join(POSTS_DIR, `${SLUG}.json`), `${JSON.stringify(posts, null, 2)}\n`);

// The server hides any slug listed in _account-meta.json → deletedProfileIds.
// Make sure our seeded slug is visible (the real account had once deleted it).
const meta = readJson(META_PATH, { lastDeletionAt: 0, deletedProfileIds: [] });
const before = Array.isArray(meta.deletedProfileIds) ? meta.deletedProfileIds : [];
meta.deletedProfileIds = before.filter(
  (id) => String(id).trim().toLowerCase() !== SLUG,
);
writeFileSync(META_PATH, `${JSON.stringify(meta, null, 2)}\n`);

console.log(`✓ Seeded profile "${SLUG}" (${posts.length} posts).`);
console.log(`  profiles/${SLUG}.json, posts/${SLUG}.json`);
if (before.length !== meta.deletedProfileIds.length) {
  console.log(`  Un-deleted "${SLUG}" in profiles/_account-meta.json so it shows.`);
}
console.log('\nNext:');
console.log('  1. `npm run servers`   (data API :3001 + generator :3010)');
console.log('  2. `npm run dev`        (Vite)');
console.log('  3. Open the app → click the big "COMPLIANT" title to enter the feed.');
console.log(`     • Click a post's "BH" avatar to open the profile view (rail blurbs, leaderboards).`);
console.log('     • To load it as YOUR OWN profile (so the Profile nav + dashboard work),');
console.log("       run this once in the browser console, then reload:");
console.log(`         localStorage.setItem('compliant_owned_profile_slug', '${SLUG}')`);
