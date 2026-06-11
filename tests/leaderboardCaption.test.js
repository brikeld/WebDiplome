import { describe, it, expect } from 'vitest';
import {
  buildLeaderboardPostCaption,
  buildLeaderboardSlotContext,
  shortLeaderboardTitle,
} from '../server/lib/leaderboardCaption.js';

describe('shortLeaderboardTitle', () => {
  it('strips the Top 5 prefix', () => {
    expect(shortLeaderboardTitle('Top 5 Most Productive')).toBe('Most Productive');
  });
});

describe('buildLeaderboardSlotContext', () => {
  it('describes the board without rank', () => {
    const ctx = buildLeaderboardSlotContext({
      board: { title: 'Top 5 Most Productive' },
      standing: { hint: 'Work apps vs entertainment.' },
    });
    expect(ctx).toContain('[Leaderboard slot]');
    expect(ctx).toContain('Top 5 Most Productive');
    expect(ctx).toContain('Work apps vs entertainment.');
    expect(ctx).not.toMatch(/your rank/i);
    expect(ctx).not.toMatch(/was \d/);
  });
});

describe('buildLeaderboardPostCaption', () => {
  it('comments on the board theme without mentioning rank', () => {
    const caption = buildLeaderboardPostCaption({
      boardId: 'most_productive',
      title: 'Top 5 Most Productive',
    });
    expect(caption).toMatch(/productivity board/i);
    expect(caption).not.toMatch(/\d(st|nd|rd|th)/i);
    expect(caption).not.toMatch(/#\d/);
    expect(caption).not.toMatch(/climbed|dropped|new to/i);
  });

  it('falls back to hint when boardId is unknown', () => {
    const caption = buildLeaderboardPostCaption({
      boardId: 'unknown_board',
      title: 'Top 5 Weird Board',
      hint: 'Measures something odd.',
    });
    expect(caption).toContain('Weird Board');
    expect(caption).not.toMatch(/\d(st|nd|rd|th)/i);
  });
});
