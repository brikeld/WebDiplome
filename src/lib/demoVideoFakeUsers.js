/**
 * Demo-video fake users — a client-only, ephemeral roster used by the "demo
 * video" button. These people do NOT exist in the backend: they live purely in
 * React state during a demo session and vanish on refresh (no DB writes).
 *
 * Assets are served from `public/videoDEMO/` (gitignored, local-only):
 *   - profile pics: `public/videoDEMO/other users/*.png` (memoji)
 *   - post content:  `public/videoDEMO/contentFakePeople/*` (images + PDFs)
 *
 * Single source of truth shared by:
 *   - the feed pipeline (src/lib/demoVideoFeed.js) — injects these into
 *     `allProfiles` and reveals their posts one at a time, and
 *   - the leaderboard splicer (below) — swaps placeholder/clone rows for these
 *     people so the boards look populated by real-looking strangers.
 */

const AVATAR_DIR = '/videoDEMO/other users';
const CONTENT_DIR = '/videoDEMO/contentFakePeople';

/** Profile-pic memoji filenames (public/videoDEMO/other users). */
const AVATAR_FILES = [
  'Screenshot 2026-06-29 at 11.27.26.png',
  'Screenshot 2026-06-29 at 11.27.31.png',
  'Screenshot 2026-06-29 at 11.27.35.png',
  'Screenshot 2026-06-29 at 11.27.42.png',
  'Screenshot 2026-06-29 at 11.27.47.png',
  'Screenshot 2026-06-29 at 11.27.53.png',
  'Screenshot 2026-06-29 at 11.27.58.png',
];

/**
 * Post attachments (public/videoDEMO/contentFakePeople). Order is the reveal
 * cycle: the pipeline walks this list round-robin so each pass attaches the
 * next piece of content. Images become `popularite` posts, PDFs `productivite`
 * (the generator's asset slot decides persona by kind — see personaPostGenerator).
 */
const CONTENT_FILES = [
  'lake.webp',
  '2024D117_ITALIANSEO_POMODORO_2_X-1-768x960.jpg',
  'cat.jpg',
  'cv-template.pdf',
  'street-with-eiffel-tower-in-the-middle-on-a-sunny-royalty-free-image-1717187207.avif',
  'invoice-number.jpeg',
  'a49d7df20838811b3eee69a977e57c05.webp',
  '35e66caf-c9a4-40a4-8e2d-fcad1a746ef9.pdf',
  '637627ca9eebde45ae5f394c_Underwater-Nun.jpeg',
  'gettyimages-586890581.avif',
  '09feb3a7ff1c1ac852dc880a6e2ef70c.jpg',
  '47f85bb0022f16eadee6761b7c7d9b06.webp',
  'Screenshot 2026-06-29 at 11.24.24.png',
];

/** Made-up French-sounding identities, one per avatar. */
const PEOPLE = [
  { first: 'Camille', last: 'Laurent', dominant: 'popularity' },
  { first: 'Théo', last: 'Moreau', dominant: 'productivity' },
  { first: 'Léa', last: 'Bernard', dominant: 'popularity' },
  { first: 'Hugo', last: 'Petit', dominant: 'security' },
  { first: 'Manon', last: 'Girard', dominant: 'productivity' },
  { first: 'Lucas', last: 'Rousseau', dominant: 'security' },
  { first: 'Chloé', last: 'Lefèvre', dominant: 'popularity' },
];

const PERSONA_KEYS = ['productivity', 'security', 'social'];

// ── deterministic RNG so ranks / scores are stable across re-renders & polls ──
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function publicUrl(relPath) {
  const origin =
    typeof window !== 'undefined' && window.location ? window.location.origin : '';
  // encodeURI keeps the path separators but escapes spaces (folder + filenames).
  return encodeURI(`${origin}${relPath}`);
}

function initialsOf(first, last) {
  return `${(first[0] ?? '').toUpperCase()}${(last[0] ?? '').toUpperCase()}`;
}

function handleOf(first, last) {
  const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '');
  return `@${strip(first)}${strip(last)[0] ?? ''}`;
}

function scoresFor(person, slug) {
  // Plausible scores that lean toward the person's dominant persona, stable per slug.
  const rng = mulberry32(hashString(`scores:${slug}`));
  const base = { productivity: 18 + rng() * 30, security: 18 + rng() * 30, social: 18 + rng() * 30 };
  const domKey = person.dominant === 'popularity' ? 'social' : person.dominant;
  base[domKey] += 22;
  return {
    productivity: Math.round(base.productivity),
    security: Math.round(base.security),
    social: Math.round(base.social),
  };
}

let cachedRoster = null;

/**
 * The fake-user roster (memoized). Each entry is a profile-shaped object the
 * feed (`avatarSrcFromProfile`, `displayNameFromProfile`) and leaderboards can
 * consume directly. Avatars are absolute `${origin}/videoDEMO/...` URLs so they
 * pass `pickProfileMediaUrl`'s http(s) check (relative `/videoDEMO` paths don't).
 */
export function getFakeUsers() {
  if (cachedRoster) return cachedRoster;
  cachedRoster = PEOPLE.map((person, i) => {
    const slug = `demo-video-${person.first}-${person.last}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const displayName = `${person.first} ${person.last}`;
    return {
      id: slug,
      slug,
      firstname: person.first,
      lastname: person.last,
      displayName,
      avatarUrl: publicUrl(`${AVATAR_DIR}/${AVATAR_FILES[i % AVATAR_FILES.length]}`),
      avatarInitials: initialsOf(person.first, person.last),
      handle: handleOf(person.first, person.last),
      personaScores: scoresFor(person, slug),
      dominantPersona: person.dominant,
      personaPosts: [],
      __demoVideoFake: true,
    };
  });
  return cachedRoster;
}

/** Reveal cycle: { fakeUser, assetBasename } steps, round-robin over people × content. */
export function buildDemoVideoSchedule() {
  const users = getFakeUsers();
  return CONTENT_FILES.map((assetBasename, i) => ({
    user: users[i % users.length],
    assetBasename,
    assetUrl: publicUrl(`${CONTENT_DIR}/${assetBasename}`),
  }));
}

export function isDemoVideoFakeSlug(slug) {
  const key = String(slug ?? '');
  return key.startsWith('demo-video-');
}

// ── active-state singleton (so leaderboard splicers need no prop drilling) ─────
let active = false;
export function setDemoVideoActive(value) {
  active = Boolean(value);
}
export function isDemoVideoActive() {
  return active;
}

/**
 * Replace placeholder / clone rows in a leaderboard board with fake people, so
 * standings look populated by real-looking strangers. Rows that belong to a
 * REAL account (`isUser` or `source === 'real'`) are left untouched — a real
 * user always keeps its true position; fakes only fill the remaining slots.
 *
 * Assignment is deterministic per board (seeded shuffle by boardId) so ranks
 * don't jitter across the 30s leaderboard poll, and distinct within a board.
 */
export function spliceFakeUsersIntoBoard(board) {
  if (!isDemoVideoActive() || !board || !Array.isArray(board.entries)) return board;
  const fakes = getFakeUsers();
  if (fakes.length === 0) return board;

  // Seeded shuffle of the roster for this board → stable, distinct-per-board.
  const order = fakes.map((_, i) => i);
  const rng = mulberry32(hashString(`board:${board.boardId ?? board.title ?? ''}`));
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  let fakeCursor = 0;
  const entries = board.entries.map((entry) => {
    if (entry?.isUser) return entry;
    if (entry?.source === 'real') return entry;
    const fake = fakes[order[fakeCursor % order.length]];
    fakeCursor += 1;
    return {
      ...entry,
      name: fake.displayName,
      handle: fake.handle,
      avatarSrc: fake.avatarUrl,
      avatarInitials: fake.avatarInitials,
      slug: fake.slug,
      source: 'demoFake',
    };
  });
  return { ...board, entries };
}

export const DEMO_VIDEO_PERSONA_KEYS = PERSONA_KEYS;
