import { describe, expect, it } from 'vitest';
import {
  collectUsedAssetFilenames,
  mergeAssetCandidatePool,
  pickUnusedAssetCandidate,
  nextAssetPersona,
} from '../server/lib/pickGenerationAsset.js';

describe('pickGenerationAsset', () => {
  it('collects upload filenames from prior posts', () => {
    const used = collectUsedAssetFilenames([
      { attachedAsset: { filename: 'abc123.pdf', url: '/uploads/abc123.pdf' } },
    ]);
    expect(used.has('abc123.pdf')).toBe(true);
  });

  it('skips already-used candidates', () => {
    const picked = pickUnusedAssetCandidate(
      [
        { filename: 'aaa.pdf', url: '/x/aaa.pdf' },
        { filename: 'bbb.png', url: '/x/bbb.png' },
      ],
      [{ attachedAsset: { filename: 'aaa.pdf' } }],
    );
    expect(picked?.filename).toBe('bbb.png');
  });

  it('returns null when every candidate was used', () => {
    const picked = pickUnusedAssetCandidate(
      [{ filename: 'aaa.pdf' }],
      [{ attachedAsset: { filename: 'aaa.pdf' } }],
    );
    expect(picked).toBeNull();
  });

  it('cycles asset persona across generations', () => {
    expect(nextAssetPersona([])).toBe('popularite');
    expect(nextAssetPersona([{ persona: 'popularite', attachedAsset: {} }])).toBe('securite');
  });

  it('merges asset pools by content hash filename', () => {
    const hash = 'a'.repeat(64);
    const merged = mergeAssetCandidatePool(
      [{ filename: `${hash}.jpg`, url: 'https://x/old.jpg' }],
      [{ filename: `${hash}.jpg`, url: 'https://x/new.jpg' }, { filename: `${'b'.repeat(64)}.png`, url: 'https://x/b.png' }],
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((c) => c.filename === `${hash}.jpg`)?.url).toBe('https://x/new.jpg');
  });

  it('accepts uploadFilename alias on candidates', () => {
    const hash = 'c'.repeat(64);
    const picked = pickUnusedAssetCandidate(
      [{ uploadFilename: `${hash}.jpg`, url: 'https://x/y.jpg' }],
      [],
    );
    expect(picked?.uploadFilename).toBe(`${hash}.jpg`);
  });
});
