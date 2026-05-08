# Post Generation Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `POST /api/posts/generate` production-ready: 3010 becomes a stateless worker, 3001 becomes the only frontend-facing service and owns all state, and the asset post is anchored to a real user image via vision.

**Architecture:** Approach C from the spec. 3001 (state owner) → 3010 (stateless generator) → LM Studio (private network). Repository module abstracts JSON file storage. Provider abstraction allows switching among LM Studio (default), Anthropic, OpenAI without code changes.

**Tech Stack:** Node 20+, Express 5, ESM, React 18, Vite 5. New deps: `vitest` (testing), `dotenv` (env loading), `@anthropic-ai/sdk` and `openai` (alternative providers, optional at runtime).

**Spec:** [docs/superpowers/specs/2026-05-08-post-generation-production-design.md](../specs/2026-05-08-post-generation-production-design.md)

**Conventions used in this plan:**
- All paths absolute from repo root: `/Users/brikeld/Documents/Repo/WebDiplome/...` shortened to repo-relative.
- TDD where the unit has interesting logic (repository, prompt builders, asset selection, providers). Skipped for trivial wiring (`server-generate.js` shell, frontend constants).
- Each task ends with a single git commit.
- Test command throughout: `npm test -- <pattern>` (configured in Task 1).

---

## File map (locked in this plan)

```
server/lib/repository/
├── paths.js                   PROFILES_DIR, POSTS_DIR, UPLOADS_DIR, ASSETS_DIR
├── currentUser.js             getActiveUserId, requireUser (stub)
├── profiles.js                getProfile, saveProfile (splits harvestedSignals)
├── posts.js                   listPosts, prependPosts
├── assets.js                  listAssets, addAsset, getAssetBytes, markAssetUsed
└── index.js                   public re-export

server/lib/
├── assetSelection.js          mostRecentPersonaWithImage, nextPersonaInCycle, pickAsset
└── internalGenerator.js       callGenerator(payload) → posts; maps errors

server-generate/lib/
├── providers/
│   ├── lmstudio.js
│   ├── anthropic.js
│   ├── openai.js
│   └── index.js               getProvider
├── prompts/
│   ├── personas.js            PERSONA_SYSTEM_PROMPTS
│   ├── buildUserPayload.js    profile + harvestedSignals → string
│   └── fallbackNotes.js       IMAGE_POST_PROMPT_EXTENSION, imageTextFallbackNote
└── personaPostGenerator.js    orchestrates 3 parallel calls

src/lib/
├── apiOrigin.js
└── apiFetch.js

server.js                       wired to repository; new /api/posts/generate, /api/assets/:userId
server-generate.js              stripped to /internal/generate + token auth
.env.example                    template
package.json                    test script + new deps
vitest.config.js                test config
```

---

## Task 1: Test infrastructure

**Files:**
- Create: `vitest.config.js`
- Modify: `package.json`

- [ ] **Step 1: Add vitest config**

Create `vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.js'],
    exclude: ['node_modules/**', 'dist/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 2: Add deps and test script**

Run:
```bash
npm install --save-dev vitest@^2
npm install --save dotenv@^16
```

Edit `package.json` to add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Verify vitest runs**

Run: `npm test`
Expected: `No test files found, exiting with code 1` (no tests yet — that's fine).

- [ ] **Step 4: Commit**

```bash
git add vitest.config.js package.json package-lock.json
git commit -m "chore: add vitest + dotenv"
```

---

## Task 2: Repository paths

**Files:**
- Create: `server/lib/repository/paths.js`
- Test: `server/lib/repository/paths.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/lib/repository/paths.test.js`:
```js
import { describe, it, expect } from 'vitest';
import path from 'path';
import { PROFILES_DIR, POSTS_DIR, UPLOADS_DIR, ASSETS_DIR } from './paths.js';

describe('paths', () => {
  it('all live under repo root', () => {
    for (const p of [PROFILES_DIR, POSTS_DIR, UPLOADS_DIR, ASSETS_DIR]) {
      expect(path.isAbsolute(p)).toBe(true);
    }
  });
  it('uses expected subdirectory names', () => {
    expect(PROFILES_DIR).toMatch(/profiles$/);
    expect(POSTS_DIR).toMatch(/posts$/);
    expect(UPLOADS_DIR).toMatch(/public[\\/]uploads$/);
    expect(ASSETS_DIR).toMatch(/assets$/);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- paths`
Expected: FAIL — file not found.

- [ ] **Step 3: Implement**

Create `server/lib/repository/paths.js`:
```js
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

export const PROFILES_DIR = path.join(REPO_ROOT, 'profiles');
export const POSTS_DIR = path.join(REPO_ROOT, 'posts');
export const UPLOADS_DIR = path.join(REPO_ROOT, 'public', 'uploads');
export const ASSETS_DIR = path.join(REPO_ROOT, 'assets');
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- paths`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/lib/repository/paths.js server/lib/repository/paths.test.js
git commit -m "feat(repo): paths module"
```

---

## Task 3: Repository currentUser (stub auth)

**Files:**
- Create: `server/lib/repository/currentUser.js`
- Test: `server/lib/repository/currentUser.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/lib/repository/currentUser.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { getActiveUserId, requireUser, _setProfilesDirForTest } from './currentUser.js';

let tmp;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-test-'));
  _setProfilesDirForTest(tmp);
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  _setProfilesDirForTest(null);
});

describe('getActiveUserId', () => {
  it('returns null when no profiles exist', async () => {
    expect(await getActiveUserId()).toBe(null);
  });

  it('returns newest profile id', async () => {
    await fs.writeFile(path.join(tmp, 'alice-smith.json'), '{}');
    await new Promise((r) => setTimeout(r, 10));
    await fs.writeFile(path.join(tmp, 'bob-jones.json'), '{}');
    expect(await getActiveUserId()).toBe('bob-jones');
  });
});

describe('requireUser', () => {
  it('returns userId when profile exists', async () => {
    await fs.writeFile(path.join(tmp, 'alice-smith.json'), '{}');
    expect(await requireUser({})).toBe('alice-smith');
  });

  it('throws 401 error when no profile', async () => {
    await expect(requireUser({})).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining('No active user'),
    });
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- currentUser`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `server/lib/repository/currentUser.js`:
```js
import { promises as fs } from 'fs';
import path from 'path';
import { PROFILES_DIR as REAL_PROFILES_DIR } from './paths.js';

let _profilesDir = REAL_PROFILES_DIR;
export function _setProfilesDirForTest(dir) {
  _profilesDir = dir ?? REAL_PROFILES_DIR;
}

export async function getActiveUserId() {
  let files;
  try {
    files = (await fs.readdir(_profilesDir)).filter(
      (f) => f.endsWith('.json') && !f.endsWith('.harvested.json'),
    );
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  if (files.length === 0) return null;

  const stats = await Promise.all(
    files.map(async (file) => ({
      file,
      mtimeMs: (await fs.stat(path.join(_profilesDir, file))).mtimeMs,
    })),
  );
  stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return stats[0].file.replace(/\.json$/i, '');
}

export async function requireUser(_req) {
  const id = await getActiveUserId();
  if (!id) {
    const err = new Error('No active user');
    err.status = 401;
    throw err;
  }
  return id;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- currentUser`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/repository/currentUser.js server/lib/repository/currentUser.test.js
git commit -m "feat(repo): currentUser stub auth"
```

---

## Task 4: Repository profiles (with harvestedSignals split)

**Files:**
- Create: `server/lib/repository/profiles.js`
- Test: `server/lib/repository/profiles.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/lib/repository/profiles.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { getProfile, saveProfile, _setProfilesDirForTest } from './profiles.js';

let tmp;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-test-'));
  _setProfilesDirForTest(tmp);
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  _setProfilesDirForTest(null);
});

describe('saveProfile / getProfile', () => {
  it('stores body without harvestedSignals in main file', async () => {
    await saveProfile('u', { firstname: 'A', harvestedSignals: { x: 1 } });
    const main = JSON.parse(await fs.readFile(path.join(tmp, 'u.json'), 'utf8'));
    expect(main).toEqual({ firstname: 'A' });
  });

  it('stores harvestedSignals in separate file', async () => {
    await saveProfile('u', { firstname: 'A', harvestedSignals: { x: 1 } });
    const harvested = JSON.parse(
      await fs.readFile(path.join(tmp, 'u.harvested.json'), 'utf8'),
    );
    expect(harvested).toEqual({ x: 1 });
  });

  it('omits harvested file if not provided', async () => {
    await saveProfile('u', { firstname: 'A' });
    await expect(fs.access(path.join(tmp, 'u.harvested.json'))).rejects.toThrow();
  });

  it('getProfile returns null when missing', async () => {
    expect(await getProfile('nope')).toBe(null);
  });

  it('getProfile reassembles { profile, harvestedSignals }', async () => {
    await saveProfile('u', { firstname: 'A', harvestedSignals: { y: 2 } });
    const r = await getProfile('u');
    expect(r.profile).toEqual({ firstname: 'A' });
    expect(r.harvestedSignals).toEqual({ y: 2 });
  });

  it('harvestedSignals is null when no harvested file', async () => {
    await saveProfile('u', { firstname: 'A' });
    const r = await getProfile('u');
    expect(r.harvestedSignals).toBe(null);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- profiles`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `server/lib/repository/profiles.js`:
```js
import { promises as fs } from 'fs';
import path from 'path';
import { PROFILES_DIR as REAL_PROFILES_DIR } from './paths.js';

let _dir = REAL_PROFILES_DIR;
export function _setProfilesDirForTest(d) {
  _dir = d ?? REAL_PROFILES_DIR;
}

export async function saveProfile(userId, body) {
  await fs.mkdir(_dir, { recursive: true });
  const { harvestedSignals, ...rest } = body;
  await fs.writeFile(
    path.join(_dir, `${userId}.json`),
    JSON.stringify(rest, null, 2),
    'utf8',
  );
  if (harvestedSignals !== undefined && harvestedSignals !== null) {
    await fs.writeFile(
      path.join(_dir, `${userId}.harvested.json`),
      JSON.stringify(harvestedSignals, null, 2),
      'utf8',
    );
  }
}

export async function getProfile(userId) {
  const mainPath = path.join(_dir, `${userId}.json`);
  const harvestedPath = path.join(_dir, `${userId}.harvested.json`);
  let profile;
  try {
    profile = JSON.parse(await fs.readFile(mainPath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  let harvestedSignals = null;
  try {
    harvestedSignals = JSON.parse(await fs.readFile(harvestedPath, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return { profile, harvestedSignals };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- profiles`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/repository/profiles.js server/lib/repository/profiles.test.js
git commit -m "feat(repo): profiles with harvestedSignals split"
```

---

## Task 5: Repository posts

**Files:**
- Create: `server/lib/repository/posts.js`
- Test: `server/lib/repository/posts.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/lib/repository/posts.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { listPosts, prependPosts, _setPostsDirForTest } from './posts.js';

let tmp;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-test-'));
  _setPostsDirForTest(tmp);
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  _setPostsDirForTest(null);
});

describe('listPosts', () => {
  it('empty array when no file', async () => {
    expect(await listPosts('u')).toEqual([]);
  });
});

describe('prependPosts', () => {
  it('writes new posts ahead of existing', async () => {
    await prependPosts('u', [{ persona: 'a', content: 'old' }]);
    await prependPosts('u', [{ persona: 'b', content: 'new' }]);
    const all = await listPosts('u');
    expect(all.map((p) => p.persona)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- posts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `server/lib/repository/posts.js`:
```js
import { promises as fs } from 'fs';
import path from 'path';
import { POSTS_DIR as REAL_POSTS_DIR } from './paths.js';

let _dir = REAL_POSTS_DIR;
export function _setPostsDirForTest(d) {
  _dir = d ?? REAL_POSTS_DIR;
}

export async function listPosts(userId) {
  try {
    const raw = await fs.readFile(path.join(_dir, `${userId}.json`), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function prependPosts(userId, newPosts) {
  await fs.mkdir(_dir, { recursive: true });
  const existing = await listPosts(userId);
  const combined = [...newPosts, ...existing];
  await fs.writeFile(
    path.join(_dir, `${userId}.json`),
    JSON.stringify(combined, null, 2),
    'utf8',
  );
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- posts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/repository/posts.js server/lib/repository/posts.test.js
git commit -m "feat(repo): posts list/prepend"
```

---

## Task 6: Repository assets (per-user index, global hash dedup)

**Files:**
- Create: `server/lib/repository/assets.js`
- Test: `server/lib/repository/assets.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/lib/repository/assets.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  addAsset,
  listAssets,
  getAssetBytes,
  markAssetUsed,
  _setDirsForTest,
} from './assets.js';

let tmp, uploads, assets;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-test-'));
  uploads = path.join(tmp, 'uploads');
  assets = path.join(tmp, 'assets');
  await fs.mkdir(uploads, { recursive: true });
  await fs.mkdir(assets, { recursive: true });
  _setDirsForTest({ uploads, assets });
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  _setDirsForTest(null);
});

describe('addAsset', () => {
  it('writes file with hash filename and registers in user index', async () => {
    const a = await addAsset('u', {
      buffer: Buffer.from('hello'),
      mime: 'image/png',
      originalName: 'x.png',
    });
    expect(a.filename).toMatch(/^[0-9a-f]{64}\.png$/);
    expect(a.url).toBe(`/uploads/${a.filename}`);
    const list = await listAssets('u');
    expect(list).toHaveLength(1);
    expect(list[0].filename).toBe(a.filename);
  });

  it('dedups same bytes across users (one file, two index entries)', async () => {
    const buf = Buffer.from('shared');
    await addAsset('u1', { buffer: buf, mime: 'image/png', originalName: 'a.png' });
    await addAsset('u2', { buffer: buf, mime: 'image/png', originalName: 'b.png' });
    const files = await fs.readdir(uploads);
    expect(files).toHaveLength(1);
    expect((await listAssets('u1'))).toHaveLength(1);
    expect((await listAssets('u2'))).toHaveLength(1);
  });

  it('dedups same bytes for same user (one entry)', async () => {
    const buf = Buffer.from('dup');
    await addAsset('u', { buffer: buf, mime: 'image/png', originalName: 'a.png' });
    await addAsset('u', { buffer: buf, mime: 'image/png', originalName: 'a.png' });
    expect(await listAssets('u')).toHaveLength(1);
  });
});

describe('getAssetBytes', () => {
  it('returns buffer + mime by filename', async () => {
    const a = await addAsset('u', {
      buffer: Buffer.from('zzz'),
      mime: 'image/jpeg',
      originalName: 'a.jpg',
    });
    const r = await getAssetBytes('u', a.filename);
    expect(r.buffer.toString()).toBe('zzz');
    expect(r.mime).toBe('image/jpeg');
  });

  it('returns null when filename not in user index', async () => {
    expect(await getAssetBytes('u', 'nope.png')).toBe(null);
  });
});

describe('markAssetUsed', () => {
  it('updates lastUsedAt in index', async () => {
    const a = await addAsset('u', {
      buffer: Buffer.from('m'),
      mime: 'image/png',
      originalName: 'a.png',
    });
    await markAssetUsed('u', a.filename);
    const list = await listAssets('u');
    expect(list[0].lastUsedAt).toBeTypeOf('string');
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- assets`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `server/lib/repository/assets.js`:
```js
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UPLOADS_DIR as REAL_UPLOADS, ASSETS_DIR as REAL_ASSETS } from './paths.js';

let _uploads = REAL_UPLOADS;
let _assets = REAL_ASSETS;
export function _setDirsForTest(dirs) {
  _uploads = dirs?.uploads ?? REAL_UPLOADS;
  _assets = dirs?.assets ?? REAL_ASSETS;
}

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

function indexPath(userId) {
  return path.join(_assets, `${userId}.json`);
}

async function readIndex(userId) {
  try {
    return JSON.parse(await fs.readFile(indexPath(userId), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(userId, list) {
  await fs.mkdir(_assets, { recursive: true });
  await fs.writeFile(indexPath(userId), JSON.stringify(list, null, 2), 'utf8');
}

export async function listAssets(userId) {
  return await readIndex(userId);
}

export async function addAsset(userId, { buffer, mime, originalName }) {
  await fs.mkdir(_uploads, { recursive: true });
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext = EXT_BY_MIME[mime] ?? path.extname(String(originalName ?? '')).toLowerCase() ?? '';
  const filename = `${sha256}${ext || ''}`;
  const fullPath = path.join(_uploads, filename);

  try {
    await fs.access(fullPath);
  } catch {
    await fs.writeFile(fullPath, buffer);
  }

  const list = await readIndex(userId);
  const existing = list.find((a) => a.sha256 === sha256);
  if (existing) return existing;

  const record = {
    filename,
    url: `/uploads/${filename}`,
    mime,
    bytes: buffer.length,
    sha256,
    addedAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  list.push(record);
  await writeIndex(userId, list);
  return record;
}

export async function getAssetBytes(userId, filename) {
  const list = await readIndex(userId);
  const found = list.find((a) => a.filename === filename);
  if (!found) return null;
  const buffer = await fs.readFile(path.join(_uploads, filename));
  return { buffer, mime: found.mime };
}

export async function markAssetUsed(userId, filename) {
  const list = await readIndex(userId);
  const idx = list.findIndex((a) => a.filename === filename);
  if (idx === -1) return;
  list[idx] = { ...list[idx], lastUsedAt: new Date().toISOString() };
  await writeIndex(userId, list);
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- assets`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/repository/assets.js server/lib/repository/assets.test.js
git commit -m "feat(repo): assets with global hash dedup, per-user index"
```

---

## Task 7: Repository public API

**Files:**
- Create: `server/lib/repository/index.js`

- [ ] **Step 1: Implement (no test — pure re-export)**

Create `server/lib/repository/index.js`:
```js
export { getActiveUserId, requireUser } from './currentUser.js';
export { getProfile, saveProfile } from './profiles.js';
export { listPosts, prependPosts } from './posts.js';
export { listAssets, addAsset, getAssetBytes, markAssetUsed } from './assets.js';
export { PROFILES_DIR, POSTS_DIR, UPLOADS_DIR, ASSETS_DIR } from './paths.js';
```

- [ ] **Step 2: Verify all tests still pass**

Run: `npm test`
Expected: PASS (all repository tests).

- [ ] **Step 3: Commit**

```bash
git add server/lib/repository/index.js
git commit -m "feat(repo): public API barrel"
```

---

## Task 8: 3001 — refactor existing endpoints to use repository

**Files:**
- Modify: `server.js` (full rewrite of the existing handlers)

- [ ] **Step 1: Rewrite server.js**

Replace `/Users/brikeld/Documents/Repo/WebDiplome/server.js` entirely with:
```js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import multer from 'multer';
import {
  PROFILES_DIR,
  POSTS_DIR,
  UPLOADS_DIR,
  saveProfile,
  getProfile,
  listPosts,
  addAsset,
} from './server/lib/repository/index.js';

const app = express();

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
app.use(cors({ origin: WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));

await fs.mkdir(PROFILES_DIR, { recursive: true });
await fs.mkdir(POSTS_DIR, { recursive: true });
await fs.mkdir(UPLOADS_DIR, { recursive: true });

app.use('/uploads', express.static(UPLOADS_DIR));

// Multer for /api/upload (legacy single-file upload — kept for backward compat).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES) || 15 * 1024 * 1024 },
});

// POST /api/upload — single file, returns URL. Stores under public/uploads with hash name.
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'missing file' });
    const a = await addAsset('_legacy', {
      buffer: req.file.buffer,
      mime: req.file.mimetype,
      originalName: req.file.originalname,
    });
    res.status(200).json({ filename: a.filename, url: a.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/profile — save profile. Splits harvestedSignals into separate file.
app.post('/api/profile', async (req, res) => {
  const body = req.body ?? {};
  const first = (body.firstname ?? body.firstName ?? '').trim().toLowerCase();
  const last = (body.lastname ?? body.lastName ?? '').trim().toLowerCase();
  if (!first || !last) {
    return res.status(400).json({ error: 'firstname and lastname are required' });
  }
  const id = `${first}-${last}`;

  try {
    const { personaPosts, persona_posts, ...rest } = body;
    await saveProfile(id, rest);

    // Posts coming with the profile (legacy Electron sync path).
    const posts = personaPosts ?? persona_posts;
    if (Array.isArray(posts)) {
      const { prependPosts } = await import('./server/lib/repository/index.js');
      // Replace the file rather than prepend on profile sync.
      await fs.writeFile(
        path.join(POSTS_DIR, `${id}.json`),
        JSON.stringify(posts, null, 2),
        'utf8',
      );
    }
    res.status(200).json({ id, filename: `${id}.json` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/profiles — array, newest first.
app.get('/api/profiles', async (_req, res) => {
  try {
    const files = (await fs.readdir(PROFILES_DIR)).filter(
      (f) => f.endsWith('.json') && !f.endsWith('.harvested.json'),
    );
    const withMeta = await Promise.all(
      files.map(async (file) => {
        const id = file.replace(/\.json$/i, '');
        const stat = await fs.stat(path.join(PROFILES_DIR, file));
        const { profile } = (await getProfile(id)) ?? { profile: {} };
        const posts = await listPosts(id);
        if (posts.length) profile.personaPosts = posts;
        return { mtimeMs: stat.mtimeMs, data: profile };
      }),
    );
    withMeta.sort((a, b) => b.mtimeMs - a.mtimeMs);
    res.json(withMeta.map((p) => p.data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/profile/:id — single profile.
app.get('/api/profile/:id', async (req, res) => {
  try {
    const r = await getProfile(req.params.id);
    if (!r) return res.status(404).json({ error: `Profile '${req.params.id}' not found` });
    const posts = await listPosts(req.params.id);
    if (posts.length) r.profile.personaPosts = posts;
    res.json(r.profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
```

- [ ] **Step 2: Verify existing flow still works manually**

Start dev:
```bash
WEB_ORIGIN=http://localhost:5173 node server.js
```
In another terminal:
```bash
curl -X GET http://localhost:3001/api/profiles
```
Expected: 200, JSON array. Stop the server (`Ctrl+C`).

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "refactor(3001): use repository module; harvestedSignals split; CORS via WEB_ORIGIN; remove delete-all branch"
```

---

## Task 9: 3001 — POST /api/assets/:userId

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add handler**

In `server.js`, add this handler **before** the `app.listen(...)` line:
```js
// POST /api/assets/:userId — multi-file upload (Electron sync).
// Auth: ASSET_SYNC_SECRET via X-Asset-Sync-Token header.
const ASSET_SYNC_SECRET = process.env.ASSET_SYNC_SECRET ?? '';

app.post('/api/assets/:userId', upload.array('files', 50), async (req, res) => {
  if (!ASSET_SYNC_SECRET || req.get('X-Asset-Sync-Token') !== ASSET_SYNC_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const files = req.files ?? [];
  if (files.length === 0) return res.status(400).json({ error: 'no files' });

  const added = [];
  const skipped = [];
  for (const f of files) {
    try {
      const a = await addAsset(req.params.userId, {
        buffer: f.buffer,
        mime: f.mimetype,
        originalName: f.originalname,
      });
      added.push({ filename: a.filename, url: a.url, mime: a.mime });
    } catch (err) {
      skipped.push({ filename: f.originalname, reason: err.message });
    }
  }
  res.json({ added, skipped });
});
```

- [ ] **Step 2: Manual smoke test**

Start server with `ASSET_SYNC_SECRET=dev node server.js`. Then:
```bash
curl -X POST http://localhost:3001/api/assets/u-test \
  -H "X-Asset-Sync-Token: dev" \
  -F "files=@public/uploads/cb51fab9f13c97a6ca59ae93aa7230d1c60685e8b4bd6fffba62568cc5aa2d4b.jpg"
```
Expected: `{"added":[{"filename":"...","url":"/uploads/...","mime":"image/jpeg"}],"skipped":[]}`. Then check that `assets/u-test.json` exists.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(3001): POST /api/assets/:userId with sync-secret auth"
```

---

## Task 10: 3010 — prompts module

**Files:**
- Create: `server-generate/lib/prompts/personas.js`
- Create: `server-generate/lib/prompts/fallbackNotes.js`
- Create: `server-generate/lib/prompts/buildUserPayload.js`
- Test: `server-generate/lib/prompts/buildUserPayload.test.js`

- [ ] **Step 1: Write personas.js (lifted from post_generator/PostGenerator.js)**

Create `server-generate/lib/prompts/personas.js`:
```js
export const PERSONAS = ['productivite', 'securite', 'popularite'];

export const PERSONA_SYSTEM_PROMPTS = {
  productivite:
    "You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) about something from their workflow or productivity. Sound like a human: a bit self-aware, natural rhythm, maybe slightly ironic or proud. No hashtags. No motivational-speaker tone.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}.",
  popularite:
    "You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) about their online presence or social life. Sound like a human: genuine, maybe a little playful or self-deprecating. No hashtags. No hype-machine tone.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}.",
  securite:
    "You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) touching on their digital life or data habits. Sound like a human: honest, maybe a touch anxious or relieved. No hashtags. No security-textbook tone.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}.",
};
```

- [ ] **Step 2: Write fallbackNotes.js**

Create `server-generate/lib/prompts/fallbackNotes.js`:
```js
export const IMAGE_POST_PROMPT_EXTENSION =
  "\n\nAn image from the user's files is attached. Write the post as if the user is sharing or reacting to this image — describe what you see in a natural way, integrate it into the post voice. The post should feel like a genuine image caption or reaction.";

export function imageTextFallbackNote(filename) {
  return `\n\nFor context, the user recently had a file named "${filename}" in their recent images — you may reference it naturally in the post.`;
}
```

- [ ] **Step 3: Write buildUserPayload test**

Create `server-generate/lib/prompts/buildUserPayload.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { buildUserPayload } from './buildUserPayload.js';

describe('buildUserPayload', () => {
  it('omits harvestedSignals key when null', () => {
    const s = buildUserPayload({ firstname: 'A', lastname: 'B' }, null);
    expect(s).toContain('"firstname": "A"');
    expect(s).not.toContain('harvestedSignals');
  });

  it('includes harvestedSignals when present', () => {
    const s = buildUserPayload({ firstname: 'A' }, { dominant: 'productivite', score: 80 });
    expect(s).toContain('harvestedSignals');
    expect(s).toContain('"score": 80');
  });

  it('strips wallpaperBase64 even if caller forgot', () => {
    const s = buildUserPayload({ firstname: 'A', wallpaperBase64: 'XXXX' }, null);
    expect(s).not.toContain('wallpaperBase64');
    expect(s).not.toContain('XXXX');
  });
});
```

- [ ] **Step 4: Run, expect fail**

Run: `npm test -- buildUserPayload`
Expected: FAIL.

- [ ] **Step 5: Implement**

Create `server-generate/lib/prompts/buildUserPayload.js`:
```js
export function buildUserPayload(profile, harvestedSignals) {
  const { wallpaperBase64, wallpaper_base64, ...clean } = profile ?? {};
  const obj = harvestedSignals
    ? { user: clean, harvestedSignals }
    : { user: clean };
  return JSON.stringify(obj, null, 2);
}
```

- [ ] **Step 6: Run, expect pass**

Run: `npm test -- buildUserPayload`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add server-generate/lib/prompts/
git commit -m "feat(gen): prompts module (personas, fallbacks, payload builder)"
```

---

## Task 11: 3010 — LM Studio provider

**Files:**
- Create: `server-generate/lib/providers/lmstudio.js`
- Test: `server-generate/lib/providers/lmstudio.test.js`

- [ ] **Step 1: Write the failing test**

Create `server-generate/lib/providers/lmstudio.test.js`:
```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LmStudioProvider } from './lmstudio.js';

const originalFetch = global.fetch;
let calls;
beforeEach(() => {
  calls = [];
  global.fetch = vi.fn(async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe('LmStudioProvider', () => {
  it('name and supportsVision flag', () => {
    const p = new LmStudioProvider({ baseUrl: 'http://x', model: 'm', vision: true });
    expect(p.name).toBe('lmstudio');
    expect(p.supportsVision).toBe(true);
  });

  it('sends text-only request', async () => {
    const p = new LmStudioProvider({ baseUrl: 'http://x', model: 'm', vision: false });
    const r = await p.generate({ system: 'sys', user: 'usr' });
    expect(r.text).toBe('OK');
    expect(calls[0].body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ]);
  });

  it('sends image content array when vision + image present', async () => {
    const p = new LmStudioProvider({ baseUrl: 'http://x', model: 'm', vision: true });
    await p.generate({ system: 's', user: 'u', image: { base64: 'AAA', mime: 'image/png' } });
    const userMsg = calls[0].body.messages[1];
    expect(Array.isArray(userMsg.content)).toBe(true);
    expect(userMsg.content[1].image_url.url).toBe('data:image/png;base64,AAA');
  });

  it('throws on non-2xx', async () => {
    global.fetch = vi.fn(async () => new Response('boom', { status: 500 }));
    const p = new LmStudioProvider({ baseUrl: 'http://x', model: 'm' });
    await expect(p.generate({ system: 's', user: 'u' })).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- lmstudio`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `server-generate/lib/providers/lmstudio.js`:
```js
export class LmStudioProvider {
  constructor({ baseUrl, model, vision = false, timeoutMs = 180_000 }) {
    if (!baseUrl) throw new Error('LM_STUDIO_BASE_URL required');
    if (!model) throw new Error('LM_STUDIO_MODEL required');
    this.name = 'lmstudio';
    this.supportsVision = !!vision;
    this._baseUrl = String(baseUrl).replace(/\/$/, '');
    this._model = model;
    this._timeoutMs = timeoutMs;
  }

  async generate({ system, user, image, temperature = 0.7, maxTokens = 900 }) {
    const userContent = image
      ? [
          { type: 'text', text: user },
          { type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.base64}` } },
        ]
      : user;

    const body = {
      model: this._model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: false,
      response_format: { type: 'json_object' },
    };

    const url = `${this._baseUrl}/v1/chat/completions`;
    const doFetch = async (payload) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this._timeoutMs),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`LM Studio HTTP ${res.status}${txt ? `: ${txt.slice(0, 200)}` : ''}`);
      }
      return await res.json();
    };

    let data;
    try {
      data = await doFetch(body);
    } catch (e) {
      if (/response_format|json_object|not supported|unsupported/i.test(String(e?.message))) {
        const { response_format, ...rest } = body;
        data = await doFetch(rest);
      } else {
        throw e;
      }
    }
    const text =
      data?.choices?.[0]?.message?.content?.trim() ??
      data?.choices?.[0]?.text?.trim() ??
      '';
    return { text };
  }
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- lmstudio`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server-generate/lib/providers/lmstudio.js server-generate/lib/providers/lmstudio.test.js
git commit -m "feat(gen): LM Studio provider"
```

---

## Task 12: 3010 — Anthropic provider (skeleton)

**Files:**
- Create: `server-generate/lib/providers/anthropic.js`

- [ ] **Step 1: Add SDK dep (optional)**

Run: `npm install --save @anthropic-ai/sdk@^0.32`

- [ ] **Step 2: Implement**

Create `server-generate/lib/providers/anthropic.js`:
```js
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider {
  constructor({ apiKey, model }) {
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY required');
    if (!model) throw new Error('ANTHROPIC_MODEL required');
    this.name = 'anthropic';
    this.supportsVision = true;
    this._client = new Anthropic({ apiKey });
    this._model = model;
  }

  async generate({ system, user, image, temperature = 0.7, maxTokens = 900 }) {
    const content = [];
    if (image) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: image.mime, data: image.base64 },
      });
    }
    content.push({ type: 'text', text: user });

    const resp = await this._client.messages.create({
      model: this._model,
      max_tokens: maxTokens,
      temperature,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
    });
    const text = resp.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return { text };
  }
}
```

- [ ] **Step 3: Verify import compiles (no test — needs real API key)**

Run:
```bash
node --input-type=module -e "import('./server-generate/lib/providers/anthropic.js').then(m=>console.log(typeof m.AnthropicProvider))"
```
Expected output: `function`.

- [ ] **Step 4: Commit**

```bash
git add server-generate/lib/providers/anthropic.js package.json package-lock.json
git commit -m "feat(gen): Anthropic provider"
```

---

## Task 13: 3010 — OpenAI provider (skeleton)

**Files:**
- Create: `server-generate/lib/providers/openai.js`

- [ ] **Step 1: Add SDK dep**

Run: `npm install --save openai@^4`

- [ ] **Step 2: Implement**

Create `server-generate/lib/providers/openai.js`:
```js
import OpenAI from 'openai';

export class OpenAIProvider {
  constructor({ apiKey, model }) {
    if (!apiKey) throw new Error('OPENAI_API_KEY required');
    if (!model) throw new Error('OPENAI_MODEL required');
    this.name = 'openai';
    this.supportsVision = true;
    this._client = new OpenAI({ apiKey });
    this._model = model;
  }

  async generate({ system, user, image, temperature = 0.7, maxTokens = 900 }) {
    const userContent = image
      ? [
          { type: 'text', text: user },
          {
            type: 'image_url',
            image_url: { url: `data:${image.mime};base64,${image.base64}` },
          },
        ]
      : user;

    const resp = await this._client.chat.completions.create({
      model: this._model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    });
    const text = resp.choices?.[0]?.message?.content?.trim() ?? '';
    return { text };
  }
}
```

- [ ] **Step 3: Verify import compiles**

Run:
```bash
node --input-type=module -e "import('./server-generate/lib/providers/openai.js').then(m=>console.log(typeof m.OpenAIProvider))"
```
Expected: `function`.

- [ ] **Step 4: Commit**

```bash
git add server-generate/lib/providers/openai.js package.json package-lock.json
git commit -m "feat(gen): OpenAI provider"
```

---

## Task 14: 3010 — provider factory

**Files:**
- Create: `server-generate/lib/providers/index.js`
- Test: `server-generate/lib/providers/index.test.js`

- [ ] **Step 1: Write the failing test**

Create `server-generate/lib/providers/index.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getProvider } from './index.js';

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getProvider', () => {
  it('defaults to lmstudio', () => {
    process.env.MODEL_PROVIDER = '';
    process.env.LM_STUDIO_BASE_URL = 'http://x';
    process.env.LM_STUDIO_MODEL = 'm';
    expect(getProvider().name).toBe('lmstudio');
  });

  it('honors MODEL_PROVIDER', () => {
    process.env.MODEL_PROVIDER = 'lmstudio';
    process.env.LM_STUDIO_BASE_URL = 'http://x';
    process.env.LM_STUDIO_MODEL = 'm';
    expect(getProvider().name).toBe('lmstudio');
  });

  it('throws on unknown provider', () => {
    process.env.MODEL_PROVIDER = 'mystery';
    expect(() => getProvider()).toThrow(/Unknown MODEL_PROVIDER/);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- "providers/index"`
Expected: FAIL.

- [ ] **Step 3: Implement (async; lazy-loads non-default providers so missing SDKs/keys never block default path)**

Create `server-generate/lib/providers/index.js`:
```js
import { LmStudioProvider } from './lmstudio.js';

export async function getProvider() {
  const name = String(process.env.MODEL_PROVIDER || 'lmstudio').toLowerCase();
  switch (name) {
    case 'lmstudio':
      return new LmStudioProvider({
        baseUrl: process.env.LM_STUDIO_BASE_URL,
        model: process.env.LM_STUDIO_MODEL || 'google/gemma-4-e4b',
        vision: process.env.LM_STUDIO_VISION === 'true',
        timeoutMs: Number(process.env.LM_STUDIO_TIMEOUT_MS) || 180_000,
      });
    case 'anthropic': {
      const { AnthropicProvider } = await import('./anthropic.js');
      return new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
      });
    }
    case 'openai': {
      const { OpenAIProvider } = await import('./openai.js');
      return new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      });
    }
    default:
      throw new Error(`Unknown MODEL_PROVIDER: ${name}`);
  }
}
```

Now update the test from Step 1 — every `it()` becomes `async`, every direct call wraps in `await`:

Replace the body of `server-generate/lib/providers/index.test.js` with:
```js
import { describe, it, expect, afterEach } from 'vitest';
import { getProvider } from './index.js';

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getProvider', () => {
  it('defaults to lmstudio', async () => {
    process.env.MODEL_PROVIDER = '';
    process.env.LM_STUDIO_BASE_URL = 'http://x';
    process.env.LM_STUDIO_MODEL = 'm';
    expect((await getProvider()).name).toBe('lmstudio');
  });

  it('honors MODEL_PROVIDER', async () => {
    process.env.MODEL_PROVIDER = 'lmstudio';
    process.env.LM_STUDIO_BASE_URL = 'http://x';
    process.env.LM_STUDIO_MODEL = 'm';
    expect((await getProvider()).name).toBe('lmstudio');
  });

  it('throws on unknown provider', async () => {
    process.env.MODEL_PROVIDER = 'mystery';
    await expect(getProvider()).rejects.toThrow(/Unknown MODEL_PROVIDER/);
  });
});
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- "providers/index"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server-generate/lib/providers/index.js server-generate/lib/providers/index.test.js
git commit -m "feat(gen): provider factory with lazy loading"
```

---

## Task 15: 3010 — refactored personaPostGenerator

**Files:**
- Create: `server-generate/lib/personaPostGenerator.js`
- Test: `server-generate/lib/personaPostGenerator.test.js`

- [ ] **Step 1: Write the failing test**

Create `server-generate/lib/personaPostGenerator.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import { generatePersonaPosts } from './personaPostGenerator.js';

function fakeProvider({ supportsVision = false, replies } = {}) {
  let i = 0;
  return {
    name: 'fake',
    supportsVision,
    generate: vi.fn(async () => {
      const r = replies[i++] ?? replies[replies.length - 1];
      return { text: r };
    }),
  };
}

const ok = (persona) =>
  JSON.stringify({ content: `text ${persona}`, sentiment: 'positive' });

describe('generatePersonaPosts', () => {
  it('returns 3 posts in [productivite, securite, popularite] order', async () => {
    const provider = fakeProvider({ replies: [ok('a'), ok('b'), ok('c')] });
    const posts = await generatePersonaPosts({
      provider,
      profile: { firstname: 'A' },
      harvestedSignals: null,
      assetImage: null,
      assetImageForPersona: null,
    });
    expect(posts.map((p) => p.persona)).toEqual([
      'productivite',
      'securite',
      'popularite',
    ]);
    expect(posts.every((p) => p.content)).toBe(true);
  });

  it('attaches image metadata to the named persona when assetImage + vision', async () => {
    const provider = fakeProvider({
      supportsVision: true,
      replies: [ok('a'), ok('b'), ok('c')],
    });
    const posts = await generatePersonaPosts({
      provider,
      profile: {},
      harvestedSignals: null,
      assetImage: { filename: 'x.png', mime: 'image/png', base64: 'AAA' },
      assetImageForPersona: 'securite',
    });
    const sec = posts.find((p) => p.persona === 'securite');
    expect(sec.attachedImage).toEqual({
      filename: 'x.png',
      mime: 'image/png',
      visionAnalysed: true,
    });
  });

  it('falls back to filename-only and visionAnalysed:false when provider has no vision', async () => {
    const provider = fakeProvider({
      supportsVision: false,
      replies: [ok('a'), ok('b'), ok('c')],
    });
    const posts = await generatePersonaPosts({
      provider,
      profile: {},
      harvestedSignals: null,
      assetImage: { filename: 'y.png', mime: 'image/png', base64: 'BBB' },
      assetImageForPersona: 'productivite',
    });
    const prod = posts.find((p) => p.persona === 'productivite');
    expect(prod.attachedImage.visionAnalysed).toBe(false);
  });

  it('throws when any persona returns empty content (all-or-nothing)', async () => {
    const provider = fakeProvider({
      replies: [ok('a'), '{}', ok('c'), '{}'], // 1st retry path also empty
    });
    await expect(
      generatePersonaPosts({
        provider,
        profile: {},
        harvestedSignals: null,
        assetImage: null,
        assetImageForPersona: null,
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- personaPostGenerator`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `server-generate/lib/personaPostGenerator.js`:
```js
import { PERSONAS, PERSONA_SYSTEM_PROMPTS } from './prompts/personas.js';
import {
  IMAGE_POST_PROMPT_EXTENSION,
  imageTextFallbackNote,
} from './prompts/fallbackNotes.js';
import { buildUserPayload } from './prompts/buildUserPayload.js';

function extractJson(text) {
  const t = String(text).trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```\s*$/im.exec(t);
  const s = fenced ? fenced[1].trim() : t;
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeSentiment(v) {
  if (v == null) return null;
  const s = String(v).toLowerCase();
  return s === 'positive' || s === 'negative' ? s : null;
}

function parsePost(raw, fallbackPersona) {
  const obj = extractJson(raw);
  if (!obj) {
    return { content: '', sentiment: null };
  }
  const content = String(obj.content ?? '').trim();
  const sentiment = normalizeSentiment(obj.sentiment);
  if (sentiment) return { content, sentiment };
  const inferred =
    fallbackPersona === 'securite' ? 'negative' :
    fallbackPersona === 'productivite' ? 'positive' :
    fallbackPersona === 'popularite' ? 'positive' :
    null;
  return { content, sentiment: inferred };
}

export async function generatePersonaPosts({
  provider,
  profile,
  harvestedSignals,
  assetImage,
  assetImageForPersona,
}) {
  const userPayload = buildUserPayload(profile, harvestedSignals);

  const runOne = async (persona) => {
    const isAsset = assetImage && assetImageForPersona === persona;
    let system = PERSONA_SYSTEM_PROMPTS[persona];
    let imageArg;
    let visionAttempted = false;

    if (isAsset && provider.supportsVision) {
      system += IMAGE_POST_PROMPT_EXTENSION;
      imageArg = assetImage;
      visionAttempted = true;
    } else if (isAsset) {
      system += imageTextFallbackNote(assetImage.filename);
    }

    const callOnce = async (temp) =>
      parsePost(
        (
          await provider.generate({
            system,
            user: userPayload,
            image: imageArg,
            temperature: temp,
          })
        ).text,
        persona,
      );

    let parsed;
    let visionOk = false;
    try {
      parsed = await callOnce(0.7);
      if (parsed.content && visionAttempted) visionOk = true;
    } catch (e) {
      // If vision call fails, retry text-only.
      if (visionAttempted) {
        imageArg = undefined;
        system = PERSONA_SYSTEM_PROMPTS[persona] + imageTextFallbackNote(assetImage.filename);
        parsed = await callOnce(0.7);
      } else {
        throw e;
      }
    }
    if (!parsed.content) parsed = await callOnce(0.35);
    if (!parsed.content) {
      throw new Error(`Empty content for persona ${persona} after retry`);
    }

    const post = {
      persona,
      content: parsed.content,
      sentiment: parsed.sentiment,
    };
    if (isAsset) {
      post.attachedImage = {
        filename: assetImage.filename,
        mime: assetImage.mime,
        visionAnalysed: visionOk,
      };
    }
    return post;
  };

  return await Promise.all(PERSONAS.map((p) => runOne(p)));
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- personaPostGenerator`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server-generate/lib/personaPostGenerator.js server-generate/lib/personaPostGenerator.test.js
git commit -m "feat(gen): refactored personaPostGenerator using provider abstraction"
```

---

## Task 16: 3010 — POST /internal/generate

**Files:**
- Modify: `server-generate.js` (full rewrite)

- [ ] **Step 1: Rewrite server-generate.js**

Replace `server-generate.js` entirely with:
```js
import 'dotenv/config';
import express from 'express';
import { getProvider } from './server-generate/lib/providers/index.js';
import { generatePersonaPosts } from './server-generate/lib/personaPostGenerator.js';

const app = express();
app.use(express.json({ limit: '20mb' }));

const INTERNAL_SHARED_SECRET = process.env.INTERNAL_SHARED_SECRET ?? '';

let providerSingleton;
async function getProviderOnce() {
  if (!providerSingleton) {
    providerSingleton = await getProvider();
    console.log(
      `[gen] provider=${providerSingleton.name} vision=${providerSingleton.supportsVision}`,
    );
  }
  return providerSingleton;
}

app.post('/internal/generate', async (req, res) => {
  if (!INTERNAL_SHARED_SECRET || req.get('X-Internal-Token') !== INTERNAL_SHARED_SECRET) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }
  try {
    const { profile, harvestedSignals, assetImage, assetImageForPersona } = req.body ?? {};
    if (!profile || typeof profile !== 'object') {
      return res.status(400).json({ success: false, error: 'profile required' });
    }
    const provider = await getProviderOnce();
    const posts = await generatePersonaPosts({
      provider,
      profile,
      harvestedSignals: harvestedSignals ?? null,
      assetImage: assetImage ?? null,
      assetImageForPersona: assetImageForPersona ?? null,
    });
    res.json({ success: true, posts });
  } catch (err) {
    console.error('[gen] failed:', err?.message || err);
    const msg = String(err?.message || 'generation failed');
    if (/Cannot reach|fetch failed|ECONNREFUSED|ENOTFOUND/i.test(msg)) {
      return res.status(502).json({ success: false, error: 'provider unreachable' });
    }
    res.status(500).json({ success: false, error: 'generation failed' });
  }
});

const PORT = Number(process.env.PORT) || 3010;
app.listen(PORT, () => console.log(`Generator running on http://localhost:${PORT}`));
```

- [ ] **Step 2: Smoke-test against LM Studio**

With LM Studio running locally on port 1234 with a model loaded:
```bash
INTERNAL_SHARED_SECRET=devsecret \
LM_STUDIO_BASE_URL=http://127.0.0.1:1234 \
LM_STUDIO_VISION=true \
PORT=3010 \
node server-generate.js &

sleep 1
curl -X POST http://127.0.0.1:3010/internal/generate \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: devsecret" \
  -d '{"profile":{"firstname":"Test","lastname":"User"}}'
```
Expected: `{"success":true,"posts":[...3 entries...]}`. Then `kill %1`.

- [ ] **Step 3: Commit**

```bash
git add server-generate.js
git commit -m "refactor(3010): stateless /internal/generate using provider abstraction"
```

---

## Task 17: 3001 — asset selection module

**Files:**
- Create: `server/lib/assetSelection.js`
- Test: `server/lib/assetSelection.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/lib/assetSelection.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  mostRecentPersonaWithImage,
  nextPersonaInCycle,
  pickAsset,
} from './assetSelection.js';

describe('mostRecentPersonaWithImage', () => {
  it('returns null when no posts have image', () => {
    expect(mostRecentPersonaWithImage([])).toBe(null);
    expect(mostRecentPersonaWithImage([{ persona: 'productivite' }])).toBe(null);
  });
  it('returns first post with attachedImage from front', () => {
    const posts = [
      { persona: 'productivite' },
      { persona: 'securite', attachedImage: { filename: 'x' } },
      { persona: 'popularite', attachedImage: { filename: 'y' } },
    ];
    expect(mostRecentPersonaWithImage(posts)).toBe('securite');
  });
});

describe('nextPersonaInCycle', () => {
  it('cycle popularite → securite → productivite → popularite', () => {
    expect(nextPersonaInCycle(null)).toBe('popularite');
    expect(nextPersonaInCycle('popularite')).toBe('securite');
    expect(nextPersonaInCycle('securite')).toBe('productivite');
    expect(nextPersonaInCycle('productivite')).toBe('popularite');
  });
});

describe('pickAsset', () => {
  it('returns null when assets empty', () => {
    expect(pickAsset([])).toBe(null);
  });
  it('prefers assets never used or used > 3 generations ago', () => {
    const fresh = { filename: 'a.png', lastUsedAt: null };
    const old = { filename: 'b.png', lastUsedAt: '2020-01-01T00:00:00Z' };
    const recent = { filename: 'c.png', lastUsedAt: new Date().toISOString() };
    const picked = pickAsset([fresh, old, recent], { recentPostCount: 0 });
    expect(['a.png', 'b.png']).toContain(picked.filename);
  });
  it('falls back to any asset if all have been used recently', () => {
    const recent = { filename: 'c.png', lastUsedAt: new Date().toISOString() };
    const picked = pickAsset([recent], { recentPostCount: 0 });
    expect(picked.filename).toBe('c.png');
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- assetSelection`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `server/lib/assetSelection.js`:
```js
const PERSONA_CYCLE = ['popularite', 'securite', 'productivite'];
const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days as a proxy for "last 3 generations"

export function mostRecentPersonaWithImage(existingPosts) {
  if (!Array.isArray(existingPosts)) return null;
  for (const p of existingPosts) {
    if (p && p.attachedImage) {
      const persona = String(p.persona ?? '').toLowerCase();
      if (PERSONA_CYCLE.includes(persona)) return persona;
    }
  }
  return null;
}

export function nextPersonaInCycle(prevPersona) {
  const idx = PERSONA_CYCLE.indexOf(String(prevPersona ?? '').toLowerCase());
  return PERSONA_CYCLE[(idx + 1) % PERSONA_CYCLE.length];
}

function isRecent(lastUsedAt) {
  if (!lastUsedAt) return false;
  const t = Date.parse(lastUsedAt);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < RECENT_WINDOW_MS;
}

export function pickAsset(assets) {
  if (!Array.isArray(assets) || assets.length === 0) return null;
  const fresh = assets.filter((a) => !isRecent(a.lastUsedAt));
  const pool = fresh.length > 0 ? fresh : assets;
  return pool[Math.floor(Math.random() * pool.length)];
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- assetSelection`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/assetSelection.js server/lib/assetSelection.test.js
git commit -m "feat(3001): asset selection — persona cycling + recency-aware picking"
```

---

## Task 18: 3001 — internal generator client

**Files:**
- Create: `server/lib/internalGenerator.js`

- [ ] **Step 1: Implement (no unit test — pure HTTP wrapper, covered by integration smoke later)**

Create `server/lib/internalGenerator.js`:
```js
export async function callGenerator(payload) {
  const url = process.env.INTERNAL_GENERATOR_URL ?? 'http://127.0.0.1:3010';
  const token = process.env.INTERNAL_SHARED_SECRET ?? '';
  const timeoutMs = Number(process.env.INTERNAL_GENERATOR_TIMEOUT_MS) || 200_000;

  let res;
  try {
    res = await fetch(`${url.replace(/\/$/, '')}/internal/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': token,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const msg = String(e?.message || '');
    if (/timed out|timeout|abort/i.test(msg) || e?.name === 'TimeoutError') {
      const err = new Error(`Generation timed out after ${Math.round(timeoutMs / 1000)}s`);
      err.status = 504;
      throw err;
    }
    const err = new Error('Generator unreachable');
    err.status = 502;
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success !== true) {
    const err = new Error(data.error || `Generator HTTP ${res.status}`);
    err.status = res.status >= 400 && res.status < 600 ? res.status : 500;
    throw err;
  }
  return data.posts;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/lib/internalGenerator.js
git commit -m "feat(3001): internal generator client with error mapping"
```

---

## Task 19: 3001 — POST /api/posts/generate

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add handler before app.listen**

Add the following imports at the top of `server.js`:
```js
import {
  requireUser,
  getProfile,
  listAssets,
  getAssetBytes,
  markAssetUsed,
  listPosts,
  prependPosts,
} from './server/lib/repository/index.js';
import {
  mostRecentPersonaWithImage,
  nextPersonaInCycle,
  pickAsset,
} from './server/lib/assetSelection.js';
import { callGenerator } from './server/lib/internalGenerator.js';
```

Add this handler before `app.listen`:
```js
app.post('/api/posts/generate', async (req, res) => {
  let userId;
  try {
    userId = await requireUser(req);
  } catch (err) {
    return res.status(err.status ?? 500).json({ success: false, error: err.message });
  }

  try {
    const r = await getProfile(userId);
    if (!r) return res.status(404).json({ success: false, error: 'profile not found' });

    const { profile: rawProfile, harvestedSignals } = r;
    const { wallpaperBase64, wallpaper_base64, ...profile } = rawProfile;

    const assets = await listAssets(userId);
    const existing = await listPosts(userId);
    const prevPersona = mostRecentPersonaWithImage(existing);
    const targetPersona = nextPersonaInCycle(prevPersona);
    const chosen = pickAsset(assets);

    let assetImage = null;
    let assetImageForPersona = null;
    let chosenForPersist = null;
    if (chosen) {
      const bytes = await getAssetBytes(userId, chosen.filename);
      if (bytes) {
        assetImage = {
          filename: chosen.filename,
          mime: bytes.mime,
          base64: bytes.buffer.toString('base64'),
        };
        assetImageForPersona = targetPersona;
        chosenForPersist = chosen;
      }
    }

    const posts = await callGenerator({
      userId,
      profile,
      harvestedSignals,
      assetImage,
      assetImageForPersona,
    });

    const base = Date.now();
    const stamped = posts.map((p, i) => {
      const out = { ...p, createdAt: new Date(base + (3 - i)).toISOString() };
      if (out.attachedImage && chosenForPersist && p.persona === assetImageForPersona) {
        out.attachedImage = {
          filename: chosenForPersist.filename,
          url: chosenForPersist.url,
          mime: chosenForPersist.mime,
          visionAnalysed: !!p.attachedImage.visionAnalysed,
        };
      }
      return out;
    });

    if (chosenForPersist) {
      await markAssetUsed(userId, chosenForPersist.filename);
    }
    await prependPosts(userId, stamped);

    res.json({
      success: true,
      posts: stamped,
      assetPostSkipped: !chosenForPersist,
    });
  } catch (err) {
    const status = err?.status ?? 500;
    const msg =
      status === 502 ? 'Generator unreachable' :
      status === 504 ? err.message :
      'Generation failed';
    res.status(status).json({ success: false, error: msg });
  }
});
```

- [ ] **Step 2: Smoke-test the full flow**

In two terminals:
```bash
# Terminal 1: 3010
INTERNAL_SHARED_SECRET=devsecret \
LM_STUDIO_BASE_URL=http://127.0.0.1:1234 \
LM_STUDIO_VISION=true \
PORT=3010 \
node server-generate.js

# Terminal 2: 3001
INTERNAL_SHARED_SECRET=devsecret \
INTERNAL_GENERATOR_URL=http://127.0.0.1:3010 \
WEB_ORIGIN=http://localhost:5173 \
node server.js
```
Then in a third terminal (with at least one profile already in `profiles/`):
```bash
curl -X POST http://localhost:3001/api/posts/generate -H "Content-Type: application/json" -d '{}'
```
Expected: `{"success":true,"posts":[…3 entries…],"assetPostSkipped":<bool>}`. Note whether one post has `attachedImage.url` (only if assets exist for that user).

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(3001): POST /api/posts/generate proxies to 3010 and persists results"
```

---

## Task 20: Frontend — apiOrigin + apiFetch

**Files:**
- Create: `src/lib/apiOrigin.js`
- Create: `src/lib/apiFetch.js`

- [ ] **Step 1: apiOrigin.js**

Create `src/lib/apiOrigin.js`:
```js
const raw =
  (import.meta?.env?.VITE_API_ORIGIN && String(import.meta.env.VITE_API_ORIGIN)) ||
  'http://localhost:3001';

export const API_ORIGIN = raw.replace(/\/$/, '');
```

- [ ] **Step 2: apiFetch.js**

Create `src/lib/apiFetch.js`:
```js
import { API_ORIGIN } from './apiOrigin.js';

const AUTH_MODE = import.meta?.env?.VITE_AUTH_MODE ?? 'stub';

export async function apiFetch(pathOrUrl, options = {}) {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${API_ORIGIN}${pathOrUrl}`;
  const init = { ...options };

  init.headers = { ...(options.headers ?? {}) };
  if (options.body !== undefined && typeof options.body !== 'string' && !(options.body instanceof FormData)) {
    init.body = JSON.stringify(options.body);
    init.headers['Content-Type'] = init.headers['Content-Type'] ?? 'application/json';
  }

  if (AUTH_MODE === 'cookie') init.credentials = 'include';

  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/apiOrigin.js src/lib/apiFetch.js
git commit -m "feat(web): apiOrigin + apiFetch helpers"
```

---

## Task 21: Frontend — wire generate button to 3001

**Files:**
- Modify: `src/app/App.jsx`
- Modify: `src/features/feed/PostsTab.jsx:12`
- Modify: `package.json`

- [ ] **Step 1: App.jsx changes**

In `src/app/App.jsx`:
- Find lines 18-19 (the `GENERATE_API_ORIGIN` constant). Delete those lines.
- Add this import near the other top-of-file imports (alongside other `@/lib/*` imports if present, otherwise just add it):
  ```js
  import { apiFetch } from '@/lib/apiFetch.js';
  ```
- Replace the body of `handleGeneratePersonaPosts` (lines 204-227) with:
  ```js
  const handleGeneratePersonaPosts = async () => {
    if (postGen.loading || !profile) return;
    setPostGen({ loading: true, error: null });
    try {
      const data = await apiFetch('/api/posts/generate', { method: 'POST', body: {} });
      const newPosts = Array.isArray(data.posts) ? data.posts : [];
      setProfile((prev) => {
        if (!prev) return prev;
        const existing = Array.isArray(prev.personaPosts) ? prev.personaPosts : [];
        return { ...prev, personaPosts: [...newPosts, ...existing] };
      });
      setPostGen({ loading: false, error: null });
    } catch (e) {
      setPostGen({ loading: false, error: e?.message || 'Generation failed' });
    }
  };
  ```

- [ ] **Step 2: PostsTab.jsx — switch hardcoded origin**

In `src/features/feed/PostsTab.jsx`, replace line 12:
```js
const API_ORIGIN = 'http://localhost:3001';
```
with:
```js
import { API_ORIGIN } from '@/lib/apiOrigin.js';
```
(Move it to the imports block at the top of the file; remove line 12 entirely.)

- [ ] **Step 3: package.json — drop VITE_GENERATE_API_ORIGIN**

In `package.json`, replace the `dev:web` script:
```json
"dev:web": "VITE_API_ORIGIN=\"http://localhost:3001\" vite",
```

- [ ] **Step 4: Manual test**

Start both servers (Task 19), then:
```bash
npm run dev:web
```
Open the resulting URL, navigate to the home or profile view, click "GENERATE NEW CONTENT / DO ANOTHER ANALYSIS". Expected: button shows "GENERATING…" then 3 new posts appear at the top of the feed, one with an attached image if assets exist for the active user.

- [ ] **Step 5: Commit**

```bash
git add src/app/App.jsx src/features/feed/PostsTab.jsx package.json
git commit -m "refactor(web): generate button hits 3001 via apiFetch; single API origin"
```

---

## Task 22: .env.example

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Write template**

Create `.env.example`:
```
# === 3001 (web backend) ===
PORT=3001
WEB_ORIGIN=http://localhost:5173
INTERNAL_GENERATOR_URL=http://127.0.0.1:3010
INTERNAL_SHARED_SECRET=changeme-internal-secret
INTERNAL_GENERATOR_TIMEOUT_MS=200000
ASSET_SYNC_SECRET=changeme-asset-secret
UPLOAD_MAX_BYTES=15728640

# === 3010 (generator worker) ===
# PORT is read from same env when running 3010; in dev they don't conflict because of distinct ports.
# Override with PORT=3010 when starting server-generate.js.
MODEL_PROVIDER=lmstudio
LM_STUDIO_BASE_URL=http://127.0.0.1:1234
LM_STUDIO_MODEL=google/gemma-4-e4b
LM_STUDIO_VISION=true
LM_STUDIO_TIMEOUT_MS=180000

# Only if MODEL_PROVIDER != lmstudio:
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-haiku-4-5
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# === Frontend (build-time, Vite) ===
VITE_API_ORIGIN=http://localhost:3001
VITE_AUTH_MODE=stub
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: env template"
```

---

## Task 23: Cleanup — remove post_generator/ reference folder

**Files:**
- Delete: `post_generator/` (entire directory)
- Delete: `server/lib/personaPostGenerator.js` (moved to server-generate/lib/ in Task 15)
- Delete: `server/lib/currentProfile.js` (replaced by repository module)

- [ ] **Step 1: Verify no live imports remain**

Run:
```bash
grep -rn "post_generator\|server/lib/personaPostGenerator\|server/lib/currentProfile" \
  --exclude-dir=node_modules --exclude-dir=docs .
```
Expected: no results outside the doc files (`docs/superpowers/...`).

- [ ] **Step 2: Delete**

```bash
rm -rf post_generator/
rm -f server/lib/personaPostGenerator.js
rm -f server/lib/currentProfile.js
```

- [ ] **Step 3: Verify tests still pass**

Run: `npm test`
Expected: PASS for all tests written so far.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove post_generator/ reference + dead lib files"
```

---

## Task 24: Final smoke test (manual)

**Files:** None — verification only.

- [ ] **Step 1: Start everything**

Three terminals.

Terminal 1 (LM Studio): start LM Studio app, load a vision-capable model, start its server on `:1234`.

Terminal 2 (backend):
```bash
INTERNAL_SHARED_SECRET=devsecret \
INTERNAL_GENERATOR_URL=http://127.0.0.1:3010 \
LM_STUDIO_BASE_URL=http://127.0.0.1:1234 \
LM_STUDIO_VISION=true \
WEB_ORIGIN=http://localhost:5173 \
ASSET_SYNC_SECRET=devassetsecret \
npm run servers
```

Terminal 3 (frontend):
```bash
npm run dev:web
```

- [ ] **Step 2: Seed an asset**

```bash
curl -X POST http://localhost:3001/api/assets/babubub-§-bibabab \
  -H "X-Asset-Sync-Token: devassetsecret" \
  -F "files=@public/uploads/cb51fab9f13c97a6ca59ae93aa7230d1c60685e8b4bd6fffba62568cc5aa2d4b.jpg"
```
(Use whichever profile id exists in `profiles/`. If `babubub-§-bibabab` no longer exists, run with the correct id.)

Expected: `{"added":[…],"skipped":[]}`.

- [ ] **Step 3: Click the button in the browser**

Navigate to the app at `http://localhost:5173`. Open the home view. Click "GENERATE NEW CONTENT / DO ANOTHER ANALYSIS".

Expected:
- Button shows "GENERATING…" while waiting.
- 3 new posts appear at the top of the feed.
- Exactly one of them has an attached image visible.
- The text of that post references the image content (vision worked).
- No errors in browser console; no errors in either backend terminal.

- [ ] **Step 4: Acceptance criteria walkthrough**

Verify each spec acceptance criterion against the running system:
1. Click → 3 new posts created. ✅
2. Exactly one has `attachedImage.url`. ✅
3. With vision-capable LM Studio: text references image. ✅
4. No localhost / Electron dependency on the request path. ✅
5. 3010 not reachable from outside. (Verify by `curl http://<your-public-ip>:3010/internal/generate` from another machine — should fail. Optional.)
6. `MODEL_PROVIDER=anthropic` / `openai` works. (Optional unless you have keys.)

- [ ] **Step 5: Commit any post-smoke-test fixes**

If anything in the smoke test failed and required code changes, commit those fixes with a descriptive message. Otherwise no commit needed.

---

## Self-review

**Spec coverage:**
- Architecture C ✅ Tasks 8, 16, 19
- Stub auth seam (`requireUser`) ✅ Task 3
- `harvestedSignals` optional pipeline ✅ Tasks 4, 8, 10, 15, 19
- Asset source from `/api/assets/:userId` ✅ Task 9
- LM Studio default in dev + prod ✅ Tasks 11, 14
- Anthropic + OpenAI alternatives ✅ Tasks 12-14
- Repository module abstracts disk ✅ Tasks 2-7
- `markAssetUsed` ✅ Tasks 6, 19
- Persona cycling popularite → securite → productivite ✅ Task 17
- All-or-nothing on persona failure ✅ Task 15 (test 4)
- 3010 returns no URL, no createdAt; 3001 attaches both ✅ Tasks 16, 19
- 3010 only reachable via X-Internal-Token ✅ Task 16
- Frontend single origin (drop VITE_GENERATE_API_ORIGIN) ✅ Tasks 20-21
- CORS config-driven for cookie-auth future ✅ Task 8
- `.env.example` ✅ Task 22
- Delete `post_generator/` ✅ Task 23
- Acceptance criteria walkthrough ✅ Task 24

**Placeholder scan:** No `TBD`, no `TODO`, no "implement later", no "similar to Task N", no "add error handling" without code. Every code step shows actual code. Every command step shows the actual command and expected output.

**Type / signature consistency:**
- `addAsset(userId, { buffer, mime, originalName })` — matches usage in Tasks 6, 8, 9, 19.
- `getAssetBytes(userId, filename) → { buffer, mime } | null` — matches Tasks 6, 19.
- `pickAsset(assets) → asset | null` — matches Tasks 17, 19.
- `callGenerator(payload) → posts[]` — matches Tasks 18, 19.
- `getProvider()` is `async` — matches Task 14 (final form) and Task 16 (`await getProvider()`).
- Persona cycle `popularite → securite → productivite` — matches Task 17 test and Task 15 input contract.
- `provider.generate({system, user, image?})` interface — matches Tasks 11, 12, 13, 15.

No gaps detected.
