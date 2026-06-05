import { describe, expect, it } from 'vitest';
import {
  shouldCreateLowScorePostOnce,
  shouldCreatePersonaChangePost,
} from '../src/lib/compliantSystemPosts.js';

describe('compliantSystemPosts', () => {
  it('creates a low-score post only before that persona has ever fired', () => {
    expect(shouldCreateLowScorePostOnce([], [], 'security')).toBe(true);
    expect(shouldCreateLowScorePostOnce([], ['security'], 'security')).toBe(false);
  });

  it('does not create another low-score post when one already exists in the feed', () => {
    const posts = [
      {
        id: 'low-security',
        compliantLowScore: { uiPersonaKey: 'security', score: 14 },
      },
    ];

    expect(shouldCreateLowScorePostOnce(posts, [], 'security')).toBe(false);
  });

  it('creates persona-change posts only for real transitions not already represented by the latest notice', () => {
    expect(shouldCreatePersonaChangePost([], 'security', 'security')).toBe(false);
    expect(shouldCreatePersonaChangePost([], 'security', 'popularity')).toBe(true);
    expect(
      shouldCreatePersonaChangePost(
        [
          {
            id: 'change-1',
            compliantPersonaChange: {
              fromPersona: 'security',
              toPersona: 'popularity',
            },
          },
        ],
        'security',
        'popularity',
      ),
    ).toBe(false);
    expect(
      shouldCreatePersonaChangePost(
        [
          {
            id: 'change-1',
            createdAt: 100,
            compliantPersonaChange: {
              fromPersona: 'security',
              toPersona: 'popularity',
            },
          },
          {
            id: 'change-2',
            createdAt: 200,
            compliantPersonaChange: {
              fromPersona: 'popularity',
              toPersona: 'productivity',
            },
          },
        ],
        'security',
        'popularity',
      ),
    ).toBe(true);
  });
});
