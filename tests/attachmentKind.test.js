import { describe, expect, it } from 'vitest';
import { isPdfDocumentAsset } from '../src/lib/attachmentKind.js';

describe('isPdfDocumentAsset', () => {
  it('returns true for document with .pdf filename', () => {
    expect(
      isPdfDocumentAsset({ kind: 'document', filename: 'abc.pdf', url: '/uploads/x' }),
    ).toBe(true);
  });

  it('returns true when url contains .pdf', () => {
    expect(
      isPdfDocumentAsset({ kind: 'document', filename: 'hash', url: 'http://localhost:3001/uploads/abc.pdf' }),
    ).toBe(true);
  });

  it('returns false for non-pdf documents', () => {
    expect(isPdfDocumentAsset({ kind: 'document', filename: 'notes.txt', url: '/u/t.txt' })).toBe(false);
  });

  it('returns false for images', () => {
    expect(isPdfDocumentAsset({ kind: 'image', filename: 'x.pdf' })).toBe(false);
  });
});
