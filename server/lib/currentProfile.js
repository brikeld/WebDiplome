import { promises as fs } from 'fs';
import path from 'path';

/**
 * Returns newest profile file (by mtime) and derived id (filename without .json).
 * This matches the UI behavior of picking GET /api/profiles[0] (newest first).
 */
export async function getNewestProfileIdAndPath(profilesDir) {
  const files = (await fs.readdir(profilesDir)).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return null;

  const withStat = await Promise.all(
    files.map(async (file) => {
      const filepath = path.join(profilesDir, file);
      const stat = await fs.stat(filepath);
      return { file, filepath, mtimeMs: stat.mtimeMs };
    }),
  );

  withStat.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const top = withStat[0];
  const id = String(top.file).replace(/\.json$/i, '');
  return { id, filepath: top.filepath };
}

export async function readProfileJson(filepath) {
  const raw = await fs.readFile(filepath, 'utf8');
  return JSON.parse(raw);
}

