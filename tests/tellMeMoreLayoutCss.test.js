import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const inferenceCss = readFileSync('src/features/inferenceChain/inferenceChain.css', 'utf8');

function blockFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|})\\s*${escaped}\\s*{`, 'm').exec(inferenceCss);
  const start = match?.index ?? -1;
  expect(start, `Missing CSS selector ${selector}`).toBeGreaterThanOrEqual(0);
  const open = inferenceCss.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < inferenceCss.length; i += 1) {
    if (inferenceCss[i] === '{') depth += 1;
    if (inferenceCss[i] === '}') {
      depth -= 1;
      if (depth === 0) return inferenceCss.slice(open + 1, i);
    }
  }
  throw new Error(`Unclosed CSS block for ${selector}`);
}

describe('tell-me-more expanded layout CSS contract', () => {
  it('stacks normal-post sections vertically and keeps ingredient labels readable', () => {
    const stack = blockFor('.tell-panel-a__stack');
    const ingredientRow = blockFor('.ing-bar__row');
    const ingredientLabel = blockFor('.ing-bar__label');

    expect(stack).toContain('flex-direction: column');
    expect(stack).toContain('overflow: hidden');
    expect(stack).not.toContain('grid-template-areas');
    expect(stack).not.toContain('overflow-y: auto');
    expect(ingredientRow).toContain('grid-template-areas');
    expect(ingredientRow).toContain('"label pct"');
    expect(ingredientRow).toContain('"track track"');
    expect(ingredientLabel).toContain('grid-area: label');
    expect(ingredientLabel).not.toContain('overflow: hidden');
  });

  it('uses the prototype focus-detail capsule, morph shell, and loading scanner in production CSS', () => {
    const focusDetail = blockFor('.focus-detail');
    const focusPanel = blockFor('.tell-panel-a--has-focus');
    const morph = blockFor('.tell-morph');
    const loader = blockFor('.tell-analysis-loader');
    const loaderVisible = blockFor('.dashboard-capsule--figma.is-tell-loading:not(.is-tell-revealing):not(.is-tell-closing) .tell-analysis-loader');

    expect(focusPanel).toContain('--panel-a-gap');
    expect(focusDetail).toContain('width: 100%');
    expect(focusDetail).toContain('animation: focus-detail-in');
    expect(morph).toContain('position: relative');
    expect(loader).toContain('place-items: center');
    expect(loaderVisible).toContain('visibility: visible');
  });
});
