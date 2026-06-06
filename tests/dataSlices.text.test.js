import { describe, expect, it } from 'vitest';
import {
  extractRecentFilesSlice,
  formatBrowserSliceAsText,
  formatAppUsageAsText,
  formatRecentFilesAsText,
  formatAppStackAsText,
  formatSecuritySliceAsText,
  pickBrowserPostAngle,
  pickRecentFilesPostAngle,
} from '../server/lib/dataSlices.js';

describe('text slice enrichment', () => {
  it('formats browser slice with angle-specific hooks', () => {
    const slice = {
      topDomains: [{ domain: 'github.com', count: 12 }, { domain: 'news.ycombinator.com', count: 1 }],
      recentTitles: ['Pull Request #42', 'HN front page'],
      totalVisits: 20,
    };
    const text = formatBrowserSliceAsText(slice, { angle: 'tab_titles' });
    expect(text).toContain('Suggested angle for this post');
    expect(text).toContain('Pull Request #42');
  });

  it('formats app usage with work_stack angle', () => {
    const slice = {
      apps: [
        { app: 'Cursor', last_used: '2026-06-05' },
        { app: 'Spotify', last_used: '2026-06-04' },
      ],
      count: 2,
    };
    const text = formatAppUsageAsText(slice, { angle: 'work_stack' });
    expect(text).toContain('work stack');
    expect(text).toContain('Cursor');
  });

  it('extracts and formats recent files slice', () => {
    const slice = extractRecentFilesSlice({
      PAST_HISTORY: {
        recent_files_7days: [
          { name: 'draft.md', ext: '.md', modified: '2026-06-05 23:10', path: '/Users/me/project/draft.md' },
          { name: 'logo.png', ext: '.png', modified: '2026-06-05 10:00', path: '/Users/me/assets/logo.png' },
        ],
      },
    });
    expect(slice.count).toBe(2);
    expect(slice.lateNightCount).toBeGreaterThanOrEqual(1);
    const text = formatRecentFilesAsText(slice, { angle: 'late_night' });
    expect(text).toContain('late night');
    expect(text).toContain('draft.md');
  });

  it('formats app stack with category angle', () => {
    const slice = {
      byCategory: [['Dev & Work', 8], ['Creative Suite', 4]],
      recentlyUsed: ['Cursor', 'Figma'],
      totalInstalled: 20,
    };
    const text = formatAppStackAsText(slice, { angle: 'category_dominance' });
    expect(text).toContain('Dev & Work');
    expect(text).toContain('Suggested angle');
  });

  it('formats security posture with lockdown angle', () => {
    const slice = {
      sip: 'Enabled',
      filevault: 'On',
      gatekeeper: 'Enabled',
      securityApps: ['NordVPN'],
    };
    const text = formatSecuritySliceAsText(slice, { angle: 'lockdown' });
    expect(text).toContain('FileVault');
    expect(text).toContain('lockdown');
  });

  it('rotates angles with recency guard', () => {
    const first = pickBrowserPostAngle([], () => 0);
    const next = pickBrowserPostAngle([first], () => 0);
    expect(next).not.toBe(first);
    const filesFirst = pickRecentFilesPostAngle([], () => 0);
    const filesNext = pickRecentFilesPostAngle([filesFirst], () => 0);
    expect(filesNext).not.toBe(filesFirst);
  });
});
