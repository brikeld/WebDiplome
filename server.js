import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = path.join(__dirname, 'profiles');

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
  return out;
}

const app = express();
app.use(cors());
// Allow larger payloads (wallpaperBase64 + personaPosts).
app.use(express.json({ limit: '10mb' }));

// Ensure profiles/ directory exists on startup
await fs.mkdir(PROFILES_DIR, { recursive: true });

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

  try {
    // Delete all existing profiles before saving the new one.
    const existing = (await fs.readdir(PROFILES_DIR)).filter((f) => f.endsWith('.json'));
    await Promise.all(existing.map((f) => fs.unlink(path.join(PROFILES_DIR, f))));

    const toStore = normalizeProfilePayload(body);
    await fs.writeFile(filepath, JSON.stringify(toStore, null, 2), 'utf8');
    res.status(200).json({ id: `${first}-${last}`, filename });
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
        return { mtimeMs: stat.mtimeMs, data: JSON.parse(raw) };
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
    res.json(JSON.parse(raw));
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
