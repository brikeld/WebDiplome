import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const profileCss = readFileSync('src/styles/profile.css', 'utf8');
const profileHeader = readFileSync('src/features/profile/ProfileHeader.jsx', 'utf8');
const profileRailScores = readFileSync('src/features/profile/ProfileRailPersonaScores.jsx', 'utf8');

function blockFor(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|})\\s*${escaped}\\s*{`, 'm').exec(css);
  const start = match?.index ?? -1;
  expect(start, `Missing CSS selector ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`Unclosed CSS block for ${selector}`);
}

describe('profile rail desktop layout CSS contract', () => {
  it('uses explicit rail rows with the tab capsule as the smallest section', () => {
    const rail = blockFor(profileCss, '.profile-rail-capsule.dashboard-capsule');
    const profile = blockFor(profileCss, '.profile-rail-capsule .profile-header-stack');
    const tabs = blockFor(profileCss, '.profile-rail-capsule .tabs-row--rail');
    const tab = blockFor(profileCss, '.profile-rail-capsule .tabs-row--rail .tab');

    expect(rail).toContain('display: grid');
    expect(rail).toContain('--profile-rail-profile-min');
    expect(rail).toContain('--profile-rail-tabs-min');
    expect(rail).toContain('grid-template-rows');
    expect(rail).toContain('minmax(var(--profile-rail-profile-min), max-content)');
    expect(rail).toContain('var(--profile-rail-tabs-min)');
    expect(rail).toContain('--profile-rail-tab-font: var(--profile-rail-blurb-size)');
    expect(rail).toContain('--profile-rail-ring-center-factor: 0.58');
    expect(rail).toContain('--profile-rail-ring-center-y-factor: 0.43');
    expect(profile).toContain('min-height: var(--profile-rail-profile-min)');
    expect(tabs).toContain('flex: 0 0 auto');
    expect(tabs).toContain('grid-row: -2 / -1');
    expect(tabs).toContain('min-height: var(--profile-rail-tabs-min)');
    expect(tabs).toContain('height: 100%');
    expect(tabs).not.toContain('max-height');
    expect(tab).toContain('flex: 0 0 var(--profile-rail-tab-h)');
  });

  it('fills the profile card by scaling identity elements without changing the blurb scale', () => {
    const rail = blockFor(profileCss, '.profile-rail-capsule.dashboard-capsule');
    const compactRail = blockFor(profileCss, '@media (max-width: 1660px)');
    const railCards = blockFor(profileCss, '.profile-rail-capsule > .profile-header-stack,\n.profile-rail-capsule > .profile-rail-persona-scores,\n.profile-rail-capsule > .tabs-row--rail');
    const hero = blockFor(profileCss, '.profile-rail-capsule .profile-hero-main');
    const bioBlock = blockFor(profileCss, '.profile-rail-capsule .profile-bio-block');
    const rowLabel = blockFor(profileCss, '.profile-rail-capsule .profile-rail-persona-row__label');
    const rowScore = blockFor(profileCss, '.profile-rail-capsule .profile-rail-persona-row__score');
    const rowCopy = blockFor(profileCss, '.profile-rail-capsule .profile-rail-persona-row__copy');
    const bioLabel = blockFor(profileCss, '.profile-rail-capsule .profile-bio-label');

    expect(rail).toContain('--profile-rail-name-size: clamp(64px');
    expect(rail).toContain('--profile-rail-bio-gap');
    expect(rail).toContain('--profile-rail-content-offset-y');
    expect(rail).toContain('--profile-rail-bio-size: clamp(15px');
    expect(rail).toContain('--profile-rail-blurb-size: clamp(13px');
    expect(rail).toContain('--profile-rail-scores-copy-size: var(--profile-rail-blurb-size)');
    expect(rail).toContain('--profile-rail-ring-size: clamp(10rem');
    expect(railCards).toContain('border: var(--capsule-shell-border-width) solid');
    expect(hero).toContain('grid-template-rows: auto auto minmax(min-content, 1fr)');
    expect(hero).toContain('align-content: start');
    expect(bioBlock).toContain('align-self: end');
    expect(bioBlock).toContain('margin-top: var(--profile-rail-bio-gap)');
    expect(rowLabel).toContain('font-size: var(--profile-rail-scores-row-label-size)');
    expect(rowLabel).toContain('background: var(--profile-row-accent');
    expect(rowLabel).toContain('border-radius: var(--radius-pill)');
    expect(rowScore).toContain('font-size: var(--profile-rail-scores-row-label-size)');
    expect(rowCopy).toContain('font-size: var(--profile-rail-scores-copy-size)');

    expect(compactRail).toContain('--profile-rail-name-size: clamp(60px');
    expect(compactRail).toContain('--profile-rail-ring-size: clamp(9rem');
    expect(profileHeader).toContain('<span className="profile-bio-label">Bio</span>');
    expect(bioLabel).not.toContain('text-transform: lowercase;');
    expect(profileRailScores).toContain("style={{ '--profile-row-accent': color }}");
  });

  it('uses a distinct 6k rail layout that scales text and prevents an oversized blurb capsule', () => {
    const largeDesktop = blockFor(profileCss, '@media (min-width: 3000px) and (min-height: 1800px)');

    expect(largeDesktop).toContain('--profile-rail-profile-min: clamp(760px');
    expect(largeDesktop).toContain('--profile-rail-tab-h: clamp(88px');
    expect(largeDesktop).toContain('--profile-rail-bio-size: clamp(34px');
    expect(largeDesktop).toContain('--profile-rail-blurb-size: clamp(34px');
    expect(largeDesktop).toContain('--profile-rail-scores-target');
    expect(largeDesktop).toContain('minmax(var(--profile-rail-scores-target), 1fr)');
    expect(largeDesktop).not.toContain('minmax(0, 1fr)');
  });
});
