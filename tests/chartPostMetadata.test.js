import { describe, expect, it } from 'vitest';
import { synthesiseChartMetadata } from '../src/lib/chartPostMetadata.js';

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
