import { describe, it, expect } from 'vitest';
import { chartPalette, buildAppCategoryChart } from '../server/lib/chartGenerator.js';

describe('chartPalette', () => {
  it('uses persona bg, black text, and white data viz', () => {
    expect(chartPalette('securite')).toEqual({
      bg: '#759AEF',
      text: '#000000',
      viz: '#ffffff',
    });
    const { svg } = buildAppCategoryChart(
      { byCategory: [['Dev', 3]], totalInstalled: 10 },
      'securite',
    );
    expect(svg).toContain('fill="#759AEF"');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('fill="#ffffff"');
    expect(chartPalette('popularite').bg).toBe('#CCF847');
    expect(chartPalette('productivite').bg).toBe('#D8D8D8');
  });

  it('renders charts without rainbow bar colors', () => {
    const { svg } = buildAppCategoryChart(
      { byCategory: [['Dev', 3]], totalInstalled: 10 },
      'securite',
    );
    expect(svg).toContain('#759AEF');
    expect(svg).toContain('#000000');
    expect(svg).toContain('#ffffff');
    expect(svg).not.toContain('#7c3aed');
    expect(svg).not.toContain('#10b981');
  });
});
