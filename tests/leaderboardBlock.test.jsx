import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LeaderboardBlock from '../src/features/feed/LeaderboardBlock.jsx';
import { LiveScoringProvider } from '../src/features/liveScoring/LiveScoringContext.jsx';

function renderWithProvider(node) {
  return renderToStaticMarkup(
    <LiveScoringProvider profile={{ firstname: 'Test', lastname: 'User' }}>
      {node}
    </LiveScoringProvider>
  );
}

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
    const html = renderWithProvider(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    expect(html).toContain('Top 5 Most Productive');
  });

  it('renders 5 rows in rank order', () => {
    const html = renderWithProvider(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    // Count `<li class="leaderboard-row...">` openings only — not child classes like leaderboard-row__rank.
    const rowOpenings = html.match(/<li class="leaderboard-row(?:--self|"| )/g) || [];
    expect(rowOpenings.length).toBe(5);
    // #01 row appears before #05 row (zero-padded ranks)
    expect(html.indexOf('>01<')).toBeLessThan(html.indexOf('>05<'));
  });

  it('marks the user row with --self', () => {
    const html = renderWithProvider(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    expect(html).toContain('leaderboard-row--self');
  });

  it('renders a delta chip "▲ from #2" when previousUserRank > userRank', () => {
    const html = renderWithProvider(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    expect(html).toContain('from #2');
    expect(html).toContain('▲');
  });

  it('renders "NEW" chip when previousUserRank is null', () => {
    const html = renderWithProvider(
      <LeaderboardBlock leaderboard={{ ...sample, previousUserRank: null }} accentColor="#abc" />,
    );
    expect(html).toContain('NEW');
  });

  it('does NOT render any score number anywhere', () => {
    const html = renderWithProvider(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    // Scores in sample: 87, 81, 74, 68, 61 — none must appear in markup
    for (const score of ['87', '81', '74', '68', '61']) {
      expect(html).not.toContain(`>${score}<`);
    }
  });

  it('renders all 4 Alex Johnson rows literally identical', () => {
    const html = renderWithProvider(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    const alexMatches = html.match(/Alex Johnson/g) || [];
    expect(alexMatches.length).toBe(4);
  });

  it('renders nothing when leaderboard is null or malformed', () => {
    expect(renderWithProvider(<LeaderboardBlock leaderboard={null} accentColor="#abc" />)).toBe('');
    expect(renderWithProvider(<LeaderboardBlock leaderboard={{ entries: 'not an array' }} accentColor="#abc" />)).toBe('');
  });

  it('zero-pads the rank display (01..05)', () => {
    const html = renderWithProvider(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    for (const rank of ['01', '02', '03', '04', '05']) {
      expect(html).toContain(`>${rank}<`);
    }
    // The bare digits 1..5 should NOT appear as the rank label — they're zero-padded.
    expect(html).not.toMatch(/>1</);
    expect(html).not.toMatch(/>5</);
  });

  it('renders rank-derived bar widths (100%, 80%, 60%, 40%, 20%)', () => {
    const html = renderWithProvider(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    for (const pct of ['100%', '80%', '60%', '40%', '20%']) {
      // Inline style on the bar fill: width:<pct>
      expect(html).toMatch(new RegExp(`width:\\s*${pct.replace('%', '\\%')}`));
    }
  });

  it('user row contains a bar fill (highlighting handled in CSS, not markup)', () => {
    const html = renderWithProvider(<LeaderboardBlock leaderboard={sample} accentColor="#abc" />);
    // The user row keeps both `leaderboard-row` and `leaderboard-row--self`; its bar-fill
    // div lives inside that row. We verify the row contains a bar-fill element.
    const selfRowMatch = html.match(/<li[^>]*leaderboard-row--self[^>]*>([\s\S]*?)<\/li>/);
    expect(selfRowMatch).not.toBeNull();
    expect(selfRowMatch[1]).toContain('leaderboard-row__bar-fill');
  });
});
