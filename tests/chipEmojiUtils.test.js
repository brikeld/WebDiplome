import { describe, expect, it } from 'vitest';
import { chipEmojiForLabel } from '../src/features/inferenceChain/chipEmojiUtils.js';

describe('chipEmojiForLabel', () => {
  it('maps chain step labels', () => {
    expect(chipEmojiForLabel('What we checked', 'chain', 0)).toBe('🔎');
    expect(chipEmojiForLabel('What it means', 'chain', 1)).toBe('🧠');
    expect(chipEmojiForLabel('Why this post', 'chain', 2)).toBe('✍️');
  });

  it('maps common thinking labels', () => {
    expect(chipEmojiForLabel('WHAT I SAW', 'thinking')).toBe('👀');
    expect(chipEmojiForLabel('WHAT WEIGHED MOST', 'thinking')).toBe('⚖️');
    expect(chipEmojiForLabel('WHERE I CHEATED', 'thinking')).toBe('🃏');
  });

  it('maps ingredient categories by keyword', () => {
    expect(chipEmojiForLabel('Wi‑Fi signals', 'ingredient')).toBe('📶');
    expect(chipEmojiForLabel('Recent files', 'ingredient')).toBe('📁');
    expect(chipEmojiForLabel('Post caption', 'ingredient')).toBe('💬');
  });
});
