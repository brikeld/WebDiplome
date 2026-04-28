import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = path.join(__dirname, 'profiles');
const POSTS_DIR = path.join(__dirname, 'posts');

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
  const normalizeAttachedImage = (img) => {
    if (!img || typeof img !== 'object') return null;
    const filename = img.filename ?? img.fileName ?? img.file_name ?? null;
    const relativePath = img.relativePath ?? img.relative_path ?? null;
    const visionAnalysed =
      img.visionAnalysed ?? img.vision_analysed ?? img.visionAnalyzed ?? img.vision_analyzed ?? null;
    return { filename, relativePath, visionAnalysed };
  };

  const normalizePost = (p) => {
    if (!p || typeof p !== 'object') return p;
    const attachedImage =
      p.attachedImage !== undefined
        ? normalizeAttachedImage(p.attachedImage)
        : p.attached_image !== undefined
          ? normalizeAttachedImage(p.attached_image)
          : null;

    const out = { ...p };
    if (attachedImage) out.attachedImage = attachedImage;
    delete out.attached_image;
    return out;
  };

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

  return out;
}

const app = express();
app.use(cors());
// Allow larger payloads (wallpaperBase64 + personaPosts).
app.use(express.json({ limit: '10mb' }));

// Ensure profiles/ directory exists on startup
await fs.mkdir(PROFILES_DIR, { recursive: true });
await fs.mkdir(POSTS_DIR, { recursive: true });

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
    // Delete all existing profiles/posts before saving the new one.
    const existing = (await fs.readdir(PROFILES_DIR)).filter((f) => f.endsWith('.json'));
    await Promise.all(existing.map((f) => fs.unlink(path.join(PROFILES_DIR, f))));
    const existingPosts = (await fs.readdir(POSTS_DIR)).filter((f) => f.endsWith('.json'));
    await Promise.all(existingPosts.map((f) => fs.unlink(path.join(POSTS_DIR, f))));

    const toStore = normalizeProfilePayload(body);
    const { personaPosts } = toStore;
    delete toStore.personaPosts;
    delete toStore.persona_posts;

    // Save posts separately
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

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});
