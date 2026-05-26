import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProfileHeader from '../src/features/profile/ProfileHeader.jsx';

const profile = {
  firstname: 'Alex',
  lastname: 'Johnson',
  machineName: 'AlexLaptop',
  profileSummary: 'Observed user.',
  personaPosts: [
    { content: 'Normal post' },
    { leaderboard: { boardId: 'most_productive', userRank: 1 } },
  ],
};

describe('<ProfileHeader> navigation stats', () => {
  it('renders post and ranking stats as tab navigation buttons', () => {
    const html = renderToStaticMarkup(
      <ProfileHeader
        profile={profile}
        onNavigateTab={() => {}}
      />,
    );

    expect(html).toContain('type="button"');
    expect(html).toContain('data-profile-tab-target="posts"');
    expect(html).toContain('aria-label="View 2 posts"');
    expect(html).toContain('data-profile-tab-target="leaderboards"');
    expect(html).toContain('aria-label="View 1 ranking"');
  });
});
