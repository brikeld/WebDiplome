import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeaderboardCard } from '../src/features/profile/tabs/LeaderboardsTab.jsx';

const board = {
  boardId: 'most_productive',
  title: 'Most Productive',
  userRank: 1,
  entries: [
    {
      rank: 1,
      name: 'Brikeld Hoxha',
      handle: '@BrikeldMac',
      slug: 'brikeld-hoxha',
      source: 'real',
      isUser: true,
      score: 91,
    },
    {
      rank: 2,
      name: 'Ada Lovelace',
      handle: '@AdaMac',
      slug: 'ada-lovelace',
      source: 'real',
      isUser: false,
      score: 88,
    },
  ],
};

describe('<LeaderboardCard> hidden ranking states', () => {
  it('redacts only the row whose user globally hid their position', () => {
    // Ada hid her own position (selfHidden); the card stays visible, only her row blurs.
    const withHiddenAda = {
      ...board,
      entries: [board.entries[0], { ...board.entries[1], selfHidden: true }],
    };
    const html = renderToStaticMarkup(<LeaderboardCard board={withHiddenAda} hiddenMode="none" />);

    expect(html).not.toContain('profile-leaderboard-card--hidden');
    const hiddenRows = html.match(/profile-leaderboard-row--hidden/g) || [];
    expect(hiddenRows).toHaveLength(1);
    expect(html).toContain('aria-label="Hidden row for Ada Lovelace"');
    expect(html).toContain('Position hidden');
  });

  it('does not redact any row when nobody hid their position', () => {
    const html = renderToStaticMarkup(<LeaderboardCard board={board} hiddenMode="none" />);
    expect(html).not.toContain('profile-leaderboard-card--hidden');
    expect(html).not.toContain('profile-leaderboard-row--hidden');
  });

  it('hides the whole card in board mode (owner hid this board)', () => {
    const html = renderToStaticMarkup(<LeaderboardCard board={board} hiddenMode="board" />);
    expect(html).toContain('profile-leaderboard-card--hidden');
    expect(html).toContain('profile-leaderboard-card__hidden-notice');
    expect(html).toContain('Leaderboard hidden');
    expect(html).toContain('You hid your place on this leaderboard.');
    // No per-row redaction notice in whole-board mode.
    expect(html).not.toContain('profile-leaderboard-row--hidden');
  });
});
