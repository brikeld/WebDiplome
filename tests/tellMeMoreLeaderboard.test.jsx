import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { atmosphericVerdict } from '../src/features/inferenceChain/leaderboardRationaleUtils.js';
import LeaderboardRationaleView from '../src/features/inferenceChain/LeaderboardRationaleView.jsx';

describe('Tell me more — leaderboard analysis', () => {
  it('returns fallback copy when rank is undefined', () => {
    expect(atmosphericVerdict(undefined, 'most_productive')).toBe(
      'The system scored your trace on this board, but no rank is assigned yet.',
    );
  });

  it('renders verdict copy when userRank is missing and user is off-board', () => {
    const html = renderToStaticMarkup(
      <LeaderboardRationaleView
        leaderboard={{
          boardId: 'most_secure',
          userRank: undefined,
          hint: '2 VPN app(s), 30 known wifi network(s).',
          entries: [
            { rank: 1, name: 'A', isUser: false, source: 'bot' },
            { rank: 2, name: 'B', isUser: false, source: 'bot' },
            { rank: 3, name: 'C', isUser: false, source: 'bot' },
            { rank: 4, name: 'D', isUser: false, source: 'bot' },
            { rank: 5, name: 'E', isUser: false, source: 'bot' },
          ],
        }}
      />,
    );

    expect(html).toContain('WHY THE SYSTEM');
    expect(html).toContain('The system scored your trace on this board');
    expect(html).toContain('WHAT COUNTED');
    expect(html).not.toContain('<p class="lb2__value"></p>');
  });

  it('renders profile avatars and position comments on other users', () => {
    const html = renderToStaticMarkup(
      <LeaderboardRationaleView
        leaderboard={{
          boardId: 'most_productive',
          entries: [
            {
              rank: 1,
              name: 'Alex',
              isUser: false,
              slug: 'alex-demo',
              avatarSrc: '/uploads/abc.png',
              source: 'real',
            },
            { rank: 2, name: 'Bot', isUser: false, source: 'bot', avatarInitials: 'B' },
            { rank: 3, isUser: true, name: 'You' },
            { rank: 4, name: 'Sam', isUser: false, slug: 'sam-demo', source: 'real' },
            { rank: 5, name: 'Bot2', isUser: false, source: 'bot' },
          ],
          rationales: [
            { rank: 1, phrase: 'leading the pack at number one today', signal: null },
            { rank: 2, phrase: 'stuck in second for now', signal: 'score 55' },
            { rank: 3, phrase: 'mid table but climbing', signal: 'hint' },
            { rank: 4, phrase: 'fourth place energy all week', signal: null },
            { rank: 5, phrase: 'bottom rung but still visible', signal: 'score 30' },
          ],
        }}
        leaderboardDirectorySlugs={['alex-demo', 'sam-demo']}
      />,
    );

    expect(html).toContain('lb2__other-avatar-img');
    expect(html).toContain('/uploads/abc.png');
    expect(html).toContain('lb2__other-comment');
    expect(html).toContain('leading the pack at number one today');
  });
});
