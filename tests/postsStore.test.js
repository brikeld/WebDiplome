import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  appendPersonaPosts,
  POSTS_DIR,
  readPostsForId,
  writePostsForId,
} from '../server/lib/postsStore.js';

const TEST_ID = '__test-concurrent-posts-store';

describe('postsStore', () => {
  afterEach(async () => {
    await rm(path.join(POSTS_DIR, `${TEST_ID}.json`), { force: true });
    const tmpFiles = await readdir(POSTS_DIR).catch(() => []);
    await Promise.all(
      tmpFiles
        .filter((file) => file.startsWith(`${TEST_ID}.json.`) && file.endsWith('.tmp'))
        .map((file) => rm(path.join(POSTS_DIR, file), { force: true })),
    );
  });

  it('preserves concurrent generated appends for one profile id', async () => {
    await writePostsForId(TEST_ID, []);

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        appendPersonaPosts(TEST_ID, [{
          persona: index % 2 === 0 ? 'productivite' : 'popularite',
          content: `generated ${index}`,
          createdAt: `2026-06-05T12:00:00.00${index}Z`,
        }]),
      ),
    );

    const posts = await readPostsForId(TEST_ID);
    expect(posts.map((post) => post.content).sort()).toEqual(
      Array.from({ length: 8 }, (_, index) => `generated ${index}`),
    );
  });
});
