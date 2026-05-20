import { promises as fs } from 'fs';
import path from 'path';

const ACCOUNT_META_FILENAME = '_account-meta.json';

export function accountMetaPath(profilesDir) {
  return path.join(profilesDir, ACCOUNT_META_FILENAME);
}

export async function readAccountState(profilesDir) {
  try {
    const raw = await fs.readFile(accountMetaPath(profilesDir), 'utf8');
    const data = JSON.parse(raw);
    return {
      lastDeletionAt: Number(data.lastDeletionAt) || 0,
      deletedProfileIds: Array.isArray(data.deletedProfileIds)
        ? data.deletedProfileIds.map(String)
        : [],
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { lastDeletionAt: 0, deletedProfileIds: [] };
    }
    throw err;
  }
}

async function writeAccountState(profilesDir, state) {
  await fs.mkdir(profilesDir, { recursive: true });
  await fs.writeFile(
    accountMetaPath(profilesDir),
    JSON.stringify(
      {
        lastDeletionAt: state.lastDeletionAt,
        deletedProfileIds: state.deletedProfileIds,
      },
      null,
      2,
    ),
    'utf8',
  );
}

/**
 * Remove all profile + post files (full account reset for debug / delete account).
 */
export async function deleteAllAccountData(profilesDir, postsDir, { profileId = null } = {}) {
  const deletedIds = [];

  try {
    const profileFiles = (await fs.readdir(profilesDir)).filter(
      (f) => f.endsWith('.json') && f !== ACCOUNT_META_FILENAME,
    );
    for (const file of profileFiles) {
      await fs.unlink(path.join(profilesDir, file));
      deletedIds.push(file.replace(/\.json$/i, ''));
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  try {
    const postFiles = (await fs.readdir(postsDir)).filter((f) => f.endsWith('.json'));
    for (const file of postFiles) {
      await fs.unlink(path.join(postsDir, file));
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const prev = await readAccountState(profilesDir);
  const ids = new Set(prev.deletedProfileIds);
  if (profileId) ids.add(profileId);
  for (const id of deletedIds) ids.add(id);

  const next = {
    lastDeletionAt: Date.now(),
    deletedProfileIds: [...ids],
  };
  await writeAccountState(profilesDir, next);
  return next;
}

/** Bump deletion epoch after a single profile was removed (browser clears live-scoring). */
export async function recordAccountDeletion(profilesDir, profileId = null) {
  const prev = await readAccountState(profilesDir);
  const ids = new Set(prev.deletedProfileIds);
  if (profileId) ids.add(profileId);
  const next = {
    lastDeletionAt: Date.now(),
    deletedProfileIds: [...ids],
  };
  await writeAccountState(profilesDir, next);
  return next;
}
