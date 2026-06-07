import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LandingPage from '../src/landing-page/LandingPage.jsx';

describe('<LandingPage> expanded content', () => {
  it('renders the app, persona, and compliant identity sections', () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('THE COMPLIANT APP');
    expect(html).toContain('THE THREE PERSONAS');
    expect(html).toContain('YOUR COMPLIANT IDENTITY');
  });

  it('renders the five requested app carousel screen labels', () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('intro');
    expect(html).toContain('welcome - name');
    expect(html).toContain('collect scan');
    expect(html).toContain('verdict');
    expect(html).toContain('profile');
  });

  it('uses a Mac app preview instead of a phone frame', () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('lp-mac-app-frame');
    expect(html).not.toContain('lp-phone-frame');
  });

  it('uses the existing profile and post card surfaces for the identity section', () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('profile-hero-capsule');
    expect(html).toContain('post-card');
    expect(html).toContain('post-card-bubble');
  });
});
