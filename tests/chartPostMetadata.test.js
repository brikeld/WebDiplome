import { describe, expect, it } from 'vitest';
import { synthesiseChartMetadata, synthesiseWifiTextMetadata, synthesiseTextSliceMetadata, synthesisePostMetadata } from '../src/lib/chartPostMetadata.js';

const CHAIN_STEPS = ['data', 'classify', 'infer', 'generate'];

describe('synthesisePostMetadata (universal fallback)', () => {
  it('returns a complete, client-valid analysis set for any normal post', () => {
    const content = 'I keep 14 tabs open and call it focus — the work apps say otherwise.';
    for (const persona of ['productivite', 'securite', 'popularite', 'social', '']) {
      const result = synthesisePostMetadata({ content, persona });
      expect(result).not.toBeNull();
      // All three sections must be renderable: chain has the 4 ordered steps with
      // values, ingredients = 3, thinking >= 3.
      expect(result.inferenceChain.map((s) => s.step)).toEqual(CHAIN_STEPS);
      expect(result.inferenceChain.every((s) => s.value && s.value.trim())).toBe(true);
      expect(result.ingredients).toHaveLength(3);
      expect(result.thinking.length).toBeGreaterThanOrEqual(3);
      expect(content).toContain(result.inferenceChain[3].value);
    }
  });

  it('returns null for empty content', () => {
    expect(synthesisePostMetadata({ content: '', persona: 'productivite' })).toBeNull();
    expect(synthesisePostMetadata({ content: '   ' })).toBeNull();
  });
});

describe('synthesiseChartMetadata', () => {
  it('returns chain, ingredients, and thinking for chart posts missing analysis', () => {
    const content =
      '49 PNG files created in the last week. It seems I am deep into design lately.';
    const result = synthesiseChartMetadata({
      content,
      chartType: 'ai_tool_exposure',
      persona: 'popularite',
    });

    expect(result).not.toBeNull();
    expect(result.inferenceChain).toHaveLength(4);
    expect(result.ingredients).toHaveLength(3);
    expect(result.thinking.length).toBeGreaterThanOrEqual(3);
    expect(content).toContain(result.inferenceChain[3].value);
  });

  it('returns null without chartType or content', () => {
    expect(synthesiseChartMetadata({ content: 'hi', chartType: '' })).toBeNull();
    expect(synthesiseChartMetadata({ content: '', chartType: 'battery_hardware' })).toBeNull();
  });

  it('uses chartContext lines when provided', () => {
    const result = synthesiseChartMetadata({
      content: '64% of my disk is full already 😅📦',
      chartType: 'storage_usage',
      persona: 'productivite',
      chartContext: {
        title: 'Storage Usage',
        lines: ['Used: 324 GB (64%)', 'Free: 176 GB', 'Total: 500 GB'],
      },
    });
    expect(result?.inferenceChain?.[0]?.value).toContain('324 GB');
    expect(result?.ingredients?.[0]?.dataPoints).toContain('Used: 324 GB (64%)');
  });
});

describe('synthesiseWifiTextMetadata', () => {
  it('returns chain, ingredients, and thinking for wifi text posts missing analysis', () => {
    const content = 'ECALPUBLIC knows me better than my calendar does.';
    const result = synthesiseWifiTextMetadata({
      content,
      angle: 'work_vs_home',
      wifiContext: {
        count: 30,
        categoryCounts: { office: 3, home: 1, cafe: 2 },
        samples: ['ECALNET', 'ECALPUBLIC', 'FibreBox_X6-002887'],
      },
      persona: 'securite',
    });

    expect(result).not.toBeNull();
    expect(result.inferenceChain).toHaveLength(4);
    expect(result.ingredients).toHaveLength(3);
    expect(result.thinking.length).toBeGreaterThanOrEqual(3);
    expect(content).toContain(result.inferenceChain[3].value);
    expect(result.ingredients[0].dataPoints.some((p) => /30|ECAL/i.test(p))).toBe(true);
  });

  it('returns null without content', () => {
    expect(synthesiseWifiTextMetadata({ content: '', angle: 'funny_name' })).toBeNull();
  });
});

describe('synthesiseTextSliceMetadata', () => {
  it('returns metadata for non-wifi text slices', () => {
    const result = synthesiseTextSliceMetadata({
      content: 'My Downloads folder is a museum of abandoned installers.',
      textSliceType: 'downloads',
      angle: 'embarrassing_name',
      context: { count: 3, samples: ['setup.dmg', 'final-final.zip'] },
      persona: 'securite',
    });
    expect(result?.ingredients).toHaveLength(3);
    expect(result?.inferenceChain).toHaveLength(4);
  });

  it('delegates wifi slices to wifi-specific fallback', () => {
    const result = synthesiseTextSliceMetadata({
      content: 'ECALNET again.',
      textSliceType: 'wifi',
      angle: 'work_vs_home',
      context: { count: 5, samples: ['ECALNET'] },
      persona: 'securite',
    });
    expect(result?.ingredients?.[0]?.label).toBe('Wi‑Fi signals');
  });
});
