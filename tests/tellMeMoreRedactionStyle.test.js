import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('tell me more redaction styling', () => {
  it('keeps redacted analysis saturated and uses the real persona panel color', () => {
    const css = readFileSync('src/features/inferenceChain/inferenceChain.css', 'utf8');

    expect(css).toContain('filter: blur(16px) saturate(1.05)');
    expect(css).toContain('background: var(--tell-pill-pastel');
  });
});
