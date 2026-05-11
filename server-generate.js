import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import crypto from 'crypto';

import { getNewestProfileIdAndPath, readProfileJson } from './server/lib/currentProfile.js';
import { generatePersonaPosts } from './server/lib/personaPostGenerator.js';
import { loadPrompts } from './server/lib/prompts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = path.join(__dirname, 'profiles');
const POSTS_DIR = path.join(__dirname, 'posts');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Read LM Studio config + raw collected data from the Electron app's data dir
// — same source of truth as the Electron app, so generated posts use the exact same input.
const ELECTRON_DATA_DIR = '/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/data';
const ELECTRON_LM_STUDIO_CONFIG = path.join(ELECTRON_DATA_DIR, 'lm_studio.json');
const ELECTRON_DATA_JSON = path.join(ELECTRON_DATA_DIR, 'data.json');
const ELECTRON_USER_JSON = path.join(ELECTRON_DATA_DIR, 'user.json');

async function readJsonOrNull(filepath) {
  try {
    return JSON.parse(await fs.readFile(filepath, 'utf8'));
  } catch {
    return null;
  }
}

async function readLmStudioConfig() {
  const cfg = (await readJsonOrNull(ELECTRON_LM_STUDIO_CONFIG)) || {};
  return {
    baseUrl: cfg.baseUrl || process.env.LM_STUDIO_BASE_URL || 'http://192.168.1.109:1234',
    model: cfg.model || process.env.LM_STUDIO_MODEL || 'google/gemma-4-e2b',
  };
}
const LM_STUDIO_TIMEOUT_MS = parseInt(process.env.LM_STUDIO_TIMEOUT_MS || '180000', 10);
const LM_STUDIO_RETRIES = parseInt(process.env.LM_STUDIO_RETRIES || '1', 10);

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

function getMimeFromExt(ext) {
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

/**
 * Picks a random unused image from candidates, copies it to /public/uploads (hash-based filename),
 * reads it as base64 for the vision API, and returns everything needed for both the AI call and UI.
 * Returns null if no unused candidates remain.
 */
async function pickAndImportAsset(candidates, usedUploadFilenames) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const used = usedUploadFilenames instanceof Set ? usedUploadFilenames : new Set();

  const pool = candidates.slice();
  while (pool.length > 0) {
    const chosen = pickRandom(pool);
    pool.splice(pool.indexOf(chosen), 1);

    const buf = await fs.readFile(chosen);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    const ext = path.extname(chosen).toLowerCase() || '.png';
    const safeExt = ALLOWED_EXT.has(ext) ? ext : '.png';
    const uploadFilename = `${hash}${safeExt}`;

    if (used.has(uploadFilename)) continue;

    const dest = path.join(UPLOADS_DIR, uploadFilename);
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    if (!(await fileExists(dest))) {
      await fs.writeFile(dest, buf);
    }

    return {
      sourceFilename: path.basename(chosen),
      base64: buf.toString('base64'),
      mime: getMimeFromExt(safeExt),
      uploadFilename,
      uploadRelativePath: `public/uploads/${uploadFilename}`,
      uploadUrl: `/uploads/${uploadFilename}`,
    };
  }

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

    const existing = (await readPostsForId(newest.id)) ?? [];

    // Build the AI payload exactly like the Electron app does:
    // JSON.stringify({ user: user.json, profile: data.json })
    // Falls back to the WebDiplome profile if those files aren't readable.
    const electronUser = await readJsonOrNull(ELECTRON_USER_JSON);
    const electronData = await readJsonOrNull(ELECTRON_DATA_JSON);

    let userPayloadObject;
    if (electronData) {
      userPayloadObject = { user: electronUser ?? {}, profile: electronData };
    } else {
      // Fallback: strip wallpaperBase64 (123k chars ≈ 30k tokens — would blow the context)
      // and personaPosts (previous output, not useful as input) from the WebDiplome profile.
      const { wallpaperBase64, personaPosts, ...profileForAI } = profile;
      userPayloadObject = profileForAI;
    }
    const userPayload = JSON.stringify(userPayloadObject);

    // Build candidate image list and track already-used upload filenames.
    const usedUploadFilenames = new Set(
      existing
        .map((p) => (p?.attachedImage && typeof p.attachedImage === 'object' ? p.attachedImage.filename : null))
        .filter(Boolean),
    );

    const lists = await Promise.all(EXTRA_ASSET_DIRS.map(listImagesInDir));
    const allCandidates = lists.flat();

    // Pick a random image, copy to uploads, and read as base64 for the vision API.
    const asset = await pickAndImportAsset(allCandidates, usedUploadFilenames).catch((e) => {
      console.error('[posts/generate] asset import failed:', e?.message || e);
      return null;
    });

    // Cycle through personas to decide which post gets the image.
    let imageAssignment = null;
    if (asset) {
      const prevPersona = mostRecentPersonaWithImage(existing);
      const targetPersona = nextPersonaInCycle(prevPersona);
      imageAssignment = {
        persona: targetPersona,
        imageData: {
          base64: asset.base64,
          mime: asset.mime,
          filename: asset.sourceFilename,
        },
      };
    }

    const lmCfg = await readLmStudioConfig();
    const rawBase = String(lmCfg.baseUrl).replace(/\/$/, '');
    const baseUrl = rawBase.endsWith('/v1') ? rawBase.slice(0, -3) : rawBase;
    const model = lmCfg.model;

    const prompts = await loadPrompts(ELECTRON_DATA_DIR);

    const posts = await generatePersonaPosts({
      baseUrl,
      model,
      userPayload,
      timeoutMs: LM_STUDIO_TIMEOUT_MS,
      retries: LM_STUDIO_RETRIES,
      imageAssignment,
      prompts,
    });

    // Replace the generator's placeholder attachedImage with upload-ready data for the UI.
    if (asset) {
      for (const post of posts) {
        if (post.attachedImage) {
          post.attachedImage = {
            filename: asset.uploadFilename,
            relativePath: asset.uploadRelativePath,
            url: asset.uploadUrl,
            visionAnalysed: post.attachedImage.visionAnalysed,
          };
          break;
        }
      }
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
