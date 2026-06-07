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

  it('renders the five app carousel step descriptions', () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('Your first touchpoint with the platform');
    expect(html).toContain('We recognize you instantly from your Mac account');
    expect(html).toContain('A guided, four-phase scan of your machine');
    expect(html).toContain('Your moment of truth');
    expect(html).toContain('Your complete digital identity dashboard');
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
