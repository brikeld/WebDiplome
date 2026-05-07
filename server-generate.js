import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import crypto from 'crypto';

import { getNewestProfileIdAndPath, readProfileJson } from './server/lib/currentProfile.js';
import { generatePersonaPosts } from './server/lib/personaPostGenerator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = path.join(__dirname, 'profiles');
const POSTS_DIR = path.join(__dirname, 'posts');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

const EXTRA_ASSET_DIRS = [
  '/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/data/assets/recent_images',
  '/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/data/assets/screenshots',
];

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);
const IMAGE_PERSONA_CYCLE = ['popularite', 'securite', 'productivite'];

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listImagesInDir(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => path.join(dir, e.name))
      .filter((p) => ALLOWED_EXT.has(path.extname(p).toLowerCase()));
  } catch {
    return [];
  }
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function nextPersonaInCycle(prevPersona) {
  const prev = String(prevPersona || '').toLowerCase();
  const idx = IMAGE_PERSONA_CYCLE.indexOf(prev);
  return IMAGE_PERSONA_CYCLE[(idx + 1) % IMAGE_PERSONA_CYCLE.length];
}

function mostRecentPersonaWithImage(existingPosts) {
  if (!Array.isArray(existingPosts)) return null;
  for (const p of existingPosts) {
    if (!p || typeof p !== 'object') continue;
    const hasImg = !!(p.attachedImage || p.attached_image);
    if (!hasImg) continue;
    const persona = String(p.persona || '').toLowerCase();
    if (IMAGE_PERSONA_CYCLE.includes(persona)) return persona;
  }
  return null;
}

async function importRandomAssetToUploads() {
  // Pick a random image from the external asset folders, copy into /public/uploads
  // using a stable hash filename, and return the attachedImage shape expected by the UI.
  const lists = await Promise.all(EXTRA_ASSET_DIRS.map(listImagesInDir));
  const all = lists.flat();
  return importRandomAssetToUploadsFromList(all, new Set());
}

async function importRandomAssetToUploadsFromList(candidates, usedUploadFilenames) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const used = usedUploadFilenames instanceof Set ? usedUploadFilenames : new Set();

  // Random sampling without replacement.
  const pool = candidates.slice();
  while (pool.length > 0) {
    const chosen = pickRandom(pool);
    // remove chosen from pool
    pool.splice(pool.indexOf(chosen), 1);

    const buf = await fs.readFile(chosen);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    const ext = path.extname(chosen).toLowerCase() || '.png';
    const safeExt = ALLOWED_EXT.has(ext) ? ext : '.png';
    const filename = `${hash}${safeExt}`;

    if (used.has(filename)) {
      continue; // already used in previous generations
    }

    const dest = path.join(UPLOADS_DIR, filename);
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    if (!(await fileExists(dest))) {
      await fs.writeFile(dest, buf);
    }

    return {
      filename,
      relativePath: `public/uploads/${filename}`,
      url: `/uploads/${filename}`,
      visionAnalysed: true,
    };
  }

  // No unused images left.
  return null;
}

async function readPostsForId(id) {
  try {
    const raw = await fs.readFile(path.join(POSTS_DIR, `${id}.json`), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function writePostsForId(id, personaPosts) {
  await fs.mkdir(POSTS_DIR, { recursive: true });
  const posts = Array.isArray(personaPosts) ? personaPosts : [];
  await fs.writeFile(path.join(POSTS_DIR, `${id}.json`), JSON.stringify(posts, null, 2), 'utf8');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// POST /api/posts/generate — dedicated generator server (to avoid port collisions)
app.post('/api/posts/generate', async (_req, res) => {
  try {
    const newest = await getNewestProfileIdAndPath(PROFILES_DIR);
    if (!newest) return res.status(400).json({ success: false, error: 'No profile found' });

    let profile;
    try {
      profile = await readProfileJson(newest.filepath);
    } catch (e) {
      console.error('[posts/generate] profile read failed:', e?.message || e);
      return res.status(500).json({ success: false, error: 'Failed to read profile' });
    }

    const posts = await generatePersonaPosts(profile);

    const existing = (await readPostsForId(newest.id)) ?? [];

    // Attach exactly 1 random image to exactly 1 of the 3 persona posts.
    // The persona cycles per generation: popularite → securite → productivite → ...
    const usedUploadFilenames = new Set(
      existing
        .map((p) => (p?.attachedImage && typeof p.attachedImage === 'object' ? p.attachedImage.filename : null))
        .filter(Boolean),
    );

    const lists = await Promise.all(EXTRA_ASSET_DIRS.map(listImagesInDir));
    const allCandidates = lists.flat();

    const attachedImage = await importRandomAssetToUploadsFromList(allCandidates, usedUploadFilenames).catch((e) => {
      console.error('[posts/generate] asset import failed:', e?.message || e);
      return null;
    });
    if (attachedImage) {
      const prevPersona = mostRecentPersonaWithImage(existing);
      const targetPersona = nextPersonaInCycle(prevPersona);
      const idx = Math.max(
        0,
        posts.findIndex((p) => String(p?.persona || '').toLowerCase() === targetPersona),
      );
      posts[idx] = { ...posts[idx], attachedImage };
    }

    await writePostsForId(newest.id, [...posts, ...existing]);

    return res.json({ success: true, posts });
  } catch (err) {
    console.error('[posts/generate] generation failed:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message ? String(err.message) : 'Generation failed',
    });
  }
});

const PORT = Number(process.env.GENERATE_PORT) || 3010;
app.listen(PORT, () => {
  console.log(`Generator server running on http://localhost:${PORT}`);
});

