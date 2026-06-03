import { describe, expect, it } from 'vitest';
import {
  isCompliantSystemPost,
  keepLatestJoinPostOnly,
  keepLatestLowScorePostPerPersona,
  keepLatestPersonaChangePostOnly,
  mergePersonaPostsFromApi,
  mergePostsPrepend,
} from '../src/lib/mergePersonaPosts.js';

describe('mergePersonaPosts', () => {
  it('detects compliant system posts', () => {
    expect(isCompliantSystemPost({ compliantLowScore: { uiPersonaKey: 'security' } })).toBe(true);
    expect(isCompliantSystemPost({ compliantJoin: { userDisplayName: 'Alex' } })).toBe(true);
    expect(isCompliantSystemPost({ content: 'hello' })).toBe(false);
  });

  it('keeps only the latest join system post', () => {
    const older = { id: 'join-old', createdAt: 100, compliantJoin: { userDisplayName: 'A' } };
    const newer = { id: 'join-new', createdAt: 200, compliantJoin: { userDisplayName: 'A' } };
    const merged = keepLatestJoinPostOnly([older, newer]);
    expect(merged.filter((p) => p.compliantJoin)).toHaveLength(1);
    expect(merged.find((p) => p.compliantJoin)?.id).toBe('join-new');
  });

  it('dedupes by stable post id', () => {
    const a = { id: 'compliant-1', content: 'a', createdAt: 1 };
    const merged = mergePostsPrepend([a], [a]);
    expect(merged).toHaveLength(1);
  });

  it('keeps only the latest persona-change system post', () => {
    const older = {
      id: 'pc-old',
      createdAt: 100,
      compliantPersonaChange: { fromPersona: 'productivity', toPersona: 'security' },
    };
    const newer = {
      id: 'pc-new',
      createdAt: 200,
      compliantPersonaChange: { fromPersona: 'security', toPersona: 'popularity' },
    };
    const regular = { id: 'r1', content: 'hello', createdAt: 50, persona: 'securite' };
    const merged = keepLatestPersonaChangePostOnly([older, regular, newer]);
    expect(merged.filter((p) => p.compliantPersonaChange)).toHaveLength(1);
    expect(merged.find((p) => p.compliantPersonaChange)?.id).toBe('pc-new');
    expect(merged).toHaveLength(2);
  });

  it('keeps only the latest low-score post per UI persona', () => {
    const older = {
      id: 'ls-old',
      createdAt: 100,
      compliantLowScore: { uiPersonaKey: 'security', score: 17 },
    };
    const newer = {
      id: 'ls-new',
      createdAt: 200,
      compliantLowScore: { uiPersonaKey: 'security', score: 19 },
    };
    const productivity = {
      id: 'ls-p',
      createdAt: 150,
      compliantLowScore: { uiPersonaKey: 'productivity', score: 12 },
    };
    const merged = keepLatestLowScorePostPerPersona([older, productivity, newer]);
    expect(merged.filter((p) => p.compliantLowScore)).toHaveLength(2);
    expect(merged.find((p) => p.compliantLowScore?.uiPersonaKey === 'security')?.id).toBe('ls-new');
  });

  it('does not resurrect regular posts when incoming list is shorter (authoritative reload)', () => {
    const prev = [
      { id: 'old-1', content: 'stale post', createdAt: 100, persona: 'productivite' },
      { id: 'old-2', content: 'another stale', createdAt: 90, persona: 'securite' },
    ];
    const incoming = [{ id: 'new-1', content: 'fresh', createdAt: 200, persona: 'productivite' }];
    const merged = mergePersonaPostsFromApi(prev, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('new-1');
  });

  it('clears all client posts when API returns an empty list (account delete)', () => {
    const prev = [
      { id: 'compliant-join', compliantJoin: { userDisplayName: 'Brikeld Hoxha' }, createdAt: 1 },
      { id: 'compliant-low', compliantLowScore: { uiPersonaKey: 'security' }, createdAt: 2 },
      { id: 'r1', content: 'hello', createdAt: 3, persona: 'securite' },
    ];
    expect(mergePersonaPostsFromApi(prev, [])).toEqual([]);
  });

  it('keeps compliant posts when API returns fewer regular posts', () => {
    const system = {
      id: 'compliant-low-score-1-security',
      content: 'notice',
      createdAt: 100,
      compliantLowScore: { uiPersonaKey: 'security' },
    };
    const prev = [system, { content: 'old', createdAt: 50, persona: 'securite' }];
    const incoming = [{ content: 'new', createdAt: 60, persona: 'securite' }];
    const merged = mergePersonaPostsFromApi(prev, incoming);
    expect(merged.some((p) => p.id === system.id)).toBe(true);
    expect(merged.some((p) => p.content === 'new')).toBe(true);
  });
});
