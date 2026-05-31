import { describe, expect, it } from 'vitest';
import {
  collectUsedAssetFilenames,
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
});
