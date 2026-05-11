import { describe, it, expect } from 'vitest';
import { extractDocText, MAX_DOC_CHARS } from '../server/lib/docText.js';

describe('extractDocText', () => {
  it('reads UTF-8 plain text and trims whitespace', async () => {
    const buf = Buffer.from('  hello \n\n\n world  \n', 'utf8');
    const out = await extractDocText(buf, '.txt');
    expect(out).toBe('hello\n\nworld');
  });

  it('reads markdown verbatim (with whitespace collapsing)', async () => {
    const buf = Buffer.from('# Title\n\n- one\n- two\n', 'utf8');
    const out = await extractDocText(buf, '.md');
    expect(out).toContain('Title');
    expect(out).toContain('- one');
  });

  it('clamps to MAX_DOC_CHARS', async () => {
    const buf = Buffer.from('a'.repeat(MAX_DOC_CHARS * 2), 'utf8');
    const out = await extractDocText(buf, '.txt');
    expect(out.length).toBe(MAX_DOC_CHARS);
  });

  it('returns null for unsupported extensions', async () => {
    const buf = Buffer.from('hello', 'utf8');
    const out = await extractDocText(buf, '.bin');
    expect(out).toBeNull();
  });

  it('returns null for empty buffer', async () => {
    const out = await extractDocText(Buffer.from(''), '.txt');
    expect(out).toBeNull();
  });
});
