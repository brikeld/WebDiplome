/**
 * Deterministic Tell-Me-More metadata when chart-slot LM output omits
 * inferenceChain / ingredients (common when the chart prompt only asks for content).
 */

const CHART_LABELS = {
  app_categories: 'App categories',
  most_used_apps: 'Most used apps',
  file_extensions: 'File types created',
  storage_usage: 'Storage usage',
  battery_hardware: 'Battery & hardware',
  persona_scores: 'Persona scores',
  browser_domains: 'Browser domains',
  language_fingerprint: 'Language fingerprint',
  ai_tool_exposure: 'AI tool exposure',
  wifi_history: 'Wi‑Fi history',
  recent_downloads: 'Recent downloads',
  security_apps: 'Security apps',
  app_recency: 'App recency',
};

function clip(value, max) {
  const t = String(value || '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Longest substring of `content` that fits maxLen (for generate step). */
function longestContentSubstring(content, maxLen = 180) {
  const t = String(content || '').trim();
  if (!t) return '';
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * @param {{ content: string, chartType: string, persona?: string }} input
 * @returns {{ inferenceChain: object[], ingredients: object[], highlights: object[], thinking: object[] } | null}
 */
export function synthesiseChartMetadata({ content, chartType, persona }) {
  const body = String(content || '').trim();
  const typeKey = String(chartType || '').trim();
  if (!body || !typeKey) return null;

  const chartLabel = CHART_LABELS[typeKey] || typeKey.replace(/_/g, ' ');
  const generateValue = longestContentSubstring(body, 180);

  const inferenceChain = [
    {
      step: 'data',
      value: `The feed attached a ${chartLabel} chart built from this device’s activity signals.`,
      source: 'Chart annex',
    },
    { step: 'classify', value: chartLabel, confidence: 'high' },
    {
      step: 'infer',
      value: 'One dominant bar or spike in the chart was treated as the whole story.',
      confidence: 'low',
      isBiased: true,
      biasNote: 'A single visual high point does not capture the full mix of habits behind the chart.',
    },
    { step: 'generate', value: generateValue },
  ];

  const ingredients = [
    {
      label: 'Chart signal',
      weight: 88,
      dataPoints: [chartLabel, typeKey],
    },
    {
      label: 'Post caption',
      weight: 72,
      dataPoints: [clip(body, 80)],
    },
    {
      label: 'Persona lens',
      weight: 42,
      dataPoints: [String(persona || 'productivite')],
    },
  ];

  const highlights = [];
  const numberMatch = body.match(/\d+[\d,.]*\s*(?:%|GB|GiB|MB|files?|PNG|png|hrs?|hours?)?/i);
  if (numberMatch && body.toLowerCase().includes(numberMatch[0].toLowerCase())) {
    highlights.push({ phrase: numberMatch[0], stepIndex: 0, ingredientIndex: 0 });
  }
  if (generateValue && body.includes(generateValue) && highlights.length < 2) {
    highlights.push({ phrase: generateValue, stepIndex: 3, ingredientIndex: 1 });
  }

  const thinking = [
    {
      label: 'CHART READ',
      detail: clip(`I reacted to the ${chartLabel} visual rather than re-listing every raw signal.`, 180),
    },
    {
      label: 'ONE NUMBER',
      detail: clip(
        numberMatch
          ? `I anchored the caption on “${numberMatch[0]}” because it was the loudest pattern in the chart.`
          : 'I picked the loudest visible pattern in the chart as the hook for the caption.',
        180,
      ),
    },
    {
      label: 'PERSONA LENS',
      detail: clip(`I filtered the takeaway through the ${persona || 'productivite'} persona tone.`, 180),
    },
  ];

  return { inferenceChain, ingredients, highlights, thinking };
}
