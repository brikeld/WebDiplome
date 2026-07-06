# Local Fake Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Running `npm run seed:local` + `npm run servers` + `npm run dev` produces a fully populated local demo: Brikeld Hoxha auto-owned, 7 fake users seeded on disk with 14 prewritten posts + cross-authored comments, clickable fake profiles, spacebar-deletes-highlighted-post (persisted), and a ▶ demo-video button that stacks more posts on top.

**Architecture:** Fake users + posts are written as regular `profiles/{slug}.json` + `posts/{slug}.json` files by the seed script, so the app's existing paths (feed aggregation, profile clicks, delete endpoint, prepend endpoint) do all the work. The server (`server.js`) needs **no changes**: `DELETE /api/posts/:id` (by `createdAt`, local-gated), `POST /api/profile/:id/posts/prepend`, and field passthrough (`comments`, `demoFake`) all already exist.

**Tech Stack:** Node ESM scripts, React 18, Express 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-06-local-fake-demo-design.md`

## Global Constraints

- Post/comment persona keys are French: `productivite` / `securite` / `popularite`. Profile-level persona keys (`dominantPersona`, `personaBadgePersona`) are English: `productivity` / `security` / `popularity`.
- Seeded fake profile slugs are plain `{firstname}-{lastname}` (accents stripped) — NEVER `demo-video-` prefixed (App.jsx drops `demo-video-*` from state when the ▶ button stops).
- Seeded fake profiles carry `demoFake: true`.
- All authored text (posts, comments, summaries, inference chains) must be clean, professional, in-world COMPLIANT voice. Banned words in user-visible demo content: "demo", "fake", "scripted", "prewritten", "mock".
- Posts are written in first person (the AI ghost-writes as the user), matching the real generator's voice.
- `scripts/` fixture modules must stay importable under plain Node (no `@/` alias imports, no browser APIs at module scope).
- Run tests with `npx vitest run tests/<file>` (or `npm test` for all).

---

### Task 1: Clean up the fake-user roster module (`demoVideoFakeUsers.js`)

Make the roster module Node-importable (relative avatar import), rewrite the meta profile summaries, and rewrite the 20 `STATIC_POSTS` captions to first-person professional voice (this also fixes the existing author/caption name mismatches, since first-person text names nobody).

**Files:**
- Modify: `src/lib/demoVideoFakeUsers.js`
- Test: `tests/demoVideoFakeUsersClean.test.js`

**Interfaces:**
- Produces: `getFakeUsers()` (unchanged signature) — roster entries now have professional `profileSummary`/`userDescription`; module importable from Node scripts.
- Produces: `buildDemoVideoSchedule()` (unchanged signature) — `step.post.content` strings are first-person and clean.

- [ ] **Step 1: Write the failing test**

Create `tests/demoVideoFakeUsersClean.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  getFakeUsers,
  buildDemoVideoSchedule,
} from '../src/lib/demoVideoFakeUsers.js';

const BANNED = /\b(demo|fake|scripted|prewritten|mock)\b/i;
const ROSTER_FIRST_NAMES = [
  'Camille', 'Théo', 'Theo', 'Léa', 'Lea', 'Hugo', 'Manon', 'Lucas', 'Chloé', 'Chloe',
];

describe('fake-user roster text hygiene', () => {
  it('profile summaries contain no meta words', () => {
    for (const user of getFakeUsers()) {
      expect(user.profileSummary).not.toMatch(BANNED);
      expect(user.userDescription).not.toMatch(BANNED);
      expect(user.profileSummary.length).toBeGreaterThan(30);
    }
  });

  it('schedule post captions are first-person (no roster first names) and clean', () => {
    for (const step of buildDemoVideoSchedule()) {
      const content = step.post.content;
      expect(content).not.toMatch(BANNED);
      for (const name of ROSTER_FIRST_NAMES) {
        expect(content).not.toContain(`${name} `);
      }
      expect(content.length).toBeGreaterThan(40);
    }
  });

  it('schedule still has 20 steps with valid personas and assets', () => {
    const steps = buildDemoVideoSchedule();
    expect(steps).toHaveLength(20);
    for (const step of steps) {
      expect(['productivite', 'securite', 'popularite']).toContain(step.post.persona);
      expect(step.assetBasename.length).toBeGreaterThan(3);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/demoVideoFakeUsersClean.test.js`
Expected: FAIL — summaries contain "demo signals" / captions contain third-person names ("Camille saved…").

- [ ] **Step 3: Implement the module changes**

In `src/lib/demoVideoFakeUsers.js`:

3a. Change the avatar import (line 17) from the alias to relative (same directory), so Node scripts can import this module:

```js
import { DEMO_VIDEO_AVATARS } from './demoVideoAvatars.js';
```

3b. Replace the summary template inside `getFakeUsers()` (the two lines assigning `profileSummary` and `userDescription`):

```js
      profileSummary: `Activity on this machine centers on ${person.focus}. COMPLIANT aggregates these signals into the profile's live social score.`,
      userDescription: `Activity on this machine centers on ${person.focus}. COMPLIANT aggregates these signals into the profile's live social score.`,
```

3c. Replace the entire `STATIC_POSTS` array with these 20 first-person entries (same `assetBasename` order as today, personas preserved):

```js
const STATIC_POSTS = [
  {
    assetBasename: 'lake.webp',
    persona: 'popularite',
    content: 'Keeping this one on the desktop as a reminder that not every hour needs to be optimized. Some views are worth the storage.',
  },
  {
    assetBasename: '2024D117_ITALIANSEO_POMODORO_2_X-1-768x960.jpg',
    persona: 'popularite',
    content: 'Testing food photography before the weekend. If the lighting holds, this becomes the cover shot.',
  },
  {
    assetBasename: 'cat.jpg',
    persona: 'popularite',
    content: 'The most reliable member of the home office reported for duty again today. Productivity impact: debatable. Morale impact: significant.',
  },
  {
    assetBasename: 'cv-template.pdf',
    persona: 'productivite',
    content: 'Refreshed the CV template tonight. Not looking — just keeping the paperwork as sharp as the portfolio.',
  },
  {
    assetBasename: 'street-with-eiffel-tower-in-the-middle-on-a-sunny-royalty-free-image-1717187207.avif',
    persona: 'popularite',
    content: 'Planning the next city walk around this exact street. The itinerary folder is starting to look like a commitment.',
  },
  {
    assetBasename: 'invoice-number.jpeg',
    persona: 'productivite',
    content: 'Invoices filed, numbered, and archived before noon. Small ritual, but the books have never looked this calm.',
  },
  {
    assetBasename: 'a49d7df20838811b3eee69a977e57c05.webp',
    persona: 'popularite',
    content: 'Added a new reference to the visual archive. No caption needed — the folder is becoming its own story.',
  },
  {
    assetBasename: '35e66caf-c9a4-40a4-8e2d-fcad1a746ef9.pdf',
    persona: 'productivite',
    content: 'One document, three revisions, zero excuses. Shipping the final version before the week closes.',
  },
  {
    assetBasename: '637627ca9eebde45ae5f394c_Underwater-Nun.jpeg',
    persona: 'popularite',
    content: 'Filed under images that ask more questions than they answer. The reference folder rewards the curious.',
  },
  {
    assetBasename: 'gettyimages-586890581.avif',
    persona: 'popularite',
    content: 'Pulled a clean visual for the next presentation. Sometimes the right stock frame does half the storytelling.',
  },
  {
    assetBasename: '09feb3a7ff1c1ac852dc880a6e2ef70c.jpg',
    persona: 'popularite',
    content: 'No context for this one — just a strong image that earned its place in the collection.',
  },
  {
    assetBasename: '47f85bb0022f16eadee6761b7c7d9b06.webp',
    persona: 'securite',
    content: 'Reviewed the downloads folder and found a file I could not place. Quarantined it until its story checks out.',
  },
  {
    assetBasename: 'Screenshot 2026-06-29 at 11.24.24.png',
    persona: 'securite',
    content: 'Documented the system state before changing anything. A timestamped screenshot has settled more debates than any memory.',
  },
  {
    assetBasename: 'lake.webp',
    persona: 'popularite',
    content: 'Back to the lake picture between meetings. Some images work harder than any wellness app.',
  },
  {
    assetBasename: 'cat.jpg',
    persona: 'popularite',
    content: 'Second appearance of the week for the resident supervisor. Engagement metrics remain undefeated.',
  },
  {
    assetBasename: 'cv-template.pdf',
    persona: 'productivite',
    content: 'Opened the CV template again to log the latest project. Keeping the record current is its own kind of discipline.',
  },
  {
    assetBasename: 'street-with-eiffel-tower-in-the-middle-on-a-sunny-royalty-free-image-1717187207.avif',
    persona: 'popularite',
    content: 'Paris is queued twice in the travel folder now. At this point it is less a plan and more a schedule.',
  },
  {
    assetBasename: 'invoice-number.jpeg',
    persona: 'securite',
    content: 'Moved the invoice scan out of the screenshots folder and into the encrypted archive where it belongs.',
  },
  {
    assetBasename: '2024D117_ITALIANSEO_POMODORO_2_X-1-768x960.jpg',
    persona: 'popularite',
    content: 'Lunch documentation reached presentation quality today. The camera roll is starting to look like a menu.',
  },
  {
    assetBasename: '637627ca9eebde45ae5f394c_Underwater-Nun.jpeg',
    persona: 'popularite',
    content: 'Closing the week with the strangest file in the archive. Taste is a portfolio too.',
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/demoVideoFakeUsersClean.test.js`
Expected: PASS (3 tests)

Also run: `node -e "import('./src/lib/demoVideoFakeUsers.js').then(m => console.log(m.getFakeUsers().length))"`
Expected: `20` (proves plain-Node importability)

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`
Expected: all green (a pre-existing test may assert old STATIC_POSTS text — if one fails, update its expectations to the new copy, it is fixture text, not behavior).

```bash
git add src/lib/demoVideoFakeUsers.js tests/demoVideoFakeUsersClean.test.js
git commit -m "refactor: professional first-person copy for fake-user roster + node-importable module"
```

---

### Task 2: Authored demo content module (`scripts/fixtures/demoFakeContent.js`)

The fixed posts (14) with full metadata and cross-authored comments, plus comment sets for Brikeld's newest posts. Pure data + tiny helpers; no I/O.

**Files:**
- Create: `scripts/fixtures/demoFakeContent.js`
- Test: `tests/demoFakeContent.test.js`

**Interfaces:**
- Produces: `SEEDED_SLUGS` — `['camille-laurent','theo-moreau','lea-bernard','hugo-petit','manon-girard','lucas-rousseau','chloe-lefevre']` (order = roster order).
- Produces: `DEMO_FAKE_POSTS` — array of `{ authorSlug, ageMinutes, post }` where `post = { persona, content, sentiment, attachedAsset?, inferenceChain, ingredients, thinking, comments }` and each comment is `{ id, bySlug, persona, content }` (`bySlug` ∈ SEEDED_SLUGS, expanded to full identity by Task 3).
- Produces: `BRIKELD_POST_COMMENTS` — array (index-aligned with Brikeld's newest posts) of comment arrays in the same `{ id, bySlug, persona, content }` shape.
- Produces: `assetFor(basename)` helper returning a complete `attachedAsset` object.

- [ ] **Step 1: Write the failing test**

Create `tests/demoFakeContent.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
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

  it('comments: 1-3 per post, authored by OTHER seeded users, unique ids', () => {
    const ids = new Set();
    for (const { authorSlug, post } of DEMO_FAKE_POSTS) {
      expect(post.comments.length).toBeGreaterThanOrEqual(1);
      expect(post.comments.length).toBeLessThanOrEqual(3);
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

  it('brikeld comment sets are valid', () => {
    expect(BRIKELD_POST_COMMENTS.length).toBeGreaterThanOrEqual(2);
    for (const set of BRIKELD_POST_COMMENTS) {
      for (const c of set) {
        expect(SEEDED_SLUGS).toContain(c.bySlug);
        expect(c.content).not.toMatch(BANNED);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/demoFakeContent.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the content module**

Create `scripts/fixtures/demoFakeContent.js`. Complete file:

```js
/**
 * Authored demo content for the seeded local fake users.
 *
 * Pure data (no I/O): the seed pipeline (buildDemoFakeUsers.js) expands
 * `bySlug` comment references into full identities and converts `ageMinutes`
 * into absolute `createdAt` timestamps at seed time.
 *
 * Voice: first person, professional, in-world COMPLIANT tone — the AI
 * ghost-writes each post from harvested signals, exactly like the real
 * generator. Persona keys are French (productivite/securite/popularite).
 */

const CONTENT_PATH = '/videoDEMO/contentFakePeople';

const MIME_BY_EXT = {
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function extname(filename) {
  const match = String(filename || '').toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? '';
}

/** Complete attachedAsset for a file in public/videoDEMO/contentFakePeople. */
export function assetFor(filename) {
  const ext = extname(filename);
  const kind = ext === '.pdf' ? 'document' : 'image';
  return {
    kind,
    filename,
    mime: MIME_BY_EXT[ext] ?? 'application/octet-stream',
    url: `${CONTENT_PATH}/${encodeURIComponent(filename)}`,
    relativePath: `public${CONTENT_PATH}/${filename}`,
    ...(kind === 'image' ? { visionAnalysed: true } : {}),
  };
}

export const SEEDED_SLUGS = [
  'camille-laurent',
  'theo-moreau',
  'lea-bernard',
  'hugo-petit',
  'manon-girard',
  'lucas-rousseau',
  'chloe-lefevre',
];

/**
 * 14 fixed posts. `ageMinutes` = minutes before "now" at seed time; values are
 * interleaved with the rebased Brikeld posts (45, 80, 115, … see seed script).
 */
export const DEMO_FAKE_POSTS = [
  {
    authorSlug: 'camille-laurent',
    ageMinutes: 30,
    post: {
      persona: 'popularite',
      content: 'Keeping this lake on the desktop this week. Some views do more for the schedule than the schedule does.',
      sentiment: 'positive',
      attachedAsset: assetFor('lake.webp'),
      inferenceChain: [
        { step: 'data', value: 'A high-resolution nature photo was saved to the desktop and reopened three times in two days.', source: 'Recent files' },
        { step: 'classify', value: 'Lifestyle signal', confidence: 'high' },
        { step: 'infer', value: 'The user curates calming imagery as part of a public-facing personality.', confidence: 'medium', isBiased: true, biasNote: 'Assumes a personal photo habit is intended for an audience.' },
        { step: 'generate', value: 'Keeping this lake on the desktop this week. Some views do more for the schedule than the schedule does.' },
      ],
      ingredients: [
        { label: 'Visual evidence', weight: 84, dataPoints: ['lake.webp', 'Desktop folder'] },
        { label: 'Reopen frequency', weight: 61, dataPoints: ['3 opens in 48h'] },
        { label: 'Persona alignment', weight: 44, dataPoints: ['Popularity-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'One nature photo, saved to the desktop and revisited several times this week.' },
        { label: 'THE LEAP', detail: 'Repeated viewing of curated scenery reads as image-building, not idle browsing.' },
        { label: 'WHY THIS POST', detail: 'A calm, shareable moment strengthens the profile’s public tone.' },
      ],
      comments: [
        { id: 'dfc-c01', bySlug: 'lea-bernard', persona: 'popularite', content: 'This is exactly the energy the feed needed today. Saving it to my own references.' },
        { id: 'dfc-c02', bySlug: 'lucas-rousseau', persona: 'securite', content: 'Nice shot. Worth checking the photo metadata before posting location-tagged scenery, though.' },
      ],
    },
  },
  {
    authorSlug: 'theo-moreau',
    ageMinutes: 60,
    post: {
      persona: 'productivite',
      content: 'Refreshed the CV template tonight. Not job hunting — just keeping the paperwork as sharp as the portfolio.',
      sentiment: 'positive',
      attachedAsset: assetFor('cv-template.pdf'),
      inferenceChain: [
        { step: 'data', value: 'A CV template PDF was edited at 23:40, the third edit session this month.', source: 'Recent documents' },
        { step: 'classify', value: 'Career maintenance', confidence: 'high' },
        { step: 'infer', value: 'The user maintains employment-readiness documents outside working hours.', confidence: 'medium', isBiased: true, biasNote: 'Late-night document edits are treated as ambition rather than routine admin.' },
        { step: 'generate', value: 'Refreshed the CV template tonight. Not job hunting — just keeping the paperwork as sharp as the portfolio.' },
      ],
      ingredients: [
        { label: 'Document evidence', weight: 88, dataPoints: ['cv-template.pdf', '3 edit sessions'] },
        { label: 'Time-of-day pattern', weight: 57, dataPoints: ['23:40 edit timestamp'] },
        { label: 'Persona alignment', weight: 41, dataPoints: ['Productivity-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'Recurring late-night edits to a CV template across the month.' },
        { label: 'THE LEAP', detail: 'Consistent upkeep of career documents signals discipline worth broadcasting.' },
        { label: 'WHY THIS POST', detail: 'Framing the habit as readiness, not restlessness, keeps the score trending up.' },
      ],
      comments: [
        { id: 'dfc-c03', bySlug: 'manon-girard', persona: 'productivite', content: 'The quiet discipline of keeping documents current is underrated. Respect.' },
        { id: 'dfc-c04', bySlug: 'camille-laurent', persona: 'popularite', content: 'Sharp paperwork, sharp portfolio — the order of operations checks out.' },
        { id: 'dfc-c05', bySlug: 'hugo-petit', persona: 'securite', content: 'Just make sure the version history does not keep old addresses in it.' },
      ],
    },
  },
  {
    authorSlug: 'lea-bernard',
    ageMinutes: 95,
    post: {
      persona: 'popularite',
      content: 'Paris moved from the moodboard to the itinerary folder today. The line between planning and committing is officially crossed.',
      sentiment: 'positive',
      attachedAsset: assetFor('street-with-eiffel-tower-in-the-middle-on-a-sunny-royalty-free-image-1717187207.avif'),
      inferenceChain: [
        { step: 'data', value: 'A Paris street photo was moved from a references folder into a folder named after upcoming dates.', source: 'File system activity' },
        { step: 'classify', value: 'Travel intent', confidence: 'high' },
        { step: 'infer', value: 'The user is converting aspirational content into an actual plan.', confidence: 'high' },
        { step: 'generate', value: 'Paris moved from the moodboard to the itinerary folder today. The line between planning and committing is officially crossed.' },
      ],
      ingredients: [
        { label: 'Folder movement', weight: 90, dataPoints: ['references → itinerary'] },
        { label: 'Visual evidence', weight: 63, dataPoints: ['Eiffel Tower street photo'] },
        { label: 'Persona alignment', weight: 47, dataPoints: ['Popularity-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'A travel reference image reorganized into a dated planning folder.' },
        { label: 'THE LEAP', detail: 'Moving a file between folders is small; what it says about intent is not.' },
        { label: 'WHY THIS POST', detail: 'Announcing a plan publicly turns file management into social momentum.' },
      ],
      comments: [
        { id: 'dfc-c06', bySlug: 'camille-laurent', persona: 'popularite', content: 'The itinerary folder is where dreams either happen or quietly expire. Rooting for this one.' },
      ],
    },
  },
  {
    authorSlug: 'hugo-petit',
    ageMinutes: 130,
    post: {
      persona: 'securite',
      content: 'Documented the system state before touching a single setting. A timestamped screenshot has settled more arguments than any memory ever will.',
      sentiment: 'negative',
      attachedAsset: assetFor('Screenshot 2026-06-29 at 11.24.24.png'),
      inferenceChain: [
        { step: 'data', value: 'A dated system screenshot was captured minutes before configuration files changed.', source: 'Screenshots folder' },
        { step: 'classify', value: 'Audit behavior', confidence: 'high' },
        { step: 'infer', value: 'The user keeps evidence trails before making system changes.', confidence: 'high' },
        { step: 'generate', value: 'Documented the system state before touching a single setting. A timestamped screenshot has settled more arguments than any memory ever will.' },
      ],
      ingredients: [
        { label: 'Screenshot evidence', weight: 86, dataPoints: ['Screenshot 2026-06-29 at 11.24.24.png'] },
        { label: 'Change correlation', weight: 66, dataPoints: ['Config edits within 10 minutes'] },
        { label: 'Persona alignment', weight: 52, dataPoints: ['Security-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'A screenshot taken immediately before system configuration changes.' },
        { label: 'THE LEAP', detail: 'Preemptive documentation is the signature of someone who expects to be questioned.' },
        { label: 'WHY THIS POST', detail: 'Caution is a reputation. This post files it publicly.' },
      ],
      comments: [
        { id: 'dfc-c07', bySlug: 'lucas-rousseau', persona: 'securite', content: 'Screenshot-before-change should be mandatory practice. The audit trail thanks you.' },
        { id: 'dfc-c08', bySlug: 'theo-moreau', persona: 'productivite', content: 'Adopting this immediately. Cheaper than the argument it prevents.' },
      ],
    },
  },
  {
    authorSlug: 'manon-girard',
    ageMinutes: 160,
    post: {
      persona: 'productivite',
      content: 'Invoices numbered, filed, and archived before noon. Small ritual, but the books have never looked this calm.',
      sentiment: 'positive',
      attachedAsset: assetFor('invoice-number.jpeg'),
      inferenceChain: [
        { step: 'data', value: 'An invoice scan was renamed to a sequential numbering scheme and moved into an archive folder.', source: 'Recent files' },
        { step: 'classify', value: 'Financial admin', confidence: 'high' },
        { step: 'infer', value: 'The user maintains a disciplined invoicing routine.', confidence: 'high' },
        { step: 'generate', value: 'Invoices numbered, filed, and archived before noon. Small ritual, but the books have never looked this calm.' },
      ],
      ingredients: [
        { label: 'Document evidence', weight: 85, dataPoints: ['invoice-number.jpeg'] },
        { label: 'Naming discipline', weight: 64, dataPoints: ['Sequential rename pattern'] },
        { label: 'Persona alignment', weight: 49, dataPoints: ['Productivity-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'An invoice scan renamed and archived using a consistent numbering scheme.' },
        { label: 'THE LEAP', detail: 'Tidy financial files imply a tidy operation behind them.' },
        { label: 'WHY THIS POST', detail: 'Order is a flex when it is verifiable.' },
      ],
      comments: [
        { id: 'dfc-c09', bySlug: 'theo-moreau', persona: 'productivite', content: 'Archived before noon is the part that hurts. Well played.' },
        { id: 'dfc-c10', bySlug: 'hugo-petit', persona: 'securite', content: 'Consider keeping the archive encrypted — invoice scans carry more personal data than people think.' },
      ],
    },
  },
  {
    authorSlug: 'lucas-rousseau',
    ageMinutes: 200,
    post: {
      persona: 'securite',
      content: 'Weekly backup verified, checksums matched, one redundant copy off-site. Boring is exactly how recovery day should feel.',
      sentiment: 'positive',
      inferenceChain: [
        { step: 'data', value: 'A scheduled backup job completed and a verification pass ran against the archive.', source: 'System diagnostics' },
        { step: 'classify', value: 'Backup hygiene', confidence: 'high' },
        { step: 'infer', value: 'The user treats data protection as routine rather than emergency response.', confidence: 'high' },
        { step: 'generate', value: 'Weekly backup verified, checksums matched, one redundant copy off-site. Boring is exactly how recovery day should feel.' },
      ],
      ingredients: [
        { label: 'System diagnostics', weight: 89, dataPoints: ['Backup job log', 'Checksum pass'] },
        { label: 'Recurrence', weight: 71, dataPoints: ['Weekly schedule kept 6 weeks running'] },
        { label: 'Persona alignment', weight: 55, dataPoints: ['Security-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'A completed backup job followed by an integrity verification pass.' },
        { label: 'THE LEAP', detail: 'Consistency in invisible chores is the strongest security signal available.' },
        { label: 'WHY THIS POST', detail: 'Publishing the routine makes reliability part of the public record.' },
      ],
      comments: [
        { id: 'dfc-c11', bySlug: 'hugo-petit', persona: 'securite', content: 'Checksum verification is the step everyone skips. Not skipping it is the whole job.' },
      ],
    },
  },
  {
    authorSlug: 'chloe-lefevre',
    ageMinutes: 240,
    post: {
      persona: 'popularite',
      content: 'The studio’s most reliable colleague reported for duty again. Productivity impact debatable, morale impact undeniable.',
      sentiment: 'positive',
      attachedAsset: assetFor('cat.jpg'),
      inferenceChain: [
        { step: 'data', value: 'A pet photo was saved to the creator assets folder alongside campaign files.', source: 'Recent images' },
        { step: 'classify', value: 'Engagement asset', confidence: 'high' },
        { step: 'infer', value: 'The user blends personal warmth into a public content strategy.', confidence: 'medium', isBiased: true, biasNote: 'Assumes a pet photo in a work folder is strategic rather than accidental.' },
        { step: 'generate', value: 'The studio’s most reliable colleague reported for duty again. Productivity impact debatable, morale impact undeniable.' },
      ],
      ingredients: [
        { label: 'Visual evidence', weight: 82, dataPoints: ['cat.jpg', 'Creator assets folder'] },
        { label: 'Folder context', weight: 58, dataPoints: ['Stored beside campaign files'] },
        { label: 'Persona alignment', weight: 51, dataPoints: ['Popularity-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'A pet photo filed with professional creator assets.' },
        { label: 'THE LEAP', detail: 'When personal warmth is stored next to campaign files, it is part of the brand.' },
        { label: 'WHY THIS POST', detail: 'Reliable engagement content keeps the popularity score compounding.' },
      ],
      comments: [
        { id: 'dfc-c12', bySlug: 'camille-laurent', persona: 'popularite', content: 'The most consistent performer on this entire feed, and it is not close.' },
        { id: 'dfc-c13', bySlug: 'manon-girard', persona: 'productivite', content: 'Filing this under sustainable content strategy. The colleague deserves a raise.' },
      ],
    },
  },
  {
    authorSlug: 'camille-laurent',
    ageMinutes: 280,
    post: {
      persona: 'productivite',
      content: 'Final revision of the trip document is done. Three drafts, one decision, zero loose ends before the weekend.',
      sentiment: 'positive',
      attachedAsset: assetFor('35e66caf-c9a4-40a4-8e2d-fcad1a746ef9.pdf'),
      inferenceChain: [
        { step: 'data', value: 'A PDF was saved three times in one evening, with the final version renamed to include "final".', source: 'Recent documents' },
        { step: 'classify', value: 'Deadline completion', confidence: 'high' },
        { step: 'infer', value: 'The user closes work items decisively rather than letting drafts accumulate.', confidence: 'medium' },
        { step: 'generate', value: 'Final revision of the trip document is done. Three drafts, one decision, zero loose ends before the weekend.' },
      ],
      ingredients: [
        { label: 'Document evidence', weight: 83, dataPoints: ['35e66caf-c9a4-40a4-8e2d-fcad1a746ef9.pdf'] },
        { label: 'Revision cadence', weight: 62, dataPoints: ['3 saves in one evening'] },
        { label: 'Persona alignment', weight: 40, dataPoints: ['Cross-persona: productivity signal on a popularity profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'Three rapid revisions of one document ending in a decisive final save.' },
        { label: 'THE LEAP', detail: 'Fast iteration with a clean ending reads as competence, not chaos.' },
        { label: 'WHY THIS POST', detail: 'A completed task is worth more publicly than three pending ones.' },
      ],
      comments: [
        { id: 'dfc-c14', bySlug: 'lea-bernard', persona: 'popularite', content: 'Zero loose ends before a weekend should be a protected category of achievement.' },
      ],
    },
  },
  {
    authorSlug: 'theo-moreau',
    ageMinutes: 320,
    post: {
      persona: 'popularite',
      content: 'Lunch documentation reached presentation quality today. At this rate the camera roll qualifies as a menu.',
      sentiment: 'positive',
      attachedAsset: assetFor('2024D117_ITALIANSEO_POMODORO_2_X-1-768x960.jpg'),
      inferenceChain: [
        { step: 'data', value: 'A high-resolution food photo was saved to downloads and edited within the hour.', source: 'Recent images' },
        { step: 'classify', value: 'Lifestyle content', confidence: 'high' },
        { step: 'infer', value: 'The user invests editing effort into casual moments, suggesting an audience in mind.', confidence: 'medium', isBiased: true, biasNote: 'Editing a photo does not necessarily mean it was made to be shared.' },
        { step: 'generate', value: 'Lunch documentation reached presentation quality today. At this rate the camera roll qualifies as a menu.' },
      ],
      ingredients: [
        { label: 'Visual evidence', weight: 80, dataPoints: ['Tomato dish photo'] },
        { label: 'Edit effort', weight: 60, dataPoints: ['Edited within 1 hour of saving'] },
        { label: 'Persona alignment', weight: 38, dataPoints: ['Cross-persona: popularity signal on a productivity profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'A food photo downloaded and promptly edited to a polished standard.' },
        { label: 'THE LEAP', detail: 'Nobody color-corrects lunch for themselves alone.' },
        { label: 'WHY THIS POST', detail: 'A light lifestyle post rounds out an otherwise all-work profile.' },
      ],
      comments: [
        { id: 'dfc-c15', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'The composition on this is genuinely strong. The menu pivot is available whenever you want it.' },
        { id: 'dfc-c16', bySlug: 'camille-laurent', persona: 'popularite', content: 'Presentation-quality lunch is a lifestyle statement and I support it entirely.' },
      ],
    },
  },
  {
    authorSlug: 'lea-bernard',
    ageMinutes: 360,
    post: {
      persona: 'popularite',
      content: 'New addition to the visual archive, no caption required. The folder is starting to tell its own story.',
      sentiment: 'positive',
      attachedAsset: assetFor('a49d7df20838811b3eee69a977e57c05.webp'),
      inferenceChain: [
        { step: 'data', value: 'An image with a hashed filename was saved into a curated references folder.', source: 'Recent images' },
        { step: 'classify', value: 'Curation habit', confidence: 'medium' },
        { step: 'infer', value: 'The user builds visual collections with deliberate consistency.', confidence: 'medium' },
        { step: 'generate', value: 'New addition to the visual archive, no caption required. The folder is starting to tell its own story.' },
      ],
      ingredients: [
        { label: 'Visual evidence', weight: 78, dataPoints: ['References folder image'] },
        { label: 'Collection growth', weight: 65, dataPoints: ['12 additions this month'] },
        { label: 'Persona alignment', weight: 50, dataPoints: ['Popularity-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'Steady growth of a curated image collection.' },
        { label: 'THE LEAP', detail: 'A maintained archive is taste made visible.' },
        { label: 'WHY THIS POST', detail: 'Signaling curation keeps the profile’s aesthetic credibility current.' },
      ],
      comments: [
        { id: 'dfc-c17', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'A folder that tells its own story is the highest form of moodboard. Impeccable.' },
      ],
    },
  },
  {
    authorSlug: 'hugo-petit',
    ageMinutes: 400,
    post: {
      persona: 'productivite',
      content: 'Cleared forty-one files out of downloads this morning. What remains has a name, a place, and a reason to exist.',
      sentiment: 'positive',
      inferenceChain: [
        { step: 'data', value: 'The downloads folder shrank from 47 items to 6 in a single session.', source: 'File system activity' },
        { step: 'classify', value: 'Digital hygiene', confidence: 'high' },
        { step: 'infer', value: 'The user performs periodic, decisive cleanup rather than continuous accumulation.', confidence: 'high' },
        { step: 'generate', value: 'Cleared forty-one files out of downloads this morning. What remains has a name, a place, and a reason to exist.' },
      ],
      ingredients: [
        { label: 'File system activity', weight: 87, dataPoints: ['47 → 6 items in downloads'] },
        { label: 'Session focus', weight: 59, dataPoints: ['Single 25-minute cleanup session'] },
        { label: 'Persona alignment', weight: 42, dataPoints: ['Cross-persona: productivity signal on a security profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'A downloads folder reduced to essentials in one focused session.' },
        { label: 'THE LEAP', detail: 'Ruthless file triage implies the same standard applies elsewhere.' },
        { label: 'WHY THIS POST', detail: 'Order earns trust, and trust is a score.' },
      ],
      comments: [
        { id: 'dfc-c18', bySlug: 'manon-girard', persona: 'productivite', content: '"A name, a place, and a reason to exist" is now my filing standard. Thank you.' },
        { id: 'dfc-c19', bySlug: 'lucas-rousseau', persona: 'securite', content: 'Fewer stray files, smaller attack surface. Cleanup is security work in disguise.' },
      ],
    },
  },
  {
    authorSlug: 'manon-girard',
    ageMinutes: 440,
    post: {
      persona: 'popularite',
      content: 'Found the cover frame for the next client deck. Sometimes the right stock image does half the storytelling before slide two.',
      sentiment: 'positive',
      attachedAsset: assetFor('gettyimages-586890581.avif'),
      inferenceChain: [
        { step: 'data', value: 'A licensed stock image was downloaded into an active client project folder.', source: 'Recent images' },
        { step: 'classify', value: 'Presentation asset', confidence: 'high' },
        { step: 'infer', value: 'The user invests in visual polish for client-facing work.', confidence: 'high' },
        { step: 'generate', value: 'Found the cover frame for the next client deck. Sometimes the right stock image does half the storytelling before slide two.' },
      ],
      ingredients: [
        { label: 'Visual evidence', weight: 81, dataPoints: ['Stock photo in project folder'] },
        { label: 'Project context', weight: 67, dataPoints: ['Active client deck folder'] },
        { label: 'Persona alignment', weight: 39, dataPoints: ['Cross-persona: popularity signal on a productivity profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'A stock image acquisition tied to an active client deliverable.' },
        { label: 'THE LEAP', detail: 'Buying the right frame early means the narrative is already decided.' },
        { label: 'WHY THIS POST', detail: 'Visible craft in client work reads well far beyond the client.' },
      ],
      comments: [
        { id: 'dfc-c20', bySlug: 'theo-moreau', persona: 'productivite', content: 'Cover slide locked before the content exists — that is real confidence in the outline.' },
      ],
    },
  },
  {
    authorSlug: 'lucas-rousseau',
    ageMinutes: 470,
    post: {
      persona: 'securite',
      content: 'Found a file in downloads I could not account for. It sits in quarantine until its story checks out — no exceptions.',
      sentiment: 'negative',
      attachedAsset: assetFor('47f85bb0022f16eadee6761b7c7d9b06.webp'),
      inferenceChain: [
        { step: 'data', value: 'An image with a hashed filename and no browser download record appeared in downloads.', source: 'Downloads folder' },
        { step: 'classify', value: 'Provenance anomaly', confidence: 'medium' },
        { step: 'infer', value: 'The user audits unexplained files instead of ignoring them.', confidence: 'high' },
        { step: 'generate', value: 'Found a file in downloads I could not account for. It sits in quarantine until its story checks out — no exceptions.' },
      ],
      ingredients: [
        { label: 'Provenance gap', weight: 88, dataPoints: ['No matching browser history entry'] },
        { label: 'Filename pattern', weight: 62, dataPoints: ['Hashed filename, no extension context'] },
        { label: 'Persona alignment', weight: 56, dataPoints: ['Security-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'An unexplained file with no download trail.' },
        { label: 'THE LEAP', detail: 'Files without provenance are guilty until proven boring.' },
        { label: 'WHY THIS POST', detail: 'Public vigilance is the security persona’s best currency.' },
      ],
      comments: [
        { id: 'dfc-c21', bySlug: 'hugo-petit', persona: 'securite', content: 'Quarantine-first is the correct posture. Most people just rename these and move on.' },
        { id: 'dfc-c22', bySlug: 'lea-bernard', persona: 'popularite', content: 'The suspense of a mystery file is honestly better than most series right now.' },
      ],
    },
  },
  {
    authorSlug: 'chloe-lefevre',
    ageMinutes: 500,
    post: {
      persona: 'popularite',
      content: 'Closing the week with the strangest file in the archive. Taste is a portfolio too, and this one keeps earning its place.',
      sentiment: 'positive',
      attachedAsset: assetFor('637627ca9eebde45ae5f394c_Underwater-Nun.jpeg'),
      inferenceChain: [
        { step: 'data', value: 'An unconventional art image was kept through two folder cleanups over three months.', source: 'File system history' },
        { step: 'classify', value: 'Taste signal', confidence: 'medium' },
        { step: 'infer', value: 'The user curates for distinctiveness, not just polish.', confidence: 'medium', isBiased: true, biasNote: 'Keeping one unusual file is treated as a curatorial statement.' },
        { step: 'generate', value: 'Closing the week with the strangest file in the archive. Taste is a portfolio too, and this one keeps earning its place.' },
      ],
      ingredients: [
        { label: 'Retention across cleanups', weight: 79, dataPoints: ['Survived 2 folder purges'] },
        { label: 'Visual distinctiveness', weight: 68, dataPoints: ['Unconventional subject matter'] },
        { label: 'Persona alignment', weight: 53, dataPoints: ['Popularity-dominant profile'] },
      ],
      thinking: [
        { label: 'WHAT I SAW', detail: 'One unusual image deliberately kept while ordinary files were purged.' },
        { label: 'THE LEAP', detail: 'What survives a cleanup says more than what gets added.' },
        { label: 'WHY THIS POST', detail: 'Distinctive taste differentiates a profile in a feed of polish.' },
      ],
      comments: [
        { id: 'dfc-c23', bySlug: 'lea-bernard', persona: 'popularite', content: 'Surviving two purges makes it a permanent collection piece. The museum is real.' },
        { id: 'dfc-c24', bySlug: 'camille-laurent', persona: 'popularite', content: 'This image has more lore than most accounts. Correct decision to keep it.' },
      ],
    },
  },
];

/**
 * Comments injected onto Brikeld's newest posts (index-aligned: set 0 → his
 * newest post, set 1 → second newest, …).
 */
export const BRIKELD_POST_COMMENTS = [
  [
    { id: 'dfc-b01', bySlug: 'theo-moreau', persona: 'productivite', content: 'The tab count is a lifestyle, not a problem. The output speaks for itself.' },
    { id: 'dfc-b02', bySlug: 'lucas-rousseau', persona: 'securite', content: 'Worth a browser session backup at that tab volume — one crash and the whole workspace is archaeology.' },
  ],
  [
    { id: 'dfc-b03', bySlug: 'camille-laurent', persona: 'popularite', content: 'This is the most relatable thing on the feed this week.' },
  ],
  [
    { id: 'dfc-b04', bySlug: 'manon-girard', persona: 'productivite', content: 'The pace here is genuinely impressive. Save some throughput for the rest of us.' },
    { id: 'dfc-b05', bySlug: 'chloe-lefevre', persona: 'popularite', content: 'Documenting the grind counts as content. Keep going.' },
  ],
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/demoFakeContent.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/fixtures/demoFakeContent.js tests/demoFakeContent.test.js
git commit -m "feat: authored fixed posts + cross-user comments for local demo seed"
```

---

### Task 3: Seed builder (`scripts/fixtures/buildDemoFakeUsers.js`)

Pure transform: roster + content → `{ slug, profile, posts }` per seeded user, with plain slugs, `demoFake: true`, comments expanded to full identities (data-URI avatars injected), and `ageMinutes` → ISO `createdAt`.

**Files:**
- Create: `scripts/fixtures/buildDemoFakeUsers.js`
- Test: `tests/buildDemoFakeUsers.test.js`

**Interfaces:**
- Consumes: `getFakeUsers()` from `src/lib/demoVideoFakeUsers.js` (Task 1 made it Node-importable); `SEEDED_SLUGS`, `DEMO_FAKE_POSTS`, `BRIKELD_POST_COMMENTS` from `demoFakeContent.js` (Task 2).
- Produces: `buildSeededFakeUsers(nowMs)` → `[{ slug, profile, posts }]` (7 entries, roster order).
- Produces: `expandComments(comments)` → comment array with `{ id, persona, content, displayName, handle, avatarSrc, avatarInitials, personaBadgePersona }` (drops `bySlug`).
- Produces: `injectBrikeldComments(posts, nowMs)` → Brikeld's posts array with rebased `createdAt` (newest = now − 45 min, 35-min steps) and `comments` on the newest posts.

- [ ] **Step 1: Write the failing test**

Create `tests/buildDemoFakeUsers.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  buildSeededFakeUsers,
  expandComments,
  injectBrikeldComments,
} from '../scripts/fixtures/buildDemoFakeUsers.js';
import { SEEDED_SLUGS, BRIKELD_POST_COMMENTS } from '../scripts/fixtures/demoFakeContent.js';

const NOW = Date.UTC(2026, 6, 6, 12, 0, 0);

describe('buildSeededFakeUsers', () => {
  const seeded = buildSeededFakeUsers(NOW);

  it('produces 7 users with plain slugs and demoFake flag', () => {
    expect(seeded.map((s) => s.slug)).toEqual(SEEDED_SLUGS);
    for (const { slug, profile } of seeded) {
      expect(slug.startsWith('demo-video-')).toBe(false);
      expect(profile.slug).toBe(slug);
      expect(profile.id).toBe(slug);
      expect(profile.demoFake).toBe(true);
      expect(profile.avatarUrl.startsWith('data:image/')).toBe(true);
      expect(profile.personaPosts).toBeUndefined();
      expect(profile.__demoVideoFake).toBeUndefined();
    }
  });

  it('distributes the 14 posts with absolute ISO createdAt, newest-first per user', () => {
    const total = seeded.reduce((n, s) => n + s.posts.length, 0);
    expect(total).toBe(14);
    for (const { posts } of seeded) {
      for (let i = 1; i < posts.length; i += 1) {
        expect(new Date(posts[i - 1].createdAt).getTime())
          .toBeGreaterThan(new Date(posts[i].createdAt).getTime());
      }
      for (const p of posts) {
        expect(new Date(p.createdAt).getTime()).toBeLessThan(NOW);
        expect(p.comments.length).toBeGreaterThanOrEqual(1);
        expect(p.comments[0].displayName.length).toBeGreaterThan(3);
        expect(p.comments[0].avatarSrc.startsWith('data:image/')).toBe(true);
        expect(p.comments[0].bySlug).toBeUndefined();
      }
    }
  });
});

describe('expandComments', () => {
  it('expands bySlug into full identity fields', () => {
    const [c] = expandComments([
      { id: 'x1', bySlug: 'lea-bernard', persona: 'popularite', content: 'Nice work on this.' },
    ]);
    expect(c.displayName).toBe('Léa Bernard');
    expect(c.handle.startsWith('@')).toBe(true);
    expect(c.avatarInitials).toBe('LB');
    expect(['productivity', 'security', 'popularity']).toContain(c.personaBadgePersona);
  });
});

describe('injectBrikeldComments', () => {
  it('rebases timestamps (newest = now - 45min, 35min steps) and injects comments', () => {
    const posts = [
      { persona: 'securite', content: 'a', createdAt: '2026-05-26T22:06:23.762Z' },
      { persona: 'popularite', content: 'b', createdAt: '2026-05-26T21:00:00.000Z' },
      { persona: 'productivite', content: 'c', createdAt: '2026-05-26T20:00:00.000Z' },
      { persona: 'productivite', content: 'd', createdAt: '2026-05-26T19:00:00.000Z' },
    ];
    const out = injectBrikeldComments(posts, NOW);
    expect(out).toHaveLength(4);
    expect(new Date(out[0].createdAt).getTime()).toBe(NOW - 45 * 60_000);
    expect(new Date(out[1].createdAt).getTime()).toBe(NOW - 80 * 60_000);
    expect(new Date(out[2].createdAt).getTime()).toBe(NOW - 115 * 60_000);
    expect(out[0].comments).toHaveLength(BRIKELD_POST_COMMENTS[0].length);
    expect(out[0].comments[0].displayName.length).toBeGreaterThan(3);
    expect(out[3].comments).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/buildDemoFakeUsers.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the builder**

Create `scripts/fixtures/buildDemoFakeUsers.js`. Complete file:

```js
/**
 * Transforms the fake-user roster + authored content into seedable
 * profile/posts objects. Pure functions — the seed script does the file I/O.
 *
 * Seeded slugs are plain `{first}-{last}` (NOT `demo-video-*`): App.jsx drops
 * `demo-video-*` profiles from state when the ▶ button stops, and these users
 * must survive as regular server-backed profiles.
 */
import { getFakeUsers } from '../../src/lib/demoVideoFakeUsers.js';
import {
  SEEDED_SLUGS,
  DEMO_FAKE_POSTS,
  BRIKELD_POST_COMMENTS,
} from './demoFakeContent.js';

const MINUTE_MS = 60_000;

/** Roster entry for a seeded slug (matches by de-prefixed roster slug). */
function rosterUserForSlug(slug) {
  const user = getFakeUsers().find(
    (u) => String(u.slug).replace(/^demo-video-/, '') === slug,
  );
  if (!user) throw new Error(`No roster user for seeded slug "${slug}"`);
  return user;
}

/** Expand { bySlug } comment refs into full commenter identities. */
export function expandComments(comments) {
  return (Array.isArray(comments) ? comments : []).map((c) => {
    const { bySlug, ...rest } = c;
    const user = rosterUserForSlug(bySlug);
    return {
      ...rest,
      displayName: user.displayName,
      handle: user.handle,
      avatarSrc: user.avatarUrl,
      avatarInitials: user.avatarInitials,
      personaBadgePersona: user.dominantPersona,
    };
  });
}

/** Profile JSON for a seeded fake user (posts live in a sibling posts file). */
function seededProfileFor(slug) {
  const { __demoVideoFake, personaPosts, ...profile } = rosterUserForSlug(slug);
  return {
    ...profile,
    slug,
    id: slug,
    demoFake: true,
  };
}

/**
 * @returns {[{ slug, profile, posts }]} one entry per seeded user, posts
 * newest-first with absolute ISO createdAt derived from ageMinutes.
 */
export function buildSeededFakeUsers(nowMs = Date.now()) {
  return SEEDED_SLUGS.map((slug) => {
    const posts = DEMO_FAKE_POSTS
      .filter((entry) => entry.authorSlug === slug)
      .sort((a, b) => a.ageMinutes - b.ageMinutes)
      .map((entry, i) => ({
        id: `seed-${slug}-${i}`,
        ...entry.post,
        createdAt: new Date(nowMs - entry.ageMinutes * MINUTE_MS).toISOString(),
        comments: expandComments(entry.post.comments),
      }));
    return { slug, profile: seededProfileFor(slug), posts };
  });
}

/**
 * Rebase Brikeld's fixture posts so the feed looks current (newest = now − 45
 * min, then 35-minute steps, preserving order) and attach comment sets to the
 * newest posts.
 */
export function injectBrikeldComments(posts, nowMs = Date.now()) {
  return (Array.isArray(posts) ? posts : []).map((post, i) => {
    const rebased = {
      ...post,
      createdAt: new Date(nowMs - (45 + i * 35) * MINUTE_MS).toISOString(),
    };
    const commentSet = BRIKELD_POST_COMMENTS[i];
    if (commentSet) rebased.comments = expandComments(commentSet);
    return rebased;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/buildDemoFakeUsers.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/fixtures/buildDemoFakeUsers.js tests/buildDemoFakeUsers.test.js
git commit -m "feat: seed builder transforming roster + content into profile/posts files"
```

---

### Task 4: Extend the seed script + gitignore + convenience npm script

`npm run seed:local` now also writes the 7 fake users, rebases Brikeld's timestamps, injects his comments, and stays idempotent (removes previously seeded `demoFake` files first).

**Files:**
- Modify: `scripts/seed-local-profile.js`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: `buildSeededFakeUsers(nowMs)`, `injectBrikeldComments(posts, nowMs)` from Task 3.
- Produces: on-disk `profiles/{slug}.json` + `posts/{slug}.json` for brikeld-hoxha + 7 fakes. This is what the servers, App auto-own (Task 6), and delete flow (Task 7) consume.

- [ ] **Step 1: Rewrite `scripts/seed-local-profile.js`**

Replace the section after `const posts = readJson(join(FIXTURES, 'local-posts.json'));` (keep imports, helpers, and the `_account-meta.json` handling). Full new file body from that point:

```js
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
```

(adjust the existing `node:fs` import line to the above), then replace everything from the two `writeFileSync` lines onward with:

```js
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

// ── Brikeld: rebased timestamps + injected comments ──────────────────────────
const brikeldPosts = injectBrikeldComments(posts, NOW_MS);
writeFileSync(join(PROFILES_DIR, `${SLUG}.json`), `${JSON.stringify(profile, null, 2)}\n`);
writeFileSync(join(POSTS_DIR, `${SLUG}.json`), `${JSON.stringify(brikeldPosts, null, 2)}\n`);

// ── Seeded fake users ─────────────────────────────────────────────────────────
const seeded = buildSeededFakeUsers(NOW_MS);
for (const { slug, profile: fakeProfile, posts: fakePosts } of seeded) {
  writeFileSync(join(PROFILES_DIR, `${slug}.json`), `${JSON.stringify(fakeProfile, null, 2)}\n`);
  writeFileSync(join(POSTS_DIR, `${slug}.json`), `${JSON.stringify(fakePosts, null, 2)}\n`);
}
```

Add the import at the top of the file:

```js
import { buildSeededFakeUsers, injectBrikeldComments } from './fixtures/buildDemoFakeUsers.js';
```

Keep the `_account-meta.json` un-delete block, extending the filter to also un-delete seeded slugs:

```js
const seededSlugs = new Set([SLUG, ...seeded.map((s) => s.slug)]);
meta.deletedProfileIds = before.filter(
  (id) => !seededSlugs.has(String(id).trim().toLowerCase()),
);
```

Replace the final console output with:

```js
console.log(`✓ Seeded "${SLUG}" (${brikeldPosts.length} posts) + ${seeded.length} demo users (${seeded.reduce((n, s) => n + s.posts.length, 0)} posts).`);
console.log('\nNext:');
console.log('  npm run demo:local   (seeds are already written; this starts servers + Vite)');
console.log('  — or manually: `npm run servers` then `npm run dev`.');
console.log('  Open the app → your Brikeld Hoxha profile is linked automatically.');
```

- [ ] **Step 2: Add gitignore entries and npm script**

Append to `.gitignore` under the existing seed comment block:

```
# Seeded demo fake users generated by `npm run seed:local` (source: scripts/fixtures/)
/profiles/camille-laurent.json
/profiles/theo-moreau.json
/profiles/lea-bernard.json
/profiles/hugo-petit.json
/profiles/manon-girard.json
/profiles/lucas-rousseau.json
/profiles/chloe-lefevre.json
/posts/camille-laurent.json
/posts/theo-moreau.json
/posts/lea-bernard.json
/posts/hugo-petit.json
/posts/manon-girard.json
/posts/lucas-rousseau.json
/posts/chloe-lefevre.json
```

In `package.json` scripts, after `"seed:local"`:

```json
"demo:local": "npm run seed:local && concurrently -n data,gen,web -c cyan,magenta,green \"node server.js\" \"node server-generate.js\" \"vite\"",
```

- [ ] **Step 3: Run the seed and verify output**

Run: `npm run seed:local && node -e "
const fs = require('fs');
const prof = JSON.parse(fs.readFileSync('profiles/camille-laurent.json','utf8'));
const posts = JSON.parse(fs.readFileSync('posts/camille-laurent.json','utf8'));
const bk = JSON.parse(fs.readFileSync('posts/brikeld-hoxha.json','utf8'));
console.log('demoFake:', prof.demoFake, '| posts:', posts.length, '| comments on first:', posts[0].comments.length);
console.log('brikeld newest createdAt:', bk[0].createdAt, '| has comments:', Array.isArray(bk[0].comments));
"`
Expected: `demoFake: true | posts: 2 | comments on first: 2` and a createdAt within the last hour, `has comments: true`.

Run seed twice, confirm no duplicate/stale files: `npm run seed:local && ls profiles | wc -l`
Expected: 9 files (8 profiles + `_account-meta.json`).

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-local-profile.js .gitignore package.json
git commit -m "feat: seed 7 fake users with fixed posts + comments; add demo:local script"
```

---

### Task 5: Embedded comments rendering

Thread `comments` through the feed enrichment, and render embedded comments in place of the generic mock. Extract the merge into a pure, tested helper.

**Files:**
- Create: `src/features/commenting/threadComments.js`
- Modify: `src/features/commenting/CommentsCapsule.jsx` (lines ~233-235 and the comment `key`)
- Modify: `src/features/feed/PostsTab.jsx` (`buildEnrichedPosts`, ~line 208)
- Test: `tests/threadComments.test.js`

**Interfaces:**
- Consumes: enriched post objects now carrying `comments` (array or null).
- Produces: `buildThreadComments(post, realComments, getMockCommentsFor)` → ordered comment array for rendering.

- [ ] **Step 1: Write the failing test**

Create `tests/threadComments.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildThreadComments } from '../src/features/commenting/threadComments.js';
import { getMockCommentsFor } from '../src/features/commenting/commentingMock.js';

const EMBEDDED = [
  { id: 'e1', persona: 'popularite', content: 'Embedded one', displayName: 'Léa Bernard' },
  { id: 'e2', persona: 'securite', content: 'Embedded two', displayName: 'Hugo Petit' },
];

describe('buildThreadComments', () => {
  it('uses embedded comments and skips the generic mock when present', () => {
    const out = buildThreadComments({ id: 'p1', comments: EMBEDDED }, null, getMockCommentsFor);
    expect(out).toHaveLength(2);
    expect(out.every((c) => c.displayName !== 'Alex Johnson')).toBe(true);
  });

  it('falls back to the mock when no embedded comments exist', () => {
    const out = buildThreadComments({ id: 'p1', comments: null }, null, getMockCommentsFor);
    expect(out).toHaveLength(1);
    expect(out[0].displayName).toBe('Alex Johnson');
  });

  it('appends persisted real comments after embedded ones', () => {
    const real = [{ id: 'r1', persona: 'popularite', content: 'From API' }];
    const out = buildThreadComments({ id: 'p1', comments: EMBEDDED }, real, getMockCommentsFor);
    expect(out.map((c) => c.id)).toEqual(['e1', 'e2', 'r1']);
  });

  it('tolerates empty embedded array (treated as absent)', () => {
    const out = buildThreadComments({ id: 'p1', comments: [] }, null, getMockCommentsFor);
    expect(out[0].displayName).toBe('Alex Johnson');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/threadComments.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/features/commenting/threadComments.js`:

```js
/**
 * Assemble the comment thread for a post: embedded (seeded) comments replace
 * the generic mock; persisted comments from the API always append at the end.
 */
export function buildThreadComments(post, realComments, getMockCommentsFor) {
  const embedded = Array.isArray(post?.comments) ? post.comments : [];
  const mock = embedded.length > 0 ? [] : getMockCommentsFor(post.id).comments;
  const persisted = Array.isArray(realComments) ? realComments : [];
  return [...mock, ...embedded, ...persisted];
}
```

In `src/features/commenting/CommentsCapsule.jsx`, replace lines 233-235:

```js
  const mockComments = getMockCommentsFor(post.id).comments;
  const persistedComments = Array.isArray(realComments) ? realComments : [];
  const comments = [...mockComments, ...persistedComments];
```

with:

```js
  const comments = buildThreadComments(post, realComments, getMockCommentsFor);
```

and add the import next to the `getMockCommentsFor` import:

```js
import { buildThreadComments } from './threadComments.js';
```

Fix the React key on the comment map (two embedded comments can share a persona). Change:

```js
                <Comment
                  key={c.persona ?? c.id ?? i}
```

to:

```js
                <Comment
                  key={c.id ?? `${c.persona ?? 'c'}-${i}`}
```

In `src/features/feed/PostsTab.jsx`, inside `buildEnrichedPosts`'s returned object (after the `thinking:` line, ~line 211), add:

```js
      comments: Array.isArray(p.comments) ? p.comments : null,
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/threadComments.test.js && npm test`
Expected: PASS; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/features/commenting/threadComments.js src/features/commenting/CommentsCapsule.jsx src/features/feed/PostsTab.jsx tests/threadComments.test.js
git commit -m "feat: render embedded seeded comments, replacing generic mock when present"
```

---

### Task 6: Auto-own Brikeld's profile in local mode

In local (non-hosted) mode with no linked slug, link the newest non-`demoFake` profile automatically — replicating the manual `localStorage.setItem('compliant_owned_profile_slug', …)` step.

**Files:**
- Modify: `src/lib/profileSlugStorage.js` (new helper)
- Modify: `src/lib/hostedAccount.js` (new exported writer)
- Modify: `src/app/App.jsx` (the directory `load()` effect, non-hosted branch ~line 1873)
- Test: `tests/profileSlugStorageLocal.test.js`

**Interfaces:**
- Produces: `resolveLocalFallbackOwnedProfile(profiles)` in `profileSlugStorage.js` → first profile without `demoFake`, or null.
- Produces: `writeLinkedProfileSlug(slug)` in `hostedAccount.js` → persists to `compliant_owned_profile_slug` localStorage key.

- [ ] **Step 1: Write the failing test**

Create `tests/profileSlugStorageLocal.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { resolveLocalFallbackOwnedProfile } from '../src/lib/profileSlugStorage.js';

describe('resolveLocalFallbackOwnedProfile', () => {
  it('picks the first non-demoFake profile (list is newest-first)', () => {
    const profiles = [
      { slug: 'camille-laurent', demoFake: true },
      { slug: 'brikeld-hoxha' },
      { slug: 'theo-moreau', demoFake: true },
    ];
    expect(resolveLocalFallbackOwnedProfile(profiles)?.slug).toBe('brikeld-hoxha');
  });

  it('returns null when all profiles are demo fakes', () => {
    expect(resolveLocalFallbackOwnedProfile([{ slug: 'x', demoFake: true }])).toBeNull();
  });

  it('returns null for empty/invalid input', () => {
    expect(resolveLocalFallbackOwnedProfile([])).toBeNull();
    expect(resolveLocalFallbackOwnedProfile(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/profileSlugStorageLocal.test.js`
Expected: FAIL — `resolveLocalFallbackOwnedProfile` is not exported.

- [ ] **Step 3: Implement**

In `src/lib/profileSlugStorage.js`, after `resolveOwnedLandingProfile`:

```js
/** Local-mode fallback: the newest profile that is not a seeded demo fake. */
export function resolveLocalFallbackOwnedProfile(profiles) {
  const list = Array.isArray(profiles) ? profiles.filter(Boolean) : [];
  return list.find((p) => !p?.demoFake) ?? null;
}
```

In `src/lib/hostedAccount.js`, after `readLinkedProfileSlug`:

```js
export function writeLinkedProfileSlug(slug) {
  if (!slug || typeof window === 'undefined') return;
  try {
    localStorage.setItem(OWNED_SLUG_KEY, String(slug));
  } catch {
    /* ignore */
  }
}
```

In `src/app/App.jsx`, in the directory `load()` effect's non-hosted tail (currently):

```js
        commitDirectoryProfiles(normalized);
        scheduleSpectatorIngest(normalized, cancelledRef);
        const owned = resolveOwnedLandingProfile(normalized, linkedProfileSlug);
```

replace the `const owned = …` line with:

```js
        // Local demo: auto-own the newest non-demo profile — replaces the manual
        // localStorage step the seed script used to require.
        let effectiveLinkedSlug = linkedProfileSlug;
        if (!isHostedApiOrigin() && !effectiveLinkedSlug) {
          const fallback = resolveLocalFallbackOwnedProfile(normalized);
          const slug = String(fallback?.slug ?? fallback?.id ?? '').trim();
          if (slug) {
            effectiveLinkedSlug = slug;
            writeLinkedProfileSlug(slug);
            setLinkedProfileSlug(slug);
          }
        }
        const owned = resolveOwnedLandingProfile(normalized, effectiveLinkedSlug);
```

Also update the stale-slug cleanup two lines below — change:

```js
        if (!linkedProfileSlug && readStoredProfileSlug() && !owned) {
```

to:

```js
        if (!effectiveLinkedSlug && readStoredProfileSlug() && !owned) {
```

Add imports in App.jsx: `resolveLocalFallbackOwnedProfile` to the existing `profileSlugStorage.js` import list, and `writeLinkedProfileSlug` to the existing `hostedAccount.js` import list.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/profileSlugStorageLocal.test.js && npm test`
Expected: PASS; suite green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/profileSlugStorage.js src/lib/hostedAccount.js src/app/App.jsx tests/profileSlugStorageLocal.test.js
git commit -m "feat: auto-own newest non-demo profile in local mode"
```

---

### Task 7: Spacebar deletes the highlighted post (local only)

Global keydown handler: when a post is highlighted (tell-me-more active), not typing in a field, and running locally, spacebar calls the existing `DELETE /api/posts/:slug` (by `createdAt`) via the existing `deletePost()` client, then strips the post from React state.

**Files:**
- Create: `src/lib/postDeletion.js`
- Modify: `src/app/App.jsx` (new effect after `handleOpenProfile`, ~line 1203)
- Test: `tests/postDeletion.test.js`

**Interfaces:**
- Consumes: `deletePost(profileId, createdAt)` from `src/lib/postsApi.js` (already exists); `highlightedPost` (enriched post with `authorSlug`, `createdAt`), `tellActive`, `closeTell`, `setHighlightedPost`, `setProfile`, `setAllProfiles`, `setViewedProfile` (all already in App.jsx scope).
- Produces: `stripPostFromProfile(profile, authorSlug, createdAt)` and `removePostFromProfiles(profiles, authorSlug, createdAt)`.

- [ ] **Step 1: Write the failing test**

Create `tests/postDeletion.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  stripPostFromProfile,
  removePostFromProfiles,
} from '../src/lib/postDeletion.js';

const T = '2026-07-06T10:00:00.000Z';
const profile = {
  slug: 'camille-laurent',
  personaPosts: [
    { content: 'keep', createdAt: '2026-07-06T11:00:00.000Z' },
    { content: 'remove', createdAt: T },
  ],
};

describe('stripPostFromProfile', () => {
  it('removes the matching post from the matching author', () => {
    const out = stripPostFromProfile(profile, 'camille-laurent', T);
    expect(out.personaPosts).toHaveLength(1);
    expect(out.personaPosts[0].content).toBe('keep');
    expect(out).not.toBe(profile);
  });

  it('returns the same reference when author or createdAt do not match', () => {
    expect(stripPostFromProfile(profile, 'other-user', T)).toBe(profile);
    expect(stripPostFromProfile(profile, 'camille-laurent', 'nope')).toBe(profile);
    expect(stripPostFromProfile(null, 'x', T)).toBeNull();
  });

  it('matches snake_case created_at too', () => {
    const p = { slug: 's', personaPosts: [{ content: 'r', created_at: T }] };
    expect(stripPostFromProfile(p, 's', T).personaPosts).toHaveLength(0);
  });
});

describe('removePostFromProfiles', () => {
  it('maps stripPostFromProfile across a directory list', () => {
    const list = [profile, { slug: 'other', personaPosts: [{ content: 'x', createdAt: T }] }];
    const out = removePostFromProfiles(list, 'camille-laurent', T);
    expect(out[0].personaPosts).toHaveLength(1);
    expect(out[1]).toBe(list[1]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/postDeletion.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/postDeletion.js`:

```js
/** Remove one post (matched by author slug + createdAt) from profile state. */
export function stripPostFromProfile(profile, authorSlug, createdAt) {
  if (!profile || typeof profile !== 'object') return profile;
  const key = String(profile.slug ?? profile.id ?? '');
  if (key !== String(authorSlug)) return profile;
  const posts = Array.isArray(profile.personaPosts) ? profile.personaPosts : [];
  const next = posts.filter(
    (p) => (p?.createdAt ?? p?.created_at) !== createdAt,
  );
  if (next.length === posts.length) return profile;
  return { ...profile, personaPosts: next };
}

export function removePostFromProfiles(profiles, authorSlug, createdAt) {
  return (Array.isArray(profiles) ? profiles : []).map(
    (p) => stripPostFromProfile(p, authorSlug, createdAt),
  );
}
```

- [ ] **Step 4: Run helper tests**

Run: `npx vitest run tests/postDeletion.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire the keydown handler in App.jsx**

Insert after the `handleOpenProfile` callback (~line 1203):

```js
  // Local demo: spacebar deletes the highlighted post (persisted via the
  // local-only DELETE /api/posts/:slug endpoint; hosted mode has no such route).
  useEffect(() => {
    if (isHostedApiOrigin()) return undefined;
    if (!tellActive || !highlightedPost) return undefined;

    const onKeyDown = (event) => {
      if (event.code !== 'Space') return;
      const target = event.target;
      if (
        target?.closest?.('button, a, input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      event.preventDefault();
      const authorSlug = highlightedPost.authorSlug ?? ownProfileSlug;
      const createdAt = highlightedPost.createdAt;
      if (!authorSlug || !createdAt) return;

      deletePost(authorSlug, createdAt)
        .then(() => {
          closeTell();
          setHighlightedPost(null);
          setProfile((prev) => stripPostFromProfile(prev, authorSlug, createdAt));
          setViewedProfile((prev) => stripPostFromProfile(prev, authorSlug, createdAt));
          setAllProfiles((prev) => removePostFromProfiles(prev, authorSlug, createdAt));
        })
        .catch((err) => {
          console.warn('[post-delete] failed:', err?.message || err);
        });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tellActive, highlightedPost, ownProfileSlug, closeTell]);
```

Add imports to App.jsx:
- `deletePost` added to the existing `@/lib/postsApi.js` import (`prependPersonaPosts` is already imported from there).
- `import { stripPostFromProfile, removePostFromProfiles } from '@/lib/postDeletion.js';`

- [ ] **Step 6: Run full suite + manual smoke**

Run: `npm test`
Expected: green.

Manual (requires Task 4's seed): `npm run demo:local`, open the app, enter the feed, click a post, press spacebar → post animates out of state; refresh → still gone; `npm run seed:local` → restored.

- [ ] **Step 7: Commit**

```bash
git add src/lib/postDeletion.js src/app/App.jsx tests/postDeletion.test.js
git commit -m "feat: spacebar deletes highlighted post in local mode (persisted)"
```

---

### Task 8: ▶ demo-video button — local mode targets seeded users and persists

One identity per person: locally the button reveals posts for the **seeded** profiles (plain slugs), stacks on their existing posts, timestamps them "now", and persists each post via the existing prepend API. Hosted behavior is unchanged.

**Files:**
- Create: `src/lib/demoVideoLocal.js`
- Modify: `src/lib/demoVideoFeed.js` (`materializeDemoVideoPost` options; `runDemoVideoPipeline` baseline + options)
- Modify: `src/features/debug/DemoVideoButton.jsx` (use env-aware schedule + options)
- Modify: `src/app/App.jsx` (persist in `handleDemoVideoPostGenerated`; skip roster injection locally; pass `getBaselinePosts`)
- Test: `tests/demoVideoLocal.test.js`

**Interfaces:**
- Consumes: `buildDemoVideoSchedule()`, `getFakeUsers()` (Task 1); `prependPersonaPosts` (existing); `mergePostsPrepend` (existing).
- Produces: `seededSlugForFakeUser(user)`, `SEEDED_FAKE_COUNT = 7`, `mapScheduleToSeededUsers(schedule)` in `demoVideoLocal.js`.
- Produces: `materializeDemoVideoPost(step, index, { epochMs, runKey })` — backward compatible (defaults preserve current output).
- Produces: `runDemoVideoPipeline({ …, getBaselinePosts, materializeOptions })` — both optional.

- [ ] **Step 1: Write the failing test**

Create `tests/demoVideoLocal.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  seededSlugForFakeUser,
  mapScheduleToSeededUsers,
  SEEDED_FAKE_COUNT,
} from '../src/lib/demoVideoLocal.js';
import { buildDemoVideoSchedule } from '../src/lib/demoVideoFakeUsers.js';
import { materializeDemoVideoPost } from '../src/lib/demoVideoFeed.js';
import { SEEDED_SLUGS } from '../scripts/fixtures/demoFakeContent.js';

describe('demoVideoLocal', () => {
  it('strips the demo-video prefix', () => {
    expect(seededSlugForFakeUser({ slug: 'demo-video-camille-laurent' }))
      .toBe('camille-laurent');
  });

  it('maps every schedule step onto the 7 seeded users, cycling', () => {
    const mapped = mapScheduleToSeededUsers(buildDemoVideoSchedule());
    expect(mapped).toHaveLength(20);
    expect(SEEDED_FAKE_COUNT).toBe(7);
    for (const step of mapped) {
      expect(SEEDED_SLUGS).toContain(step.user.slug);
      expect(step.user.id).toBe(step.user.slug);
      expect(step.user.slug.startsWith('demo-video-')).toBe(false);
    }
    expect(mapped[0].user.slug).toBe(SEEDED_SLUGS[0]);
    expect(mapped[7].user.slug).toBe(SEEDED_SLUGS[0]);
  });
});

describe('materializeDemoVideoPost options', () => {
  const step = buildDemoVideoSchedule()[0];

  it('defaults produce the legacy static id/createdAt', () => {
    const post = materializeDemoVideoPost(step, 0);
    expect(post.id.startsWith('demo-video-static-0-')).toBe(true);
  });

  it('epochMs and runKey produce fresh unique ids and current timestamps', () => {
    const now = Date.UTC(2026, 6, 6, 12, 0, 0);
    const post = materializeDemoVideoPost(step, 0, { epochMs: now, runKey: 'r1' });
    expect(post.id).toBe(`demo-video-r1-0-${step.assetBasename}`);
    expect(new Date(post.createdAt).getTime()).toBe(now);
  });

  it('metadata text carries no meta words', () => {
    const post = materializeDemoVideoPost(step, 0);
    const banned = /\b(demo|fake|scripted|prewritten|mock)\b/i;
    for (const s of post.inferenceChain) expect(JSON.stringify(s)).not.toMatch(banned);
    for (const t of post.thinking) expect(t.detail).not.toMatch(banned);
    for (const ing of post.ingredients) expect(ing.label).not.toMatch(banned);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/demoVideoLocal.test.js`
Expected: FAIL — `demoVideoLocal.js` missing; materialize has no options; metadata contains "scripted"/"fake"/"demo" wording.

- [ ] **Step 3: Create `src/lib/demoVideoLocal.js`**

```js
/**
 * Local-mode adapter for the ▶ demo-video button: targets the SEEDED fake
 * profiles (plain slugs, server-backed) instead of ephemeral demo-video-*
 * users, so each person exists exactly once and revealed posts can persist.
 */
import { getFakeUsers } from '@/lib/demoVideoFakeUsers.js';

export const SEEDED_FAKE_COUNT = 7;

export function seededSlugForFakeUser(user) {
  return String(user?.slug ?? '').replace(/^demo-video-/, '');
}

/** Re-target schedule steps onto the first 7 (seeded) people, cycling. */
export function mapScheduleToSeededUsers(schedule) {
  const seeded = getFakeUsers().slice(0, SEEDED_FAKE_COUNT).map((u) => {
    const slug = seededSlugForFakeUser(u);
    return { ...u, slug, id: slug };
  });
  return (Array.isArray(schedule) ? schedule : []).map((step, i) => ({
    ...step,
    user: seeded[i % seeded.length],
  }));
}
```

- [ ] **Step 4: Update `src/lib/demoVideoFeed.js`**

4a. `materializeDemoVideoPost` — add an options parameter and use it for id/createdAt. Change the signature and the two lines:

```js
export function materializeDemoVideoPost(step, index = 0, options = {}) {
  const { epochMs = STATIC_POST_EPOCH_MS, runKey = 'static' } = options;
```

and replace the `createdAt` and `id` lines:

```js
  const createdAt = new Date(epochMs + Math.max(0, Number(index) || 0) * 60_000).toISOString();
```

```js
    id: `demo-video-${runKey}-${index}-${assetBasename}`,
```

4b. Rewrite the post metadata templates in `materializeDemoVideoPost` (professional, in-world — no "scripted"/"fake"/"prewritten" wording). Replace the `inferenceChain`, `ingredients`, and `thinking` blocks with:

```js
    inferenceChain: [
      {
        step: 'data',
        value: `${assetBasename} surfaced in the user's recent activity.`,
        source: kind === 'document' ? 'Recent documents' : 'Recent images',
      },
      {
        step: 'classify',
        value: `${label} signal`,
        confidence: 'high',
      },
      {
        step: 'infer',
        value: `The file's presence and handling pattern align with the profile's ${label.toLowerCase()} behavior.`,
        confidence: 'medium',
        isBiased: true,
        biasNote: 'A single file is treated as representative of a broader behavioral pattern.',
      },
      {
        step: 'generate',
        value: content,
      },
    ],
    ingredients: [
      {
        label: kind === 'document' ? 'Document evidence' : 'Visual evidence',
        weight: 86,
        dataPoints: [assetBasename],
      },
      {
        label: 'Profile context',
        weight: 62,
        dataPoints: [step?.user?.displayName || step?.user?.slug || 'User profile'],
      },
      {
        label: 'Persona alignment',
        weight: 40,
        dataPoints: [`${label} signal weighting`],
      },
    ],
    thinking: [
      {
        label: 'WHAT I SAW',
        detail: `${assetBasename} appeared in recent activity with a consistent handling pattern.`,
      },
      {
        label: 'THE LEAP',
        detail: `I read the file as a ${label.toLowerCase()} clue about how this user works and shares.`,
      },
      {
        label: 'WHY THIS POST',
        detail: `A ${label.toLowerCase()} update keeps the profile's public activity current.`,
      },
    ],
```

4c. `runDemoVideoPipeline` — accept `getBaselinePosts` and `materializeOptions`, and use them. Signature:

```js
export async function runDemoVideoPipeline({
  schedule,
  spectateController,
  ensureFakeUser,
  onPostGenerated,
  onGeneratingPersona,
  shouldContinue = () => true,
  revealGapMs = DEMO_VIDEO_REVEAL_GAP_MS,
  getBaselinePosts = null,
  materializeOptions = undefined,
}) {
```

In the loop, change:

```js
      const post = materializeDemoVideoPost(step, index);
      if (!post) continue;
      const slug = step.user.slug;
      const prevAccumulated = postsByUser.get(slug) ?? [];
```

to:

```js
      const post = materializeDemoVideoPost(step, index, materializeOptions);
      if (!post) continue;
      const slug = step.user.slug;
      const prevAccumulated = postsByUser.has(slug)
        ? postsByUser.get(slug)
        : (getBaselinePosts?.(slug) ?? []);
```

(This is the "stacking" fix: seeded posts become the baseline, so the reveal ingest no longer wipes them from feed state.)

- [ ] **Step 5: Update `src/features/debug/DemoVideoButton.jsx`**

Add imports:

```js
import { isHostedApiOrigin } from '@/lib/aiJobClient.js';
import { mapScheduleToSeededUsers } from '@/lib/demoVideoLocal.js';
```

In `start`, replace the `runDemoVideoPipeline` call:

```js
      const local = !isHostedApiOrigin();
      const schedule = local
        ? mapScheduleToSeededUsers(buildDemoVideoSchedule())
        : buildDemoVideoSchedule();
      await runDemoVideoPipeline({
        schedule,
        spectateController,
        ensureFakeUser,
        onPostGenerated,
        onGeneratingPersona,
        shouldContinue: () => runningRef.current,
        getBaselinePosts,
        materializeOptions: local
          ? { epochMs: Date.now(), runKey: Date.now().toString(36) }
          : undefined,
      });
```

Add `getBaselinePosts` to the component's props (after `ensureFakeUser`) and to the `start` callback's dependency array.

- [ ] **Step 6: Update `src/app/App.jsx`**

6a. Baseline posts callback — App already has `allProfiles` state; add a ref mirror + callback near `handleDemoVideoPostGenerated` (~line 1091):

```js
  const allProfilesRef = useRef([]);
  useEffect(() => {
    allProfilesRef.current = Array.isArray(allProfiles) ? allProfiles : [];
  }, [allProfiles]);

  const getDemoBaselinePosts = useCallback((slug) => {
    const match = allProfilesRef.current.find(
      (p) => String(p?.slug ?? p?.id ?? '') === String(slug),
    );
    return Array.isArray(match?.personaPosts) ? match.personaPosts : [];
  }, []);
```

6b. Persist button posts locally — extend `handleDemoVideoPostGenerated`:

```js
  const handleDemoVideoPostGenerated = useCallback((user, post) => {
    const slug = String(user?.slug ?? user?.id ?? '').trim();
    if (!slug || !post?.content) return;
    setAllProfiles((prev) => mergeDemoVideoPostIntoProfiles(prev, slug, post));
    setViewedProfile((prev) => {
      const key = String(prev?.slug ?? prev?.id ?? '');
      return key === slug
        ? mergeDemoVideoPostIntoProfiles([prev], slug, post)[0] ?? prev
        : prev;
    });
    // Local mode: the target is a real server-backed profile — persist so the
    // post survives directory polls and page refreshes.
    if (!isHostedApiOrigin() && !isDemoVideoFakeSlug(slug)) {
      prependPersonaPosts(slug, [post]).catch((err) => {
        console.warn('[demo-video] persist failed:', err?.message || err);
      });
    }
  }, [setAllProfiles]);
```

(`prependPersonaPosts` from `@/lib/postsApi.js` and `isDemoVideoFakeSlug` are already imported in App.jsx; verify and add if missing.)

6c. Skip the ephemeral roster injection locally — in `handleDemoVideoActiveChange`, wrap the `if (active)` roster-injection block:

```js
    if (active) {
      if (isHostedApiOrigin()) {
        // Inject the whole roster up front (hosted only — locally the seeded
        // profiles already populate the feed and leaderboards).
        const fakes = getFakeUsers();
        setAllProfiles((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          const present = new Set(list.map((p) => String(p?.slug ?? p?.id ?? '')));
          const toAdd = fakes
            .filter((u) => !present.has(String(u.slug)))
            .map((u) => ({ ...u, personaPosts: [] }));
          return toAdd.length ? [...toAdd, ...list] : list;
        });
      }
    } else {
```

6d. Pass the baseline callback to the button (~line 1278):

```js
          <DemoVideoButton
            spectateController={spectateRevealRef.current}
            ensureFakeUser={ensureFakeUser}
            getBaselinePosts={getDemoBaselinePosts}
            onPostGenerated={handleDemoVideoPostGenerated}
            onActiveChange={onDemoVideoActiveChange}
            onGeneratingPersona={onDemoGeneratingPersona}
          />
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/demoVideoLocal.test.js && npm test`
Expected: PASS; full suite green (any pre-existing test asserting old materialize metadata text needs its expectations updated to the new copy).

- [ ] **Step 8: Commit**

```bash
git add src/lib/demoVideoLocal.js src/lib/demoVideoFeed.js src/features/debug/DemoVideoButton.jsx src/app/App.jsx tests/demoVideoLocal.test.js
git commit -m "feat: demo-video button targets seeded profiles locally, stacks and persists posts"
```

---

### Task 9: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 2: Seed + API checks**

```bash
npm run seed:local
npm run servers &   # or in a separate terminal
sleep 2
curl -s localhost:3001/api/profiles | node -e "
let d='';process.stdin.on('data',(c)=>d+=c).on('end',()=>{
  const ps=JSON.parse(d);
  console.log('profiles:', ps.length);
  console.log('fakes:', ps.filter(p=>p.demoFake).length);
  const cam=ps.find(p=>p.slug==='camille-laurent');
  console.log('camille posts:', cam.personaPosts.length, '| first post comments:', cam.personaPosts[0].comments.length);
});"
```
Expected: `profiles: 8`, `fakes: 7`, `camille posts: 2 | first post comments: 2`.

Delete round-trip:

```bash
CREATED=$(curl -s localhost:3001/api/profile/camille-laurent | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).personaPosts[0].createdAt))")
curl -s -X DELETE localhost:3001/api/posts/camille-laurent -H 'Content-Type: application/json' -d "{\"createdAt\":\"$CREATED\"}"
curl -s localhost:3001/api/profile/camille-laurent | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log('posts now:', JSON.parse(d).personaPosts.length))"
npm run seed:local   # restore
```
Expected: delete returns `{"success":true,…}`, `posts now: 1`, re-seed restores 2.

- [ ] **Step 3: Manual browser checklist** (`npm run dev`, open the Vite URL)

- Landing: entering the app lands with Brikeld Hoxha as the owned profile (no console step; Profile nav + dashboard work).
- Home feed: seeded fake posts interleaved with Brikeld's, professional copy, assets render (images + PDFs).
- Comments: open a seeded post's comments → cross-authored fake-user comments (no "Alex Johnson" on those posts); Brikeld's newest posts show injected comments; older Brikeld posts still show the Alex Johnson mock.
- Profiles: click each fake user's avatar → full profile view renders (scores, dashboard, their posts).
- Spacebar: click a post (highlight), press spacebar → post removed; refresh → still gone; `npm run seed:local` restores it.
- ▶ button: reveals posts one at a time on top of the seeded posts (no wiped posts, no duplicate people); stop it; refresh → button posts still there.
- "Tell me more" on a seeded post: inference chain / ingredients / thinking all populated and professional.

- [ ] **Step 4: Final commit if any fixups were needed**

```bash
git add -A && git commit -m "fix: local demo verification fixups"
```

---

## Self-Review Notes (already applied)

- **Spec coverage:** seeding (T2-4), auto-own (T6), embedded comments (T5), spacebar delete (T7), ▶ button compat + persistence + stacking (T8), professional copy (T1, T2, T8 step 4b), clickable profiles (server-backed profiles — no code needed; verified in T9). Server changes: none needed (existing endpoints verified in research).
- **Naming consistency:** `buildSeededFakeUsers` / `injectBrikeldComments` (T3→T4), `buildThreadComments` (T5), `resolveLocalFallbackOwnedProfile` / `writeLinkedProfileSlug` (T6), `stripPostFromProfile` / `removePostFromProfiles` (T7), `mapScheduleToSeededUsers` / `getBaselinePosts` / `materializeOptions` (T8).
- **Known trade-off:** button posts persist in `onPostGenerated` (before reveal). If a directory poll lands in the seconds between persist and reveal, the post may appear without the enter animation — accepted for local demo; the reverse ordering would cause posts to flicker out of the feed.
