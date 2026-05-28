import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import crypto from 'crypto';

import { getNewestProfileIdAndPath, readProfileJson } from './server/lib/currentProfile.js';
import {
  generatePersonaPosts,
  generateUserSummary,
  ASSET_SLOT_INDEX,
} from './server/lib/personaPostGenerator.js';
import { loadPrompts } from './server/lib/prompts.js';
import { extractDocText } from './server/lib/docText.js';
import { readPostsForId, appendPersonaPosts } from './server/lib/postsStore.js';
import { generateCommentSuggestions } from './server/lib/commentSuggestions.js';
import { computeAllBoardStandings } from './server/lib/leaderboards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = path.join(__dirname, 'profiles');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Read LM Studio config + raw collected data from the Electron app's data dir
// — same source of truth as the Electron app, so generated posts use the exact same input.
const ELECTRON_DATA_DIR = '/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/data';
/** Repo-local LM Studio settings (wins over Electron `data/lm_studio.json` when present). */
const LOCAL_LM_STUDIO_CONFIG = path.join(__dirname, 'data', 'lm_studio.json');
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
  const fromElectron = (await readJsonOrNull(ELECTRON_LM_STUDIO_CONFIG)) || {};
  const fromLocal = (await readJsonOrNull(LOCAL_LM_STUDIO_CONFIG)) || {};
  const cfg = { ...fromElectron, ...fromLocal };
  return {
    baseUrl:
      process.env.LM_STUDIO_BASE_URL ||
      cfg.baseUrl ||
      'http://192.168.1.109:1234',
    model:
      process.env.LM_STUDIO_MODEL ||
      cfg.model ||
      'google/gemma-4-e2b',
  };
}
const LM_STUDIO_TIMEOUT_MS = parseInt(process.env.LM_STUDIO_TIMEOUT_MS || '180000', 10);
const LM_STUDIO_RETRIES = parseInt(process.env.LM_STUDIO_RETRIES || '1', 10);

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
const ASSET_PERSONA_CYCLE = ['popularite', 'securite', 'productivite'];

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

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

function nextPersonaInCycle(prevPersona) {
  const prev = String(prevPersona || '').toLowerCase();
  const idx = ASSET_PERSONA_CYCLE.indexOf(prev);
  return ASSET_PERSONA_CYCLE[(idx + 1) % ASSET_PERSONA_CYCLE.length];
}

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

/**
 * Picks a random unused asset from candidates, copies it to /public/uploads (hash-based filename),
 * and returns everything needed for both the AI call and UI.
 * For images: reads base64 for the vision API.
 * For documents: extracts text via extractDocText.
 * Returns null if no unused candidates remain.
 */
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
    if (!text) continue; // try next candidate if extraction fails
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

async function writeProfileBio(filepath, description) {
  const profile = JSON.parse(await fs.readFile(filepath, 'utf8'));
  profile.profileSummary = description;
  profile.userDescription = description;
  await fs.writeFile(filepath, JSON.stringify(profile, null, 2), 'utf8');
}

function patchPostAttachedAssetFromUpload(post, asset) {
  if (!asset || !post?.attachedAsset) return;
  post.attachedAsset = {
    ...post.attachedAsset,
    filename: asset.uploadFilename,
    relativePath: asset.uploadRelativePath,
    url: asset.uploadUrl,
  };
}

/**
 * @returns {Promise<{ newest: object, existing: array, userPayload: string, asset: object|null, assetAssignment: object|null, baseUrl: string, model: string, prompts: object, electronData: object|null } | { error: string, status: number }>}
 */
async function prepareGenerationContext() {
  const newest = await getNewestProfileIdAndPath(PROFILES_DIR);
  if (!newest) return { error: 'No profile found', status: 400 };

  let profile;
  try {
    profile = await readProfileJson(newest.filepath);
  } catch (e) {
    console.error('[posts/generate] profile read failed:', e?.message || e);
    return { error: 'Failed to read profile', status: 500 };
  }

  const existing = await readPostsForId(newest.id);

  const electronUser = await readJsonOrNull(ELECTRON_USER_JSON);
  const electronData = await readJsonOrNull(ELECTRON_DATA_JSON);

  const harvestedIdentity = electronData?.MACHINE_IDENTITY?.user_identity;
  const userForLm = { ...(electronUser ?? {}) };
  if (harvestedIdentity) {
    if (!userForLm.first_name && harvestedIdentity.first_name) {
      userForLm.first_name = harvestedIdentity.first_name;
    }
    if (!userForLm.last_name && harvestedIdentity.last_name) {
      userForLm.last_name = harvestedIdentity.last_name;
    }
  }

  let userPayloadObject;
  if (electronData) {
    userPayloadObject = { user: userForLm, profile: electronData };
  } else {
    const { wallpaperBase64, personaPosts, ...profileForAI } = profile;
    userPayloadObject = profileForAI;
  }
  const userPayload = JSON.stringify(userPayloadObject);

  const usedUploadFilenames = new Set(
    existing
      .map((p) => {
        if (p?.attachedAsset && typeof p.attachedAsset === 'object') return p.attachedAsset.filename;
        if (p?.attachedImage && typeof p.attachedImage === 'object') return p.attachedImage.filename;
        return null;
      })
      .filter(Boolean),
  );

  const lists = await Promise.all(ASSET_DIRS.map(listAssetsInDir));
  const allCandidates = lists.flat();

  const asset = await pickAndImportAsset(allCandidates, usedUploadFilenames).catch((e) => {
    console.error('[posts/generate] asset import failed:', e?.message || e);
    return null;
  });

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

  const lmCfg = await readLmStudioConfig();
  const rawBase = String(lmCfg.baseUrl).replace(/\/$/, '');
  const baseUrl = rawBase.endsWith('/v1') ? rawBase.slice(0, -3) : rawBase;
  const model = lmCfg.model;

  const prompts = await loadPrompts(ELECTRON_DATA_DIR);

  return {
    newest,
    existing,
    profile,
    userPayload,
    asset,
    assetAssignment,
    baseUrl,
    model,
    prompts,
    electronData,
  };
}

async function prepareLeaderboardContext() {
  const newest = await getNewestProfileIdAndPath(PROFILES_DIR);
  if (!newest) return { error: 'No profile found', status: 400 };

  let profile;
  try {
    profile = await readProfileJson(newest.filepath);
  } catch (e) {
    console.error('[leaderboards] profile read failed:', e?.message || e);
    return { error: 'Failed to read profile', status: 500 };
  }

  const electronData = await readJsonOrNull(ELECTRON_DATA_JSON);
  return { newest, profile, electronData };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// GET /api/leaderboards — current user standings for every board, not just posted boards
app.get('/api/leaderboards', async (_req, res) => {
  try {
    const ctx = await prepareLeaderboardContext();
    if (ctx.error) {
      return res.status(ctx.status || 500).json({ success: false, error: ctx.error });
    }

    const standings = computeAllBoardStandings(
      ctx.electronData,
      ctx.profile,
      Date.now(),
    );
    return res.json({
      success: true,
      profileId: ctx.newest.id,
      leaderboards: standings,
    });
  } catch (err) {
    console.error('[leaderboards] failed:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message ? String(err.message) : 'Leaderboard calculation failed',
    });
  }
});

// POST /api/profile/generate-summary — LM bio; persists profileSummary + userDescription
app.post('/api/profile/generate-summary', async (_req, res) => {
  try {
    const ctx = await prepareGenerationContext();
    if (ctx.error) {
      return res.status(ctx.status || 500).json({ success: false, error: ctx.error });
    }
    const { newest, profile, userPayload, baseUrl, model, prompts } = ctx;
    const existingBio = String(profile?.profileSummary || profile?.userDescription || '').trim();
    if (existingBio) {
      return res.json({
        success: true,
        profileSummary: existingBio,
        userDescription: existingBio,
        reused: true,
      });
    }
    const description = await generateUserSummary({
      baseUrl,
      model,
      userPayload,
      timeoutMs: LM_STUDIO_TIMEOUT_MS,
      retries: LM_STUDIO_RETRIES,
      prompts,
    });
    if (!description) {
      return res.status(500).json({ success: false, error: 'Empty bio from model' });
    }
    await writeProfileBio(newest.filepath, description);
    return res.json({
      success: true,
      profileSummary: description,
      userDescription: description,
    });
  } catch (err) {
    console.error('[profile/generate-summary] failed:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message ? String(err.message) : 'Bio generation failed',
    });
  }
});

// POST /api/posts/generate — batch JSON (waits for all posts)
app.post('/api/posts/generate', async (_req, res) => {
  try {
    const ctx = await prepareGenerationContext();
    if (ctx.error) {
      return res.status(ctx.status || 500).json({ success: false, error: ctx.error });
    }
    const { newest, existing, profile, userPayload, asset, assetAssignment, baseUrl, model, prompts, electronData } = ctx;

    const slotResults = await generatePersonaPosts({
      baseUrl,
      model,
      userPayload,
      timeoutMs: LM_STUDIO_TIMEOUT_MS,
      retries: LM_STUDIO_RETRIES,
      assetAssignment,
      prompts,
      dataJson: electronData,
      profile,
      existingPosts: existing,
      chartUploadDir: UPLOADS_DIR,
    });

    if (asset) {
      const p = slotResults[ASSET_SLOT_INDEX];
      if (p?.attachedAsset) patchPostAttachedAssetFromUpload(p, asset);
    }

    const posts = slotResults.filter(Boolean);
    await appendPersonaPosts(newest.id, posts);

    return res.json({ success: true, posts });
  } catch (err) {
    console.error('[posts/generate] generation failed:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message ? String(err.message) : 'Generation failed',
    });
  }
});

// POST /api/posts/generate-stream — NDJSON: one `{ "post": {...} }` per line as each post is ready; ends with `{ "done": true }`
app.post('/api/posts/generate-stream', async (_req, res) => {
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  try {
    const ctx = await prepareGenerationContext();
    if (ctx.error) {
      res.write(`${JSON.stringify({ success: false, error: ctx.error })}\n`);
      res.end();
      return;
    }
    const { newest, existing, profile, userPayload, asset, assetAssignment, baseUrl, model, prompts, electronData } = ctx;

    const bySlot = new Array(4).fill(null);
    const slotResults = await generatePersonaPosts({
      baseUrl,
      model,
      userPayload,
      timeoutMs: LM_STUDIO_TIMEOUT_MS,
      retries: LM_STUDIO_RETRIES,
      assetAssignment,
      prompts,
      dataJson: electronData,
      profile,
      existingPosts: existing,
      chartUploadDir: UPLOADS_DIR,
      onEachPost: async (post, meta) => {
        if (asset && post.attachedAsset && meta?.slotIndex === ASSET_SLOT_INDEX) {
          patchPostAttachedAssetFromUpload(post, asset);
        }
        const idx = meta && typeof meta.slotIndex === 'number' ? meta.slotIndex : 0;
        bySlot[idx] = post;
        await appendPersonaPosts(newest.id, [post]);
        res.write(`${JSON.stringify({ post, slotIndex: idx })}\n`);
        if (typeof res.flush === 'function') res.flush();
      },
    });

    const posts = slotResults.filter(Boolean);
    const merged = await appendPersonaPosts(newest.id, posts);
    res.write(`${JSON.stringify({ done: true, success: true, posts: merged })}\n`);
    res.end();
  } catch (err) {
    console.error('[posts/generate-stream] failed:', err?.message || err);
    try {
      res.write(`${JSON.stringify({ success: false, error: err?.message ? String(err.message) : 'Generation failed' })}\n`);
    } catch {
      /* ignore */
    }
    res.end();
  }
});

// POST /api/comments/suggest — 3 AI reply options (max 60 chars each) for the logged-in user
app.post('/api/comments/suggest', async (req, res) => {
  try {
    const ctx = await prepareGenerationContext();
    if (ctx.error) {
      return res.status(ctx.status || 500).json({ success: false, error: ctx.error });
    }
    const post = req.body?.post;
    if (!post || typeof post !== 'object') {
      return res.status(400).json({ success: false, error: 'post object required' });
    }
    const content = String(post.content ?? '').trim();
    if (!content) {
      return res.status(400).json({ success: false, error: 'post.content required' });
    }

    const electronUser = await readJsonOrNull(ELECTRON_USER_JSON);
    const allowedPersonas = Array.isArray(req.body?.allowedPersonas)
      ? req.body.allowedPersonas
      : null;

    const suggestions = await generateCommentSuggestions({
      baseUrl: ctx.baseUrl,
      model: ctx.model,
      profile: ctx.profile,
      post,
      electronData: ctx.electronData,
      electronUser,
      uploadsDir: UPLOADS_DIR,
      timeoutMs: LM_STUDIO_TIMEOUT_MS,
      retries: LM_STUDIO_RETRIES,
      allowedPersonas,
    });

    return res.json({ success: true, suggestions });
  } catch (err) {
    console.error('[comments/suggest] failed:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message ? String(err.message) : 'Comment suggestion failed',
    });
  }
});

const PORT = Number(process.env.GENERATE_PORT) || 3010;
app.listen(PORT, async () => {
  const lm = await readLmStudioConfig();
  console.log(`Generator server running on http://localhost:${PORT}`);
  console.log(`LM Studio: ${lm.baseUrl}  model: ${lm.model}`);
  console.log('[comments/suggest] assistant-prefill parser (text-only, sequential)');
});
