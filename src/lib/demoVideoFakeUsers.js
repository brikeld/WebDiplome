/**
 * Demo-video fake users — a client-only, ephemeral roster used by the "demo
 * video" button. These people do NOT exist in the backend: they live purely in
 * React state during a demo session and vanish on refresh (no DB writes).
 *
 * Assets:
 *   - profile pics are embedded as small data URIs for production rendering
 *   - post content files are served from Vercel/Vite public assets
 *
 * Single source of truth shared by:
 *   - the feed pipeline (src/lib/demoVideoFeed.js) — injects these into
 *     `allProfiles` and reveals their posts one at a time, and
 *   - the leaderboard splicer (below) — swaps placeholder/clone rows for these
 *     people so the boards look populated by real-looking strangers.
 */

import { DEMO_VIDEO_AVATARS } from '@/lib/demoVideoAvatars.js';

/**
 * Prewritten posts for the demo-video button. They are intentionally static:
 * the button only reveals these posts one by one, with no LM Studio, Railway
 * job, or AI worker dependency.
 */
const STATIC_POSTS = [
  {
    assetBasename: 'lake.webp',
    persona: 'popularite',
    content: 'Camille saved one calm lake photo and COMPLIANT immediately filed it under main-character recovery arc.',
  },
  {
    assetBasename: '2024D117_ITALIANSEO_POMODORO_2_X-1-768x960.jpg',
    persona: 'popularite',
    content: 'Theo has restaurant-grade tomato content sitting in downloads, which is basically a soft launch for a food account.',
  },
  {
    assetBasename: 'cat.jpg',
    persona: 'popularite',
    content: 'Lea kept the cat photo close enough to become evidence, and honestly the algorithm respects the engagement strategy.',
  },
  {
    assetBasename: 'cv-template.pdf',
    persona: 'productivite',
    content: 'Hugo keeping a CV template ready feels less like admin and more like a carefully organized escape hatch.',
  },
  {
    assetBasename: 'street-with-eiffel-tower-in-the-middle-on-a-sunny-royalty-free-image-1717187207.avif',
    persona: 'popularite',
    content: 'Manon saved a sunny Eiffel Tower street like she is three clicks away from turning the week into a travel moodboard.',
  },
  {
    assetBasename: 'invoice-number.jpeg',
    persona: 'productivite',
    content: 'Lucas has invoice material in the mix, so COMPLIANT gave the folder productivity points and a tiny stress penalty.',
  },
  {
    assetBasename: 'a49d7df20838811b3eee69a977e57c05.webp',
    persona: 'popularite',
    content: 'Chloe dropped another image into the archive with absolutely no context, which is exactly how visual lore starts.',
  },
  {
    assetBasename: '35e66caf-c9a4-40a4-8e2d-fcad1a746ef9.pdf',
    persona: 'productivite',
    content: 'Camille left a PDF where COMPLIANT could find it, and now one document is being treated like a work ethic confession.',
  },
  {
    assetBasename: '637627ca9eebde45ae5f394c_Underwater-Nun.jpeg',
    persona: 'popularite',
    content: 'Theo saved the underwater nun image, which is either niche taste or a cry for a better folder naming system.',
  },
  {
    assetBasename: 'gettyimages-586890581.avif',
    persona: 'popularite',
    content: 'Lea has a stock-photo-looking asset in the folder, so COMPLIANT suspects a presentation, a bit, or both.',
  },
  {
    assetBasename: '09feb3a7ff1c1ac852dc880a6e2ef70c.jpg',
    persona: 'popularite',
    content: 'Hugo kept a polished image with no explanation, and the social score machine loves a confident mystery.',
  },
  {
    assetBasename: '47f85bb0022f16eadee6761b7c7d9b06.webp',
    persona: 'securite',
    content: 'Manon has one of those anonymous webp files that makes every security dashboard quietly sit up straighter.',
  },
  {
    assetBasename: 'Screenshot 2026-06-29 at 11.24.24.png',
    persona: 'securite',
    content: 'Lucas kept a timestamped screenshot, which COMPLIANT reads as evidence, memory, and mild operational risk.',
  },
  {
    assetBasename: 'lake.webp',
    persona: 'popularite',
    content: 'Chloe reposted the lake energy without saying anything, because apparently serenity performs better without captions.',
  },
  {
    assetBasename: 'cat.jpg',
    persona: 'popularite',
    content: 'Camille brought the cat back into rotation, proving the most reliable social strategy is still having a better face in frame.',
  },
  {
    assetBasename: 'cv-template.pdf',
    persona: 'productivite',
    content: 'Theo opened the CV template again, and COMPLIANT marked it as ambition with just enough plausible deniability.',
  },
  {
    assetBasename: 'street-with-eiffel-tower-in-the-middle-on-a-sunny-royalty-free-image-1717187207.avif',
    persona: 'popularite',
    content: 'Lea has Paris queued twice, which is not a file pattern anymore, it is a destination campaign.',
  },
  {
    assetBasename: 'invoice-number.jpeg',
    persona: 'securite',
    content: 'Hugo saved an invoice image where screenshots usually live, and the privacy score immediately started asking follow-up questions.',
  },
  {
    assetBasename: '2024D117_ITALIANSEO_POMODORO_2_X-1-768x960.jpg',
    persona: 'popularite',
    content: 'Manon has tomato imagery sharp enough to make lunch look like a brand partnership.',
  },
  {
    assetBasename: '637627ca9eebde45ae5f394c_Underwater-Nun.jpeg',
    persona: 'popularite',
    content: 'Lucas ended on the weirdest image in the folder, which is exactly the kind of choice COMPLIANT pretends to understand.',
  },
];

/** Made-up French-sounding identities, one per avatar. */
const PEOPLE = [
  { first: 'Camille', last: 'Laurent', dominant: 'popularity', device: 'Camille MacBook Air', focus: 'Paris food photos, travel planning, and group chats' },
  { first: 'Théo', last: 'Moreau', dominant: 'productivity', device: 'Theo Studio MacBook', focus: 'PDF invoices, portfolio drafts, and late-night export folders' },
  { first: 'Léa', last: 'Bernard', dominant: 'popularity', device: 'Lea Social Laptop', focus: 'visual moodboards, city photos, and fast-moving DMs' },
  { first: 'Hugo', last: 'Petit', dominant: 'security', device: 'Hugo ThinkPad', focus: 'security settings, document cleanup, and cautious downloads' },
  { first: 'Manon', last: 'Girard', dominant: 'productivity', device: 'Manon MacBook Pro', focus: 'client decks, design files, and invoice admin' },
  { first: 'Lucas', last: 'Rousseau', dominant: 'security', device: 'Lucas Work Laptop', focus: 'network hygiene, backups, and private folders' },
  { first: 'Chloé', last: 'Lefèvre', dominant: 'popularity', device: 'Chloe Creator MacBook', focus: 'creator assets, image folders, and social posts' },
  { first: 'Noah', last: 'Fontaine', dominant: 'productivity', device: 'Noah Office MacBook', focus: 'proposal drafts, shared drives, and calendar cleanup' },
  { first: 'Inès', last: 'Mercier', dominant: 'popularity', device: 'Ines Photo Laptop', focus: 'travel photos, saved references, and social planning' },
  { first: 'Jules', last: 'Garnier', dominant: 'security', device: 'Jules Secure ThinkPad', focus: 'network traces, screenshots, and private browser sessions' },
  { first: 'Sarah', last: 'Blanc', dominant: 'productivity', device: 'Sarah Project MacBook', focus: 'client PDFs, budget sheets, and export folders' },
  { first: 'Nina', last: 'Robin', dominant: 'popularity', device: 'Nina Creator Studio', focus: 'visual experiments, image pulls, and draft captions' },
  { first: 'Maxime', last: 'Faure', dominant: 'security', device: 'Maxime Admin Laptop', focus: 'system settings, invoices, and cautious file handling' },
  { first: 'Emma', last: 'Chevalier', dominant: 'popularity', device: 'Emma Air', focus: 'city guides, outfit references, and group chat assets' },
  { first: 'Antoine', last: 'Perrin', dominant: 'productivity', device: 'Antoine Workstation', focus: 'resume edits, contracts, and late-night documents' },
  { first: 'Zoé', last: 'Masson', dominant: 'popularity', device: 'Zoe Social MacBook', focus: 'pet photos, story drafts, and lifestyle folders' },
  { first: 'Rayan', last: 'Lopez', dominant: 'security', device: 'Rayan Travel Laptop', focus: 'tickets, IDs, invoices, and screenshot evidence' },
  { first: 'Clara', last: 'Aubert', dominant: 'productivity', device: 'Clara Studio Pro', focus: 'campaign folders, PDF proofs, and task boards' },
  { first: 'Mathis', last: 'Renard', dominant: 'popularity', device: 'Mathis Media Laptop', focus: 'stock images, food photos, and visual references' },
  { first: 'Eva', last: 'Marchand', dominant: 'security', device: 'Eva Private MacBook', focus: 'download hygiene, odd filenames, and locked notes' },
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

function mockOverviewFor(person, slug, i) {
  const collectedAt = new Date(Date.now() - (i + 2) * 36 * 60 * 60 * 1000).toISOString();
  const appsByPersona = {
    productivity: ['Notion', 'Figma', 'Preview', 'Numbers', 'Calendar', 'Mail'],
    security: ['1Password', 'Little Snitch', 'CleanMyMac', 'Preview', 'Finder', 'Safari'],
    popularity: ['Instagram', 'Messages', 'WhatsApp', 'Photos', 'Spotify', 'Safari'],
  };
  const dom = person.dominant;
  const apps = appsByPersona[dom] ?? appsByPersona.productivity;
  return {
    collectedAt,
    lastAnalysisAt: new Date(Date.now() - (i + 1) * 90 * 60 * 1000).toISOString(),
    harvestOverview: {
      machine: {
        name: person.device,
        model: i % 2 === 0 ? 'MacBook Pro 14-inch' : 'MacBook Air 13-inch',
        chip: i % 3 === 0 ? 'Apple M3 Pro' : 'Apple M2',
        ram: i % 2 === 0 ? '18 GB' : '16 GB',
        osVersion: 'macOS 15.5',
        appearance: i % 2 === 0 ? 'Dark' : 'Light',
        screenResolution: i % 2 === 0 ? '3024 x 1964' : '2560 x 1664',
        locale: 'fr_CH',
        languages: ['fr-FR', 'en-US'],
      },
      storage: {
        totalGb: 512,
        usedGb: 220 + i * 23,
        freeGb: Math.max(48, 292 - i * 23),
        usePercent: 43 + i * 4,
        smartStatus: 'Verified',
      },
      battery: {
        percent: 54 + i * 5,
        charging: i % 2 === 0,
        powerSource: i % 2 === 0 ? 'Power Adapter' : 'Battery',
        cycles: 110 + i * 31,
        condition: 'Normal',
        healthPercent: 91 - i,
      },
      memory: {
        pressure: i % 2 === 0 ? 'Normal' : 'Moderate',
        usedGb: 8 + i,
        totalGb: i % 2 === 0 ? 18 : 16,
      },
      security: {
        sip: 'Enabled',
        filevault: i % 3 === 0 ? 'Enabled' : 'Unknown',
        gatekeeper: 'Enabled',
      },
      diagnostics: {
        crashCount7d: i % 3,
        errorCount24h: i + 1,
      },
      usage: {
        appUsage7d: apps.slice(0, 4),
        recentFilesCount: 18 + i * 7,
        downloadsCount: 4 + i,
        uptimeDays: 1 + (i % 4),
      },
      apps: {
        mostUsed: apps,
        dock: apps.slice(0, 5),
        installedCount: 73 + i * 6,
      },
      network: {
        wifiNetworks: ['Home-5G', 'Cafe_Guest', 'SBB-Free', `${person.first}-Hotspot`],
        wifiCount: 12 + i,
      },
      browser: {
        topDomains: ['instagram.com', 'notion.so', 'icloud.com', 'google.com'].slice(0, 3 + (i % 2)),
        totalVisits: 220 + i * 47,
      },
      files: {
        extensions: ['jpg', 'pdf', 'webp', 'png'].slice(0, 3 + (i % 2)),
      },
      displays: [{ name: 'Built-in Retina', resolution: i % 2 === 0 ? '3024 x 1964' : '2560 x 1664' }],
    },
  };
}

let cachedRoster = null;

/**
 * The fake-user roster (memoized). Each entry is a profile-shaped object the
 * feed (`avatarSrcFromProfile`, `displayNameFromProfile`) and leaderboards can
 * consume directly. Avatars are base64 `data:` URIs (DEMO_VIDEO_AVATARS) so they
 * render on any origin — including the deployed site — with no asset deploy.
 */
export function getFakeUsers() {
  if (cachedRoster) return cachedRoster;
  cachedRoster = PEOPLE.map((person, i) => {
    const slug = `demo-video-${person.first}-${person.last}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const displayName = `${person.first} ${person.last}`;
    const scoreSet = scoresFor(person, slug);
    const overview = mockOverviewFor(person, slug, i);
    const globalScore = Math.round((scoreSet.productivity + scoreSet.security + scoreSet.social) / 3) + 18;
    return {
      id: slug,
      slug,
      firstname: person.first,
      lastname: person.last,
      displayName,
      machineName: person.device,
      globalScore: Math.max(35, Math.min(92, globalScore)),
      avatarUrl: DEMO_VIDEO_AVATARS[i % DEMO_VIDEO_AVATARS.length],
      avatarInitials: initialsOf(person.first, person.last),
      handle: handleOf(person.first, person.last),
      personaScores: scoreSet,
      dominantPersona: person.dominant,
      profileSummary: `${displayName} looks like ${person.focus}. COMPLIANT has enough demo signals to score the profile without using a real account.`,
      userDescription: `${displayName} looks like ${person.focus}. COMPLIANT has enough demo signals to score the profile without using a real account.`,
      collectedAt: overview.collectedAt,
      lastAnalysisAt: overview.lastAnalysisAt,
      harvestOverview: overview.harvestOverview,
      personaPosts: [],
      __demoVideoFake: true,
    };
  });
  return cachedRoster;
}

/** Reveal cycle: { fakeUser, assetBasename, post } steps. */
export function buildDemoVideoSchedule() {
  const users = getFakeUsers();
  return STATIC_POSTS.map((post, i) => ({
    user: users[i % users.length],
    assetBasename: post.assetBasename,
    post,
  }));
}

export function isDemoVideoFakeSlug(slug) {
  const key = String(slug ?? '');
  return key.startsWith('demo-video-');
}

// ── active-state singleton (so leaderboard splicers need no prop drilling) ─────
// Backed by a tiny pub/sub so React views (useDemoVideoActive) re-render and
// re-splice the moment the demo video is toggled — not only on the next poll.
let active = false;
const activeListeners = new Set();
export function setDemoVideoActive(value) {
  const next = Boolean(value);
  if (next === active) return;
  active = next;
  for (const listener of activeListeners) {
    try { listener(); } catch { /* ignore */ }
  }
}
export function isDemoVideoActive() {
  return active;
}
export function subscribeDemoVideoActive(listener) {
  activeListeners.add(listener);
  return () => activeListeners.delete(listener);
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
