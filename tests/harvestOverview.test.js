import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildHarvestOverview } from '../server/lib/harvestOverview.js';
import { mapProfileRowForApi } from '../server/lib/publicProfileMapping.js';

/** Shaped like the real collector data.json (v18_profile.py). */
const HARVEST_JSON = {
  collected_at: '2026-06-11 23:31:56',
  MACHINE_IDENTITY: {
    user_identity: { first_name: 'Brikeld', last_name: 'Hoxha' },
    hostname: 'Brikeld’s MacBook Pro',
    model: 'MacBook Pro',
    macos_version: '26.0',
    screen_resolution: '3024 x 1964 Retina',
    ui_theme: 'Dark Mode',
    installed_apps: Array.from({ length: 92 }, (_, i) => `App ${i}`),
    dock_apps: ['Premiere Pro', 'Photoshop', 'After Effects', 'Figma', 'Cursor', 'Arc', 'Spotify', 'Discord', 'Notes', 'Mail'],
    languages: ['en-CH', 'de-CH', 'fr-CH', 'it-CH'],
    locale: 'en_CH',
    security: { sip: 'Enabled', filevault: 'On', gatekeeper: 'Enabled' },
    peripherals: {
      displays: [{ name: 'Built-in Liquid Retina XDR Display', resolution: '3024 x 1964 Retina' }],
      bluetooth_devices: [],
      usb_devices: [],
    },
    storage: {
      total: '994.7 GB',
      used: '369.6 GB',
      free: '625.0 GB',
      use_percent: '37.2%',
      smart_status: 'Verified',
    },
    battery: {
      percent: '65%',
      charging: true,
      source: 'AC Power',
      cycle_count: 269,
      condition: 'Normal',
      max_capacity: '94%',
    },
    memory_pressure: { pressure_level: 'Normal', swap_used: '0.00 MB' },
    hardware_snapshot: { total_ram: '36 GB' },
    recent_crashes: [],
  },
  PAST_HISTORY: {
    recent_files_7days: [{ path: '/Users/x/a.txt' }, { path: '/Users/x/b.txt' }],
    shell_history_last50: ['npm run start', 'git status'],
    browser_history: {
      chrome: [
        { url: 'https://github.com/brikeld/WebDiplome', title: 'repo' },
        { url: 'https://github.com/brikeld/other', title: 'repo 2' },
        { url: 'https://chat.openai.com/c/1', title: 'chat' },
      ],
      safari: [],
    },
    app_usage_7days: [
      { app: 'Discord', last_used: '2026-06-11 21:12:34' },
      { app: 'Figma', last_used: '2026-06-11 20:02:10' },
    ],
    recent_downloads: [{ name: 'a.zip' }, { name: 'b.pdf' }, { name: 'c.png' }],
    wifi_history: ['FibreBox_X6-002887', 'ECALNET', 'ECALEVENT', 'ECALPUBLIC'],
  },
  SCORING_DATA: {
    axe_comportement_productif: {
      file_creation_patterns: {
        extension_counts: { '.json': 1, '.jpg': 4, '.jsx': 5, '.js': 13, '.css': 2 },
      },
    },
    axe_sante_numerique: {
      error_log_summary: { error_count_24h: '3', crash_count_7days: 1 },
    },
  },
};

const RAW_PROFILE = {
  firstname: 'Brikeld',
  lastname: 'Hoxha',
  machineName: 'Brikeld’s MacBook Pro',
  hardware_chip: 'Apple M2 Pro',
  ram: '36 GB',
  uptimeDays: 4,
  storageUsed: '369.6 GB',
  storageTotal: '994.7 GB',
  applications: 92,
  systemLanguages: ['en-CH', 'de-CH'],
  mostUsedApps: ['Cursor', 'Arc', 'Figma'],
  appearance: 'Dark Mode',
  osVersion: '26.0',
  lastHarvestDataJson: HARVEST_JSON,
};

describe('buildHarvestOverview', () => {
  it('builds machine, displays and security from the harvest JSON', () => {
    const o = buildHarvestOverview(RAW_PROFILE);
    expect(o.machine).toMatchObject({
      model: 'MacBook Pro',
      chip: 'Apple M2 Pro',
      ram: '36 GB',
      osVersion: '26.0',
      appearance: 'Dark Mode',
      screenResolution: '3024 x 1964 Retina',
      locale: 'en_CH',
    });
    expect(o.machine.languages).toEqual(['en-CH', 'de-CH', 'fr-CH', 'it-CH']);
    expect(o.displays).toEqual([
      { name: 'Built-in Liquid Retina XDR Display', resolution: '3024 x 1964 Retina' },
    ]);
    expect(o.security).toEqual({ sip: 'Enabled', filevault: 'On', gatekeeper: 'Enabled' });
  });

  it('parses storage, battery and memory numbers', () => {
    const o = buildHarvestOverview(RAW_PROFILE);
    expect(o.storage).toMatchObject({
      totalGb: 994.7,
      usedGb: 369.6,
      freeGb: 625,
      usePercent: 37.2,
      smartStatus: 'Verified',
    });
    expect(o.battery).toMatchObject({
      percent: 65,
      charging: true,
      powerSource: 'AC Power',
      cycles: 269,
      condition: 'Normal',
      healthPercent: 94,
    });
    expect(o.memory).toEqual({ pressureLevel: 'Normal', swapUsed: '0.00 MB' });
  });

  it('summarizes apps, network, usage, browser domains and file extensions', () => {
    const o = buildHarvestOverview(RAW_PROFILE);
    expect(o.apps.installedCount).toBe(92);
    expect(o.apps.mostUsed).toEqual(['Cursor', 'Arc', 'Figma']);
    expect(o.apps.dock).toHaveLength(8);
    expect(o.network).toMatchObject({ wifiCount: 4 });
    expect(o.network.wifiNetworks).toEqual([
      'FibreBox_X6-002887',
      'ECALNET',
      'ECALEVENT',
      'ECALPUBLIC',
    ]);
    expect(o.usage).toMatchObject({
      recentFilesCount: 2,
      downloadsCount: 3,
      uptimeDays: 4,
    });
    expect(o.usage.appUsage7d[0]).toMatchObject({ app: 'Discord' });
    expect(o.browser.topDomains[0]).toEqual({ domain: 'github.com', count: 2 });
    expect(o.browser.totalVisits).toBe(3);
    expect(o.files.extensions[0]).toEqual({ ext: 'js', count: 13 });
    expect(o.diagnostics).toEqual({ crashCount7d: 1, errorCount24h: 3 });
  });

  it('never leaks urls, titles, shell commands or file paths', () => {
    const text = JSON.stringify(buildHarvestOverview(RAW_PROFILE));
    expect(text).not.toContain('github.com/brikeld');
    expect(text).not.toContain('npm run start');
    expect(text).not.toContain('/Users/x/');
  });

  it('falls back to flat sync fields when harvest JSON is missing', () => {
    const { lastHarvestDataJson, ...flatOnly } = RAW_PROFILE;
    const o = buildHarvestOverview(flatOnly);
    expect(o.machine).toMatchObject({
      ram: '36 GB',
      osVersion: '26.0',
      appearance: 'Dark Mode',
    });
    expect(o.machine.languages).toEqual(['en-CH', 'de-CH']);
    expect(o.storage).toMatchObject({ totalGb: 994.7, usedGb: 369.6, usePercent: 37.2 });
    expect(o.apps.mostUsed).toEqual(['Cursor', 'Arc', 'Figma']);
    expect(o.apps.installedCount).toBe(92);
    expect(o.displays).toBeNull();
    expect(o.security).toBeNull();
    expect(o.browser).toBeNull();
  });

  it('returns null when there is nothing to show', () => {
    expect(buildHarvestOverview(null)).toBeNull();
    expect(buildHarvestOverview({})).toBeNull();
  });
});

describe('mapProfileRowForApi harvestOverview wiring', () => {
  it('attaches harvestOverview built from raw_profile', () => {
    const api = mapProfileRowForApi({
      id: 'uuid-1',
      slug: 'brikeld-hoxha-abc',
      user_id: 'user-1',
      firstname: 'Brikeld',
      lastname: 'Hoxha',
      display_name: 'Brikeld Hoxha',
      machine_name: 'Brikeld’s MacBook Pro',
      persona_scores: {},
      raw_profile: RAW_PROFILE,
    });
    expect(api.harvestOverview).toBeTruthy();
    expect(api.harvestOverview.machine.appearance).toBe('Dark Mode');
    expect(api.harvestOverview.security.filevault).toBe('On');
  });

  it('keeps raw_profile out of the high-frequency directory select (egress guard)', () => {
    const src = readFileSync('server/lib/publicProfileStore.js', 'utf8');
    const start = src.indexOf('const PUBLIC_PROFILE_SELECT');
    const end = src.indexOf('].join', start);
    expect(start).toBeGreaterThan(-1);
    expect(src.slice(start, end)).not.toContain('raw_profile');
  });
});
