# Local Fake Demo — Design

**Date:** 2026-07-06
**Status:** Approved

## Goal

Running the app locally (`npm run seed:local`, `npm run servers`, `npm run dev`) produces a
fully populated demo with zero manual steps:

- Brikeld Hoxha is automatically the owned profile (no localStorage console step).
- The feed already contains ~14 fixed, prewritten posts from the existing fake-user
  roster, each with 1–3 prewritten comments authored by other fake users.
- Every fake user is clickable and opens a complete fake profile view.
- Highlighting a post (clicking it) and pressing **spacebar** deletes it, persisted
  across refresh. Local mode only.
- All demo texts are clean and professional (no snark, no "this is scripted" meta-text).
- The ▶ demo-video button keeps working and stacks new posts on top of the seeded ones.

Out of scope (explicitly deferred by the user): responsive 2K/6K layout changes.

## Architecture: server-seeded files

Fake users and their posts are written to disk as regular `profiles/{slug}.json` +
`posts/{slug}.json` files by the seed script. Everything then rides the app's existing
paths: the home feed aggregates all profiles from `GET /api/profiles`, profile clicks
fetch `/api/profiles/:slug`, posts survive refresh, and deletion mutates the posts file.

Rejected alternative: client-injected React state (like the ▶ button does today). It
would require no server changes but adds poll-preservation logic to an already large
`App.jsx`, forces localStorage tombstones for deletions, and keeps fake profiles
memory-only.

## Components

### 1. Fixture module + seed script

- New `scripts/fixtures/demo-fake-users.js` derives fake profile JSON from the roster in
  `src/lib/demoVideoFakeUsers.js` (names, avatars, persona scores, harvest overviews —
  single source of truth). Each generated profile carries `demoFake: true`.
- Seeded profiles use normal `{firstname}-{lastname}` slugs (e.g. `camille-laurent`),
  **not** the `demo-video-` prefix: `App.jsx` drops all `demo-video-*` profiles from
  state when the ▶ button stops, and the prefix drives ephemeral-preservation logic that
  must not touch server-backed profiles.
- `scripts/seed-local-profile.js` additionally writes profile + posts files for the
  7 roster users who author posts, plus profile files for any roster users who only
  author comments (so their avatars/profiles resolve) — ≈10–12 fake profiles total.
- Idempotent: re-running `seed:local` resets all seeded data and restores any
  spacebar-deleted posts. It also keeps the existing behavior of un-hiding the
  `brikeld-hoxha` slug in `profiles/_account-meta.json`.

### 2. Auto-own Brikeld locally

In local (non-hosted) mode, when no linked profile slug is stored, `App.jsx` auto-owns
the newest profile whose JSON does **not** carry `demoFake: true` — i.e. `brikeld-hoxha`
after seeding. The landing page's "enter profile" flow then works immediately.

### 3. Fixed post content (authored in the fixture)

- 14 posts across the 7 fake users (1–3 each), using existing assets in
  `public/videoDEMO/contentFakePeople` (images + PDFs) plus a few text-only posts.
- Mixed personas (`popularite` / `productivite` / `securite`); staggered `createdAt`
  timestamps so seeded posts interleave naturally with Brikeld's.
- Every post carries complete metadata — `inferenceChain`, `ingredients`, `thinking` —
  written as plausible in-world analysis so "tell me more" is fully populated.
- Tone: clean, professional, dystopian-corporate (consistent COMPLIANT voice). The
  roster's profile summaries in `demoVideoFakeUsers.js` (currently meta-text about demo
  accounts) are rewritten in the same voice.

### 4. Embedded comments

- Each fixed post embeds a `comments` array (1–3 entries) authored by *other* roster
  users (name, handle, avatar, persona badge, content).
- `CommentsCapsule` renders embedded comments as the thread and skips the generic
  "Alex Johnson" mock for posts that have them. AI suggestions and comment posting are
  untouched.
- The local `server.js` posts read path must pass the `comments` field through
  unmodified.

### 5. Spacebar delete (local only)

- **Client (`App.jsx`):** global keydown listener, active only when a post is
  highlighted (`tellActive` + `highlightedPost`), focus is not in an
  input/textarea/contenteditable, and `!isHostedApiOrigin()`. On spacebar:
  `DELETE /api/posts/{authorSlug}/{postId}`, remove the post from React state
  (`profile`, `allProfiles`), close the tell-me-more panel.
- **Server (`server.js`):** new `DELETE /api/posts/:slug/:postId` endpoint that removes
  the post by id from `posts/{slug}.json`. Guarded to local mode — rejects (404/403)
  when running in hosted/Supabase mode. Works identically for Brikeld's and fake users'
  posts.

### 6. ▶ demo-video button compatibility (local mode)

One identity per person: the button must not create ephemeral `demo-video-*` duplicates
of people who now exist as seeded profiles. In local mode:

- The schedule targets the **seeded** slugs (roster module maps each person to their
  seeded `{first}-{last}` slug when running locally), and only includes people who have
  seeded profiles.
- The pipeline initializes each user's accumulated post list from the posts already in
  `allProfiles` (today it starts empty, which would wipe seeded posts from feed state on
  first reveal), so button posts stack on top of seeded ones.
- Each revealed post is persisted through the existing local posts-prepend API (the same
  path `prependPersonaPosts` uses), so button posts survive directory polls and page
  refreshes, and spacebar-delete works on them too.

Hosted mode keeps the current ephemeral `demo-video-*` behavior unchanged.

## Known interaction

`POST /api/profile` (Electron harvest sync) keeps single-profile semantics locally and
removes other profile files — a harvest sync while the demo is seeded deletes the fake
profiles. Acceptable for a local demo; re-run `npm run seed:local` to restore.

## Data flow

```
seed:local ──writes──► profiles/*.json + posts/*.json (demoFake flagged)
                              │
server.js  ──serves──► GET /api/profiles (all, incl. fakes)
                              │
App.jsx    ──auto-owns──► newest non-demoFake profile (brikeld-hoxha)
           ──feed────► aggregates every profile's posts (existing path)
           ──click───► /api/profiles/:slug → fake profile view (existing path)
           ──space───► DELETE /api/posts/:slug/:postId → file mutation + state removal
▶ button   ──stacks──► reveals extra prewritten posts on top of seeded ones,
                       persisting each via the local posts-prepend API
```

## Error handling

- Delete endpoint: 404 for unknown slug/post id; 403 (or 404) in hosted mode; file write
  errors surface as 500 with a JSON error body. Client logs a console warning and leaves
  state unchanged on failure.
- Spacebar handler ignores key events when typing in form fields or when no post is
  highlighted.
- Seed script fails loudly (non-zero exit) if fixtures are malformed.

## Testing

- Vitest: fixture/seed output shape (valid profile + posts, `demoFake` flag, comments
  arrays); delete endpoint (local-mode guard, removes correct post, 404 cases);
  CommentsCapsule embedded-comments fallthrough (mock skipped when embedded present).
- Manual: seed + launch → feed populated with commented posts; fake profiles clickable;
  spacebar delete persists across refresh; ▶ button stacks on seeded posts and its posts
  survive refresh; re-seed restores deleted posts.
