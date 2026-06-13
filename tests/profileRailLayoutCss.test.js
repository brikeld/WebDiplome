import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const profileCss = readFileSync('src/styles/profile.css', 'utf8');

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
    expect(rail).toContain('var(--profile-rail-profile-min)');
    expect(rail).toContain('var(--profile-rail-tabs-min)');
    expect(profile).toContain('min-height: var(--profile-rail-profile-min)');
    expect(tabs).toContain('flex: 0 0 auto');
    expect(tabs).toContain('min-height: var(--profile-rail-tabs-min)');
    expect(tabs).toContain('max-height: var(--profile-rail-tabs-max)');
    expect(tab).toContain('flex: 0 0 var(--profile-rail-tab-h)');
  });
});
