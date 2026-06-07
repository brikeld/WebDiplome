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
  it('marks the full board hidden on the owner profile', () => {
    const html = renderToStaticMarkup(
      <LeaderboardCard
        board={board}
        hiddenMode="full"
        ownedProfileSlug="brikeld-hoxha"
      />,
    );

    expect(html).toContain('profile-leaderboard-card--hidden');
    expect(html).toContain('aria-label="Hidden ranking: Most Productive standings"');
  });

  it('marks only the owned row hidden when viewing another profile board', () => {
    const otherProfileBoard = {
      ...board,
      userRank: 2,
      entries: [
        { ...board.entries[0], isUser: false },
        { ...board.entries[1], isUser: true },
      ],
    };
    const html = renderToStaticMarkup(
      <LeaderboardCard
        board={otherProfileBoard}
        hiddenMode="row"
        ownedProfileSlug="brikeld-hoxha"
      />,
    );

    expect(html).not.toContain('profile-leaderboard-card--hidden');
    const hiddenRows = html.match(/profile-leaderboard-row--hidden/g) || [];
    expect(hiddenRows).toHaveLength(1);
    expect(html).toContain('aria-label="Hidden row for Brikeld Hoxha"');
  });
});
