import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LeaderboardBlock from '../src/features/feed/LeaderboardBlock.jsx';

const sample = {
  boardId: 'most_productive',
  title: 'Top 5 Most Productive',
  userRank: 1,
  previousUserRank: 2,
  entries: [
    { rank: 1, name: 'Brikeld Hoxha', handle: '@brikeld',    avatarSrc: '/uploads/x.jpg', avatarInitials: 'BH', isUser: true,  score: 87 },
    { rank: 2, name: 'Alex Johnson',  handle: '@AlexLaptop', avatarSrc: '/imgs/AlexP.png', avatarInitials: 'AJ', isUser: false, score: 81 },
    { rank: 3, name: 'Alex Johnson',  handle: '@AlexLaptop', avatarSrc: '/imgs/AlexP.png', avatarInitials: 'AJ', isUser: false, score: 74 },
    { rank: 4, name: 'Alex Johnson',  handle: '@AlexLaptop', avatarSrc: '/imgs/AlexP.png', avatarInitials: 'AJ', isUser: false, score: 68 },
    { rank: 5, name: 'Alex Johnson',  handle: '@AlexLaptop', avatarSrc: '/imgs/AlexP.png', avatarInitials: 'AJ', isUser: false, score: 61 },
  ],
};

describe('<LeaderboardBlock>', () => {
  it('renders the board title', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    expect(html).toContain('Top 5 Most Productive');
  });

  it('renders 5 rows in rank order', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    const rowMatches = html.match(/leaderboard-row/g) || [];
    expect(rowMatches.length).toBe(5);
    // #1 appears before #5
    expect(html.indexOf('#1')).toBeLessThan(html.indexOf('#5'));
  });

  it('marks the user row with --self', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    expect(html).toContain('leaderboard-row--self');
  });

  it('renders a delta chip "▲ from #2" when previousUserRank > userRank', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    expect(html).toContain('from #2');
    expect(html).toContain('▲');
  });

  it('renders "NEW" chip when previousUserRank is null', () => {
    const html = renderToStaticMarkup(
      <LeaderboardBlock leaderboard={{ ...sample, previousUserRank: null }} accentColor="#abc" />,
    );
    expect(html).toContain('NEW');
  });

  it('does NOT render any score number anywhere', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    // Scores in sample: 87, 81, 74, 68, 61 — none must appear in markup
    for (const score of ['87', '81', '74', '68', '61']) {
      expect(html).not.toContain(`>${score}<`);
    }
  });

  it('renders all 4 Alex Johnson rows literally identical', () => {
    const html = renderToStaticMarkup(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    const alexMatches = html.match(/Alex Johnson/g) || [];
    expect(alexMatches.length).toBe(4);
  });
});
