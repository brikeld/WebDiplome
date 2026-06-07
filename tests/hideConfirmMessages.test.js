import { describe, expect, it } from 'vitest';
import {
  formatRestorePointsLabel,
  unhideConfirmActionLabel,
  unhideConfirmCancelLabel,
  unhideConfirmTitle,
} from '../src/lib/hideConfirmMessages.js';

describe('hideConfirmMessages', () => {
  it('formats restore points as half of the hide delta', () => {
    expect(formatRestorePointsLabel(4)).toBe('2');
    expect(formatRestorePointsLabel(3)).toBe('1.5');
  });

  it('uses leaderboard-specific unhide labels', () => {
    expect(unhideConfirmTitle(true)).toBe('Unhide your ranking?');
    expect(unhideConfirmCancelLabel(true)).toBe('Stay hidden');
    expect(unhideConfirmActionLabel(true)).toBe('Show ranking');
  });

  it('uses post-specific unhide labels', () => {
    expect(unhideConfirmTitle(false)).toBe('Unhide this post?');
    expect(unhideConfirmCancelLabel(false)).toBe('Keep hidden');
    expect(unhideConfirmActionLabel(false)).toBe('Unhide anyway');
  });
});
