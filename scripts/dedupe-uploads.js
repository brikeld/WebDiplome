import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const uploadsDir = path.join(repoRoot, 'public', 'uploads');
const postsDir = path.join(repoRoot, 'posts');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function listFiles(dir) {
  try {
    return (await fs.readdir(dir)).filter((f) => !f.startsWith('.'));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function pickCanonicalExt(exts) {
  const order = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
  const normalized = exts.map((e) => e.toLowerCase());
  for (const e of order) {
    if (normalized.includes(e)) return e;
  }
  return normalized[0] || '';
}

async function dedupeUploads() {
  const files = await listFiles(uploadsDir);
  const byHash = new Map(); // hash -> { canonical, entries: [{ filename, ext }] }

  for (const filename of files) {
    const fullPath = path.join(uploadsDir, filename);
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) continue;

    const buf = await fs.readFile(fullPath);
    const hash = sha256(buf);
    const ext = path.extname(filename).toLowerCase();

    if (!byHash.has(hash)) byHash.set(hash, { entries: [] });
    byHash.get(hash).entries.push({ filename, ext });
  }

  const renameMap = new Map(); // oldFilename -> canonicalFilename
  let kept = 0;
  let removed = 0;

  for (const [hash, { entries }] of byHash.entries()) {
    if (entries.length === 0) continue;
    const canonicalExt = pickCanonicalExt(entries.map((e) => e.ext));
    const canonicalFilename = `${hash}${canonicalExt}`;
    const canonicalPath = path.join(uploadsDir, canonicalFilename);

    // Ensure one file exists at canonicalPath. Prefer an existing canonical file if present.
    const canonicalAlreadyThere = entries.some((e) => e.filename === canonicalFilename);
    if (!canonicalAlreadyThere) {
      // Rename the first entry to canonical filename (unless canonicalPath already exists due to collisions).
      const source = entries[0].filename;
      const sourcePath = path.join(uploadsDir, source);
      if (!(await fileExists(canonicalPath))) {
        await fs.rename(sourcePath, canonicalPath);
        renameMap.set(source, canonicalFilename);
      } else {
        // If canonical exists (rare), map this source to canonical and delete the source.
        await fs.unlink(sourcePath);
        renameMap.set(source, canonicalFilename);
        removed += 1;
      }
    }

    // Any remaining entries that are not canonical should be deleted and mapped.
    for (const e of entries) {
      if (e.filename === canonicalFilename) {
        renameMap.set(e.filename, canonicalFilename);
        continue;
      }
      // If we already renamed one file above, it may have changed names.
      const currentName = renameMap.get(e.filename) ? null : e.filename;
      if (currentName) {
        const p = path.join(uploadsDir, currentName);
        if (await fileExists(p)) {
          await fs.unlink(p);
          removed += 1;
        }
        renameMap.set(e.filename, canonicalFilename);
      }
    }

    kept += 1;
  }

  return { renameMap, stats: { unique: kept, removed } };
}

async function updatePosts(renameMap) {
  const postFiles = (await listFiles(postsDir)).filter((f) => f.endsWith('.json'));
  let touchedFiles = 0;
  let updatedUrls = 0;

  for (const file of postFiles) {
    const fullPath = path.join(postsDir, file);
    const raw = await fs.readFile(fullPath, 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!Array.isArray(data)) continue;

    let changed = false;
    for (const post of data) {
      const img = post?.attachedImage ?? post?.attached_image ?? null;
      if (!img || typeof img !== 'object') continue;
      const url = img.url ?? img.imageUrl ?? img.image_url ?? null;
      if (!url || typeof url !== 'string') continue;
      const m = url.match(/^\/uploads\/(.+)$/);
      if (!m) continue;
      const oldFilename = m[1];
      const canonical = renameMap.get(oldFilename);
      if (!canonical || canonical === oldFilename) continue;

      img.url = `/uploads/${canonical}`;
      updatedUrls += 1;
      changed = true;
    }

    if (changed) {
      touchedFiles += 1;
      await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf8');
    }
  }

  return { touchedFiles, updatedUrls };
}

async function main() {
  console.log(`[dedupe-uploads] uploadsDir: ${uploadsDir}`);
  console.log(`[dedupe-uploads] postsDir:   ${postsDir}`);

  const { renameMap, stats } = await dedupeUploads();
  const postsResult = await updatePosts(renameMap);

  console.log(
    `[dedupe-uploads] unique_files: ${stats.unique}, removed_duplicates: ${stats.removed}`,
  );
  console.log(
    `[dedupe-uploads] updated_posts_files: ${postsResult.touchedFiles}, updated_urls: ${postsResult.updatedUrls}`,
  );
}

main().catch((err) => {
  console.error('[dedupe-uploads] failed:', err);
  process.exitCode = 1;
});

