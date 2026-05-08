# Post Generation — Production Design

**Date:** 2026-05-08
**Status:** Approved
**Scope:** Make `POST /api/posts/generate` production-ready for a hosted website.

## Goals

When a user clicks "Generate new posts" on the website, the backend produces 3 new posts for that user:

- 2 text-only persona posts.
- 1 persona post anchored to a real user asset (image), generated via a vision-capable model so the text relates to the image.

The system must work when the website is hosted, with no dependency on the Electron app or the user's local machine.

## Non-goals (v1)

- Real authentication (login UI, sessions). A `requireUser(req)` seam is added; real auth plugs in later.
- Streaming responses, partial success, post regeneration of a single persona.
- Database migrations. Storage stays JSON files behind a repository module.
- Cost tracking / token logging.
- Docker / CI / log shipping.

## Architecture

Approach C — 3010 is a stateless generation worker, 3001 is the only port the frontend talks to and the only thing that touches disk.

```
Browser
  │  POST /api/posts/generate  { count?: 3 }
  ▼
┌───────────────────────────────────────────────────────────────┐
│ 3001 — Web backend (frontend-facing, owns state)              │
│                                                               │
│  • requireUser(req) → userId  (stub: active profile)          │
│  • repository.getProfile(userId)                              │
│  • repository.listAssets(userId), pick asset for image post   │
│  • strip wallpaperBase64 from profile                         │
│  • POST /internal/generate to 3010                            │
│  • on success: stamp createdAt, re-attach asset URL,          │
│    markAssetUsed, prependPosts                                │
└───────────────────────────────────────────────────────────────┘
  │  POST /internal/generate (X-Internal-Token header)
  ▼
┌───────────────────────────────────────────────────────────────┐
│ 3010 — Stateless worker (no disk, no DB)                      │
│                                                               │
│  • providers/{lmstudio,anthropic,openai}.js                   │
│    selected via MODEL_PROVIDER (default lmstudio)             │
│  • prompts/buildUserPayload(profile, harvestedSignals?)       │
│  • prompts/personas (productivite | securite | popularite)    │
│  • asset post: vision call if supportsVision,                 │
│    else filename-only fallback                                │
└───────────────────────────────────────────────────────────────┘
  │
  ▼
LM Studio (dedicated model server, private network)
```

### Key invariants

- 3010 has no filesystem, no DB, no asset URLs. Input fully determines output.
- 3010 receives image bytes, never URLs. 3001 owns URLs.
- 3001 picks the asset, picks which persona gets it, and cycles personas across generations.
- 3010 is reachable only on a private network. Internal calls authenticated by `X-Internal-Token` shared secret.

## API contracts

### 3001 (frontend-facing)

#### `POST /api/posts/generate`

Request:
```json
{ "count": 3 }
```
`count` is optional and only `3` is supported in v1; other values → 400.

Response (200):
```json
{
  "success": true,
  "posts": [
    { "persona": "productivite", "content": "...", "sentiment": "positive"|"negative"|null,
      "createdAt": "2026-05-08T...Z", "attachedImage": null },
    { "persona": "securite",     "content": "...", "sentiment": null, "createdAt": "...", "attachedImage": null },
    { "persona": "popularite",   "content": "...", "sentiment": null, "createdAt": "...",
      "attachedImage": { "url": "/uploads/<hash>.png", "filename": "<hash>.png", "mime": "image/png" } }
  ],
  "assetPostSkipped": false
}
```

Exactly one of the three posts has `attachedImage` set, **iff** the user has at least one asset. If they have none, all three are text-only and `assetPostSkipped: true`.

Error shape: `{ "success": false, "error": "<readable message>" }`.

| Code | When |
|------|------|
| 401  | `requireUser` fails (stub: no active profile exists) |
| 400  | Unsupported `count` |
| 502  | `Generator unreachable` (3010 down / DNS / refused) |
| 504  | `Generation timed out after Ns` |
| 500  | `Generation failed` (any other error; never leaks provider details) |

#### `POST /api/assets/:userId`

Multipart upload, accepts one or many images. Auth: `requireUser` must match `:userId`, OR `X-Asset-Sync-Token` header matches `ASSET_SYNC_SECRET` (used by the Electron sync). Writes to `public/uploads/`, dedupes by SHA-256 hash, registers `{userId, filename, mime, bytes, sha256, addedAt}` via `repository.addAsset`.

Response: `{ added: [{filename, url, mime}], skipped: [{filename, reason}] }`.

**Dedup model:** bytes in `public/uploads/` are deduped globally by SHA-256 (saves disk if two users happen to upload the same image). Ownership is per-user via `assets/<userId>.json`. Same hash can appear in multiple users' asset indexes; the underlying file is one shared blob.

**Two-secret rationale.** `ASSET_SYNC_SECRET` and `INTERNAL_SHARED_SECRET` cover different trust boundaries: the asset secret authenticates the Electron desktop client to 3001, the internal secret authenticates 3001 to 3010. Keeping them separate means rotating one doesn't break the other, and a leak of one doesn't compromise both.

#### `POST /api/profile` (existing, extended)

Optionally accepts `harvestedSignals` (opaque JSON blob). Stored verbatim alongside the profile. Backward-compatible — missing field changes nothing.

### 3010 (internal-only)

#### `POST /internal/generate`

Requires `X-Internal-Token` header matching `INTERNAL_SHARED_SECRET`. Otherwise 401.

Request:
```json
{
  "userId": "babubub-bibabab",
  "profile": { "...": "stored profile JSON minus wallpaperBase64" },
  "harvestedSignals": { "...": "..." } | null,
  "assetImageForPersona": "productivite" | "securite" | "popularite" | null,
  "assetImage": { "filename": "<hash>.png", "mime": "image/png", "base64": "..." } | null
}
```

Response:
```json
{
  "success": true,
  "posts": [
    { "persona": "productivite", "content": "...", "sentiment": "..."|null },
    { "persona": "securite",     "content": "...", "sentiment": "..."|null },
    { "persona": "popularite",   "content": "...", "sentiment": "..."|null,
      "attachedImage": { "filename": "<hash>.png", "mime": "image/png", "visionAnalysed": true } }
  ]
}
```

3010 returns `attachedImage` with `filename`/`mime`/`visionAnalysed` only — no `url`. 3010 does not stamp `createdAt`.

Errors: 401 (bad token), 502 (provider unreachable), 500 (unparseable model output after retries). All-or-nothing: if any persona fails, the whole request fails.

## Repository module

`server/lib/repository/` — only place that touches `profiles/`, `posts/`, `public/uploads/`, or any future DB. Both `server.js` and any future split process import it. 3010 never imports it.

### Files
```
server/lib/repository/
├── index.js              re-exports public API
├── profiles.js           getProfile, saveProfile (handles harvestedSignals split)
├── posts.js              listPosts, prependPosts
├── assets.js             listAssets, addAsset, getAssetBytes, markAssetUsed
├── currentUser.js        getActiveUserId, requireUser
└── paths.js              PROFILES_DIR, POSTS_DIR, UPLOADS_DIR, ASSETS_INDEX_DIR
```

### Public API
```js
getProfile(userId)         → { profile, harvestedSignals } | null
saveProfile(userId, body)  → void

listPosts(userId)          → Post[]   // newest-first
prependPosts(userId, posts) → void

listAssets(userId)                                    → Asset[]
addAsset(userId, { buffer, mime, originalName })      → Asset   // hash-dedupe
getAssetBytes(userId, filename)                       → { buffer, mime } | null
markAssetUsed(userId, filename)                       → void

getActiveUserId()          → userId | null   // stub: newest profile's id
requireUser(req)           → userId           // stub: returns getActiveUserId();
                                              // throws 401 only if no profile exists at all

Asset = { filename, url, mime, bytes, sha256, addedAt, lastUsedAt? }
Post  = { persona, content, sentiment, createdAt, attachedImage? }
```

### On-disk layout
```
profiles/
  <userId>.json                main profile (no harvestedSignals, no wallpaperBase64 at gen-time)
  <userId>.harvested.json      optional harvested blob, separate file
posts/
  <userId>.json                array, newest-first
public/uploads/
  <hash>.<ext>                 bytes, hash-deduped
assets/
  <userId>.json                asset index — array of Asset records
```

### Behavioral changes vs. today

- "Delete all existing profiles before saving a new one" (current `server.js`) is removed. With user-keyed storage, `saveProfile(userId, body)` overwrites only that user's file.
- Hardcoded `EXTRA_ASSET_DIRS = ['/Users/brikeld/.../Diplome_/...']` is removed. Replaced by `assets.listAssets(userId)`.
- Posts cap not enforced in v1.

## Provider abstraction (3010 only)

`server-generate/providers/` — only place 3010 touches model APIs. Selected at boot via `MODEL_PROVIDER` env var.

### Interface
```ts
type GenerateInput = {
  system: string,
  user: string,
  image?: { base64: string, mime: string },
  responseFormat?: "json_object",
  maxTokens?: number,
  temperature?: number,
};
type GenerateOutput = { text: string };

interface Provider {
  name: "lmstudio" | "anthropic" | "openai";
  supportsVision: boolean;
  generate(input: GenerateInput): Promise<GenerateOutput>;
}
```

Caller parses JSON from `text` and validates shape (existing logic from `personaPostGenerator.js`).

### Implementations

- **`lmstudio.js`** (default in dev and prod): generalized from current code. Env: `LM_STUDIO_BASE_URL`, `LM_STUDIO_MODEL`, `LM_STUDIO_TIMEOUT_MS`, `LM_STUDIO_VISION`. `supportsVision = (LM_STUDIO_VISION === 'true')`. Sends image as `messages[].content` array form when vision is enabled. Retries without `response_format` on rejection.
- **`anthropic.js`** (alternative): `@anthropic-ai/sdk`, `claude-haiku-4-5` default. `supportsVision: true`. System prompt cached via `cache_control: {type:"ephemeral"}`. Image as `{type:"image", source:{type:"base64", ...}}`.
- **`openai.js`** (alternative): `openai` SDK, `gpt-4o-mini` default. `supportsVision: true`. Image as `{type:"image_url", image_url:{url:"data:..."}}`.

Boot-time: 3010 instantiates the provider, logs `name + supportsVision + model`. Constructor throws on missing required env (e.g. missing API key) → process exits.

### Vision fallback policy (in persona generator, not provider)

```
if assetImage && provider.supportsVision:
   system += IMAGE_POST_PROMPT_EXTENSION
   call generate({ system, user, image })
elif assetImage:
   system += imageTextFallbackNote(filename)
   call generate({ system, user })
else:
   call generate({ system, user })
```

Vision call failure (model rejects image) → fall back to filename-only path, mark `visionAnalysed: false`.

### Not in scope

No streaming. No structured outputs / tool use. No rate-limit retry beyond existing temp-lower retry. No cost tracking.

## End-to-end flow

```
3001:
1.  userId = requireUser(req)
2.  { profile, harvestedSignals } = repository.getProfile(userId)
3.  strip wallpaperBase64 from profile
4.  assets = repository.listAssets(userId)
5.  existing = repository.listPosts(userId)
6.  prevImagePersona = mostRecentPersonaWithImage(existing)
7.  assetImageForPersona = nextPersonaInCycle(prevImagePersona)
8.  unused = assets.filter(a => a.lastUsedAt is null OR was used > 3 generations ago)
9.  chosen = pickRandom(unused) ?? pickRandom(assets) ?? null
10. if !chosen: assetImageForPersona = null
11. assetBytes = chosen ? repository.getAssetBytes(userId, chosen.filename) : null
12. POST http://3010/internal/generate
       headers: { X-Internal-Token: INTERNAL_SHARED_SECRET }
       body: { userId, profile, harvestedSignals, assetImageForPersona,
               assetImage: assetBytes ? { filename, mime, base64 } : null }
       timeout: INTERNAL_GENERATOR_TIMEOUT_MS (200s)

3010:
13. validate X-Internal-Token → 401 if mismatch
14. provider = boot-time singleton
15. userPayload = buildUserPayload(profile, harvestedSignals)
        // harvestedSignals present → richer JSON
        // absent → summary fields only
16. Promise.all over [productivite, securite, popularite]:
       isAssetPost = (persona === assetImageForPersona) && assetImage
       systemPrompt = PERSONA_SYSTEM_PROMPTS[persona]
       if isAssetPost && provider.supportsVision:
         systemPrompt += IMAGE_POST_PROMPT_EXTENSION
         result = await provider.generate({ system, user, image: assetImage })
       elif isAssetPost:
         systemPrompt += imageTextFallbackNote(assetImage.filename)
         result = await provider.generate({ system, user })
       else:
         result = await provider.generate({ system, user })
       parsed = parsePostWithSentiment(result.text, persona)
       if !parsed.content: retry once at temp 0.35
       if !parsed.content: throw  // all-or-nothing
17. return { success, posts }  // posts include attachedImage for asset post,
                                // no url, no createdAt

3001:
18. for each post: stamp createdAt = new Date(now + i ms).toISOString()
19. for asset post: re-attach { url: chosen.url, filename, mime }
20. repository.markAssetUsed(userId, chosen.filename)
21. repository.prependPosts(userId, posts)
22. respond { success: true, posts, assetPostSkipped: !chosen }
```

### Failure modes

| Where | Behavior |
|-------|----------|
| 3010 unreachable | 502, no posts persisted |
| 3010 timeout | 504, no posts persisted |
| Any persona fails after retry | 3010 returns 500 — no partial success |
| Vision call fails on asset post | fall back to filename-only, `visionAnalysed: false`, post still generated |
| `assets[]` empty | `assetPostSkipped: true`, 3 text-only posts |
| `harvestedSignals` missing | summary-fields-only prompt |

### Error message standards (3001)

- 502: `"Generator unreachable"`
- 504: `"Generation timed out after Ns"`
- 500: `"Generation failed"` — generic; never leaks provider error text or stack traces

## Frontend changes

Small. PostsTab.jsx already renders `attachedImage.url` correctly (`PostsTab.jsx:14-20`).

### New: `src/lib/apiOrigin.js`
```js
export const API_ORIGIN =
  (import.meta?.env?.VITE_API_ORIGIN ?? 'http://localhost:3001').replace(/\/$/, '');
```

### New: `src/lib/apiFetch.js`
Thin wrapper over `fetch` that:
- prefixes `API_ORIGIN`
- (future-proof) sets `credentials: 'include'` if cookie auth is enabled via `VITE_AUTH_MODE=cookie`
- (future-proof) injects `Authorization: Bearer <token>` if `VITE_AUTH_MODE=token`
- parses JSON, throws on non-2xx with `data.error || 'HTTP <code>'`

In v1 with stub-auth, the wrapper just forwards. The seam exists for the auth swap.

### `src/app/App.jsx`
- Drop `GENERATE_API_ORIGIN` and `VITE_GENERATE_API_ORIGIN`.
- Replace direct `fetch` in `handleGeneratePersonaPosts` with `apiFetch('/api/posts/generate', { method: 'POST', body: {} })`.
- Handle `data.assetPostSkipped` if returned (no UI in v1, just don't crash).

### `src/features/feed/PostsTab.jsx:12`
- Replace `const API_ORIGIN = 'http://localhost:3001';` with `import { API_ORIGIN } from '@/lib/apiOrigin.js';`.

### `package.json`
- Drop `VITE_GENERATE_API_ORIGIN` from `dev:web`.

### CORS

3001 today: `app.use(cors())` (wide-open). Stays this way for stub-auth dev. When real cookie-auth lands later:
```js
app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true }));
```
Token-auth path: wide-open CORS is fine; `apiFetch` injects `Authorization`.

## Config

### 3001 env
```
PORT=3001
WEB_ORIGIN=https://your-site.tld                  # CORS; default http://localhost:5173
INTERNAL_GENERATOR_URL=http://127.0.0.1:3010      # default; co-located 3001+3010
INTERNAL_SHARED_SECRET=<random-64-hex>
INTERNAL_GENERATOR_TIMEOUT_MS=200000              # default 200s
ASSET_SYNC_SECRET=<random-64-hex>
UPLOAD_MAX_BYTES=15728640                         # default 15MB
```

### 3010 env
```
PORT=3010                    (renamed from GENERATE_PORT for consistency)
INTERNAL_SHARED_SECRET=<same-as-3001>
MODEL_PROVIDER=lmstudio      (default; alternatives: anthropic | openai)
LM_STUDIO_BASE_URL=http://<private-ip>:1234
LM_STUDIO_MODEL=google/gemma-4-e4b
LM_STUDIO_VISION=true
LM_STUDIO_TIMEOUT_MS=180000
# Only when MODEL_PROVIDER != lmstudio:
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-haiku-4-5
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```

### Frontend env (Vite, build-time)
```
VITE_API_ORIGIN=https://your-site.tld
VITE_AUTH_MODE=stub          (future: cookie | token)
```

### `.env.example` at repo root lists every variable above. `.env` already in `.gitignore`. Add `dotenv` to dependencies; each server loads its own subset.

## Deployment topology

```
┌────────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Web frontend       │    │ Web backend host │    │ Model server     │
│ (static, CDN)      │ →  │  3001 + 3010     │ →  │ LM Studio :1234  │
└────────────────────┘    │  same machine    │    │ dedicated box    │
                          │  3010 → 127.0.0.1│    │ private network  │
                          └──────────────────┘    └──────────────────┘
```

Three deployment requirements:

1. **3001 ↔ 3010 co-located.** 3010 binds `127.0.0.1:3010` so the OS firewall enforces "internal only". No public route to 3010.
2. **3010 → LM Studio over private network.** `LM_STUDIO_BASE_URL` points at private IP / Tailscale / VPC. Never expose LM Studio publicly.
3. **`public/uploads/` survives restarts.** The JSON+filesystem decision means assets must persist. Ephemeral filesystems (Heroku, default Vercel) break this design. Use a VM, bare metal, or a host with persistent volumes (Fly volumes, Railway volumes).

## Local dev

```bash
# Terminal 1: LM Studio with a vision-capable model loaded, server on :1234

# Terminal 2: backend (both servers)
INTERNAL_SHARED_SECRET=devsecret \
INTERNAL_GENERATOR_URL=http://127.0.0.1:3010 \
LM_STUDIO_BASE_URL=http://127.0.0.1:1234 \
LM_STUDIO_VISION=true \
npm run servers

# Terminal 3: frontend
npm run dev
```

`npm run servers` is the existing `concurrently` script.

## Out of scope (explicitly)

- Real authentication (login UI, sessions, password storage).
- Multi-user support beyond the storage seam being user-keyed.
- Database (SQLite/Postgres). Repository module is the swap point when it's needed.
- Streaming, partial-success generation, single-persona regeneration.
- Docker / Compose / CI / log shipping / metrics / cost tracking.
- HTTPS termination (assumed handled by reverse proxy / load balancer).
- Frontend asset uploader UI (Electron sync is the only asset source in v1).

## File-level change summary

### New files
- `server/lib/repository/{index,profiles,posts,assets,currentUser,paths}.js`
- `server-generate/lib/providers/{index,lmstudio,anthropic,openai}.js`
- `server-generate/lib/prompts/{personas,buildUserPayload,fallbackNotes}.js`
- `server-generate/lib/personaPostGenerator.js` — moved from `server/lib/`
- `src/lib/apiOrigin.js`
- `src/lib/apiFetch.js`
- `.env.example`

### Modified files
- `server.js` — switch to repository module; add `POST /api/posts/generate` (proxies to 3010); add `POST /api/assets/:userId`; extend `POST /api/profile` to store `harvestedSignals` separately; remove "delete all profiles" behavior; tighten CORS (config-driven); standardized error responses.
- `server-generate.js` — strip filesystem code; add `X-Internal-Token` middleware; rewrite endpoint as `POST /internal/generate` using provider abstraction; remove `EXTRA_ASSET_DIRS`; rename env `GENERATE_PORT` → `PORT`.
- `src/app/App.jsx` — switch endpoint origin to `API_ORIGIN`; use `apiFetch`; drop `GENERATE_API_ORIGIN`.
- `src/features/feed/PostsTab.jsx` — replace hardcoded `http://localhost:3001` with shared `API_ORIGIN`.
- `package.json` — drop `VITE_GENERATE_API_ORIGIN` from `dev:web`; add `dotenv` and `@anthropic-ai/sdk`/`openai` as optional dependencies (only loaded by their providers).

### Deleted / removed code
- Hardcoded `EXTRA_ASSET_DIRS` constant in `server-generate.js`.
- "Delete all existing profiles before saving a new one" branch in `server.js`.
- Direct `fetch` to LM Studio inside `personaPostGenerator.js` (replaced by provider call).
- The old `server/lib/personaPostGenerator.js` location (moved to `server-generate/lib/`; 3001 no longer imports it).
- The `post_generator/` folder at the repo root. Copied from the Electron repo as reference; not imported by the active code path. Its `generate_posts.py` hardcodes a stale default model (`google/gemma-4-26b-a4b`) that contradicts the canonical default used everywhere else (`google/gemma-4-e4b`). Delete after implementation lifts the prompts and asset-image patterns into `server-generate/lib/prompts/` and `server-generate/lib/personaPostGenerator.js`.

### Canonical model default
`LM_STUDIO_MODEL=google/gemma-4-e4b` is the single source of truth. The Electron-side default agrees; the Python reference file in `post_generator/` is wrong and is being deleted.

## Acceptance criteria

1. Clicking "Generate new posts" on the website creates 3 new persona posts for the current user.
2. Exactly one post includes `attachedImage.url` when the user has at least one asset; otherwise `assetPostSkipped: true` and all three are text-only.
3. With a vision-capable LM Studio model, the asset post's text references what's in the image (manually verified).
4. The frontend works against a hosted backend with no localhost / Electron dependency. The Electron app is only needed to feed profiles and assets via authenticated sync endpoints.
5. 3010 is not reachable from the public internet.
6. Switching `MODEL_PROVIDER=anthropic` (or `openai`) and supplying the corresponding key works without code changes.
