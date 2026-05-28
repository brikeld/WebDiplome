import { describe, expect, it } from 'vitest';
import {
  getAllowedCommentPersonas,
  getPersonaScore,
  isPersonaScoreRestricted,
  canHideContentForScores,
  personaToUiKey,
} from '../src/lib/personaScoreCompliance.js';

describe('personaScoreCompliance', () => {
  const scores = { productivity: 55, security: 6, social: 40 };

  it('reads persona scores from adjusted scores', () => {
    expect(getPersonaScore(scores, 'securite')).toBe(6);
    expect(getPersonaScore(scores, 'security')).toBe(6);
  });

  it('flags restricted personas below 20%', () => {
    expect(isPersonaScoreRestricted(scores, 'security')).toBe(true);
    expect(isPersonaScoreRestricted(scores, 'productivity')).toBe(false);
  });

  it('limits comments to restricted personas only', () => {
    expect(getAllowedCommentPersonas(scores)).toEqual(['securite']);
  });

  it('allows all comment personas when none are restricted', () => {
    const ok = { productivity: 55, security: 40, social: 60 };
    expect(getAllowedCommentPersonas(ok)).toEqual([
      'productivite',
      'securite',
      'popularite',
    ]);
  });

  it('blocks hide for low persona content', () => {
    expect(canHideContentForScores('securite', scores)).toBe(false);
    expect(canHideContentForScores('productivite', scores)).toBe(true);
  });

  it('normalizes persona keys', () => {
    expect(personaToUiKey('popularite')).toBe('popularity');
  });
});
