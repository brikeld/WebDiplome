# Shared state, centralized prompts, and document assets — design

**Date:** 2026-05-11
**Scope:** spans both repos — `WebDiplome` (this repo) and `Diplome_/testCreationAcc` (sibling Electron app)

## Problem

Today the two apps generate persona posts in parallel and only loosely coordinate:

1. **No cross-app dedup of attached assets.** The Electron app's `PostGenerator.js` does not track which images it has already attached, and even if it did, it has no visibility into images attached by WebDiplome's web-side generator. The two apps can pick the same image twice.
2. **Prompts are duplicated.** `SYSTEM_PROMPTS`, `IMAGE_POST_PROMPT_EXTENSION`, and `SYSTEM_PROMPT_USER_SUMMARY` live in both `Diplome_/testCreationAcc/python/post_generator/PostGenerator.js` and `WebDiplome/server/lib/personaPostGenerator.js`. Tuning a prompt means editing both.
3. **Only images are post-anchorable.** The collector also harvests documents into `data/assets/docs/` (`.pdf`, `.txt`, `.md`, `.py`, `.js`, `.ts`, `.css`, `.html`), but nothing in the post pipeline ever picks from there.

## Goals

- One canonical record of "what has been posted" that both apps consult before generating, keyed by content hash so the file's original name doesn't matter.
- One file that holds all persona system prompts, prompt extensions, and per-call model parameters; edited once, picked up by both apps.
- Persona posts can be anchored to documents (PDFs, source code, markdown, plain text), not only images. HTML is explicitly excluded.

## Non-goals

- Migrating existing post records on disk. Read-time translation of legacy fields is sufficient.
- Rendering PDF pages as images for vision input — text extraction only.
- Inline preview of document contents in the WebDiplome UI — filename and "Open" link only.
- Changing the persona cycle order, persona count, or the "one attached asset per generation" rule.
- Stronger concurrency guarantees than today (best-effort dedup; last write wins on `POST /api/profile`).

## Architecture

### 1. Shared post-history via WebDiplome's HTTP API

WebDiplome's `posts/{id}.json` is already the union of both apps' history after every Electron sync. The new behavior simply names that store and has Electron read from it before generating.

```
Electron pre-generation (new step in main.js, before generatePersonaPosts):
  GET http://localhost:3001/api/profiles  →  pick newest profile's id
  GET http://localhost:3001/api/profile/{id}
      → response includes personaPosts[]
      → build Set<string> of post.attachedAsset.filename (SHA-256 hashes)
      → pass into generatePersonaPosts as `usedAssetHashes`

  Fallback if WebDiplome unreachable (timeout / network error):
      → read local data/posts_personas.json
      → extract hashes from posts[].attachedAsset.filename
      → log a warning and proceed

WebDiplome generator (server-generate.js):
  Already reads its own posts/{id}.json. No change to the data source —
  only the field name changes (attachedImage → attachedAsset.filename).
```

**Why HTTP and not a direct filesystem read of WebDiplome's posts dir:** Electron already speaks HTTP to WebDiplome for sync; adding a second hardcoded absolute path (the reverse of `ELECTRON_DATA_DIR`) doubles the maintenance burden when either repo moves. HTTP also lets WebDiplome continue to do shape normalization in one place.

### 2. Centralized prompts in `Electron/data/prompts.json`

Lives next to `lm_studio.json`. Both apps read it on every generation (cheap fs read, file is small). Each app keeps a baked-in default for the case where the file is missing or malformed — same defensive pattern as `lm_studio.json`.

**File shape:**

```json
{
  "personaPosts": {
    "productivite": { "system": "<prompt text>", "temperature": 0.7, "maxTokens": 900 },
    "popularite":   { "system": "<prompt text>", "temperature": 0.7, "maxTokens": 900 },
    "securite":     { "system": "<prompt text>", "temperature": 0.7, "maxTokens": 900 }
  },
  "imageExtension":    "<prompt text appended when an image is attached>",
  "documentExtension": "<prompt text appended when a document is attached>",
  "userSummary":       { "system": "<prompt text>", "temperature": 0.55, "maxTokens": 900 }
}
```

**Resolution priority** (both apps):
1. `<data dir>/prompts.json` if present and valid JSON with the required top-level keys.
2. Baked-in defaults inside the app's generator module. Missing per-persona entries fall back per-key, not all-or-nothing.

**Reset semantics:** `prompts.json` is NOT in the Electron `reset-account-data` target list. It survives resets, like `lm_studio.json`.

### 3. Documents as post anchors

**Asset discovery (both apps):**

| Path | Kind | Extensions | Notes |
|---|---|---|---|
| `data/assets/recent_images/` | image | `.jpg .jpeg .png .webp .gif .avif` | exclude `profile.jpg` |
| `data/assets/screenshots/`   | image | same | |
| `data/assets/docs/`          | document | `.pdf .txt .md .py .js .ts .css` | exclude `.html` and `.htm` |

All extensions are matched case-insensitively. Symlinks and non-files are ignored.

**Candidate pool:** one flat list combining images and documents from all three directories. The cycle that decides which persona gets the asset (currently `IMAGE_PERSONA_CYCLE`) is renamed `ASSET_PERSONA_CYCLE` and operates on the merged pool.

**Dedup:** before adding a candidate to the pool, compute SHA-256 of its content. Skip if the hash is in `usedAssetHashes`. The hash IS the post's `attachedAsset.filename` (with extension appended).

**Document text extraction:**
- `.pdf` → `pdf-parse` (Node lib, ~250 KB, no native build).
- All other allowed extensions → `fs.readFile` as UTF-8.
- Normalize: collapse whitespace runs, drop form-feed and other control chars, trim.
- Clamp to **4096 characters** (the budget includes the filename and any wrapping text added in the user payload).
- On any extraction failure (encrypted PDF, non-UTF-8 file, parse exception): skip the candidate and try the next one.

**LLM input shaping per kind:**

- `kind: 'image'` — unchanged from today. System prompt is `personaPosts[persona].system + imageExtension`. User message is multi-part: text payload + `image_url` data URL.
- `kind: 'document'` — system prompt is `personaPosts[persona].system + documentExtension`. User message is text-only: the existing JSON `{user, profile}` payload, followed by a separator and the extracted document text prefixed with the filename. Single `content: string` (no multi-part).

```text
User content for documents:
  <existing JSON payload>

  --- Attached document (<sourceFilename>) ---
  <extracted text, clamped>
```

### 4. Unified post schema

Replaces `attachedImage` with `attachedAsset`. One field, one consumer code path.

```json
{
  "persona": "popularite",
  "content": "...",
  "sentiment": "positive",
  "createdAt": "2026-05-11T...",
  "attachedAsset": {
    "kind": "image",
    "filename": "<sha256>.<ext>",
    "relativePath": "public/uploads/<sha256>.<ext>",
    "url": "/uploads/<sha256>.<ext>",
    "mime": "image/jpeg",
    "visionAnalysed": true
  }
}
```

For `kind: 'document'`:
- `visionAnalysed` is omitted.
- `mime` reflects the file: `application/pdf`, `text/plain`, `text/markdown`, `text/x-python`, `application/javascript`, `application/typescript`, `text/css`.
- Same `filename`/`relativePath`/`url` semantics: SHA-256 of content + lowercased original extension.

**Backward compat (read-time only):** when reading post records, if a post has `attachedImage` and no `attachedAsset`, synthesize `attachedAsset = { kind: 'image', filename: img.filename, relativePath: img.relativePath, url: img.url, mime: <derived from ext>, visionAnalysed: img.visionAnalysed }` and drop `attachedImage`. Applies in `WebDiplome/server.js` `normalizePost` and the equivalent helper in `Diplome_/testCreationAcc/renderer/app.js`. Writes only emit `attachedAsset`.

### 5. WebDiplome UI — document rendering

`PostCard.jsx` dispatches on `attachedAsset.kind`:
- `kind: 'image'` — existing `PostImage` view, unchanged visually.
- `kind: 'document'` — new compact view: file-type icon (derived from extension), filename, and an "Open" link pointing at `attachedAsset.url`. No content preview. No iframe. The file is already served by `WebDiplome/server.js` at `/uploads/...`.

The doc view uses the same per-post persona accent color as the image view (`--post-accent`).

## Per-repo file impact

### `Diplome_/testCreationAcc`

| File | Change |
|---|---|
| `package.json` | add `pdf-parse` runtime dep |
| `data/prompts.json` | **new** — checked-in defaults, mirrors current baked-in prompts |
| `python/post_generator/PostGenerator.js` | accept `prompts` and `usedAssetHashes` params; remove local `SYSTEM_PROMPTS` / `IMAGE_POST_PROMPT_EXTENSION` constants (keep small baked-in fallback); extend asset discovery to `data/assets/docs/`; add `extractDocText(filePath)` (PDF + text); rename `pickRandomAssetImage` → `pickRandomAsset` returning `{kind, mime, base64?, text?, sourceFilename, sha256, ext}`; branch `buildChatBody` on `kind` (image=multi-part, document=text-only inlined); rename `imageAssignment` → `assetAssignment`; emit `attachedAsset` on returned posts |
| `main.js` | load `prompts.json` analogous to `lm_studio.json` (with defaults); add `fetchUsedAssetHashes()` helper that does `GET http://localhost:3001/api/profiles` → newest id → `GET /api/profile/{id}` → extracts hashes from posts; falls back to reading local `data/posts_personas.json`; pass `prompts` and `usedAssetHashes` into `generatePersonaPosts`; log when fallback path is taken |
| `renderer/app.js` | `uploadAttachedImagesForPosts` → `uploadAttachedAssetsForPosts` (same logic, ranges over `attachedAsset` and uploads the file regardless of kind via existing `POST /api/upload`); `normalizePersonaPosts` writes `attachedAsset`; legacy `attachedImage` translated on read |

### `WebDiplome`

| File | Change |
|---|---|
| `package.json` | add `pdf-parse` runtime dep |
| `server.js` | rename `normalizeAttachedImage` → `normalizeAttachedAsset`; add read-time legacy translator (`attachedImage` → `attachedAsset` with `kind: 'image'`); the existing `POST /api/upload` final-extension resolution stays as-is but uses the original filename extension before falling back to MIME, so doc extensions (`.pdf`, `.md`, …) round-trip correctly |
| `server-generate.js` | read `prompts.json` from `ELECTRON_DATA_DIR` (with baked-in fallback); extend `EXTRA_ASSET_DIRS` with `…/data/assets/docs`; `ALLOWED_EXT` set per-directory (images vs docs); generalize `pickAndImportAsset` to accept a `kind`, compute `mime` from extension, and load text for docs; pass `prompts` and `usedHashes` into `generatePersonaPosts`; `IMAGE_PERSONA_CYCLE` → `ASSET_PERSONA_CYCLE`; `mostRecentPersonaWithImage` → `mostRecentPersonaWithAsset` |
| `server/lib/personaPostGenerator.js` | accept `prompts` and `usedAssetHashes` params; remove top-level `SYSTEM_PROMPTS` / `IMAGE_POST_PROMPT_EXTENSION` (keep small baked-in fallback); branch `buildChatBody` on asset kind; rename `imageAssignment` → `assetAssignment`; emit `attachedAsset` |
| `src/features/feed/PostCard.jsx` | dispatch on `post.attachedAsset?.kind`; pass through to image or document view |
| `src/features/feed/PostImage.jsx` | unchanged in render, but reads from `attachedAsset` instead of `attachedImage` (or wrapped by the dispatch in PostCard) |
| `src/features/feed/PostDocument.jsx` | **new** — small card with icon + filename + "Open" link to `attachedAsset.url`; styled with `--post-accent` |
| `src/styles/*.css` | add doc-card styles next to existing post-image styles |

## Data flow (after change)

```
1. WebDiplome web user clicks "Generate":
   POST :3010/api/posts/generate
     → read prompts.json (from ELECTRON_DATA_DIR)
     → read own posts/{id}.json (canonical history)
     → build usedHashes from attachedAsset.filename
     → walk EXTRA_ASSET_DIRS (images + docs), filter by ALLOWED_EXT per dir
     → pickAndImportAsset(candidates, usedHashes)
         → SHA-256 content
         → if kind=image: base64 for vision
         → if kind=document: extract text (pdf-parse or utf-8 read), clamp 4096
         → copy file into public/uploads/{hash}.{ext}
     → call LM Studio (one persona gets asset attached)
     → write three posts (one with attachedAsset) into posts/{id}.json

2. Electron user clicks "Update" or "Generate":
   main.js generate-persona-posts handler
     → read prompts.json (from DATA_DIR)
     → fetchUsedAssetHashes() — HTTP GET to :3001/api/profile/{id}
                              | fallback: local data/posts_personas.json
     → walk asset dirs (images + docs)
     → PostGenerator.pickRandomAsset(usedHashes)
         → SHA-256, build {kind, mime, base64/text, sourceFilename, sha256, ext}
     → call LM Studio (one persona gets asset attached)
     → return posts (with attachedAsset placeholder pointing at relativePath)
   renderer/app.js syncProfileToWebDiplome:
     → uploadAttachedAssetsForPosts: for each post.attachedAsset,
       POST /api/upload (server.js dedupes by SHA-256, returns canonical /uploads/{hash}.{ext})
       → splice url back into post.attachedAsset.url
     → POST /api/profile (server.js wipes prior posts, writes new union)
```

## Error handling

- **WebDiplome offline during Electron pre-generation:** swallow the fetch error, log once, fall back to local `posts_personas.json`. Generation proceeds.
- **`prompts.json` missing or malformed:** log once, use baked-in defaults. Per-key fallback so partial files still partially apply.
- **PDF parse exception / non-UTF-8 doc / empty file:** skip candidate, try next. If the entire pool is exhausted, no asset is attached this round (existing behavior when the pool is empty).
- **`POST /api/upload` failure during sync:** keep the post but leave `attachedAsset.url` empty; UI gracefully degrades to no media. Same as today's image upload failure path.
- **LM Studio rejects multi-part content (vision unsupported):** existing fallback path applies for images; documents are text-only so this concern doesn't apply to them.

## Testing approach

Manual end-to-end since the existing pipeline has no automated tests:

1. **Image dedup across apps:** clear `posts/{id}.json` and `posts_personas.json`. Generate from web until two posts each have an image. Verify two distinct hashes. Then generate from Electron; verify the new posts pick a third distinct image (or none if pool exhausted) and don't reuse either of the first two.
2. **Prompt centralization:** edit `prompts.json` to change `personaPosts.productivite.system`. Trigger generation from each app independently. Verify both reflect the new prompt (compare against console-logged system prompts).
3. **Document attachment:** drop a `.md` and a `.pdf` into `data/assets/docs/`. Generate multiple rounds. Verify at least one post lands a document (`attachedAsset.kind === 'document'`), the file is uploaded to `public/uploads/`, and the WebDiplome UI renders a doc card with an "Open" link that downloads the file.
4. **HTML exclusion:** drop a `test.html` into `data/assets/docs/`. Generate many rounds. Verify it is never picked.
5. **Backward compat:** preserve an existing `posts/{id}.json` containing `attachedImage` entries. Load the WebDiplome UI; verify images still render. Generate a new round; verify only new posts have `attachedAsset` and old ones still display.
6. **Reset survival:** trigger `reset-account-data` from Electron; verify `prompts.json` and `lm_studio.json` are still present.

## Open risks

- **`pdf-parse` quirks:** the package logs to stderr on certain malformed PDFs and occasionally hangs on encrypted ones. Wrap with a try/catch and a per-file timeout (e.g., 3s) to prevent generation from stalling on one bad PDF.
- **Concurrent generation:** if Electron and WebDiplome both generate at the same time, they may pick the same asset (each sees the other's pre-state). Acceptable: the second sync wins; one duplicate may slip through occasionally. Not worth solving with locking at this stage.
- **Packaged Electron app data dir mismatch:** WebDiplome's `ELECTRON_DATA_DIR` is the dev-tree path. When the Electron app is packaged, it writes to `~/Library/Application Support/profil-citoyen/data/`. WebDiplome would not see the packaged app's prompts/data without updating the path. This is a pre-existing limitation, not introduced by this change, but worth noting.
