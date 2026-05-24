# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev               # Vite dev server (Vite default port, expects servers on localhost:3001/3010)
npm run dev:web           # Same, but sets VITE_API_ORIGIN + VITE_GENERATE_API_ORIGIN explicitly
npm run build             # Production build to dist/
npm run preview           # Preview the built dist/
npm run server            # Profile/posts API on :3001 (server.js)
npm run server:generate   # LM Studio post-generation API on :3010 (server-generate.js)
npm run servers           # Both API servers in parallel (via concurrently)
npm run dedupe:uploads    # Reconcile public/uploads against SHA-256 names (scripts/dedupe-uploads.js)
npm test                  # Vitest unit tests (tests/**/*.test.js)
```

A typical local dev session is three processes: `npm run servers` in one terminal, `npm run dev` in another.

Environment variables consumed by the Vite app (`src/app/App.jsx`):
- `VITE_API_ORIGIN` — profile/data server, default `http://localhost:3001`
- `VITE_GENERATE_API_ORIGIN` — generator server, default `http://localhost:3010`

Environment variables consumed by `server-generate.js`:
- `LM_STUDIO_BASE_URL`, `LM_STUDIO_MODEL` — fallback if `data/lm_studio.json` from the Electron repo is missing
- `LM_STUDIO_TIMEOUT_MS` (default 180000), `LM_STUDIO_RETRIES` (default 1)
- `GENERATE_PORT` (default 3010)

No lint scripts are configured.

## High-Level Architecture

WebDiplome is the **web-facing half** of a two-repo project. It's a Vite + React 18 SPA backed by two small Express servers, fed by a sibling Electron app at `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/` (see the integration section below).

### Frontend (`src/`)

- Entry: `src/main.jsx` → `src/app/App.jsx`. Single React component drives the whole app via `mainView` state: `landing` → `home` → `profile`.
- Path alias `@/` → `src/` (configured in both `vite.config.js` and `jsconfig.json`).
- Feature-folder layout: `src/features/{home,feed,profile,landing,debug}/…`. The profile view has the most surface area — see `src/features/profile/ProfileOverview/` for the dashboard card composition.
- `App.jsx` polls `GET /api/profiles` every 30s and picks the first (newest) result — the backend always returns newest-first, and the UI is single-profile by design.
- Persona system: three personas drive theming and post categorization. Names are dual-locale:
  - UI uses English keys (`productivity` / `security` / `popularity`).
  - Posts and prompts use French keys (`productivite` / `securite` / `popularite`).
  - `PERSONA_ALIASES` in `App.jsx` maps between them. Always go through that map rather than comparing strings directly.
- Dominant persona resolution priority: `profile.dominantPersona` → most common `persona` in `personaPosts` → fallback `productivity`. CSS custom properties (`--persona-accent`, `--tabs-capsule-fill`) are set inline on the root element so all child components inherit theming via vars rather than per-component prop drilling.

### Backend — two separate Express apps

The two servers are intentionally split (different concerns, different port). Both live at the repo root, not under `server/`.

**`server.js` (port 3001) — profile + media store**
- `POST /api/profile` — writes `profiles/{firstname}-{lastname}.json`. **Destructive:** deletes all existing profile and post files before writing. The system is intentionally single-profile.
- `GET /api/profiles` — returns all profiles, newest-first by mtime, with `personaPosts` re-hydrated from `posts/{id}.json`.
- `GET /api/profile/:id` — single profile, also re-hydrates posts.
- `POST /api/upload` — content-addressed image dedup: hashes the uploaded buffer (SHA-256), renames to `{hash}{ext}` in `public/uploads/`. Subsequent uploads of the same content reuse the canonical name.
- `personaPosts` are stripped from the profile JSON on write and stored in a sibling `posts/{id}.json` to keep the profile file small (the wallpaper base64 alone is ~30k tokens).
- `normalizeProfilePayload()` merges camelCase + snake_case keys; stored JSON is camelCase only.

**`server-generate.js` (port 3010) — LM Studio post generation**
- `POST /api/posts/generate` — generates three new persona posts (one per persona) and prepends them to `posts/{id}.json` for the newest profile.
- Generation logic lives in `server/lib/personaPostGenerator.js` and is functionally identical to the Electron app's `PostGenerator.js`. Both speak the same OpenAI-compatible `/v1/chat/completions` shape to a local LM Studio instance.
- Prompt config is loaded from `ELECTRON_DATA_DIR/prompts.json` via `server/lib/prompts.js`, with baked-in per-key fallbacks if the file is missing or malformed.
- The user message payload is rebuilt from the **Electron app's** `data/data.json` + `data/user.json` (see absolute path constant `ELECTRON_DATA_DIR` near the top of `server-generate.js`). If those files are missing, it falls back to stripping `wallpaperBase64` and `personaPosts` from the WebDiplome profile.
- Asset pipeline: each generation pass picks one random unused asset from the Electron app's `assets/recent_images`, `assets/screenshots`, and `assets/docs` (`.pdf .txt .md .py .js .ts .css`; no HTML), copies it into `public/uploads/` under a SHA-256 name, and assigns it to one persona in cycle order (`ASSET_PERSONA_CYCLE`).
- Image assets are sent via vision input; document assets are sent as extracted text (`server/lib/docText.js`, capped to 4096 chars). If vision is unavailable, image prompts downgrade to filename-only text fallback.
- Posts now use `attachedAsset` with `kind: "image" | "document"` rather than `attachedImage`.
- `server/lib/currentProfile.js` resolves the "current" profile as the newest by mtime — same heuristic the UI uses.

### Data on disk (repo-relative)

- `profiles/{id}.json` — one profile per system; `id = {firstname-lastname}`.
- `posts/{id}.json` — array of persona posts for that profile (separated from profile JSON).
- `public/uploads/{sha256}.{ext}` — content-addressed user-uploaded and generator-imported assets (images and docs). Served at `/uploads/...` by `server.js`. `.gitignore`d.

### Design system

Detailed token list in `DESIGN_SYSTEM.txt`. Tokens are defined in `src/styles/base.css`; dynamic per-persona values (`--persona-accent`, `--post-accent`, `--score-fill`) are written as inline styles from `App.jsx` and `PostCard.jsx`. CSS is plain — no preprocessor.

## How This Repo Talks to `Diplome_/testCreationAcc`

The two repos form a **collector → presenter** pipeline:

```
Diplome_/testCreationAcc (Electron + Python)            WebDiplome (Vite + Express)
─────────────────────────────────────────────           ─────────────────────────────
1. Electron collector (Python v18_profile.py)
   scrapes macOS → writes data/data.json + assets/
2. Flask /analyze (python/server/app.py, :5050)
   computes persona scores
3. Electron main.js calls LM Studio via
   python/post_generator/PostGenerator.js
   → writes data/posts_personas.json
4. renderer/app.js uploads attached assets to ─────────► POST /api/upload  (server.js :3001)
   and POSTs the full analyzed payload to    ─────────► POST /api/profile (server.js :3001)
                                                        Stores profiles/{id}.json + posts/{id}.json
                                                        (replaces any prior profile — single-tenant)

User in the web UI clicks "Generate new content" ─────► POST /api/posts/generate (server-generate.js :3010)
                                                        which reads Electron's data/data.json +
                                                        data/user.json + data/lm_studio.json
                                                        directly off disk via ELECTRON_DATA_DIR,
                                                        plus picks a random asset from
                                                        Electron's assets/{recent_images,screenshots,docs}.
                                                        New posts are prepended to posts/{id}.json.
```

Concretely:

1. **Initial sync (Electron → WebDiplome HTTP).** `renderer/app.js` constructs a `syncPayload` from the Flask `/analyze` result + locally-generated posts and `POST`s it to `http://localhost:3001/api/profile`. Attached assets on posts go through `POST /api/upload` first, and the returned `/uploads/...` URLs are spliced back into the payload's `personaPosts[*].attachedAsset.url`. See `renderer/app.js` `syncProfileToWebDiplome()` and `uploadAttachedAssetsForPosts()`.

2. **On-demand regeneration (WebDiplome filesystem → Electron data dir).** The "GENERATE NEW CONTENT" button in `App.jsx` calls `POST /api/posts/generate` on port 3010. That endpoint:
   - Resolves the newest WebDiplome profile.
   - **Reads the Electron repo's `data/data.json`, `data/user.json`, `data/lm_studio.json` directly** (hardcoded path `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/data` in `server-generate.js`) so the AI input and LM Studio config exactly match what the Electron app would send. This sidesteps the WebDiplome profile's serialization losses (e.g. the stripped wallpaperBase64).
   - Reads assets from the Electron repo's `data/assets/recent_images`, `data/assets/screenshots`, and `data/assets/docs` (no HTML allowed).
   - Calls LM Studio (default `http://192.168.1.109:1234`, model `google/gemma-4-e2b` via repo `data/lm_studio.json`, env `LM_STUDIO_*`, or Electron `data/lm_studio.json`) using the same prompts/logic as the Electron app's `PostGenerator.js`.
   - Prepends the three new posts to `posts/{id}.json`.

3. **LM Studio is the only shared external service.** Both apps point at the same OpenAI-compatible `/v1/chat/completions` endpoint and share the same prompt contract from `Electron/data/prompts.json` (`loadPrompts`/`loadPromptsSync` with local defaults).

4. **Cross-app dedup preflight.** Before Electron generates posts, it calls WebDiplome `GET /api/profiles` then `GET /api/profile/:id` to build a used-asset hash set from `attachedAsset.filename`. If WebDiplome is unreachable, Electron falls back to local `data/posts_personas.json`.

5. **Hardcoded absolute paths.** `server-generate.js` references `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/...` directly. If you move either repo, update `ELECTRON_DATA_DIR` and `ASSET_DIRS` at the top of `server-generate.js`. There is no environment-variable fallback for these paths today.

## Conventions Worth Knowing

- **Single-profile semantics.** `POST /api/profile` wipes prior profiles/posts. Don't add multi-profile logic without changing both servers and the polling loop in `App.jsx`.
- **Persona key locale.** Posts and prompts are French (`productivite`/`securite`/`popularite`); UI/state are English. Use `PERSONA_ALIASES` for any cross-boundary comparison.
- **Assets are content-addressed.** `attachedAsset` is the canonical attachment field (`kind=image|document`), keyed by SHA-256 filename. Never trust original names; dedupe always uses hash+extension. `scripts/dedupe-uploads.js` reconciles `public/uploads/` if something gets out of sync.
- **Legacy compatibility is read-time only.** `server.js` translates old `attachedImage` payloads to `attachedAsset` when loading posts; new writes should emit `attachedAsset` only.
- **`server.js` and `server-generate.js` share no in-process state** — they communicate only via the filesystem (`profiles/`, `posts/`, `public/uploads/`). When debugging "why didn't my new post show up?", the answer is usually that one server wrote a file the other server hasn't re-read yet (the UI re-polls every 30s).
- **Wallpaper base64 is huge.** It lives in the profile JSON for display but is stripped before being sent to LM Studio as user payload (in both the Electron app and the WebDiplome fallback path).
