import { describe, it, expect } from 'vitest';
import {
  normalizeAttachedAsset,
  translateLegacyImage,
  mimeFromExt,
} from '../server/lib/attachedAsset.js';

describe('mimeFromExt', () => {
  it('maps known image extensions', () => {
    expect(mimeFromExt('.jpg')).toBe('image/jpeg');
    expect(mimeFromExt('.PNG')).toBe('image/png');
    expect(mimeFromExt('.webp')).toBe('image/webp');
  });
  it('maps known document extensions', () => {
    expect(mimeFromExt('.pdf')).toBe('application/pdf');
    expect(mimeFromExt('.md')).toBe('text/markdown');
    expect(mimeFromExt('.txt')).toBe('text/plain');
    expect(mimeFromExt('.py')).toBe('text/x-python');
    expect(mimeFromExt('.js')).toBe('application/javascript');
    expect(mimeFromExt('.ts')).toBe('application/typescript');
    expect(mimeFromExt('.css')).toBe('text/css');
  });
  it('falls back to octet-stream for unknown extensions', () => {
    expect(mimeFromExt('.zzz')).toBe('application/octet-stream');
  });
});

describe('translateLegacyImage', () => {
  it('returns null when input is null/undefined', () => {
    expect(translateLegacyImage(null)).toBeNull();
    expect(translateLegacyImage(undefined)).toBeNull();
  });
  it('translates legacy attachedImage to attachedAsset with kind=image', () => {
    const legacy = {
      filename: 'abc.jpg',
      relativePath: 'public/uploads/abc.jpg',
      url: '/uploads/abc.jpg',
      visionAnalysed: true,
    };
    const out = translateLegacyImage(legacy);
    expect(out).toEqual({
      kind: 'image',
      filename: 'abc.jpg',
      relativePath: 'public/uploads/abc.jpg',
      url: '/uploads/abc.jpg',
      mime: 'image/jpeg',
      visionAnalysed: true,
    });
  });
});

describe('normalizeAttachedAsset', () => {
  it('returns null for null/empty input', () => {
    expect(normalizeAttachedAsset(null)).toBeNull();
    expect(normalizeAttachedAsset({})).toBeNull();
  });
  it('passes through a well-formed image asset', () => {
    const a = {
      kind: 'image',
      filename: 'h.jpg',
      relativePath: 'public/uploads/h.jpg',
      url: '/uploads/h.jpg',
      mime: 'image/jpeg',
      visionAnalysed: false,
    };
    expect(normalizeAttachedAsset(a)).toEqual(a);
  });
  it('passes through a well-formed document asset (no visionAnalysed)', () => {
    const a = {
      kind: 'document',
      filename: 'h.pdf',
      relativePath: 'public/uploads/h.pdf',
      url: '/uploads/h.pdf',
      mime: 'application/pdf',
    };
    expect(normalizeAttachedAsset(a)).toEqual(a);
  });
  it('accepts snake_case keys', () => {
    const out = normalizeAttachedAsset({
      kind: 'image',
      filename: 'x.png',
      relative_path: 'public/uploads/x.png',
      url: '/uploads/x.png',
      mime: 'image/png',
      vision_analysed: true,
    });
    expect(out.relativePath).toBe('public/uploads/x.png');
    expect(out.visionAnalysed).toBe(true);
  });
});
