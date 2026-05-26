import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PostCard from '../src/features/feed/PostCard.jsx';

const leaderboardPost = {
  id: 'p1',
  persona: 'productivite',
  content: 'Climbed to #1 in Most Productive.',
  displayName: 'Brikeld Hoxha',
  handle: '@brikeld',
  avatarInitials: 'BH',
  avatarSrc: '/uploads/x.jpg',
  noteColor: '#d8d8d8',
  createdAt: new Date().toISOString(),
  systemDeltaPct: 1,
  leaderboard: {
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
  },
};

describe('<PostCard> with leaderboard post', () => {
  it('renders the leaderboard block when post.leaderboard is set', () => {
    const html = renderToStaticMarkup(<PostCard post={leaderboardPost} />);
    expect(html).toContain('leaderboard-block');
    expect(html).toContain('Top 5 Most Productive');
  });

  it('does not break for a normal (non-leaderboard) post', () => {
    const html = renderToStaticMarkup(<PostCard post={{ ...leaderboardPost, leaderboard: undefined }} />);
    expect(html).not.toContain('leaderboard-block');
  });
});
