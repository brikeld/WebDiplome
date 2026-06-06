import { describe, expect, it } from 'vitest';
import {
  WIFI_POST_ANGLES,
  categorizeWifiNetwork,
  enrichWifiSlice,
  formatWifiSliceAsText,
  buildWifiPostContext,
  pickWifiPostAngle,
} from '../server/lib/dataSlices.js';

const SAMPLE_NETWORKS = [
  'FibreBox_X6-002887',
  'ECALNET',
  'ECALEVENT',
  'ECALPUBLIC',
  'UPC0021713',
  'Blue Bottle Wi-Fi',
  'iPhone Hotspot',
];

describe('wifi slice enrichment', () => {
  it('categorizes networks heuristically', () => {
    expect(categorizeWifiNetwork('FibreBox_X6-002887')).toBe('home');
    expect(categorizeWifiNetwork('ECALNET')).toBe('office');
    expect(categorizeWifiNetwork('UPC0021713')).toBe('isp');
    expect(categorizeWifiNetwork('Blue Bottle Wi-Fi')).toBe('cafe');
    expect(categorizeWifiNetwork('iPhone Hotspot')).toBe('hotspot');
  });

  it('enriches slice with stats, clusters, and notable names', () => {
    const enriched = enrichWifiSlice({ networks: SAMPLE_NETWORKS, count: SAMPLE_NETWORKS.length });
    expect(enriched.count).toBe(7);
    expect(enriched.categoryCounts.office).toBeGreaterThanOrEqual(2);
    expect(enriched.clusters.some((c) => c.prefix === 'ECAL')).toBe(true);
    expect(enriched.notableNames.length).toBeGreaterThan(0);
  });

  it('formats legacy output without angle', () => {
    const text = formatWifiSliceAsText({ networks: SAMPLE_NETWORKS, count: SAMPLE_NETWORKS.length });
    expect(text).toContain('[WiFi networks — 7 known networks]');
    expect(text).toContain('ECALNET');
    expect(text).not.toContain('Suggested angle');
  });

  it('formats angle-specific context with suggested angle line', () => {
    const text = formatWifiSliceAsText(
      { networks: SAMPLE_NETWORKS, count: SAMPLE_NETWORKS.length },
      { angle: 'work_vs_home' },
    );
    expect(text).toContain('angle: work vs home');
    expect(text).toContain('Suggested angle for this post: contrast between work/school and home networks');
    expect(text).toContain('ECALNET');
    expect(text).toContain('FibreBox_X6-002887');
  });

  it('rotates wifi angles with recency guard', () => {
    expect(WIFI_POST_ANGLES).toHaveLength(6);
    const first = pickWifiPostAngle([], () => 0);
    expect(WIFI_POST_ANGLES).toContain(first);
    const next = pickWifiPostAngle([first], () => 0);
    expect(next).not.toBe(first);
  });

  it('buildWifiPostContext exposes metadata samples for fallback', () => {
    const ctx = buildWifiPostContext({ networks: SAMPLE_NETWORKS }, 'funny_name');
    expect(ctx.angle).toBe('funny_name');
    expect(ctx.count).toBe(7);
    expect(ctx.samples.length).toBeGreaterThan(0);
    expect(ctx.categoryCounts.office).toBeGreaterThanOrEqual(2);
  });
});
