import { describe, expect, it } from 'vitest';
import {
  formatRecencyLead,
  freshnessWeight,
  parseHarvestTimestamp,
  scoreChartFreshness,
  scoreTextSliceFreshness,
} from '../server/lib/recencyRanking.js';

describe('recencyRanking', () => {
  it('parses harvest timestamps with space or T separator', () => {
    expect(parseHarvestTimestamp('2026-06-01 14:30:00')).toBe(Date.parse('2026-06-01T14:30:00'));
    expect(parseHarvestTimestamp('2026-06-01T14:30:00Z')).toBe(Date.parse('2026-06-01T14:30:00Z'));
    expect(parseHarvestTimestamp('')).toBeNull();
  });

  it('decays freshness weight with age', () => {
    expect(freshnessWeight(0)).toBeGreaterThan(freshnessWeight(7 * 24 * 3600000));
  });

  it('scores browser slice from latest visit', () => {
    const dataJson = {
      collected_at: '2026-06-01 10:00:00',
      PAST_HISTORY: {
        browser_history: {
          chrome: [
            { url: 'https://old.example/', visited: '2026-05-20 08:00:00', title: 'Old' },
            { url: 'https://fresh.example/', visited: '2026-06-01 09:55:00', title: 'Fresh tab' },
          ],
        },
      },
    };
    const { freshestMs, hook } = scoreTextSliceFreshness('browser', dataJson);
    expect(freshestMs).toBe(parseHarvestTimestamp('2026-06-01 09:55:00'));
    expect(hook).toContain('fresh.example');
  });

  it('prefers fresher browser chart over stale downloads chart', () => {
    const dataJson = {
      collected_at: '2026-06-01 12:00:00',
      PAST_HISTORY: {
        browser_history: {
          chrome: [{ url: 'https://now.test/', visited: '2026-06-01 11:50:00' }],
        },
        recent_downloads: [{ name: 'old.zip', modified: '2026-04-01 08:00:00' }],
      },
    };
    const browser = scoreChartFreshness('browser_domains', dataJson);
    const downloads = scoreChartFreshness('recent_downloads', dataJson);
    expect(freshnessWeight(browser.ageMs)).toBeGreaterThan(freshnessWeight(downloads.ageMs));
  });

  it('formats recency lead for LLM context', () => {
    const lead = formatRecencyLead({ freshestMs: Date.parse('2026-06-01T09:55:00Z'), hook: 'screenshot.png' });
    expect(lead).toContain('Priority');
    expect(lead).toContain('screenshot.png');
  });
});
