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
  it('keeps the data section full-width and ingredient labels readable', () => {
    const stack = blockFor('.tell-panel-a__stack');
    const ingredientRow = blockFor('.ing-bar__row');
    const ingredientLabel = blockFor('.ing-bar__label');

    expect(stack).toContain('"data data"');
    expect(ingredientRow).toContain('grid-template-areas');
    expect(ingredientRow).toContain('"label pct"');
    expect(ingredientRow).toContain('"track track"');
    expect(ingredientLabel).toContain('grid-area: label');
    expect(ingredientLabel).not.toContain('overflow: hidden');
  });

  it('animates expansion from the previous idle row position', () => {
    expect(inferenceCss).toContain('@keyframes dashboard-tell-row-expand');
    const expandedRow = blockFor(
      '.dashboard-capsule--figma.is-tell-expanded:not(.is-tell-closing) .dashboard-tell-row',
    );

    expect(expandedRow).toContain('dashboard-tell-row-expand');
    expect(inferenceCss).toContain('translateY(calc(var(--dashboard-actions-h');
  });
});
