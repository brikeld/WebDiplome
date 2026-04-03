import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = path.join(__dirname, 'profiles');

const app = express();
app.use(cors());
app.use(express.json());

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
    await fs.writeFile(filepath, JSON.stringify(body, null, 2), 'utf8');
    res.status(200).json({ id: `${first}-${last}`, filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/profiles — return array of all saved profiles
app.get('/api/profiles', async (_req, res) => {
  try {
    const files = (await fs.readdir(PROFILES_DIR)).filter(f => f.endsWith('.json'));
    const profiles = await Promise.all(
      files.map(async (file) => {
        const raw = await fs.readFile(path.join(PROFILES_DIR, file), 'utf8');
        return JSON.parse(raw);
      })
    );
    res.json(profiles);
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
