import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LoginEntryPage from '../src/landing-page/LoginEntryPage.jsx';

describe('<LoginEntryPage>', () => {
  it('renders a minimal account login screen with the compliant logo and profile picture', () => {
    const html = renderToStaticMarkup(
      <LoginEntryPage
        profile={{
          firstname: 'Mira',
          lastname: 'Kade',
          avatarUrl: '/imgs/AlexP.png',
        }}
      />,
    );

    expect(html).toContain('COMPLIANT');
    expect(html).toContain('login');
    expect(html).toContain('/imgs/AlexP.png');
    expect(html).toContain('lp-login-avatar-button');
    expect(html).toContain('lp-login-transition');
  });
});
