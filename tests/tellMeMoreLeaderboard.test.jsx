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
});
