import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appendPostsForceGrow, mergePostsPrepend } from './postsMerge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const POSTS_DIR = path.join(__dirname, '..', '..', 'posts');

export async function readPostsForId(id) {
  try {
    const raw = await fs.readFile(path.join(POSTS_DIR, `${id}.json`), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function writePostsForId(id, personaPosts, normalizePost = (p) => p) {
  await fs.mkdir(POSTS_DIR, { recursive: true });
  const posts = Array.isArray(personaPosts) ? personaPosts.map(normalizePost) : [];
  await fs.writeFile(path.join(POSTS_DIR, `${id}.json`), JSON.stringify(posts, null, 2), 'utf8');
  return posts.length;
}

/** Prepend freshly generated posts — always reads current file from disk first. */
export async function appendPersonaPosts(id, newPosts, normalizePost = (p) => p) {
  const current = await readPostsForId(id);
  const merged = appendPostsForceGrow(newPosts, current);
  await writePostsForId(id, merged, normalizePost);
  return merged;
}

/**
 * Apply posts from /api/profile sync.
 * Never shrinks the feed unless replace=true (explicit reset).
 */
export async function syncPersonaPostsFromClient(id, incomingPosts, { replace = false } = {}, normalizePost = (p) => p) {
  const incoming = Array.isArray(incomingPosts) ? incomingPosts.map(normalizePost) : [];
  const current = await readPostsForId(id);

  if (replace) {
    await writePostsForId(id, incoming, normalizePost);
    return incoming.length;
  }

  if (incoming.length === 0) return current.length;
  if (current.length === 0) {
    await writePostsForId(id, incoming, normalizePost);
    return incoming.length;
  }

  if (incoming.length < current.length) {
    console.warn(
      `[posts] kept ${current.length} posts (ignored client sync with ${incoming.length})`,
    );
    return current.length;
  }

  const merged = mergePostsPrepend(incoming, current);
  if (merged.length < current.length) {
    console.warn(`[posts] merge would shrink feed for ${id}; keeping ${current.length} posts`);
    return current.length;
  }

  await writePostsForId(id, merged, normalizePost);
  return merged.length;
}
