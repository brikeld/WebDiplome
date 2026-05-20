import { describe, it, expect } from 'vitest';
import { chartPalette, buildAppCategoryChart } from '../server/lib/chartGenerator.js';

describe('chartPalette', () => {
  it('uses feed persona accents and black only', () => {
    expect(chartPalette('securite')).toEqual({
      bg: '#000000',
      accent: '#759AEF',
      black: '#000000',
    });
    expect(chartPalette('popularite').accent).toBe('#CCF847');
    expect(chartPalette('productivite').accent).toBe('#D8D8D8');
  });

  it('renders charts without rainbow bar colors', () => {
    const { svg } = buildAppCategoryChart(
      { byCategory: [['Dev', 3]], totalInstalled: 10 },
      'securite',
    );
    expect(svg).toContain('#759AEF');
    expect(svg).not.toContain('#7c3aed');
    expect(svg).not.toContain('#10b981');
  });
});
