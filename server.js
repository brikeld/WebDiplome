import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import crypto from 'crypto';
import { normalizeAttachedAsset, translateLegacyImage } from './server/lib/attachedAsset.js';
import { normalizePersonaPercentTriplet } from './server/lib/personaScores.js';
import {
  getHarvestStatus,
  requestHarvest,
  markHarvestRunning,
  pushHarvestProgress,
  completeHarvest,
  failHarvest,
  ackHarvest,
} from './server/lib/harvestSession.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = path.join(__dirname, 'profiles');
const POSTS_DIR = path.join(__dirname, 'posts');
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

async function readPostsForId(id) {
  try {
    const raw = await fs.readFile(path.join(POSTS_DIR, `${id}.json`), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.map(normalizePost) : [];
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function writePostsForId(id, personaPosts) {
  await fs.mkdir(POSTS_DIR, { recursive: true });
  const posts = Array.isArray(personaPosts) ? personaPosts.map(normalizePost) : [];
  await fs.writeFile(path.join(POSTS_DIR, `${id}.json`), JSON.stringify(posts, null, 2), 'utf8');
}

/** Merge camelCase + snake_case for summary fields; stored JSON uses camelCase. */
function normalizeProfilePayload(body) {
  const out = { ...body };
  if (
    body.profileSummary !== undefined ||
    body.profile_summary !== undefined
  ) {
    out.profileSummary = body.profileSummary ?? body.profile_summary;
  }
  if (
    body.userDescription !== undefined ||
    body.user_description !== undefined
  ) {
    out.userDescription = body.userDescription ?? body.user_description;
  }
  delete out.profile_summary;
  delete out.user_description;

  // Normalize posts key too (some clients send snake_case).
  if (body.personaPosts !== undefined || body.persona_posts !== undefined) {
    out.personaPosts = body.personaPosts ?? body.persona_posts;
  }
  delete out.persona_posts;

  if (body.personaScores !== undefined || body.persona_scores !== undefined) {
    const raw = body.personaScores ?? body.persona_scores;
    out.personaScores = normalizePersonaPercentTriplet(raw);
  }
  delete out.persona_scores;

  return out;
}

const app = express();
app.use(cors());
// Allow larger payloads for personaPosts and uploaded images.
app.use(express.json({ limit: '10mb' }));

// Ensure profiles/ directory exists on startup
await fs.mkdir(PROFILES_DIR, { recursive: true });
await fs.mkdir(POSTS_DIR, { recursive: true });
await fs.mkdir(UPLOADS_DIR, { recursive: true });

// Serve uploaded media files
app.use('/uploads', express.static(UPLOADS_DIR));

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

    const toStore = normalizeProfilePayload(body);
    const { personaPosts } = toStore;
    delete toStore.personaPosts;
    delete toStore.persona_posts;

    // Only replace posts when the client explicitly sends them (initial Electron sync).
    // Harvest / score updates omit personaPosts so WebDiplome-generated posts are preserved.
    if (personaPosts !== undefined) {
      await writePostsForId(id, personaPosts);
    }

    await fs.writeFile(filepath, JSON.stringify(toStore, null, 2), 'utf8');
    res.status(200).json({ id, filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/profiles — return array of all saved profiles
app.get('/api/profiles', async (_req, res) => {
  try {
    const files = (await fs.readdir(PROFILES_DIR)).filter((f) => f.endsWith('.json'));
    const profilesWithMeta = await Promise.all(
      files.map(async (file) => {
        const filepath = path.join(PROFILES_DIR, file);
        const stat = await fs.stat(filepath);
        const raw = await fs.readFile(filepath, 'utf8');
        const data = JSON.parse(raw);
        const id = String(file).replace(/\.json$/i, '');
        const posts = await readPostsForId(id);
        if (posts) data.personaPosts = posts;
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
    const raw = await fs.readFile(filepath, 'utf8');
    const data = JSON.parse(raw);
    const posts = await readPostsForId(req.params.id);
    if (posts) data.personaPosts = posts;
    res.json(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: `Profile '${req.params.id}' not found` });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── Harvest orchestration (WebDiplome UI ↔ Electron collector) ─────────────
app.post('/api/harvest/request', (req, res) => {
  const scoresBefore = req.body?.scoresBefore ?? req.body?.scores_before ?? null;
  const dynamicOnly = req.body?.dynamicOnly ?? req.body?.dynamic_only ?? false;
  const result = requestHarvest(scoresBefore, { dynamicOnly });
  if (!result.ok) return res.status(409).json(result);
  res.json({ success: true, ...getHarvestStatus() });
});

app.get('/api/harvest/status', (_req, res) => {
  res.json(getHarvestStatus());
});

app.post('/api/harvest/running', (_req, res) => {
  const result = markHarvestRunning();
  if (!result.ok) return res.status(409).json(result);
  res.json({ success: true, ...getHarvestStatus() });
});

app.post('/api/harvest/progress', (req, res) => {
  pushHarvestProgress(req.body ?? {});
  res.json({ success: true, ...getHarvestStatus() });
});

app.post('/api/harvest/complete', (req, res) => {
  const scoresAfter = req.body?.scoresAfter ?? req.body?.scores_after ?? null;
  completeHarvest(scoresAfter);
  res.json({ success: true, ...getHarvestStatus() });
});

app.post('/api/harvest/error', (req, res) => {
  failHarvest(req.body?.error || req.body?.message || 'Harvest failed');
  res.json({ success: true, ...getHarvestStatus() });
});

app.post('/api/harvest/ack', (_req, res) => {
  ackHarvest();
  res.json({ success: true, ...getHarvestStatus() });
});

// DELETE /api/posts/:id — remove one post by createdAt from a profile's post array
app.delete('/api/posts/:id', async (req, res) => {
  const id = req.params.id;
  const { createdAt } = req.body ?? {};
  if (!createdAt) return res.status(400).json({ error: 'createdAt required' });

  try {
    const existing = await readPostsForId(id);
    if (!existing) return res.status(404).json({ error: 'Posts not found for profile' });

    const idx = existing.findIndex((p) => p?.createdAt === createdAt);
    if (idx === -1) return res.status(404).json({ error: 'Post not found' });

    const updated = [...existing.slice(0, idx), ...existing.slice(idx + 1)];
    await writePostsForId(id, updated);
    res.json({ success: true, removed: existing[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
