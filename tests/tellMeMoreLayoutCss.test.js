import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const inferenceCss = readFileSync('src/features/inferenceChain/inferenceChain.css', 'utf8');
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

describe('tell-me-more expanded layout CSS contract', () => {
  it('stacks normal-post sections vertically and keeps ingredient labels readable', () => {
    const stack = blockFor(inferenceCss, '.tell-panel-a__stack');
    const ingredientRow = blockFor(inferenceCss, '.ing-bar__row');
    const ingredientLabel = blockFor(inferenceCss, '.ing-bar__label');

    expect(stack).toContain('flex-direction: column');
    expect(stack).toContain('overflow: hidden');
    expect(stack).not.toContain('grid-template-areas');
    expect(ingredientRow).toContain('grid-template-areas');
    expect(ingredientLabel).toContain('grid-area: label');
  });

  it('uses a simple phase + is-active layer contract', () => {
    expect(transitionCss).toContain('@keyframes tell-loader-scan');
    expect(transitionCss).toContain('.tell-morph__layer.is-active');
    expect(transitionCss).toContain('[data-tell-phase="loading"]');
    expect(inferenceCss).toContain("@import './tellTransition.css'");
  });
});
