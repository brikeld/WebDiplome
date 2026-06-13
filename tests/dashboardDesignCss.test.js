import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const baseCss = readFileSync('src/styles/base.css', 'utf8');
const transitionCss = readFileSync('src/features/inferenceChain/tellTransition.css', 'utf8');

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

describe('home dashboard design CSS contract', () => {
  it('keeps the idle timer as a simple white capsule', () => {
    const timer = blockFor(
      baseCss,
      '.dashboard-timer-card--idle-countdown.dashboard-timer-card--action-update',
    );

    expect(timer).toContain('background: #fff');
    expect(timer).not.toContain('linear-gradient');
  });

  it('places all persona progress rings inside one capsule instead of three rectangles', () => {
    const rings = blockFor(baseCss, '.dashboard-rings');
    const ringTile = blockFor(baseCss, '.dashboard-ring-card::before');

    expect(rings).toContain('border: var(--capsule-shell-border-width) solid');
    expect(rings).toContain('background: var(--card, #fff)');
    expect(rings).toContain('border-radius: calc(');
    expect(rings).toContain('padding:');
    expect(ringTile).toContain('display: none');
  });

  it('uses larger radar loading artwork and persona-only animated fills', () => {
    const loaderCard = blockFor(transitionCss, '.tell-analysis-loader__card');
    const loaderScope = blockFor(transitionCss, '.tell-analysis-loader__scope');
    const idleFill = blockFor(transitionCss, '.tell-idle-a__bars span::after');
    const progressFill = blockFor(transitionCss, '.tell-analysis-loader__progress span');

    expect(loaderCard).toContain('width: min(500px, 100%)');
    expect(loaderCard).toContain('min-height: min(520px, 100%)');
    expect(loaderScope).toContain('width: clamp(190px');
    expect(idleFill).toContain('background: var(--tell-pill-accent');
    expect(idleFill).not.toContain('linear-gradient');
    expect(progressFill).toContain('background: var(--tell-pill-accent');
    expect(progressFill).not.toContain('linear-gradient');
  });
});
