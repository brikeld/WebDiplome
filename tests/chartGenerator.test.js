import { describe, it, expect } from 'vitest';
import {
  extractFileHeatmapSlice,
  extractAppRecencySlice,
} from '../server/lib/dataSlices.js';
import {
  buildAppCategoryChart,
  buildMostUsedAppsChart,
  buildFileExtChart,
  buildFileExtSlice,
  buildStorageChart,
  buildBatteryHardwareChart,
  buildBrowserDomainsChart,
  buildLanguageChart,
  buildAIToolChart,
  buildWifiTimelineChart,
  buildDownloadsChart,
  buildSecurityAppsChart,
  buildFileHeatmapChart,
  buildAppRecencyChart,
} from '../server/lib/chartGenerator.js';

// Shared helpers for tests
const mockData = {
  MACHINE_IDENTITY: {
    installed_apps: ['Cursor', 'Figma', 'Chrome', 'Safari', 'Slack'],
    languages: ['en', 'fr'],
    model_name: 'MacBook Pro 14',
    hardware_snapshot: { ram: '16 GB', chip: 'Apple M3 Pro' },
    battery: { percent: 87, cycle_count: 304, condition: 'Normal', max_capacity: '89%' },
    storage: { total: '500 GB', used: '324 GB', free: '176 GB', use_percent: '64.8' },
    security: { sip: 'Enabled', filevault: 'On', gatekeeper: 'Enabled' },
  },
  PAST_HISTORY: {
    browser_history: {
      chrome: [
        { url: 'https://github.com/foo', title: 'GitHub' },
        { url: 'https://github.com/bar', title: 'GitHub' },
        { url: 'https://claude.ai/chat', title: 'Claude' },
      ],
      safari: [],
    },
    app_usage_7days: [
      { app: 'Cursor', last_used: new Date(Date.now() - 3600000).toISOString() },
      { app: 'Figma', last_used: new Date(Date.now() - 86400000).toISOString() },
      { app: 'Chrome', last_used: new Date(Date.now() - 172800000).toISOString() },
    ],
    recent_files_7days: [
      { path: '/Users/x/code/app.js', ext: '.js', date: '2026-05-25T10:00:00Z' },
      { path: '/Users/x/code/App.tsx', ext: '.tsx', date: '2026-05-25T10:05:00Z' },
      { path: '/Users/x/imgs/photo.png', ext: '.png', date: '2026-05-25T22:00:00Z' },
    ],
    wifi_history: ['Home-5G', 'Office-Wifi', 'iPhone-Hotspot'],
    recent_downloads: [
      { name: 'figma-agent.zip', size_kb: 82000 },
      { name: 'report.pdf', size_kb: 1800 },
    ],
  },
};

const mockProfile = {
  personaScores: { productivity: 72, security: 54, social: 43 },
  globalScore: 56,
  ram: '16 GB',
};

function expectChart(result) {
  expect(result).not.toBeNull();
  expect(typeof result.svg).toBe('string');
  expect(result.svg).toContain('<svg');
  expect(typeof result.w).toBe('number');
  expect(typeof result.h).toBe('number');
}

describe('extractFileHeatmapSlice', () => {
  it('counts files by hour from recent_files_7days', () => {
    const data = {
      PAST_HISTORY: {
        recent_files_7days: [
          { date: '2026-05-25T09:30:00Z' },
          { date: '2026-05-25T09:45:00Z' },
          { date: '2026-05-25T14:00:00Z' },
        ],
      },
    };
    const result = extractFileHeatmapSlice(data);
    expect(result.counts).toHaveLength(24);
    expect(result.total).toBe(3);
    // hours 9 and 14 should have counts (UTC)
    const hour9 = new Date('2026-05-25T09:30:00Z').getHours();
    const hour14 = new Date('2026-05-25T14:00:00Z').getHours();
    expect(result.counts[hour9]).toBeGreaterThanOrEqual(1);
    expect(result.counts[hour14]).toBe(1);
  });

  it('returns all-zero counts for missing data', () => {
    const result = extractFileHeatmapSlice({});
    expect(result.counts).toEqual(new Array(24).fill(0));
    expect(result.total).toBe(0);
  });
});

describe('extractAppRecencySlice', () => {
  it('returns daysAgo for each app', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const data = {
      PAST_HISTORY: {
        app_usage_7days: [
          { app: 'Cursor', last_used: yesterday },
          { app: 'Figma', last_used: null },
        ],
      },
    };
    const result = extractAppRecencySlice(data);
    expect(result).toHaveLength(2);
    expect(result[0].app).toBe('Cursor');
    expect(result[0].daysAgo).toBe(1);
    expect(result[1].daysAgo).toBeNull();
  });

  it('returns at most 8 entries', () => {
    const data = {
      PAST_HISTORY: {
        app_usage_7days: Array.from({ length: 12 }, (_, i) => ({
          app: `App${i}`,
          last_used: new Date().toISOString(),
        })),
      },
    };
    expect(extractAppRecencySlice(data)).toHaveLength(8);
  });
});

describe('Chart builders — smoke tests', () => {
  it('buildAppCategoryChart returns valid svg', () => {
    const slice = { byCategory: [['Dev & Work', 20], ['Browsers', 5]], totalInstalled: 25 };
    expectChart(buildAppCategoryChart(slice, 'productivite'));
  });
  it('buildMostUsedAppsChart returns valid svg', () => {
    expectChart(buildMostUsedAppsChart(mockData, 'productivite'));
  });
  it('buildFileExtChart returns valid svg', () => {
    const slice = buildFileExtSlice(mockData);
    expectChart(buildFileExtChart(slice, 'productivite'));
  });
  it('buildFileExtChart returns null for empty slice', () => {
    expect(buildFileExtChart([], 'productivite')).toBeNull();
  });
  it('buildStorageChart returns valid svg', () => {
    expectChart(buildStorageChart(mockData, mockProfile, 'productivite'));
  });
  it('buildBatteryHardwareChart returns valid svg', () => {
    expectChart(buildBatteryHardwareChart(mockData, mockProfile, 'productivite'));
  });
  it('buildBatteryHardwareChart falls back to cached static profile hardware', () => {
    const result = buildBatteryHardwareChart(
      { MACHINE_IDENTITY: { battery: { cycle_count: 243, condition: 'Normal' } } },
      {
        machineName: 'Brikeld’s MacBook Pro',
        hardware_chip: 'Apple M3 Max',
        ram: '36 GB',
        batteryCycles: 243,
      },
      'productivite',
    );

    expectChart(result);
    expect(result.svg).toContain('Brikeld’s MacBook');
    expect(result.svg).toContain('Apple M3 Max');
    expect(result.svg).toContain('36 GB');
    expect(result.svg).not.toContain('>—<');
  });
  it('buildBrowserDomainsChart returns valid svg', () => {
    expectChart(buildBrowserDomainsChart(mockData, 'popularite'));
  });
  it('buildLanguageChart returns valid svg', () => {
    expectChart(buildLanguageChart(mockData, mockProfile, 'popularite'));
  });
  it('buildAIToolChart returns valid svg', () => {
    expectChart(buildAIToolChart(mockData, mockProfile, 'popularite'));
  });
  it('buildWifiTimelineChart returns valid svg', () => {
    const slice = { networks: ['Home-5G', 'Office'], count: 2 };
    expectChart(buildWifiTimelineChart(slice, 'securite'));
  });
  it('buildWifiTimelineChart returns null for empty networks', () => {
    expect(buildWifiTimelineChart({ networks: [], count: 0 }, 'securite')).toBeNull();
  });
  it('buildDownloadsChart returns valid svg', () => {
    expectChart(buildDownloadsChart(mockData, null, 'securite'));
  });
  it('buildSecurityAppsChart returns valid svg', () => {
    expectChart(buildSecurityAppsChart(mockData, null, 'securite'));
  });
  it('buildFileHeatmapChart returns valid svg', () => {
    expectChart(buildFileHeatmapChart(mockData, 'productivite'));
  });
  it('buildFileHeatmapChart returns null for no file data', () => {
    expect(buildFileHeatmapChart({}, 'productivite')).toBeNull();
  });
  it('buildAppRecencyChart returns valid svg', () => {
    expectChart(buildAppRecencyChart(mockData, 'productivite'));
  });
});
