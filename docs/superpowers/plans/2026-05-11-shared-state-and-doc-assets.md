# Shared State & Document Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate cross-repo drift in three places at once — shared "used assets" state, persona prompts, and asset post-anchoring (extend from images to documents).

**Architecture:** Electron reads WebDiplome's `posts/{id}.json` over HTTP before generating, so both apps converge on the same SHA-256-keyed used-assets set. Persona prompts move to `Electron/data/prompts.json`, read by both generators. Post pipeline accepts documents (PDF + text formats, no HTML) from `data/assets/docs/` alongside images, unified under an `attachedAsset` schema with a `kind: 'image' | 'document'` discriminator. Legacy `attachedImage` is translated on read; writes only emit `attachedAsset`.

**Tech Stack:** Node 20+, Express 5, ESM (WebDiplome) / CommonJS (Electron), React 18, vitest (WebDiplome only). New deps: `pdf-parse` in both repos.

**Spec:** [docs/superpowers/specs/2026-05-11-shared-state-and-doc-assets-design.md](../specs/2026-05-11-shared-state-and-doc-assets-design.md)

**Repos involved (paths are absolute and pinned):**
- `WebDiplome`: `/Users/brikeld/Documents/Repo/WebDiplome` (this repo)
- `Electron`: `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc` (sibling)

**Conventions used in this plan:**
- File paths are repo-relative; the repo is named in the task header.
- Each task ends in one git commit in the repo it touched. Cross-repo tasks (rare) commit in both, named with the repo prefix.
- Unit tests only where there's pure logic worth pinning down (prompts loader, attachedAsset translator, doc-text extractor). Wiring is verified by manual smoke tests with concrete commands.
- For Electron's CommonJS helpers, no unit tests — Electron has no test infra and adding it is out of scope. Verification is console output + file inspection.
- Smoke tests assume `npm run servers` and `npm run dev` running in WebDiplome, and `npm start` running in Electron. State for tests is reset between tasks by deleting `posts/*.json` and `profiles/*.json` in WebDiplome.

---

## File map (locked in this plan)

**WebDiplome (`/Users/brikeld/Documents/Repo/WebDiplome`):**
```
package.json                                       (add pdf-parse, add test script + vitest config)
vitest.config.js                                   NEW — minimal config
tests/
├── attachedAsset.test.js                          NEW — normalization helper unit tests
├── promptsLoader.test.js                          NEW — load + fallback unit tests
└── docText.test.js                                NEW — extractDocText unit tests
server.js                                          attachedImage → attachedAsset normalization + legacy translator
server-generate.js                                 load prompts.json; extend EXTRA_ASSET_DIRS with docs; per-dir allowed exts; pickAndImportAsset returns {kind, …}; emit attachedAsset
server/lib/personaPostGenerator.js                 accept prompts + usedAssetHashes params; remove top-level constants (keep small bakedin fallback); branch buildChatBody on kind; rename imageAssignment → assetAssignment; emit attachedAsset
server/lib/prompts.js                              NEW — loadPrompts(dataDir): JSON + fallback
server/lib/attachedAsset.js                        NEW — normalizeAttachedAsset, translateLegacyImage, mimeFromExt
server/lib/docText.js                              NEW — extractDocText(buf, ext): pdf-parse for .pdf, utf8 otherwise; clamp 4096
src/features/feed/PostCard.jsx                     dispatch on attachedAsset.kind
src/features/feed/PostImage.jsx                    read from attachedAsset (kind=image)
src/features/feed/PostDocument.jsx                 NEW — file-icon + filename + Open link
src/styles/postImage.css                           add postDocument styles (or new file)
```

**Electron (`/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc`):**
```
package.json                                       (add pdf-parse)
data/prompts.json                                  NEW — checked-in defaults
python/post_generator/PostGenerator.js             accept prompts + usedAssetHashes params; extend asset discovery to data/assets/docs; add extractDocText; rename pickRandomAssetImage → pickRandomAsset; branch buildChatBody on kind; emit attachedAsset
main.js                                            load prompts.json; add fetchUsedAssetHashes() helper; pass prompts + usedAssetHashes into generatePersonaPosts
renderer/app.js                                    uploadAttachedImagesForPosts → uploadAttachedAssetsForPosts; normalizePersonaPosts emits attachedAsset; translate legacy attachedImage on read
```

---

## Phase 0 — Test infrastructure (WebDiplome)

### Task 1: Wire vitest into WebDiplome's npm scripts

**Repo:** WebDiplome
**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`

- [ ] **Step 1: Add vitest config**

Create `vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
```

- [ ] **Step 2: Add test script + pdf-parse dep**

Edit `package.json`. Add to `scripts`: `"test": "vitest run"`. Add to `dependencies`: `"pdf-parse": "^1.1.1"`. Run:

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
npm install pdf-parse@^1.1.1
```

Expected: `pdf-parse` added; lockfile updated.

- [ ] **Step 3: Verify vitest runs (no tests yet)**

Run:
```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
npm test
```

Expected: vitest reports "No test files found" but exits 0. If exit ≠ 0, vitest config is wrong.

- [ ] **Step 4: Commit**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
git add package.json package-lock.json vitest.config.js
git commit -m "chore: wire vitest + add pdf-parse dep"
```

---

## Phase 1 — Prompts centralization

### Task 2: Create `data/prompts.json` defaults file (Electron)

**Repo:** Electron
**Files:**
- Create: `data/prompts.json`

- [ ] **Step 1: Write `data/prompts.json`**

Mirror the current baked-in prompts in `python/post_generator/PostGenerator.js`. Create exactly:

```json
{
  "personaPosts": {
    "productivite": {
      "system": "You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) about something from their workflow or productivity. Sound like a human: a bit self-aware, natural rhythm, maybe slightly ironic or proud. No hashtags. No motivational-speaker tone.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
      "temperature": 0.7,
      "maxTokens": 900
    },
    "popularite": {
      "system": "You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) about their online presence or social life. Sound like a human: genuine, maybe a little playful or self-deprecating. No hashtags. No hype-machine tone.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
      "temperature": 0.7,
      "maxTokens": 900
    },
    "securite": {
      "system": "You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) touching on their digital life or data habits. Sound like a human: honest, maybe a touch anxious or relieved. No hashtags. No security-textbook tone.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
      "temperature": 0.7,
      "maxTokens": 900
    }
  },
  "imageExtension": "\n\nAn image from the user's files is attached. Write the post as if the user is sharing or reacting to this image — describe what you see in a natural way, integrate it into the post voice. The post should feel like a genuine image caption or reaction.",
  "documentExtension": "\n\nA document from the user's files is attached. Its filename and a text excerpt of its contents are included below the JSON. Write the post as if the user is referencing or reacting to this document — incorporate something concrete from the excerpt (a phrase, a fact, a vibe) without quoting it verbatim. The post should feel like a genuine reference to something they were working on.",
  "userSummary": {
    "system": "You profile digital citizens from system data. Read the JSON (user + profile). Write ONE short introduction in French (max 140 characters) describing observable digital habits/tools — factual, no moral judgment.\nReturn ONLY valid JSON: {\"description\":\"...\"}. No markdown, no line breaks in the string. /no_think",
    "temperature": 0.55,
    "maxTokens": 900
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc
git add data/prompts.json
git commit -m "feat(prompts): add data/prompts.json with current prompts as defaults"
```

---

### Task 3: WebDiplome — `loadPrompts` module + unit tests

**Repo:** WebDiplome
**Files:**
- Create: `server/lib/prompts.js`
- Create: `tests/promptsLoader.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/promptsLoader.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { loadPrompts, DEFAULT_PROMPTS } from '../server/lib/prompts.js';

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prompts-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('loadPrompts', () => {
  it('returns DEFAULT_PROMPTS when prompts.json is missing', async () => {
    const p = await loadPrompts(tmpDir);
    expect(p).toEqual(DEFAULT_PROMPTS);
  });

  it('returns DEFAULT_PROMPTS when prompts.json is malformed JSON', async () => {
    await fs.writeFile(path.join(tmpDir, 'prompts.json'), '{ not json', 'utf8');
    const p = await loadPrompts(tmpDir);
    expect(p).toEqual(DEFAULT_PROMPTS);
  });

  it('merges partial overrides per-key', async () => {
    const partial = {
      personaPosts: {
        productivite: { system: 'override-prod', temperature: 0.9, maxTokens: 100 },
      },
    };
    await fs.writeFile(path.join(tmpDir, 'prompts.json'), JSON.stringify(partial), 'utf8');
    const p = await loadPrompts(tmpDir);
    expect(p.personaPosts.productivite.system).toBe('override-prod');
    expect(p.personaPosts.popularite.system).toBe(DEFAULT_PROMPTS.personaPosts.popularite.system);
    expect(p.imageExtension).toBe(DEFAULT_PROMPTS.imageExtension);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd /Users/brikeld/Documents/Repo/WebDiplome && npm test -- promptsLoader`

Expected: FAIL with `Cannot find module … server/lib/prompts.js`.

- [ ] **Step 3: Implement `server/lib/prompts.js`**

Create `server/lib/prompts.js`:
```js
import { promises as fs } from 'fs';
import path from 'path';

export const DEFAULT_PROMPTS = {
  personaPosts: {
    productivite: {
      system:
        'You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) about something from their workflow or productivity. Sound like a human: a bit self-aware, natural rhythm, maybe slightly ironic or proud. No hashtags. No motivational-speaker tone.\nReturn ONLY valid JSON: {"content":"...","sentiment":"positive"|"negative"}. /no_think',
      temperature: 0.7,
      maxTokens: 900,
    },
    popularite: {
      system:
        'You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) about their online presence or social life. Sound like a human: genuine, maybe a little playful or self-deprecating. No hashtags. No hype-machine tone.\nReturn ONLY valid JSON: {"content":"...","sentiment":"positive"|"negative"}. /no_think',
      temperature: 0.7,
      maxTokens: 900,
    },
    securite: {
      system:
        'You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) touching on their digital life or data habits. Sound like a human: honest, maybe a touch anxious or relieved. No hashtags. No security-textbook tone.\nReturn ONLY valid JSON: {"content":"...","sentiment":"positive"|"negative"}. /no_think',
      temperature: 0.7,
      maxTokens: 900,
    },
  },
  imageExtension:
    "\n\nAn image from the user's files is attached. Write the post as if the user is sharing or reacting to this image — describe what you see in a natural way, integrate it into the post voice. The post should feel like a genuine image caption or reaction.",
  documentExtension:
    "\n\nA document from the user's files is attached. Its filename and a text excerpt of its contents are included below the JSON. Write the post as if the user is referencing or reacting to this document — incorporate something concrete from the excerpt (a phrase, a fact, a vibe) without quoting it verbatim. The post should feel like a genuine reference to something they were working on.",
  userSummary: {
    system:
      'You profile digital citizens from system data. Read the JSON (user + profile). Write ONE short introduction in French (max 140 characters) describing observable digital habits/tools — factual, no moral judgment.\nReturn ONLY valid JSON: {"description":"..."}. No markdown, no line breaks in the string. /no_think',
    temperature: 0.55,
    maxTokens: 900,
  },
};

function mergePersonaPosts(defaults, override) {
  const out = {};
  for (const key of Object.keys(defaults)) {
    const o = override?.[key];
    out[key] = {
      system: typeof o?.system === 'string' && o.system ? o.system : defaults[key].system,
      temperature: typeof o?.temperature === 'number' ? o.temperature : defaults[key].temperature,
      maxTokens: typeof o?.maxTokens === 'number' ? o.maxTokens : defaults[key].maxTokens,
    };
  }
  return out;
}

function mergeUserSummary(defaults, override) {
  const o = override || {};
  return {
    system: typeof o.system === 'string' && o.system ? o.system : defaults.system,
    temperature: typeof o.temperature === 'number' ? o.temperature : defaults.temperature,
    maxTokens: typeof o.maxTokens === 'number' ? o.maxTokens : defaults.maxTokens,
  };
}

export async function loadPrompts(dataDir) {
  try {
    const raw = await fs.readFile(path.join(dataDir, 'prompts.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      personaPosts: mergePersonaPosts(DEFAULT_PROMPTS.personaPosts, parsed?.personaPosts),
      imageExtension:
        typeof parsed?.imageExtension === 'string' && parsed.imageExtension
          ? parsed.imageExtension
          : DEFAULT_PROMPTS.imageExtension,
      documentExtension:
        typeof parsed?.documentExtension === 'string' && parsed.documentExtension
          ? parsed.documentExtension
          : DEFAULT_PROMPTS.documentExtension,
      userSummary: mergeUserSummary(DEFAULT_PROMPTS.userSummary, parsed?.userSummary),
    };
  } catch {
    return DEFAULT_PROMPTS;
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd /Users/brikeld/Documents/Repo/WebDiplome && npm test -- promptsLoader`

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
git add server/lib/prompts.js tests/promptsLoader.test.js
git commit -m "feat(prompts): add loadPrompts module with per-key fallback"
```

---

### Task 4: WebDiplome — wire `loadPrompts` into the generator

**Repo:** WebDiplome
**Files:**
- Modify: `server-generate.js`
- Modify: `server/lib/personaPostGenerator.js`

- [ ] **Step 1: Change `personaPostGenerator.js` to accept `prompts` param**

In `server/lib/personaPostGenerator.js`, replace the top-level constants and `generatePersonaPosts` signature.

Replace the `SYSTEM_PROMPTS` and `IMAGE_POST_PROMPT_EXTENSION` constants with a hardcoded minimal fallback only used if `prompts` is null/undefined (defensive):

```js
const FALLBACK_PROMPTS = {
  personaPosts: {
    productivite: { system: '', temperature: 0.7, maxTokens: 900 },
    popularite: { system: '', temperature: 0.7, maxTokens: 900 },
    securite: { system: '', temperature: 0.7, maxTokens: 900 },
  },
  imageExtension: '',
  documentExtension: '',
};
```

Change `generatePersonaPosts({ baseUrl, model, userPayload, timeoutMs, retries, imageAssignment })` to also accept `prompts`. Inside, use `prompts ?? FALLBACK_PROMPTS`. Replace every reference to `SYSTEM_PROMPTS` with `prompts.personaPosts` (e.g. `prompts.personaPosts[key].system`). Replace `IMAGE_POST_PROMPT_EXTENSION` with `prompts.imageExtension`. Use `prompts.personaPosts[key].temperature` and `…maxTokens` where literal `0.7` / `900` / `1` appears for runOnce-vision and runOnce-text calls.

Pull all temperature/maxTokens reads from `prompts.personaPosts[key]` (do NOT use any other literal temperature here).

- [ ] **Step 2: Wire `loadPrompts` into `server-generate.js`**

Edit `server-generate.js`. Add import at top:
```js
import { loadPrompts } from './server/lib/prompts.js';
```

Inside the `POST /api/posts/generate` handler, after `await readLmStudioConfig()` and before `generatePersonaPosts(...)`, load prompts:
```js
const prompts = await loadPrompts(ELECTRON_DATA_DIR);
```

Add `prompts` to the `generatePersonaPosts({ ... })` call.

- [ ] **Step 3: Smoke test — generation still works**

Start servers and confirm a generation still produces three posts:
```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
npm run servers &
# Wait a few seconds
curl -sX POST http://localhost:3010/api/posts/generate -H 'Content-Type: application/json' -d '{}' | head -c 500
```

Expected: JSON with `"success": true` and `posts: [...]` (3 items). If LM Studio isn't reachable, the failure mode should be a graceful 500 — not a crash from undefined `prompts`.

- [ ] **Step 4: Smoke test — override via prompts.json**

Temporarily edit `Electron/data/prompts.json` to change `personaPosts.productivite.system` to a short string like `"Reply with the JSON {\"content\":\"PROD-OVERRIDE-MARKER\",\"sentiment\":\"positive\"}. /no_think"`. Re-run the curl. The productivite post's content should be `PROD-OVERRIDE-MARKER` (or close — model may vary slightly). Revert the change after.

- [ ] **Step 5: Commit**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
git add server-generate.js server/lib/personaPostGenerator.js
git commit -m "feat(prompts): personaPostGenerator reads prompts from data/prompts.json"
```

---

### Task 5: Electron — wire prompts loading into PostGenerator.js + main.js

**Repo:** Electron
**Files:**
- Modify: `python/post_generator/PostGenerator.js`
- Modify: `main.js`

- [ ] **Step 1: Add `loadPromptsSync` helper to `PostGenerator.js`**

In `python/post_generator/PostGenerator.js`, add near the top (after the requires):

```js
const FALLBACK_PROMPTS = {
  personaPosts: {
    productivite: {
      system: SYSTEM_PROMPTS.productivite,
      temperature: 0.7,
      maxTokens: 900,
    },
    popularite: {
      system: SYSTEM_PROMPTS.popularite,
      temperature: 0.7,
      maxTokens: 900,
    },
    securite: {
      system: SYSTEM_PROMPTS.securite,
      temperature: 0.7,
      maxTokens: 900,
    },
  },
  imageExtension: IMAGE_POST_PROMPT_EXTENSION,
  documentExtension:
    "\n\nA document from the user's files is attached. Its filename and a text excerpt of its contents are included below the JSON. Write the post as if the user is referencing or reacting to this document — incorporate something concrete from the excerpt (a phrase, a fact, a vibe) without quoting it verbatim. The post should feel like a genuine reference to something they were working on.",
  userSummary: {
    system: SYSTEM_PROMPT_USER_SUMMARY,
    temperature: 0.55,
    maxTokens: 900,
  },
};

function loadPromptsSync(dataDir) {
  try {
    const raw = fs.readFileSync(path.join(dataDir, 'prompts.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const merge = (def, ov) => ({
      system: typeof ov?.system === 'string' && ov.system ? ov.system : def.system,
      temperature: typeof ov?.temperature === 'number' ? ov.temperature : def.temperature,
      maxTokens: typeof ov?.maxTokens === 'number' ? ov.maxTokens : def.maxTokens,
    });
    return {
      personaPosts: {
        productivite: merge(FALLBACK_PROMPTS.personaPosts.productivite, parsed?.personaPosts?.productivite),
        popularite: merge(FALLBACK_PROMPTS.personaPosts.popularite, parsed?.personaPosts?.popularite),
        securite: merge(FALLBACK_PROMPTS.personaPosts.securite, parsed?.personaPosts?.securite),
      },
      imageExtension:
        typeof parsed?.imageExtension === 'string' && parsed.imageExtension
          ? parsed.imageExtension
          : FALLBACK_PROMPTS.imageExtension,
      documentExtension:
        typeof parsed?.documentExtension === 'string' && parsed.documentExtension
          ? parsed.documentExtension
          : FALLBACK_PROMPTS.documentExtension,
      userSummary: merge(FALLBACK_PROMPTS.userSummary, parsed?.userSummary),
    };
  } catch {
    return FALLBACK_PROMPTS;
  }
}

module.exports.loadPromptsSync = loadPromptsSync;
```

(Keep the old `SYSTEM_PROMPTS` / `IMAGE_POST_PROMPT_EXTENSION` / `SYSTEM_PROMPT_USER_SUMMARY` constants in place during this task — they are still referenced; we wire `prompts` through next.)

- [ ] **Step 2: Change `generatePersonaPosts` and `generateUserSummary` to accept `prompts`**

In `python/post_generator/PostGenerator.js`, change the exported `generatePersonaPosts` signature to accept `prompts`:
```js
async function generatePersonaPosts({ baseUrl, model, userPayload, timeoutMs, retries, dataDir, prompts }) {
```

Inside, set `const P = prompts ?? FALLBACK_PROMPTS;`. Replace `SYSTEM_PROMPTS[key]` with `P.personaPosts[key].system`. Replace `IMAGE_POST_PROMPT_EXTENSION` with `P.imageExtension`. Replace the hard-coded `temperature` and `max_tokens` values in `runOnce(...)` and the `buildChatBody({ ... })` call sites with `P.personaPosts[key].temperature` and `P.personaPosts[key].maxTokens`.

Change `generateUserSummary` similarly: accept `prompts`, use `P.userSummary.system / .temperature / .maxTokens`.

- [ ] **Step 3: Wire prompts in `main.js`**

In `main.js`, near the top imports, add:
```js
const { loadPromptsSync } = require("./python/post_generator/PostGenerator");
```

(or add `loadPromptsSync` to the existing destructured require statement.)

Inside `app.whenReady().then(() => { ... })`, after `lmStudioBaseUrl` is finalized (i.e., after the `try { … lm_studio.json … }` block, around line 92), load prompts:
```js
const promptsConfig = loadPromptsSync(DATA_DIR);
```

In `ipcMain.handle("generate-user-summary", ...)`, pass `prompts: promptsConfig` into `generateUserSummary({ ... })`.

In `ipcMain.handle("generate-persona-posts", ...)`, pass `prompts: promptsConfig` into `generatePersonaPosts({ ... })`.

- [ ] **Step 4: Smoke test — Electron generation still works**

```bash
cd /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc
npm start
```

In the Electron app: complete onboarding (or click "Update"). When LM Studio is reached, confirm three persona posts appear and `data/posts_personas.json` is written. Now edit `data/prompts.json` `personaPosts.productivite.system` to a marker prompt as in Task 4 Step 4; trigger generation again; verify the productivite post reflects the override. Revert.

- [ ] **Step 5: Commit**

```bash
cd /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc
git add main.js python/post_generator/PostGenerator.js
git commit -m "feat(prompts): PostGenerator reads prompts from data/prompts.json"
```

---

## Phase 2 — Unified `attachedAsset` schema (read-time legacy translator first)

### Task 6: WebDiplome — `attachedAsset` normalizer with legacy-image translator

**Repo:** WebDiplome
**Files:**
- Create: `server/lib/attachedAsset.js`
- Create: `tests/attachedAsset.test.js`
- Modify: `server.js`

- [ ] **Step 1: Write failing tests**

Create `tests/attachedAsset.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  normalizeAttachedAsset,
  translateLegacyImage,
  mimeFromExt,
} from '../server/lib/attachedAsset.js';

describe('mimeFromExt', () => {
  it('maps known image extensions', () => {
    expect(mimeFromExt('.jpg')).toBe('image/jpeg');
    expect(mimeFromExt('.PNG')).toBe('image/png');
    expect(mimeFromExt('.webp')).toBe('image/webp');
  });
  it('maps known document extensions', () => {
    expect(mimeFromExt('.pdf')).toBe('application/pdf');
    expect(mimeFromExt('.md')).toBe('text/markdown');
    expect(mimeFromExt('.txt')).toBe('text/plain');
    expect(mimeFromExt('.py')).toBe('text/x-python');
    expect(mimeFromExt('.js')).toBe('application/javascript');
    expect(mimeFromExt('.ts')).toBe('application/typescript');
    expect(mimeFromExt('.css')).toBe('text/css');
  });
  it('falls back to octet-stream for unknown extensions', () => {
    expect(mimeFromExt('.zzz')).toBe('application/octet-stream');
  });
});

describe('translateLegacyImage', () => {
  it('returns null when input is null/undefined', () => {
    expect(translateLegacyImage(null)).toBeNull();
    expect(translateLegacyImage(undefined)).toBeNull();
  });
  it('translates legacy attachedImage to attachedAsset with kind=image', () => {
    const legacy = {
      filename: 'abc.jpg',
      relativePath: 'public/uploads/abc.jpg',
      url: '/uploads/abc.jpg',
      visionAnalysed: true,
    };
    const out = translateLegacyImage(legacy);
    expect(out).toEqual({
      kind: 'image',
      filename: 'abc.jpg',
      relativePath: 'public/uploads/abc.jpg',
      url: '/uploads/abc.jpg',
      mime: 'image/jpeg',
      visionAnalysed: true,
    });
  });
});

describe('normalizeAttachedAsset', () => {
  it('returns null for null/empty input', () => {
    expect(normalizeAttachedAsset(null)).toBeNull();
    expect(normalizeAttachedAsset({})).toBeNull();
  });
  it('passes through a well-formed image asset', () => {
    const a = {
      kind: 'image',
      filename: 'h.jpg',
      relativePath: 'public/uploads/h.jpg',
      url: '/uploads/h.jpg',
      mime: 'image/jpeg',
      visionAnalysed: false,
    };
    expect(normalizeAttachedAsset(a)).toEqual(a);
  });
  it('passes through a well-formed document asset (no visionAnalysed)', () => {
    const a = {
      kind: 'document',
      filename: 'h.pdf',
      relativePath: 'public/uploads/h.pdf',
      url: '/uploads/h.pdf',
      mime: 'application/pdf',
    };
    expect(normalizeAttachedAsset(a)).toEqual(a);
  });
  it('accepts snake_case keys', () => {
    const out = normalizeAttachedAsset({
      kind: 'image',
      filename: 'x.png',
      relative_path: 'public/uploads/x.png',
      url: '/uploads/x.png',
      mime: 'image/png',
      vision_analysed: true,
    });
    expect(out.relativePath).toBe('public/uploads/x.png');
    expect(out.visionAnalysed).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd /Users/brikeld/Documents/Repo/WebDiplome && npm test -- attachedAsset`

Expected: FAIL with `Cannot find module … server/lib/attachedAsset.js`.

- [ ] **Step 3: Implement `server/lib/attachedAsset.js`**

```js
const EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.py': 'text/x-python',
  '.js': 'application/javascript',
  '.ts': 'application/typescript',
  '.css': 'text/css',
};

export function mimeFromExt(ext) {
  const e = String(ext || '').toLowerCase();
  return EXT_TO_MIME[e] || 'application/octet-stream';
}

function extFromFilename(filename) {
  const f = String(filename || '');
  const i = f.lastIndexOf('.');
  return i >= 0 ? f.slice(i).toLowerCase() : '';
}

export function translateLegacyImage(legacy) {
  if (!legacy || typeof legacy !== 'object') return null;
  const filename = legacy.filename ?? legacy.fileName ?? legacy.file_name ?? null;
  if (!filename) return null;
  const relativePath = legacy.relativePath ?? legacy.relative_path ?? null;
  const url = legacy.url ?? legacy.imageUrl ?? legacy.image_url ?? null;
  const visionAnalysed =
    legacy.visionAnalysed ??
    legacy.vision_analysed ??
    legacy.visionAnalyzed ??
    legacy.vision_analyzed ??
    null;
  return {
    kind: 'image',
    filename,
    relativePath,
    url,
    mime: mimeFromExt(extFromFilename(filename)),
    visionAnalysed,
  };
}

export function normalizeAttachedAsset(asset) {
  if (!asset || typeof asset !== 'object') return null;
  const kind = asset.kind === 'document' ? 'document' : asset.kind === 'image' ? 'image' : null;
  if (!kind) return null;
  const filename = asset.filename ?? asset.fileName ?? asset.file_name ?? null;
  if (!filename) return null;
  const relativePath = asset.relativePath ?? asset.relative_path ?? null;
  const url = asset.url ?? null;
  const mime = asset.mime ?? mimeFromExt(extFromFilename(filename));
  const out = { kind, filename, relativePath, url, mime };
  if (kind === 'image') {
    out.visionAnalysed =
      asset.visionAnalysed ??
      asset.vision_analysed ??
      asset.visionAnalyzed ??
      asset.vision_analyzed ??
      null;
  }
  return out;
}
```

- [ ] **Step 4: Verify tests pass**

Run: `cd /Users/brikeld/Documents/Repo/WebDiplome && npm test -- attachedAsset`

Expected: all 9 tests pass.

- [ ] **Step 5: Wire into `server.js`**

In `server.js`, near the top, add:
```js
import { normalizeAttachedAsset, translateLegacyImage } from './server/lib/attachedAsset.js';
```

Replace the inline `normalizeAttachedImage` helper inside `writePostsForId` and the `normalizePost` function with the new logic. Replace the existing `writePostsForId`/`normalizePost` body with:

```js
const normalizePost = (p) => {
  if (!p || typeof p !== 'object') return p;
  const out = { ...p };

  // Prefer explicit attachedAsset; otherwise translate legacy attachedImage.
  if (out.attachedAsset || out.attached_asset) {
    out.attachedAsset = normalizeAttachedAsset(out.attachedAsset ?? out.attached_asset);
    if (!out.attachedAsset) delete out.attachedAsset;
  } else if (out.attachedImage || out.attached_image) {
    out.attachedAsset = translateLegacyImage(out.attachedImage ?? out.attached_image);
    if (!out.attachedAsset) delete out.attachedAsset;
  }

  delete out.attached_image;
  delete out.attachedImage;
  delete out.attached_asset;
  return out;
};
```

`writePostsForId` keeps its loop body but calls the new `normalizePost`.

In `readPostsForId`, after parsing, **also map through `normalizePost`** so legacy posts on disk get translated on read:
```js
return Array.isArray(data) ? data.map(normalizePost) : [];
```

- [ ] **Step 6: Smoke test — legacy posts still render via API**

Make sure `posts/brikeld-hoxha.json` (or whatever profile exists) has at least one post with `attachedImage`. (If not, restore the pre-change file from git.)

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
npm run server &
curl -s http://localhost:3001/api/profiles | head -c 2000
```

Expected: in the JSON response, posts that previously had `attachedImage` now have `attachedAsset: {kind: "image", ...}` and no `attachedImage`.

- [ ] **Step 7: Commit**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
git add server.js server/lib/attachedAsset.js tests/attachedAsset.test.js
git commit -m "feat(asset): unified attachedAsset schema with legacy translator on read"
```

---

### Task 7: WebDiplome — UI dispatches on `attachedAsset.kind`

**Repo:** WebDiplome
**Files:**
- Modify: `src/features/feed/PostCard.jsx`
- Modify: `src/features/feed/PostImage.jsx`

- [ ] **Step 1: Read both files first**

```bash
cat /Users/brikeld/Documents/Repo/WebDiplome/src/features/feed/PostCard.jsx
cat /Users/brikeld/Documents/Repo/WebDiplome/src/features/feed/PostImage.jsx
```

Note the prop name currently passed to `<PostImage … />` (likely `attachedImage`). The change is mechanical: replace consumption of `post.attachedImage` with `post.attachedAsset` and gate on `attachedAsset.kind === 'image'`.

- [ ] **Step 2: Edit `PostCard.jsx`**

Replace any `post.attachedImage` reference with this dispatch (preserving the existing prop-passing pattern — adjust to whatever wrapper element the file uses):

```jsx
{post.attachedAsset?.kind === 'image' && (
  <PostImage asset={post.attachedAsset} /* …other existing props */ />
)}
```

Document branch comes in Task 16 — don't add it yet.

- [ ] **Step 3: Edit `PostImage.jsx`**

Change the props destructure from `attachedImage` → `asset`. Internal references like `attachedImage.url` become `asset.url`, `attachedImage.filename` → `asset.filename`, etc. Leave everything else (styling, animation, etc.) intact.

- [ ] **Step 4: Smoke test — UI**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
npm run servers &
npm run dev
```

Open the dev URL in a browser, navigate to the feed. The post that previously had an image should still display the image. No console errors about `attachedImage` being undefined.

- [ ] **Step 5: Commit**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
git add src/features/feed/PostCard.jsx src/features/feed/PostImage.jsx
git commit -m "feat(asset): UI dispatches on attachedAsset.kind"
```

---

### Task 8: Electron — emit `attachedAsset` from `PostGenerator.js`

**Repo:** Electron
**Files:**
- Modify: `python/post_generator/PostGenerator.js`

- [ ] **Step 1: Find the place where `attachedImage` is set on the post**

Inside `generatePersonaPosts`, in the `runPersonaPost` function, the post object is built like:
```js
const post = { persona: key, content: parsed.content, sentiment: parsed.sentiment, createdAt: new Date().toISOString() };
if (wantsImage && assetImage) {
  post.attachedImage = { filename: assetImage.filename, visionAnalysed: visionSucceeded };
}
```

Plus a separate place where `attachedImage = { filename, relativePath, ... }` gets enriched once the asset is selected.

Identify those two writes in the file (one is the placeholder set inside `runPersonaPost`, one is the upload-side enrichment in `pickRandomAssetImage`'s consumers).

- [ ] **Step 2: Change the placeholder write**

Inside `runPersonaPost`, replace the `post.attachedImage = …` block with:

```js
if (wantsImage && assetImage) {
  post.attachedAsset = {
    kind: 'image',
    filename: assetImage.filename,
    relativePath: assetImage.relativePath ?? null,
    url: null,
    mime: assetImage.mime ?? 'image/jpeg',
    visionAnalysed: visionSucceeded,
  };
}
```

(The `url` is filled in later by the renderer's upload step.)

- [ ] **Step 3: Verify nothing else still writes `attachedImage`**

```bash
grep -n "attachedImage" /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/python/post_generator/PostGenerator.js
```

Expected: zero hits (or only inside `normalizePostsFilePayload` if any — leave reads alone). If there are remaining writes, change them similarly.

- [ ] **Step 4: Update `normalizePostsFilePayload` to translate legacy on read**

`normalizePostsFilePayload` is exported and used by `main.js` for reading `posts_personas.json`. Add legacy-image → attachedAsset translation:

In `normalizePostsFilePayload` (locate the post normalization loop), wherever it currently shapes `attachedImage`, add an `attachedAsset`-first path. Concretely, inside whatever per-post normalization happens, add at the top:

```js
let attachedAsset = null;
if (p && p.attachedAsset && typeof p.attachedAsset === 'object') {
  attachedAsset = {
    kind: p.attachedAsset.kind === 'document' ? 'document' : 'image',
    filename: p.attachedAsset.filename ?? null,
    relativePath: p.attachedAsset.relativePath ?? null,
    url: p.attachedAsset.url ?? null,
    mime: p.attachedAsset.mime ?? null,
    ...(p.attachedAsset.kind === 'image'
      ? { visionAnalysed: !!p.attachedAsset.visionAnalysed }
      : {}),
  };
} else if (p && p.attachedImage && typeof p.attachedImage === 'object') {
  attachedAsset = {
    kind: 'image',
    filename: p.attachedImage.filename ?? null,
    relativePath: p.attachedImage.relativePath ?? null,
    url: p.attachedImage.url ?? null,
    mime: 'image/jpeg',
    visionAnalysed: !!p.attachedImage.visionAnalysed,
  };
}
```

Then the returned per-post object includes `attachedAsset` and drops `attachedImage`.

- [ ] **Step 5: Smoke test — generation produces `attachedAsset`**

```bash
cd /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc
npm start
```

Trigger generation. Inspect `data/posts_personas.json`. Expected: one of the three posts has `attachedAsset: { kind: "image", filename, relativePath, url: null, mime, visionAnalysed }`. No post has `attachedImage`.

- [ ] **Step 6: Commit**

```bash
cd /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc
git add python/post_generator/PostGenerator.js
git commit -m "feat(asset): PostGenerator emits attachedAsset (kind=image)"
```

---

### Task 9: Electron — renderer uploads and syncs `attachedAsset`

**Repo:** Electron
**Files:**
- Modify: `renderer/app.js`

- [ ] **Step 1: Rename `uploadAttachedImagesForPosts` → `uploadAttachedAssetsForPosts`**

In `renderer/app.js`, find the function `uploadAttachedImagesForPosts`. Rename it and update its body to operate on `post.attachedAsset`:

```js
async function uploadOneAttachedAsset(asset) {
  if (!asset || !asset.relativePath) return null;
  if (asset.url) return asset.url;

  const file = await window.api.readDataFileBase64(asset.relativePath);
  if (!file || !file.base64) return null;

  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: file.mime || asset.mime || "application/octet-stream" });

  const form = new FormData();
  form.append("file", blob, file.filename || asset.filename || "upload");

  const resp = await fetch(WEBDIPLOME_UPLOAD_URL, { method: "POST", body: form });
  if (!resp.ok) {
    console.warn("[upload] failed", resp.status, await resp.text());
    return null;
  }
  const json = await resp.json();
  return json?.url || null;
}

async function uploadAttachedAssetsForPosts(posts) {
  if (!Array.isArray(posts)) return posts;
  const out = [];
  for (const p of posts) {
    if (!p || !p.attachedAsset) {
      out.push(p);
      continue;
    }
    try {
      const url = await uploadOneAttachedAsset(p.attachedAsset);
      if (url) {
        out.push({ ...p, attachedAsset: { ...p.attachedAsset, url } });
      } else {
        out.push(p);
      }
    } catch (e) {
      console.warn("[upload] exception", e);
      out.push(p);
    }
  }
  return out;
}
```

Remove the old `uploadOneAttachedImage` and `uploadAttachedImagesForPosts`.

- [ ] **Step 2: Update `normalizePersonaPosts` to write `attachedAsset`**

Find `normalizePersonaPosts(posts)` in `renderer/app.js`. Replace its per-post output:
```js
return posts.map((p) => ({
  persona: p.persona,
  content: p.content,
  sentiment: p.sentiment ?? null,
  createdAt: p.createdAt ?? new Date().toISOString(),
  attachedAsset: p.attachedAsset
    ? {
        kind: p.attachedAsset.kind === 'document' ? 'document' : 'image',
        filename: p.attachedAsset.filename ?? null,
        relativePath: p.attachedAsset.relativePath ?? null,
        url: p.attachedAsset.url ?? null,
        mime: p.attachedAsset.mime ?? null,
        ...(p.attachedAsset.kind !== 'document'
          ? { visionAnalysed: !!p.attachedAsset.visionAnalysed }
          : {}),
      }
    : null,
}));
```

Remove the old `attachedImage` shaping.

- [ ] **Step 3: Update the sync call site**

Find the line `generatedPosts = await uploadAttachedImagesForPosts(generatedPosts);` and rename:
```js
generatedPosts = await uploadAttachedAssetsForPosts(generatedPosts);
```

- [ ] **Step 4: Smoke test — end-to-end Electron → WebDiplome**

Ensure WebDiplome's `npm run servers` is running. In Electron, click "Update". After generation completes, inspect:
```bash
cat /Users/brikeld/Documents/Repo/WebDiplome/posts/<id>.json | head -50
```
Expected: posts contain `attachedAsset: {kind: "image", filename: "<hash>.<ext>", url: "/uploads/<hash>.<ext>", ...}`. The hash filename in `url` should exist in `WebDiplome/public/uploads/`.

Then open the WebDiplome web UI and confirm the image still renders for that post.

- [ ] **Step 5: Commit**

```bash
cd /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc
git add renderer/app.js
git commit -m "feat(asset): renderer uploads + syncs attachedAsset"
```

---

### Task 10: WebDiplome generator — emit `attachedAsset`

**Repo:** WebDiplome
**Files:**
- Modify: `server-generate.js`
- Modify: `server/lib/personaPostGenerator.js`

- [ ] **Step 1: Update `personaPostGenerator.js` post shape**

Find the place inside `runPersonaPost` that sets `post.attachedImage`. Replace with:
```js
if (wantsImage && assetImage) {
  post.attachedAsset = {
    kind: 'image',
    filename: assetImage.filename,
    relativePath: null,
    url: null,
    mime: assetImage.mime ?? 'image/jpeg',
    visionAnalysed: visionSucceeded,
  };
}
```

Rename the `imageAssignment` parameter to `assetAssignment` throughout this file (function signature, `personaIndex` derivation, `wantsImage`/`assetImage` derivation). The semantic stays "asset assignment"; only the type-tag varies. For now, only `kind: 'image'` is produced — Task 17 adds document branching.

- [ ] **Step 2: Update `server-generate.js` callsite**

In `server-generate.js`, find the block that builds `imageAssignment` and renames it to `assetAssignment`:
```js
let assetAssignment = null;
if (asset) {
  const prevPersona = mostRecentPersonaWithAsset(existing);
  const targetPersona = nextPersonaInCycle(prevPersona);
  assetAssignment = {
    persona: targetPersona,
    asset: {
      kind: 'image',
      base64: asset.base64,
      mime: asset.mime,
      filename: asset.sourceFilename,
    },
  };
}
```

Then update the `generatePersonaPosts({ ... })` call to pass `assetAssignment` instead of `imageAssignment`.

Inside `personaPostGenerator.js`, update reads: `assetAssignment.asset` instead of `imageAssignment.imageData`.

- [ ] **Step 3: Rename `mostRecentPersonaWithImage` → `mostRecentPersonaWithAsset` and `IMAGE_PERSONA_CYCLE` → `ASSET_PERSONA_CYCLE`**

In `server-generate.js`, find both. Update the function body to look for `attachedAsset?.filename` (instead of `attachedImage?.filename`):
```js
function mostRecentPersonaWithAsset(existingPosts) {
  if (!Array.isArray(existingPosts)) return null;
  for (const p of existingPosts) {
    if (!p || typeof p !== 'object') continue;
    const hasAsset = !!p.attachedAsset;
    if (!hasAsset) continue;
    const persona = String(p.persona || '').toLowerCase();
    if (ASSET_PERSONA_CYCLE.includes(persona)) return persona;
  }
  return null;
}
```

Also update `usedUploadFilenames` to read from `attachedAsset.filename`:
```js
const usedUploadFilenames = new Set(
  existing
    .map((p) =>
      p?.attachedAsset && typeof p.attachedAsset === 'object'
        ? p.attachedAsset.filename
        : null,
    )
    .filter(Boolean),
);
```

- [ ] **Step 4: Update post-write enrichment**

In `server-generate.js`, find the loop that previously enriched `post.attachedImage` with `uploadFilename/uploadRelativePath/uploadUrl`. Replace with:
```js
if (asset) {
  for (const post of posts) {
    if (post.attachedAsset) {
      post.attachedAsset = {
        ...post.attachedAsset,
        filename: asset.uploadFilename,
        relativePath: asset.uploadRelativePath,
        url: asset.uploadUrl,
      };
      break;
    }
  }
}
```

- [ ] **Step 5: Smoke test**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
# Stop and restart servers
npm run servers &
curl -sX POST http://localhost:3010/api/posts/generate -H 'Content-Type: application/json' -d '{}' | head -c 800
```

Expected: response includes 3 posts. One has `attachedAsset: {kind: "image", filename: "<hash>.<ext>", relativePath: "public/uploads/<hash>.<ext>", url: "/uploads/<hash>.<ext>", mime: "image/jpeg" | …, visionAnalysed: true|false}`. No post has `attachedImage`. Confirm the file lives at `WebDiplome/public/uploads/<hash>.<ext>`.

Then open the UI and confirm the image renders.

- [ ] **Step 6: Commit**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
git add server-generate.js server/lib/personaPostGenerator.js
git commit -m "feat(asset): generator emits attachedAsset and dedupes via attachedAsset.filename"
```

---

## Phase 3 — Cross-app dedup via HTTP

### Task 11: Electron — `fetchUsedAssetHashes` helper with fallback

**Repo:** Electron
**Files:**
- Modify: `main.js`

- [ ] **Step 1: Add the helper near the top of `main.js`**

After the requires, add:
```js
const WEBDIPLOME_BASE_URL = process.env.WEBDIPLOME_URL || "http://localhost:3001";
const USED_HASHES_FETCH_TIMEOUT_MS = parseInt(process.env.USED_HASHES_FETCH_TIMEOUT_MS || "1500", 10);

async function fetchUsedAssetHashesViaHttp() {
  const ctrlA = new AbortController();
  const ta = setTimeout(() => ctrlA.abort(), USED_HASHES_FETCH_TIMEOUT_MS);
  let id;
  try {
    const r1 = await fetch(`${WEBDIPLOME_BASE_URL}/api/profiles`, { signal: ctrlA.signal });
    if (!r1.ok) return null;
    const profiles = await r1.json();
    if (!Array.isArray(profiles) || profiles.length === 0) return new Set();
    const top = profiles[0];
    const first = (top.firstname ?? "").trim().toLowerCase();
    const last = (top.lastname ?? "").trim().toLowerCase();
    if (!first || !last) return new Set();
    id = `${first}-${last}`;
  } catch {
    return null;
  } finally {
    clearTimeout(ta);
  }
  const ctrlB = new AbortController();
  const tb = setTimeout(() => ctrlB.abort(), USED_HASHES_FETCH_TIMEOUT_MS);
  try {
    const r2 = await fetch(`${WEBDIPLOME_BASE_URL}/api/profile/${id}`, { signal: ctrlB.signal });
    if (!r2.ok) return null;
    const profile = await r2.json();
    const posts = Array.isArray(profile?.personaPosts) ? profile.personaPosts : [];
    const hashes = new Set();
    for (const p of posts) {
      const f = p?.attachedAsset?.filename;
      if (typeof f === "string" && f) hashes.add(f);
    }
    return hashes;
  } catch {
    return null;
  } finally {
    clearTimeout(tb);
  }
}

function readUsedAssetHashesFromLocalFile(dataDir) {
  try {
    const jsonPath = path.join(dataDir, "posts_personas.json");
    if (!fs.existsSync(jsonPath)) return new Set();
    const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const posts = Array.isArray(raw?.posts) ? raw.posts : Array.isArray(raw) ? raw : [];
    const hashes = new Set();
    for (const p of posts) {
      const f = p?.attachedAsset?.filename || p?.attachedImage?.filename;
      if (typeof f === "string" && f) hashes.add(f);
    }
    return hashes;
  } catch {
    return new Set();
  }
}

async function fetchUsedAssetHashes(dataDir) {
  const viaHttp = await fetchUsedAssetHashesViaHttp().catch(() => null);
  if (viaHttp instanceof Set) return viaHttp;
  console.warn("[used-assets] WebDiplome unreachable; falling back to local posts_personas.json");
  return readUsedAssetHashesFromLocalFile(dataDir);
}
```

- [ ] **Step 2: Pass hashes into `generatePersonaPosts`**

In `ipcMain.handle("generate-persona-posts", async (_, options = {}) => { ... })`, before calling `generatePersonaPosts`:

```js
const usedAssetHashes = await fetchUsedAssetHashes(DATA_DIR);
```

Add `usedAssetHashes` to the `generatePersonaPosts({ ... })` call.

- [ ] **Step 3: Smoke test — verify the HTTP call fires**

Start WebDiplome's servers and Electron. Trigger an Electron generation. In the WebDiplome server terminal, you should see two `GET /api/profiles` and `GET /api/profile/...` log lines (Express defaults — they may not log; instead grep main.js console output for the fallback warning). If WebDiplome is up, no "falling back" warning should print.

Then stop WebDiplome and trigger another Electron generation. Expected: console prints "[used-assets] WebDiplome unreachable; falling back …" and generation still succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc
git add main.js
git commit -m "feat(dedup): fetch used asset hashes from WebDiplome with local fallback"
```

---

### Task 12: Electron — `pickRandomAsset` honors `usedAssetHashes`

**Repo:** Electron
**Files:**
- Modify: `python/post_generator/PostGenerator.js`

- [ ] **Step 1: Locate `pickRandomAssetImage(dataDir)`**

This function returns a single candidate's `{filename, fullPath, relativePath, base64, mime}` or `null`. It needs to (a) compute SHA-256 of each candidate, (b) skip if hash is in `usedAssetHashes`, and (c) return the hash so the caller can use it as the `attachedAsset.filename`.

- [ ] **Step 2: Update `generatePersonaPosts` signature**

In `python/post_generator/PostGenerator.js`, change `generatePersonaPosts`:
```js
async function generatePersonaPosts({ baseUrl, model, userPayload, timeoutMs, retries, dataDir, prompts, usedAssetHashes }) {
```

Default `usedAssetHashes ??= new Set()`.

- [ ] **Step 3: Replace `pickRandomAssetImage` body with hash-aware logic**

Add `const crypto = require("crypto");` near the top of the file if not already there. Replace the body of `pickRandomAssetImage` (rename to `pickRandomAsset` even though it still returns only images in this task — Task 14 adds documents):

```js
function pickRandomAsset(dataDir, usedHashes) {
  const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
  const used = usedHashes instanceof Set ? usedHashes : new Set();
  const candidates = [];

  const recentDir = path.join(dataDir, "assets", "recent_images");
  if (fs.existsSync(recentDir)) {
    for (const f of fs.readdirSync(recentDir)) {
      if (imageExts.has(path.extname(f).toLowerCase()) && f !== "profile.jpg") {
        candidates.push({
          sourceFilename: f,
          fullPath: path.join(recentDir, f),
          relativePath: `assets/recent_images/${f}`,
        });
      }
    }
  }

  const screenshotsDir = path.join(dataDir, "assets", "screenshots");
  if (fs.existsSync(screenshotsDir)) {
    for (const f of fs.readdirSync(screenshotsDir)) {
      if (imageExts.has(path.extname(f).toLowerCase())) {
        candidates.push({
          sourceFilename: f,
          fullPath: path.join(screenshotsDir, f),
          relativePath: `assets/screenshots/${f}`,
        });
      }
    }
  }

  // Shuffle, then try each until we find an unused one.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (const c of candidates) {
    try {
      const buf = fs.readFileSync(c.fullPath);
      if (buf.length === 0) continue;
      const ext = path.extname(c.sourceFilename).toLowerCase();
      const hash = crypto.createHash("sha256").update(buf).digest("hex");
      const filename = `${hash}${ext}`;
      if (used.has(filename)) continue;
      const mime =
        ext === ".png" ? "image/png" :
        ext === ".webp" ? "image/webp" :
        ext === ".gif" ? "image/gif" :
        ext === ".avif" ? "image/avif" :
        "image/jpeg";
      return {
        kind: "image",
        sourceFilename: c.sourceFilename,
        filename,
        relativePath: c.relativePath,
        base64: buf.toString("base64"),
        mime,
      };
    } catch {
      continue;
    }
  }
  return null;
}
```

- [ ] **Step 4: Update the call sites**

Inside `generatePersonaPosts`, find where `pickRandomAssetImage(dataDir)` was called and the asset is paired with a persona. Replace with:

```js
const asset = pickRandomAsset(dataDir, usedAssetHashes);
```

Update the post-construction step inside `runPersonaPost` so the placeholder `attachedAsset` uses the new fields:
```js
if (wantsImage && assetImage) {
  post.attachedAsset = {
    kind: 'image',
    filename: assetImage.filename,            // hash-based
    relativePath: assetImage.relativePath,
    url: null,
    mime: assetImage.mime,
    visionAnalysed: visionSucceeded,
  };
}
```

The `relativePath` here is the per-source asset path (`assets/recent_images/foo.jpg`) — this is the same shape `window.api.readDataFileBase64` expects in `renderer/app.js`.

- [ ] **Step 5: Smoke test — dedup actually skips duplicates**

Start both apps with WebDiplome running. Trigger generation in Electron. Note one image's hash filename. Now trigger generation again. Expected: the new post's image hash is different from the prior one (or no image if pool exhausted). Repeat 3-4 times — each generation picks a unique hash.

To verify dedup spans the apps: after one Electron generation, trigger a web-side generation. The web-side picked image should also have a different hash than any prior post (web-side dedup also reads `attachedAsset.filename` — Task 10).

- [ ] **Step 6: Commit**

```bash
cd /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc
git add python/post_generator/PostGenerator.js
git commit -m "feat(dedup): pickRandomAsset honors usedAssetHashes (SHA-256-keyed)"
```

---

## Phase 4 — Documents

### Task 13: Add `pdf-parse` dep + `docText` module to WebDiplome

**Repo:** WebDiplome
**Files:**
- Modify: `package.json` (already added in Task 1)
- Create: `server/lib/docText.js`
- Create: `tests/docText.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/docText.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { extractDocText, MAX_DOC_CHARS } from '../server/lib/docText.js';

describe('extractDocText', () => {
  it('reads UTF-8 plain text and trims whitespace', async () => {
    const buf = Buffer.from('  hello \n\n\n world  \n', 'utf8');
    const out = await extractDocText(buf, '.txt');
    expect(out).toBe('hello world');
  });

  it('reads markdown verbatim (with whitespace collapsing)', async () => {
    const buf = Buffer.from('# Title\n\n- one\n- two\n', 'utf8');
    const out = await extractDocText(buf, '.md');
    expect(out).toContain('Title');
    expect(out).toContain('- one');
  });

  it('clamps to MAX_DOC_CHARS', async () => {
    const buf = Buffer.from('a'.repeat(MAX_DOC_CHARS * 2), 'utf8');
    const out = await extractDocText(buf, '.txt');
    expect(out.length).toBe(MAX_DOC_CHARS);
  });

  it('returns null for unsupported extensions', async () => {
    const buf = Buffer.from('hello', 'utf8');
    const out = await extractDocText(buf, '.bin');
    expect(out).toBeNull();
  });

  it('returns null for empty buffer', async () => {
    const out = await extractDocText(Buffer.from(''), '.txt');
    expect(out).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd /Users/brikeld/Documents/Repo/WebDiplome && npm test -- docText`

Expected: FAIL with `Cannot find module … server/lib/docText.js`.

- [ ] **Step 3: Implement `server/lib/docText.js`**

```js
import pdfParse from 'pdf-parse';

export const MAX_DOC_CHARS = 4096;
const SUPPORTED_TEXT_EXTS = new Set(['.txt', '.md', '.py', '.js', '.ts', '.css']);
const PDF_EXT = '.pdf';
const PDF_TIMEOUT_MS = 3000;

function normalizeWhitespace(s) {
  // Drop control chars except \n, collapse internal runs of whitespace incl. \n,
  // but preserve some line structure by collapsing 3+ newlines into one.
  const stripped = String(s || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  const linesNormalized = stripped.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  return linesNormalized.trim();
}

function clamp(s) {
  return s.length > MAX_DOC_CHARS ? s.slice(0, MAX_DOC_CHARS) : s;
}

async function extractPdf(buf) {
  const parsePromise = pdfParse(buf).then((r) => r?.text ?? '');
  const timeoutPromise = new Promise((_resolve, reject) =>
    setTimeout(() => reject(new Error('pdf-parse timeout')), PDF_TIMEOUT_MS),
  );
  return Promise.race([parsePromise, timeoutPromise]);
}

export async function extractDocText(buf, ext) {
  if (!buf || buf.length === 0) return null;
  const e = String(ext || '').toLowerCase();
  try {
    let text;
    if (e === PDF_EXT) {
      text = await extractPdf(buf);
    } else if (SUPPORTED_TEXT_EXTS.has(e)) {
      text = buf.toString('utf8');
    } else {
      return null;
    }
    const normalized = normalizeWhitespace(text);
    if (!normalized) return null;
    return clamp(normalized);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Verify tests pass**

Run: `cd /Users/brikeld/Documents/Repo/WebDiplome && npm test`

Expected: all tests across all 3 test files pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
git add server/lib/docText.js tests/docText.test.js
git commit -m "feat(docs): extractDocText with pdf-parse + utf8 + 4096 char clamp"
```

---

### Task 14: Add `pdf-parse` dep + doc extraction to Electron

**Repo:** Electron
**Files:**
- Modify: `package.json`
- Modify: `python/post_generator/PostGenerator.js`

- [ ] **Step 1: Add pdf-parse dep**

```bash
cd /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc
npm install pdf-parse@^1.1.1
```

- [ ] **Step 2: Add `extractDocText` to `PostGenerator.js`**

Paste below the helpers near the top of `python/post_generator/PostGenerator.js`:
```js
const pdfParse = require("pdf-parse");

const MAX_DOC_CHARS = 4096;
const SUPPORTED_TEXT_EXTS = new Set([".txt", ".md", ".py", ".js", ".ts", ".css"]);
const PDF_TIMEOUT_MS = 3000;

function normalizeDocWhitespace(s) {
  const stripped = String(s || "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  return stripped.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function extractDocText(buf, ext) {
  if (!buf || buf.length === 0) return null;
  const e = String(ext || "").toLowerCase();
  try {
    let text;
    if (e === ".pdf") {
      const parsePromise = pdfParse(buf).then((r) => r?.text ?? "");
      const timeoutPromise = new Promise((_r, reject) =>
        setTimeout(() => reject(new Error("pdf-parse timeout")), PDF_TIMEOUT_MS),
      );
      text = await Promise.race([parsePromise, timeoutPromise]);
    } else if (SUPPORTED_TEXT_EXTS.has(e)) {
      text = buf.toString("utf8");
    } else {
      return null;
    }
    const normalized = normalizeDocWhitespace(text);
    if (!normalized) return null;
    return normalized.length > MAX_DOC_CHARS ? normalized.slice(0, MAX_DOC_CHARS) : normalized;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Smoke test — extraction works on a known PDF**

Place a small PDF at `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/data/assets/docs/test.pdf` (or use one already there). In Node REPL:
```bash
cd /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc
node -e "const {extractDocText}=require('./python/post_generator/PostGenerator'); (async()=>{const fs=require('fs'); const buf=fs.readFileSync('data/assets/docs/test.pdf'); const t=await extractDocText(buf,'.pdf'); console.log('len=',t?.length,'head=',t?.slice(0,80))})()"
```

Expected: prints a non-zero length and a snippet of recognizable PDF text. If you don't have a test PDF, use any `.md` or `.txt` from `data/assets/docs/`.

If `extractDocText` is not exported, add a `module.exports.extractDocText = extractDocText;` line at the bottom before testing (it doesn't need to be exported in production, but exporting makes the REPL test possible — leave the export in).

- [ ] **Step 4: Commit**

```bash
cd /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc
git add package.json package-lock.json python/post_generator/PostGenerator.js
git commit -m "feat(docs): add pdf-parse + extractDocText helper"
```

---

### Task 15: WebDiplome — extend asset discovery to include `data/assets/docs/`

**Repo:** WebDiplome
**Files:**
- Modify: `server-generate.js`

- [ ] **Step 1: Add docs directory and per-dir allowed-extensions config**

Near the top of `server-generate.js`, replace `EXTRA_ASSET_DIRS` and `ALLOWED_EXT` with a per-dir config:
```js
const ASSET_DIRS = [
  {
    path: '/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/data/assets/recent_images',
    kind: 'image',
    allowedExts: new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']),
    excludeBasenames: new Set(['profile.jpg']),
  },
  {
    path: '/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/data/assets/screenshots',
    kind: 'image',
    allowedExts: new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']),
    excludeBasenames: new Set(),
  },
  {
    path: '/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/data/assets/docs',
    kind: 'document',
    allowedExts: new Set(['.pdf', '.txt', '.md', '.py', '.js', '.ts', '.css']),
    excludeBasenames: new Set(),
  },
];
```

Delete the old `EXTRA_ASSET_DIRS`, `ALLOWED_EXT`, and `IMAGE_PERSONA_CYCLE` constants. Add:
```js
const ASSET_PERSONA_CYCLE = ['popularite', 'securite', 'productivite'];
```

(Keep the same order — same as the old `IMAGE_PERSONA_CYCLE`.)

- [ ] **Step 2: Replace `listImagesInDir` with `listAssetsInDir`**

```js
async function listAssetsInDir(spec) {
  try {
    const entries = await fs.readdir(spec.path, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => ({
        fullPath: path.join(spec.path, e.name),
        basename: e.name,
        kind: spec.kind,
      }))
      .filter(
        (a) =>
          spec.allowedExts.has(path.extname(a.basename).toLowerCase()) &&
          !spec.excludeBasenames.has(a.basename),
      );
  } catch {
    return [];
  }
}
```

Update the calling code from `EXTRA_ASSET_DIRS.map(listImagesInDir)` to `ASSET_DIRS.map(listAssetsInDir)`.

- [ ] **Step 3: Update `pickAndImportAsset` to handle both kinds**

Replace the body of `pickAndImportAsset(candidates, usedUploadFilenames)` to differentiate by kind:
```js
async function pickAndImportAsset(candidates, usedUploadFilenames) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const used = usedUploadFilenames instanceof Set ? usedUploadFilenames : new Set();

  const pool = candidates.slice();
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  while (pool.length > 0) {
    const chosen = pool.pop();
    const buf = await fs.readFile(chosen.fullPath);
    if (!buf.length) continue;
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    const ext = path.extname(chosen.basename).toLowerCase();
    const uploadFilename = `${hash}${ext}`;
    if (used.has(uploadFilename)) continue;

    const dest = path.join(UPLOADS_DIR, uploadFilename);
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    if (!(await fileExists(dest))) {
      await fs.writeFile(dest, buf);
    }

    if (chosen.kind === 'image') {
      return {
        kind: 'image',
        sourceFilename: chosen.basename,
        base64: buf.toString('base64'),
        mime: getMimeFromExt(ext),
        uploadFilename,
        uploadRelativePath: `public/uploads/${uploadFilename}`,
        uploadUrl: `/uploads/${uploadFilename}`,
      };
    }
    // kind === 'document'
    const text = await extractDocText(buf, ext);
    if (!text) continue;  // try next candidate if extraction fails
    return {
      kind: 'document',
      sourceFilename: chosen.basename,
      text,
      mime: getMimeFromExt(ext),
      uploadFilename,
      uploadRelativePath: `public/uploads/${uploadFilename}`,
      uploadUrl: `/uploads/${uploadFilename}`,
    };
  }
  return null;
}
```

Update `getMimeFromExt` to handle doc extensions:
```js
function getMimeFromExt(ext) {
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.avif') return 'image/avif';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.md') return 'text/markdown';
  if (ext === '.txt') return 'text/plain';
  if (ext === '.py') return 'text/x-python';
  if (ext === '.js') return 'application/javascript';
  if (ext === '.ts') return 'application/typescript';
  if (ext === '.css') return 'text/css';
  return 'image/jpeg';
}
```

Add `import { extractDocText } from './server/lib/docText.js';` near the top.

- [ ] **Step 4: Build the `assetAssignment` with kind**

In the `POST /api/posts/generate` handler, replace the previous `assetAssignment` build with:
```js
let assetAssignment = null;
if (asset) {
  const prevPersona = mostRecentPersonaWithAsset(existing);
  const targetPersona = nextPersonaInCycle(prevPersona);
  if (asset.kind === 'image') {
    assetAssignment = {
      persona: targetPersona,
      asset: {
        kind: 'image',
        base64: asset.base64,
        mime: asset.mime,
        filename: asset.sourceFilename,
      },
    };
  } else {
    assetAssignment = {
      persona: targetPersona,
      asset: {
        kind: 'document',
        text: asset.text,
        mime: asset.mime,
        filename: asset.sourceFilename,
      },
    };
  }
}
```

- [ ] **Step 5: Smoke test — doc gets picked**

Drop a small `.md` file into `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/data/assets/docs/test.md`:
```bash
mkdir -p /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/data/assets/docs
echo "# Roadmap\n\nFinish the doc-attachment feature." > /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/data/assets/docs/test.md
```

Reset WebDiplome posts to force fresh dedup:
```bash
rm -f /Users/brikeld/Documents/Repo/WebDiplome/posts/*.json
```
(re-sync from Electron, or write a stub profile via curl if you have one — Tasks 17 and onward require the doc path to be picked.)

Then trigger several `curl -sX POST http://localhost:3010/api/posts/generate` runs and inspect `posts/{id}.json`. Within a few runs you should see one post with `attachedAsset: { kind: "document", filename: "<hash>.md", mime: "text/markdown", url: "/uploads/<hash>.md" }`. Confirm the file lives at `WebDiplome/public/uploads/<hash>.md`.

- [ ] **Step 6: Commit**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
git add server-generate.js
git commit -m "feat(docs): extend asset discovery to include data/assets/docs (no html)"
```

---

### Task 16: WebDiplome — generator branches `buildChatBody` on `kind`

**Repo:** WebDiplome
**Files:**
- Modify: `server/lib/personaPostGenerator.js`

- [ ] **Step 1: Update `buildChatBody` to accept a document text branch**

Replace `buildChatBody` body to handle three input shapes (text-only payload, image attached, document attached):

```js
function buildChatBody({ model, systemPrompt, userPayload, imageData, docText, docFilename, maxTokens = 900, temperature = 0.7 }) {
  let userContent;
  if (imageData) {
    userContent = [
      { type: 'text', text: userPayload },
      {
        type: 'image_url',
        image_url: { url: `data:${imageData.mime};base64,${imageData.base64}` },
      },
    ];
  } else if (docText) {
    userContent =
      `${userPayload}\n\n--- Attached document (${docFilename}) ---\n${docText}`;
  } else {
    userContent = userPayload;
  }

  return {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature,
    max_tokens: maxTokens,
    enable_thinking: false,
    response_format: { type: 'json_object' },
  };
}
```

- [ ] **Step 2: Update `runPersonaPost` to dispatch on `assetAssignment.asset.kind`**

Inside `runPersonaPost`, where it currently checks `wantsImage && assetImage`, replace with:
```js
const wantsAsset = personaIndex >= 0 && index === personaIndex;
const asset = wantsAsset ? assetAssignment.asset : null;
```

Inside `runOnce(temperature, withVision)`:
```js
const runOnce = async (temperature, withVision) => {
  let systemPrompt = basePrompt;
  let imageData = null;
  let docText = null;
  let docFilename = null;

  if (asset) {
    if (asset.kind === 'image') {
      if (withVision) {
        systemPrompt = basePrompt + (prompts.imageExtension ?? '');
        imageData = { base64: asset.base64, mime: asset.mime };
      } else {
        systemPrompt = basePrompt + `\n\nFor context, the user recently had a file named "${asset.filename}" in their recent images — you may reference it naturally in the post.`;
      }
    } else if (asset.kind === 'document') {
      systemPrompt = basePrompt + (prompts.documentExtension ?? '');
      docText = asset.text;
      docFilename = asset.filename;
    }
  }

  const body = buildChatBody({
    model,
    systemPrompt,
    userPayload,
    imageData,
    docText,
    docFilename,
    temperature,
    maxTokens: prompts.personaPosts[key].maxTokens,
  });
  const r = await lmChatCompletion({ baseUrl, timeoutMs, retries, body });
  const raw = extractChoiceText(r);
  return parsePostWithSentiment(raw, key);
};
```

Update the outer flow inside `runPersonaPost`:
```js
let parsed = { content: '', sentiment: null };
let visionSucceeded = false;

if (asset && asset.kind === 'image') {
  try {
    parsed = await runOnce(prompts.personaPosts[key].temperature, true);
    if (parsed.content) visionSucceeded = true;
  } catch {
    // vision unsupported — fall through to text fallback
  }
}

if (!parsed.content) {
  parsed = await runOnce(prompts.personaPosts[key].temperature, false);
}
if (!parsed.content) {
  parsed = await runOnce(0.35, false);
}
```

(Document branch does not use vision, so it falls through `if (asset && asset.kind === 'image')` and goes straight to the no-vision call — which is correct.)

Update the post-write block:
```js
if (asset) {
  post.attachedAsset = {
    kind: asset.kind,
    filename: asset.filename,
    relativePath: null,
    url: null,
    mime: asset.mime,
  };
  if (asset.kind === 'image') {
    post.attachedAsset.visionAnalysed = visionSucceeded;
  }
}
```

- [ ] **Step 3: Smoke test — doc-attached post**

With a doc placed (per Task 15 Step 5), run generation. Inspect `posts/{id}.json`. Expected: one post has `attachedAsset.kind === 'document'`. The content of the post should make some reference to the doc's text (look for keyword overlap with your test.md).

- [ ] **Step 4: Commit**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
git add server/lib/personaPostGenerator.js
git commit -m "feat(docs): personaPostGenerator branches buildChatBody on kind (image|document)"
```

---

### Task 17: Electron — `pickRandomAsset` includes docs + buildChatBody branches

**Repo:** Electron
**Files:**
- Modify: `python/post_generator/PostGenerator.js`

- [ ] **Step 1: Replace `pickRandomAsset` with two functions: enumerate + select**

The Task 12 `pickRandomAsset` returned a single image synchronously. PDF parsing is async, so we split into a sync enumerator and an async selector. **Delete** the Task 12 `pickRandomAsset` definition. Replace with:

```js
const DOC_EXTS = new Set([".pdf", ".txt", ".md", ".py", ".js", ".ts", ".css"]);

function enumerateAssetCandidates(dataDir) {
  const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
  const candidates = [];

  const addDirCandidates = (dir, kind, allowed, exclude) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      const ext = path.extname(f).toLowerCase();
      if (!allowed.has(ext)) continue;
      if (exclude && exclude.has(f)) continue;
      candidates.push({
        kind,
        sourceFilename: f,
        fullPath: path.join(dir, f),
        relativePath: `${path.relative(dataDir, dir)}/${f}`,
      });
    }
  };

  addDirCandidates(
    path.join(dataDir, "assets", "recent_images"),
    "image",
    imageExts,
    new Set(["profile.jpg"]),
  );
  addDirCandidates(path.join(dataDir, "assets", "screenshots"), "image", imageExts);
  addDirCandidates(path.join(dataDir, "assets", "docs"), "document", DOC_EXTS);

  // shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates;
}

async function selectFirstUsableAsset(candidates, usedHashes, dataDir) {
  const used = usedHashes instanceof Set ? usedHashes : new Set();
  for (const c of candidates) {
    try {
      const buf = fs.readFileSync(c.fullPath);
      if (!buf.length) continue;
      const ext = path.extname(c.sourceFilename).toLowerCase();
      const hash = require("crypto").createHash("sha256").update(buf).digest("hex");
      const filename = `${hash}${ext}`;
      if (used.has(filename)) continue;
      const mime =
        ext === ".png" ? "image/png" :
        ext === ".webp" ? "image/webp" :
        ext === ".gif" ? "image/gif" :
        ext === ".avif" ? "image/avif" :
        ext === ".pdf" ? "application/pdf" :
        ext === ".md" ? "text/markdown" :
        ext === ".txt" ? "text/plain" :
        ext === ".py" ? "text/x-python" :
        ext === ".js" ? "application/javascript" :
        ext === ".ts" ? "application/typescript" :
        ext === ".css" ? "text/css" :
        "image/jpeg";
      if (c.kind === "image") {
        return {
          kind: "image",
          sourceFilename: c.sourceFilename,
          filename,
          relativePath: c.relativePath,
          base64: buf.toString("base64"),
          mime,
        };
      }
      // document
      const text = await extractDocText(buf, ext);
      if (!text) continue;
      return {
        kind: "document",
        sourceFilename: c.sourceFilename,
        filename,
        relativePath: c.relativePath,
        text,
        mime,
      };
    } catch {
      continue;
    }
  }
  return null;
}
```

Inside `generatePersonaPosts`, replace the call (replacing the Task 12 `pickRandomAsset` call site):
```js
const asset = await selectFirstUsableAsset(enumerateAssetCandidates(dataDir), usedAssetHashes, dataDir);
```

- [ ] **Step 2: Update `buildChatBody` (Electron version) for documents**

Find `buildChatBody` in `python/post_generator/PostGenerator.js`. Update to accept `docText` and `docFilename` and produce the right `userContent` (mirror the WebDiplome version in Task 16 Step 1).

- [ ] **Step 3: Update `runPersonaPost` to dispatch on `asset.kind`**

Mirror the same dispatch added in Task 16 Step 2 (but with `prompts.personaPosts[key].temperature` and `prompts.personaPosts[key].maxTokens` already wired in Task 5). The placeholder write becomes:
```js
if (wantsAsset && asset) {
  post.attachedAsset = {
    kind: asset.kind,
    filename: asset.filename,             // hash-based
    relativePath: asset.relativePath,     // assets/.../foo.ext
    url: null,
    mime: asset.mime,
  };
  if (asset.kind === 'image') {
    post.attachedAsset.visionAnalysed = visionSucceeded;
  }
}
```

- [ ] **Step 4: Smoke test — Electron generates doc post**

Make sure `data/assets/docs/test.md` exists. Click "Update" in Electron. Inspect `data/posts_personas.json`. Expected: one post has `attachedAsset.kind === 'document'`. After WebDiplome sync (next step happens automatically in renderer), inspect `WebDiplome/posts/{id}.json` — same post should now have an `url`.

- [ ] **Step 5: Commit**

```bash
cd /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc
git add python/post_generator/PostGenerator.js
git commit -m "feat(docs): Electron PostGenerator picks docs and branches buildChatBody on kind"
```

---

### Task 18: WebDiplome — `PostDocument` component + UI dispatch

**Repo:** WebDiplome
**Files:**
- Create: `src/features/feed/PostDocument.jsx`
- Modify: `src/features/feed/PostCard.jsx`
- Modify: `src/styles/postImage.css` (or create `src/styles/postDocument.css`)

- [ ] **Step 1: Create `PostDocument.jsx`**

```jsx
import React from 'react';

const EXT_LABEL = {
  '.pdf': 'PDF',
  '.md': 'MD',
  '.txt': 'TXT',
  '.py': 'PY',
  '.js': 'JS',
  '.ts': 'TS',
  '.css': 'CSS',
};

function extOf(filename) {
  const f = String(filename || '');
  const i = f.lastIndexOf('.');
  return i >= 0 ? f.slice(i).toLowerCase() : '';
}

function basenameOf(filename) {
  return String(filename || '').split('/').pop();
}

export default function PostDocument({ asset }) {
  if (!asset || asset.kind !== 'document') return null;
  const ext = extOf(asset.filename);
  const label = EXT_LABEL[ext] || ext.replace('.', '').toUpperCase() || 'DOC';
  const href = asset.url || '#';
  return (
    <a
      className="post-document"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open attached document ${basenameOf(asset.filename)}`}
    >
      <span className="post-document__ext">{label}</span>
      <span className="post-document__name">{basenameOf(asset.filename)}</span>
      <span className="post-document__open">Open</span>
    </a>
  );
}
```

- [ ] **Step 2: Add CSS for the doc card**

Append to `src/styles/postImage.css` (or create `src/styles/postDocument.css` and import it from `main.jsx` if you prefer — this plan appends to keep file count lower):
```css
.post-document {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--post-accent, currentColor);
  border-radius: 8px;
  color: var(--post-accent, currentColor);
  text-decoration: none;
  font-family: var(--font-sans, inherit);
  font-size: 14px;
  font-weight: 700;
  text-transform: lowercase;
  background: transparent;
}
.post-document__ext {
  font-size: 12px;
  padding: 2px 6px;
  border: 1px solid var(--post-accent, currentColor);
  border-radius: 4px;
  text-transform: uppercase;
}
.post-document__name {
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.post-document__open {
  opacity: 0.6;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.post-document:hover .post-document__open {
  opacity: 1;
}
```

- [ ] **Step 3: Wire dispatch into `PostCard.jsx`**

Find the existing image branch (added in Task 7):
```jsx
{post.attachedAsset?.kind === 'image' && (
  <PostImage asset={post.attachedAsset} />
)}
```

Add directly below:
```jsx
{post.attachedAsset?.kind === 'document' && (
  <PostDocument asset={post.attachedAsset} />
)}
```

Import the new component at the top of `PostCard.jsx`:
```jsx
import PostDocument from './PostDocument.jsx';
```

- [ ] **Step 4: Smoke test — doc renders in UI**

With `npm run dev` and `npm run servers` running, trigger a generation that produces a doc attachment. Refresh the feed. Expected: the doc post shows a small card with the file's extension label, the filename, and an "Open" link. Clicking the link opens the file at `/uploads/<hash>.<ext>` in a new tab.

- [ ] **Step 5: Commit**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
git add src/features/feed/PostDocument.jsx src/features/feed/PostCard.jsx src/styles/postImage.css
git commit -m "feat(docs): PostDocument component + PostCard dispatch on kind"
```

---

## Phase 5 — Documentation

### Task 19: Update `WebDiplome/CLAUDE.md`

**Repo:** WebDiplome
**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the architecture section**

Replace the "server-generate.js — LM Studio post generation" bullets to mention:
- `prompts.json` is read from `ELECTRON_DATA_DIR` (with bake-in fallback in `server/lib/prompts.js`).
- Asset pool now includes `data/assets/docs/` with allowed exts `.pdf .txt .md .py .js .ts .css` (no html).
- `pickAndImportAsset` now returns either `{kind: 'image', base64, …}` or `{kind: 'document', text, …}`.

Replace any mention of `attachedImage` in the conventions / data-model section with `attachedAsset` and note the `kind` discriminator. Document the legacy read-time translation in `server.js`.

Add a brief mention under "How This Repo Talks to `Diplome_/testCreationAcc`":
- Electron does `GET /api/profiles` + `GET /api/profile/:id` before generating to build the used-asset set (with a local fallback if WebDiplome is offline).
- `Electron/data/prompts.json` is the single source of truth for persona prompts (read by both apps via `loadPrompts(dataDir)`).

- [ ] **Step 2: Update conventions**

In the "Conventions Worth Knowing" section, replace the wallpaper bullet and image bullet to mention that asset attachment is unified under `attachedAsset` (kind=image or kind=document), keyed by SHA-256 of content.

- [ ] **Step 3: Commit**

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for prompts.json, attachedAsset, doc assets"
```

---

### Task 20: Update `Diplome_/testCreationAcc/CLAUDE.md`

**Repo:** Electron
**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update LM Studio integration section**

- Mention that prompts now come from `data/prompts.json` via `loadPromptsSync(DATA_DIR)`; baked-in defaults if missing.
- Mention `extractDocText` is included and that `data/assets/docs/` is part of the asset pool with extensions `.pdf .txt .md .py .js .ts .css` (no html).
- Update the post-schema description: writes go to `attachedAsset` with a `kind` discriminator; legacy `attachedImage` is translated on read by `normalizePostsFilePayload`.

- [ ] **Step 2: Update the integration section**

Document the new pre-generation HTTP step:
- `main.js`'s `generate-persona-posts` IPC handler does `fetchUsedAssetHashes(DATA_DIR)` before generation, which calls WebDiplome `GET /api/profiles` then `GET /api/profile/:id`. Hashes are extracted from `post.attachedAsset.filename`. If WebDiplome is unreachable, falls back to the local `data/posts_personas.json`.
- Document the env vars `WEBDIPLOME_URL` and `USED_HASHES_FETCH_TIMEOUT_MS`.

- [ ] **Step 3: Update on-disk data table**

Add a row for `data/prompts.json` (manual / shared config — both apps read it).

- [ ] **Step 4: Update "Conventions Worth Knowing"**

- The duplicated-prompts conventions line is now obsolete; replace it with "Persona prompts and the user-summary prompt live in `data/prompts.json`. Both apps read it; baked-in defaults exist in each app's generator as fallback."
- Update the image bullet to mention `attachedAsset` unification + doc support.

- [ ] **Step 5: Commit**

```bash
cd /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for prompts.json, attachedAsset, doc assets, HTTP dedup"
```

---

## Final self-check

After the last commit:

- [ ] Run `npm test` in WebDiplome — all tests pass.
- [ ] Generate from WebDiplome (`POST :3010/api/posts/generate`) twice; verify both generations produce distinct asset hashes (image or doc).
- [ ] Generate from Electron once; verify it does NOT pick any of the hashes WebDiplome just used.
- [ ] Stop WebDiplome; trigger Electron generation; verify the "[used-assets] WebDiplome unreachable" warning prints and generation still produces 3 posts (using local fallback).
- [ ] Place an `.html` file in `data/assets/docs/`; run several generations; verify it is never picked.
- [ ] Edit `data/prompts.json` `personaPosts.productivite.system` to a marker string; trigger generation from both apps; verify the productivite post reflects the marker; revert.
- [ ] Confirm an existing pre-change post (with `attachedImage`) still renders correctly in the WebDiplome UI.

---

## Spec coverage cross-check

| Spec requirement | Implemented in |
|---|---|
| Cross-app used-assets dedup via HTTP | Task 11 (Electron HTTP fetch), Task 12 (Electron picker honors hashes), Task 10 (WebDiplome dedupes from `attachedAsset.filename`) |
| Local fallback when WebDiplome offline | Task 11 (`readUsedAssetHashesFromLocalFile`) |
| `prompts.json` in `Electron/data/` with per-key fallback | Task 2 (file), Task 3 (loader+tests), Task 4 (WebDiplome wires it), Task 5 (Electron wires it) |
| `attachedAsset` unified schema + legacy translator | Task 6 (server.js + normalizer module + tests), Task 8/10 (writes), Task 9 (Electron renderer sync) |
| Document asset support (no HTML) | Task 13 (WebDiplome docText), Task 14 (Electron docText), Task 15 (WebDiplome discovery + pickAndImportAsset), Task 17 (Electron picker + builder) |
| `buildChatBody` branches on kind | Task 16 (WebDiplome), Task 17 (Electron) |
| PDF parsing with timeout | Task 13 (3s timeout in `extractDocText`), mirrored in Task 14 |
| 4096-char clamp | Task 13 (`MAX_DOC_CHARS`) |
| WebDiplome UI dispatches on kind | Task 7 (image branch), Task 18 (document branch + `PostDocument`) |
| Reset survival of `prompts.json` | No code change — `prompts.json` is not in `reset-account-data` target list (verified in CLAUDE.md update / Task 20) |
| Backward compat (legacy `attachedImage` on disk) | Task 6 (read-time translation in `server.js`), Task 8 (read-time translation in `normalizePostsFilePayload`) |
| CLAUDE.md updates | Task 19, Task 20 |
