import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import crypto from 'crypto';
import { normalizeAttachedAsset, translateLegacyImage } from './server/lib/attachedAsset.js';
import {
  mergeStaticProfileFields,
  normalizeProfilePayload,
} from './server/lib/profileNormalization.js';
import {
  resetHarvestSession,
} from './server/lib/harvestSession.js';
import {
  readAccountState,
  deleteAllAccountData,
  recordAccountDeletion,
} from './server/lib/accountDeletion.js';
import {
  filterProfilesNotDeleted,
  isProfileSlugDeleted,
} from './server/lib/deletedProfileSlugs.js';
import { getHostedAccountState } from './server/lib/hostedAccountDeletion.js';
import {
  readPostsForId,
  writePostsForId,
  syncPersonaPostsFromClient,
  appendPersonaPosts,
  POSTS_DIR,
} from './server/lib/postsStore.js';
import {
  createCompliantJoinPost,
  hasCompliantJoinPost,
  joinCreatedAtAfterExisting,
} from './server/lib/compliantSystemPosts.js';
import { serverConfig } from './server/lib/env.js';
import { supabaseClients } from './server/lib/supabaseClient.js';
import { createAuthRoutes } from './server/routes/authRoutes.js';
import { createPublicDemoRoutes } from './server/routes/publicDemoRoutes.js';
import { createPublicProfileStore } from './server/lib/publicProfileStore.js';
import { createStorageStore } from './server/lib/storageStore.js';
import { buildPublicLeaderboards } from './server/lib/publicLeaderboards.js';
import { createGenerationJobStore } from './server/lib/generationJobStore.js';
import { createGenerationJobRoutes } from './server/routes/generationJobRoutes.js';
import { createHarvestRoutes } from './server/routes/harvestRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = path.join(__dirname, 'profiles');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

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

const app = express();
app.use(cors());
// Allow larger payloads for personaPosts and uploaded images.
app.use(express.json({ limit: '10mb' }));

// Ensure profiles/ directory exists on startup
await fs.mkdir(PROFILES_DIR, { recursive: true });
await fs.mkdir(POSTS_DIR, { recursive: true });
await fs.mkdir(UPLOADS_DIR, { recursive: true });

// Harvest + account-state: always mounted (hosted web UI + Electron remote collect).
app.use('/api', createHarvestRoutes());

app.get('/api/account-state', async (_req, res) => {
  try {
    if (serverConfig.hostedMode) {
      return res.json(getHostedAccountState());
    }
    const state = await readAccountState(PROFILES_DIR);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve uploaded media files (local dev only; hosted uses Supabase Storage URLs).
if (!serverConfig.hostedMode) {
  app.use('/uploads', express.static(UPLOADS_DIR));
}

// ── Hosted (Supabase, multi-user) mode ──────────────────────────────────────
// When Supabase keys are present, mount the public multi-user demo API backed by
// Supabase Postgres + Storage. Otherwise fall back to the local file-backed routes.
if (serverConfig.hostedMode) {
  const storageStore = createStorageStore({
    supabase: supabaseClients.service,
    publicBaseUrl: serverConfig.publicBaseUrl,
  });
  const profileStore = createPublicProfileStore(supabaseClients.service, { storageStore });
  const jobStore = createGenerationJobStore(supabaseClients.service);

  app.use('/api/auth', createAuthRoutes({ supabaseAnon: supabaseClients.anon }));
  app.use('/api', createPublicDemoRoutes({
    supabaseService: supabaseClients.service,
    profileStore,
    storageStore,
    buildLeaderboards: buildPublicLeaderboards,
  }));
  app.use('/api', createGenerationJobRoutes({
    config: serverConfig,
    supabaseService: supabaseClients.service,
    profileStore,
    jobStore,
    storageStore,
  }));
  console.log('[hosted] Supabase public demo routes enabled');
} else {
  console.log('[local] File-backed demo routes enabled');
}

if (!serverConfig.hostedMode) {
// ── Upload endpoint ─────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    // Temp name; we will rename to a hash-based name after upload (dedupe).
    const orig = String(file.originalname || 'upload');
    const safe = orig.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    const ext = path.extname(safe) || '';
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    cb(null, `tmp-${unique}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

function extFromMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m === 'image/jpeg') return '.jpg';
  if (m === 'image/png') return '.png';
  if (m === 'image/webp') return '.webp';
  if (m === 'image/gif') return '.gif';
  if (m === 'image/avif') return '.avif';
  return '';
}

// POST /api/upload — upload one file, returns URL
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'missing file' });
    const tmpPath = req.file.path;
    const buf = await fs.readFile(tmpPath);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');

    const mimeExt = extFromMime(req.file.mimetype);
    const origExt = path.extname(String(req.file.originalname || '')).toLowerCase();
    const tmpExt = path.extname(String(req.file.filename || '')).toLowerCase();
    const ext = mimeExt || origExt || tmpExt || '';

    const finalFilename = `${hash}${ext}`;
    const finalPath = path.join(UPLOADS_DIR, finalFilename);

    try {
      await fs.access(finalPath);
      // File already exists → delete temp upload and reuse canonical filename.
      await fs.unlink(tmpPath);
    } catch (_notFound) {
      // New content → rename temp to canonical hash name.
      await fs.rename(tmpPath, finalPath);
    }

    res.status(200).json({ filename: finalFilename, url: `/uploads/${finalFilename}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/profile — save a profile as {firstname}-{lastname}.json
app.post('/api/profile', async (req, res) => {
  const body = req.body;
  const first = (body.firstname ?? body.firstName ?? '').trim().toLowerCase();
  const last  = (body.lastname  ?? body.lastName  ?? '').trim().toLowerCase();

  if (!first || !last) {
    return res.status(400).json({ error: 'firstname and lastname are required' });
  }

  const filename = `${first}-${last}.json`;
  const filepath = path.join(PROFILES_DIR, filename);
  const id = `${first}-${last}`;

  try {
    // Single active profile: remove other users' files, but keep this user's posts on score-only syncs.
    const existingProfiles = (await fs.readdir(PROFILES_DIR)).filter((f) => f.endsWith('.json'));
    await Promise.all(
      existingProfiles
        .filter((f) => f !== filename)
        .map(async (f) => {
          await fs.unlink(path.join(PROFILES_DIR, f));
          const otherId = f.replace(/\.json$/i, '');
          try {
            await fs.unlink(path.join(POSTS_DIR, `${otherId}.json`));
          } catch (err) {
            if (err.code !== 'ENOENT') throw err;
          }
        }),
    );

    let existingProfile = null;
    try {
      existingProfile = JSON.parse(await fs.readFile(filepath, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    const toStore = mergeStaticProfileFields(
      normalizeProfilePayload(body),
      existingProfile,
    );
    const { personaPosts } = toStore;
    delete toStore.personaPosts;
    delete toStore.persona_posts;

    // Harvest / score updates omit personaPosts so WebDiplome-generated posts are preserved.
    if (personaPosts !== undefined) {
      const replace =
        body.replacePersonaPosts === true || body.replace_persona_posts === true;
      await syncPersonaPostsFromClient(id, personaPosts, { replace }, normalizePost);
    }

    const currentPosts = await readPostsForId(id);
    if (!hasCompliantJoinPost(currentPosts)) {
      const displayName = [body.firstname, body.lastname]
        .map((s) => String(s ?? '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();
      const joinPost = createCompliantJoinPost({
        profile: toStore,
        userDisplayName: displayName || 'User',
        dominantPersona: toStore.dominantPersona,
        createdAt: joinCreatedAtAfterExisting(currentPosts),
      });
      await appendPersonaPosts(id, [joinPost], normalizePost);
    }

    await fs.writeFile(filepath, JSON.stringify(toStore, null, 2), 'utf8');
    res.status(200).json({ id, filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/account — wipe all profiles, posts, and harvest session (full reset)
app.delete('/api/account', async (req, res) => {
  const body = req.body ?? {};
  const profileId =
    body.profileId ??
    body.profile_id ??
    (() => {
      const first = String(body.firstname ?? body.firstName ?? '').trim().toLowerCase();
      const last = String(body.lastname ?? body.lastName ?? '').trim().toLowerCase();
      return first && last ? `${first}-${last}` : null;
    })();

  try {
    const state = await deleteAllAccountData(PROFILES_DIR, POSTS_DIR, { profileId });
    resetHarvestSession();
    res.json({ success: true, ...state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/profile/:id — remove one profile and its posts
app.delete('/api/profile/:id', async (req, res) => {
  const id = req.params.id;
  const profilePath = path.join(PROFILES_DIR, `${id}.json`);
  const postsPath = path.join(POSTS_DIR, `${id}.json`);

  try {
    let removedProfile = false;
    let removedPosts = false;
    try {
      await fs.unlink(profilePath);
      removedProfile = true;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    try {
      await fs.unlink(postsPath);
      removedPosts = true;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    if (!removedProfile && !removedPosts) {
      return res.status(404).json({ error: `Profile '${id}' not found` });
    }
    const state = await recordAccountDeletion(PROFILES_DIR, id);
    resetHarvestSession();
    res.json({ success: true, removedProfile, removedPosts, ...state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/profiles — return array of all saved profiles
app.get('/api/profiles', async (_req, res) => {
  try {
    const { deletedProfileIds } = await readAccountState(PROFILES_DIR);
    const deletedSet = new Set(
      (deletedProfileIds ?? []).map((id) => String(id).trim().toLowerCase()).filter(Boolean),
    );
    const files = (await fs.readdir(PROFILES_DIR)).filter(
      (f) => f.endsWith('.json') && f !== '_account-meta.json',
    );
    const profilesWithMeta = await Promise.all(
      files
        .filter((file) => {
          const id = String(file).replace(/\.json$/i, '').toLowerCase();
          return !deletedSet.has(id);
        })
        .map(async (file) => {
        const filepath = path.join(PROFILES_DIR, file);
        const stat = await fs.stat(filepath);
        const raw = await fs.readFile(filepath, 'utf8');
        const data = JSON.parse(raw);
        const id = String(file).replace(/\.json$/i, '');
        const posts = await readPostsForId(id);
        data.personaPosts = posts;
        return { mtimeMs: stat.mtimeMs, data };
      }),
    );
    // Sort newest first so the UI picks the latest profile when multiple exist.
    profilesWithMeta.sort((a, b) => b.mtimeMs - a.mtimeMs);
    res.json(profilesWithMeta.map((p) => p.data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/profile/:id — return a single profile by id (firstname-lastname)
app.get('/api/profile/:id', async (req, res) => {
  const filename = `${req.params.id}.json`;
  const filepath = path.join(PROFILES_DIR, filename);

  try {
    const { deletedProfileIds } = await readAccountState(PROFILES_DIR);
    if (isProfileSlugDeleted(req.params.id, deletedProfileIds)) {
      return res.status(404).json({ error: `Profile '${req.params.id}' not found` });
    }
    const raw = await fs.readFile(filepath, 'utf8');
    const data = JSON.parse(raw);
    const posts = await readPostsForId(req.params.id);
    data.personaPosts = posts;
    res.json(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: `Profile '${req.params.id}' not found` });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/profile/:id/posts/prepend — persist system or generated posts at feed head
app.post('/api/profile/:id/posts/prepend', async (req, res) => {
  const id = req.params.id;
  const posts = req.body?.posts;
  if (!Array.isArray(posts) || posts.length === 0) {
    return res.status(400).json({ error: 'posts array required' });
  }

  try {
    const profilePath = path.join(PROFILES_DIR, `${id}.json`);
    try {
      await fs.access(profilePath);
    } catch {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const merged = await appendPersonaPosts(id, posts, normalizePost);
    res.json({ success: true, count: merged.length, posts: merged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function loadLocalProfilesForLeaderboards() {
  const { deletedProfileIds } = await readAccountState(PROFILES_DIR);
  const files = (await fs.readdir(PROFILES_DIR)).filter(
    (f) => f.endsWith('.json') && f !== '_account-meta.json',
  );
  const profiles = await Promise.all(
    files
      .filter((file) => !isProfileSlugDeleted(String(file).replace(/\.json$/i, ''), deletedProfileIds))
      .map(async (file) => {
      const id = String(file).replace(/\.json$/i, '');
      const filepath = path.join(PROFILES_DIR, file);
      const raw = await fs.readFile(filepath, 'utf8');
      const data = JSON.parse(raw);
      const posts = await readPostsForId(id);
      return {
        ...data,
        id: data.id ?? id,
        slug: data.slug ?? id,
        personaPosts: posts,
        _harvest: data,
      };
    }),
  );
  return filterProfilesNotDeleted(profiles, deletedProfileIds);
}

// GET /api/leaderboards — live standings for every board (local file-backed mode)
app.get('/api/leaderboards', async (req, res) => {
  try {
    const profiles = await loadLocalProfilesForLeaderboards();
    const viewerSlug = String(
      req.query.viewerSlug ?? req.query.viewer_slug ?? req.query.profileSlug ?? '',
    ).trim() || null;
    res.json({
      success: true,
      leaderboards: buildPublicLeaderboards(profiles, 5, { viewerSlug }),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/posts/:id — remove one post by createdAt from a profile's post array
app.delete('/api/posts/:id', async (req, res) => {
  const id = req.params.id;
  const { createdAt } = req.body ?? {};
  if (!createdAt) return res.status(400).json({ error: 'createdAt required' });

  try {
    const existing = await readPostsForId(id);
    if (existing.length === 0) return res.status(404).json({ error: 'Posts not found for profile' });

    const idx = existing.findIndex((p) => p?.createdAt === createdAt);
    if (idx === -1) return res.status(404).json({ error: 'Post not found' });

    const updated = [...existing.slice(0, idx), ...existing.slice(idx + 1)];
    await writePostsForId(id, updated, normalizePost);
    res.json({ success: true, removed: existing[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
} // end if (!serverConfig.hostedMode)

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
