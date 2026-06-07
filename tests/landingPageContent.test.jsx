import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LandingPage from '../src/landing-page/LandingPage.jsx';

describe('<LandingPage> expanded content', () => {
  it('renders the app, persona, and compliant identity sections', () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('THE COMPLIANT APP');
    expect(html).toContain('THE THREE PERSONAS');
    expect(html).toContain('YOUR COMPLIANT IDENTITY');
    expect(html).toContain('lp-identity-emphasis');
  });

  it('renders the five app carousel step descriptions', () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('Your first touchpoint with the platform');
    expect(html).toContain('We recognize you instantly from your Mac account');
    expect(html).toContain('A guided, four-phase scan of your machine');
    expect(html).toContain('Your moment of truth');
    expect(html).toContain('Your complete digital identity dashboard');
  });

  it('renders the expanded profile dashboard in the mac app carousel', () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('Battery cycles');
    expect(html).toContain('System languages');
    expect(html).toContain('Appearance');
    expect(html).toContain('Delete all data');
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

  it('uses Alex Johnson consistently for every landing mockup', () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('Alex Johnson');
    expect(html).toContain('@Alexs MacBook Pro');
    expect(html).not.toContain('Brikeld');
    expect(html).not.toContain('Hoxha');
  });

  it('renders one identity post for each persona inside the post capsule', () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('lp-identity-post-capsule');
    expect(html).toContain('landing-productivity-post');
    expect(html).toContain('landing-security-post');
    expect(html).toContain('landing-social-post');
    expect(html).toContain('landing-productivity-post-2');
    expect(html).not.toContain('landing-security-post-2');
  });

  it('renders a professional black website footer', () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('lp-footer');
    expect(html).toContain('Operational identity infrastructure');
    expect(html).toContain('Privacy');
    expect(html).toContain('Terms');
    expect(html).toContain('Contact');
  });
});
