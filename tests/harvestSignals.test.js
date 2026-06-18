import { describe, expect, it } from 'vitest';
import { extractHarvestSignals, buildSignalIngredients, buildSignalDataStep } from '../server/lib/harvestSignals.js';

const dataJson = {
  MACHINE_IDENTITY: {
    installed_apps: ['Figma', 'Cursor', 'Slack'],
    dock_apps: ['Safari', 'Mail'],
  },
  PAST_HISTORY: {
    app_usage_7days: [{ app: 'Figma', total_seconds: 22000 }, { app: 'Cursor' }],
    recent_files_7days: [{ path: '/Users/me/Design/hero.fig' }, { name: 'export.png' }],
    wifi_history: [{ ssid: 'Roastery_Guest' }, 'home-5G'],
    recent_downloads: [{ name: 'invoice.pdf' }],
    browser_history: {
      chrome: [{ url: 'https://www.figma.com/files', title: 'Figma' }],
      safari: [{ url: 'https://github.com/x/y' }],
    },
  },
};

describe('harvestSignals', () => {
  it('extracts real, readable signals from the harvest', () => {
    const cats = extractHarvestSignals(dataJson);
    const byLabel = Object.fromEntries(cats.map((c) => [c.label, c.dataPoints]));

    expect(byLabel['Apps you actually use']).toContain('Figma');
    expect(byLabel['Recent files']).toContain('hero.fig'); // basename of a path
    expect(byLabel['Where you connect']).toEqual(expect.arrayContaining(['Roastery_Guest', 'home-5G']));
    expect(byLabel['Sites you visited']).toEqual(expect.arrayContaining(['figma.com', 'github.com'])); // www stripped
  });

  it('builds up to 3 persona-ordered ingredients with real data points', () => {
    const prod = buildSignalIngredients(dataJson, 'productivite');
    expect(prod.length).toBeGreaterThan(0);
    expect(prod.length).toBeLessThanOrEqual(3);
    expect(prod[0].label).toBe('Apps you actually use'); // productivity prioritizes apps
    expect(prod[0].dataPoints).toContain('Figma');

    const sec = buildSignalIngredients(dataJson, 'securite');
    expect(sec[0].label).toBe('Where you connect'); // security prioritizes networks
  });

  it('builds a real "data" chain step naming the top signal', () => {
    const step = buildSignalDataStep(dataJson, 'productivite');
    expect(step.step).toBe('data');
    expect(step.source).toBe('Apps you actually use');
    expect(step.value).toContain('Figma');
  });

  it('returns null when there is no usable harvest data', () => {
    expect(buildSignalIngredients({}, 'productivite')).toBeNull();
    expect(buildSignalDataStep(null, 'securite')).toBeNull();
  });
});
