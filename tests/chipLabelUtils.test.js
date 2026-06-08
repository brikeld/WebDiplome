import { describe, expect, it } from 'vitest';
import { chainChipLines, splitLabelTwoLines } from '../src/features/inferenceChain/chipLabelUtils.js';

describe('chipLabelUtils', () => {
  it('splits chain step labels on fixed phrase boundaries', () => {
    expect(chainChipLines('What we checked')).toEqual({ line1: 'What we', line2: 'checked' });
    expect(chainChipLines('What it means')).toEqual({ line1: 'What it', line2: 'means' });
    expect(chainChipLines('Why this post')).toEqual({ line1: 'Why this', line2: 'post' });
  });

  it('balances unknown labels across two lines', () => {
    expect(splitLabelTwoLines('AI model usage')).toEqual({ line1: 'AI model', line2: 'usage' });
    expect(splitLabelTwoLines('Recent files')).toEqual({ line1: 'Recent', line2: 'files' });
  });
});
