import { describe, expect, it } from 'vitest';
import { categorizeApp, collectAppNamesForCategorySlice, extractAppCategorySlice } from '../server/lib/dataSlices.js';

const BRKELD_INSTALLED_APPS = [
  'Adobe Acrobat DC', 'Adobe After Effects 2025', 'Adobe Creative Cloud', 'Adobe Illustrator 2025',
  'Adobe InDesign 2026', 'Adobe Lightroom CC', 'Adobe Media Encoder 2025', 'Adobe Photoshop 2025',
  'Adobe Premiere Pro 2025', 'AltTab', 'Android File Transfer', 'AppCleaner', 'Arduino IDE',
  'BetterDisplay', 'Blender 4.5.3 LTS', 'ChatGPT', 'Claude', 'Codex', 'Cursor', 'DAZN',
  'DiffusionBee', 'Discord', 'Epic Games Launcher', 'Figma', 'FileWave', 'GitHub Desktop',
  'GlobalProtect', 'GoPro Player', 'Godot', 'Google Chrome', 'HandBrake', 'Keynote',
  'Kiosk ECAL', 'LM Studio', 'LetsView', 'LinearMouse', 'LocalSend', 'Microsoft Teams',
  'NordVPN', 'Notion', 'Ollama', 'OmniDiskSweeper', 'Rectangle', 'Safari', 'Spotify',
  'Stremio', 'The Unarchiver', 'TrackWeight', 'Utilities', 'VLC', 'Visual Studio Code',
  'WattsConnected', 'WhatsApp', 'Windsurf', 'Xcode', 'boringNotch', 'ideaMaker',
  'logioptionsplus', 'qbittorrent',
];

describe('categorizeApp', () => {
  it('maps common aliases and vendor prefixes', () => {
    expect(categorizeApp('Chrome')).toBe('Browsers');
    expect(categorizeApp('Autodesk Fusion')).toBe('Creative Suite');
    expect(categorizeApp('Autodesk Fusion Service Utility')).toBe('System');
    expect(categorizeApp('Microsoft Word')).toBe('Dev & Work');
    expect(categorizeApp('Claude Code URL Handler')).toBe('AI Tools');
    expect(categorizeApp('Remove Autodesk Fusion')).toBe('System');
  });

  it('classifies utility and IT apps instead of Other', () => {
    expect(categorizeApp('Rectangle')).toBe('Utilities');
    expect(categorizeApp('AppCleaner')).toBe('Utilities');
    expect(categorizeApp('FileWave')).toBe('IT & Admin');
    expect(categorizeApp('Utilities')).toBe('System');
  });

  it('keeps Other small on a real installed-app snapshot', () => {
    const slice = extractAppCategorySlice({ MACHINE_IDENTITY: { installed_apps: BRKELD_INSTALLED_APPS } });
    const otherCount = slice.byCategory.find(([cat]) => cat === 'Other')?.[1] ?? 0;

    expect(otherCount).toBe(0);
    expect(slice.byCategory.some(([cat]) => cat === 'Utilities')).toBe(true);
  });

  it('merges installed, dock, and recent-usage apps for category counts', () => {
    const names = collectAppNamesForCategorySlice({
      MACHINE_IDENTITY: {
        installed_apps: ['Safari', 'Google Chrome'],
        dock_apps: ['Cursor'],
      },
      PAST_HISTORY: {
        app_usage_7days: [{ app: 'Spotify' }, { app: 'NordVPN' }],
      },
    });
    expect(names).toHaveLength(5);

    const slice = extractAppCategorySlice({
      MACHINE_IDENTITY: { installed_apps: ['Safari'] },
      PAST_HISTORY: {
        app_usage_7days: [
          { app: 'Cursor' },
          { app: 'Figma' },
          { app: 'ChatGPT' },
          { app: 'Discord' },
          { app: 'Spotify' },
          { app: 'NordVPN' },
          { app: 'Adobe Photoshop 2025' },
          { app: 'Rectangle' },
        ],
      },
    });
    expect(slice.totalInstalled).toBe(9);
    expect(slice.byCategory.length).toBeGreaterThanOrEqual(6);
  });
});
