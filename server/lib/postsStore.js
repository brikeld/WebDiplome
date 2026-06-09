import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  appendPostsForceGrow,
  collectLeaderboardBoardIds,
  dedupeCompliantSystemPosts,
  mergePostsPrepend,
  stripLeaderboardPostsByBoardIds,
} from './postsMerge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const POSTS_DIR = path.join(__dirname, '..', '..', 'posts');
const postFileLocks = new Map();

async function withPostFileLock(id, task) {
  const key = String(id || '');
  const previous = postFileLocks.get(key) ?? Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => {}).then(() => gate);
  postFileLocks.set(key, tail);
  await previous.catch(() => {});
  try {
    return await task();
  } finally {
    release();
    if (postFileLocks.get(key) === tail) {
      postFileLocks.delete(key);
    }
  }
}

export async function readPostsForId(id) {
  try {
    const raw = await fs.readFile(path.join(POSTS_DIR, `${id}.json`), 'utf8');
    const data = JSON.parse(raw);
    const posts = Array.isArray(data) ? data : [];
    const deduped = dedupeCompliantSystemPosts(posts);
    if (deduped.length !== posts.length) {
      await writePostsForId(id, deduped);
    }
    return deduped;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function writePostsForId(id, personaPosts, normalizePost = (p) => p) {
  await fs.mkdir(POSTS_DIR, { recursive: true });
  const posts = Array.isArray(personaPosts) ? personaPosts.map(normalizePost) : [];
  const filepath = path.join(POSTS_DIR, `${id}.json`);
  const tmpPath = `${filepath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(posts, null, 2), 'utf8');
  await fs.rename(tmpPath, filepath);
  return posts.length;
}

/** Remove leaderboard posts for the given boards across all local profile feeds. */
export async function purgeLeaderboardPostsGlobally(boardIds, { exceptProfileId = null } = {}) {
  if (!boardIds?.size) return;
  await fs.mkdir(POSTS_DIR, { recursive: true });
  let files;
  try {
    files = await fs.readdir(POSTS_DIR);
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  const profileIds = files
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace(/\.json$/i, ''))
    .filter((profileId) => profileId && profileId !== exceptProfileId);

  await Promise.all(
    profileIds.map((profileId) =>
      withPostFileLock(profileId, async () => {
        const posts = await readPostsForId(profileId);
        const cleaned = stripLeaderboardPostsByBoardIds(posts, boardIds);
        if (cleaned.length !== posts.length) {
          await writePostsForId(profileId, cleaned);
        }
      }),
    ),
  );
}

/** Prepend freshly generated posts — always reads current file from disk first. */
export async function appendPersonaPosts(id, newPosts, normalizePost = (p) => p) {
  const incoming = Array.isArray(newPosts) ? newPosts.filter(Boolean) : [];
  const boardIds = collectLeaderboardBoardIds(incoming);
  if (boardIds.size > 0) {
    await purgeLeaderboardPostsGlobally(boardIds, { exceptProfileId: id });
  }

  return withPostFileLock(id, async () => {
    const current = await readPostsForId(id);
    const replaceUiKeys = new Set(
      incoming.map((p) => p?.compliantLowScore?.uiPersonaKey).filter(Boolean),
    );
    const baseline =
      replaceUiKeys.size > 0
        ? current.filter((p) => !replaceUiKeys.has(p?.compliantLowScore?.uiPersonaKey))
        : current;
    const merged = appendPostsForceGrow(incoming, baseline);
    await writePostsForId(id, merged, normalizePost);
    return merged;
  });
}

/**
 * Apply posts from /api/profile sync.
 * Never shrinks the feed unless replace=true (explicit reset).
 */
export async function syncPersonaPostsFromClient(id, incomingPosts, { replace = false } = {}, normalizePost = (p) => p) {
  return withPostFileLock(id, async () => {
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
  });
}
