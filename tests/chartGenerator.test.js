import { describe, it, expect } from 'vitest';
import {
  extractFileHeatmapSlice,
  extractAppRecencySlice,
} from '../server/lib/dataSlices.js';

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
