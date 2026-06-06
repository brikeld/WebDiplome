import { describe, expect, it } from 'vitest';
import { synthesiseChartMetadata, synthesiseWifiTextMetadata } from '../src/lib/chartPostMetadata.js';

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
