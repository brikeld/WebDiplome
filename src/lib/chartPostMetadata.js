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
 * @param {{ content: string, chartType: string, persona?: string, chartContext?: { title?: string, lines?: string[] } }} input
 * @returns {{ inferenceChain: object[], ingredients: object[], highlights: object[], thinking: object[] } | null}
 */
export function synthesiseChartMetadata({ content, chartType, persona, chartContext }) {
  const body = String(content || '').trim();
  const typeKey = String(chartType || '').trim();
  if (!body || !typeKey) return null;

  const chartLabel = CHART_LABELS[typeKey] || typeKey.replace(/_/g, ' ');
  const contextLines = Array.isArray(chartContext?.lines) ? chartContext.lines : [];
  const dataSummary = contextLines.length
    ? contextLines.slice(0, 4).join('; ')
    : null;
  const generateValue = longestContentSubstring(body, 180);

  const inferenceChain = [
    {
      step: 'data',
      value: dataSummary
        ? `Chart “${chartContext?.title || chartLabel}” shows: ${dataSummary}.`
        : `The feed attached a ${chartLabel} chart built from this device’s activity signals.`,
      source: 'Chart annex',
    },
    { step: 'classify', value: chartLabel, confidence: 'high' },
    {
      step: 'infer',
      value: dataSummary
        ? 'The caption was tied to a specific label or number from the chart data list.'
        : 'One dominant bar or spike in the chart was treated as the whole story.',
      confidence: dataSummary ? 'medium' : 'low',
      isBiased: !dataSummary,
      biasNote: dataSummary
        ? null
        : 'A single visual high point does not capture the full mix of habits behind the chart.',
    },
    { step: 'generate', value: generateValue },
  ];

  const ingredients = [
    {
      label: 'Chart signal',
      weight: 88,
      dataPoints: dataSummary
        ? [chartLabel, ...contextLines.slice(0, 3)]
        : [chartLabel, typeKey],
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
      detail: clip(
        dataSummary
          ? `I read the ${chartLabel} data (${contextLines[0] || 'see chart list'}) before writing the caption.`
          : `I reacted to the ${chartLabel} visual rather than re-listing every raw signal.`,
        180,
      ),
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

const WIFI_ANGLE_LABELS = {
  funny_name: 'Memorable network name',
  cafe_habit: 'Café wifi habit',
  work_vs_home: 'Work vs home networks',
  travel_footprint: 'Travel footprint',
  sheer_diversity: 'Network diversity',
  security_read: 'Security footprint',
};

/**
 * Deterministic Tell-Me-More metadata when wifi text-slot LM output omits analysis fields.
 * @param {{ content: string, angle?: string, wifiContext?: object, persona?: string }} input
 */
export function synthesiseWifiTextMetadata({ content, angle, wifiContext, persona }) {
  const body = String(content || '').trim();
  if (!body) return null;

  const angleKey = String(angle || 'sheer_diversity').trim();
  const angleLabel = WIFI_ANGLE_LABELS[angleKey] || angleKey.replace(/_/g, ' ');
  const generateValue = longestContentSubstring(body, 180);
  const count = Number(wifiContext?.count) || 0;
  const categoryLine = wifiContext?.categoryCounts
    ? Object.entries(wifiContext.categoryCounts)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k} ${n}`)
      .slice(0, 5)
      .join(', ')
    : '';

  const dataValue = count > 0
    ? `${count} saved Wi‑Fi networks${categoryLine ? ` (${categoryLine})` : ''} fed a ${angleLabel.toLowerCase()} caption.`
    : `Saved Wi‑Fi network history fed a ${angleLabel.toLowerCase()} caption.`;

  const inferenceChain = [
    {
      step: 'data',
      value: dataValue,
      source: 'Wi‑Fi history',
    },
    { step: 'classify', value: angleLabel, confidence: 'high' },
    {
      step: 'infer',
      value: 'One SSID or category pattern was treated as a stand-in for your whole location story.',
      confidence: 'low',
      isBiased: true,
      biasNote: 'A single network name cannot capture everywhere you have actually worked or traveled.',
    },
    { step: 'generate', value: generateValue },
  ];

  const dataPoints = [];
  if (count > 0) dataPoints.push(`${count} networks`);
  if (categoryLine) dataPoints.push(categoryLine);
  const samples = Array.isArray(wifiContext?.samples) ? wifiContext.samples.slice(0, 4) : [];
  for (const s of samples) dataPoints.push(String(s));
  if (!dataPoints.length) dataPoints.push(angleLabel);

  const ingredients = [
    {
      label: 'Wi‑Fi signals',
      weight: 86,
      dataPoints: dataPoints.slice(0, 6),
    },
    {
      label: 'Post caption',
      weight: 74,
      dataPoints: [clip(body, 80)],
    },
    {
      label: 'Persona lens',
      weight: 44,
      dataPoints: [String(persona || 'securite')],
    },
  ];

  const highlights = [];
  if (generateValue && body.includes(generateValue)) {
    highlights.push({ phrase: generateValue, stepIndex: 3, ingredientIndex: 1 });
  }
  for (const sample of samples) {
    if (sample && body.toLowerCase().includes(String(sample).toLowerCase()) && highlights.length < 3) {
      highlights.push({ phrase: String(sample), stepIndex: 0, ingredientIndex: 0 });
    }
  }
  const numberMatch = body.match(/\d+[\d,.]*/);
  if (numberMatch && body.includes(numberMatch[0]) && highlights.length < 3) {
    highlights.push({ phrase: numberMatch[0], stepIndex: 0, ingredientIndex: 0 });
  }

  const thinking = [
    {
      label: 'ANGLE PICK',
      detail: clip(`I leaned into the ${angleLabel.toLowerCase()} angle instead of another café joke.`, 180),
    },
    {
      label: 'SSID HOOK',
      detail: clip(
        samples[0]
          ? `I anchored on “${samples[0]}” because it was the most concrete name in the slice.`
          : 'I picked the loudest SSID or stat visible in the Wi‑Fi slice.',
        180,
      ),
    },
    {
      label: 'PERSONA LENS',
      detail: clip(`I filtered the takeaway through the ${persona || 'securite'} persona tone.`, 180),
    },
  ];

  return { inferenceChain, ingredients, highlights, thinking };
}

const TEXT_SLICE_LABELS = {
  browser: 'Browser history',
  wifi: 'Wi‑Fi history',
  downloads: 'Recent downloads',
  app_usage: 'App usage',
  recent_files: 'Recent files',
  app_stack: 'Installed apps',
  security_posture: 'Security posture',
  ai_tools: 'AI tools',
};

const TEXT_SLICE_SOURCES = {
  browser: 'Browser history',
  wifi: 'Wi‑Fi history',
  downloads: 'Recent downloads',
  app_usage: 'App usage',
  recent_files: 'Recent files',
  app_stack: 'Installed apps',
  security_posture: 'Security settings',
  ai_tools: 'AI tool signals',
};

/**
 * Deterministic Tell-Me-More metadata when any text-slot LM output omits analysis fields.
 * @param {{ content: string, textSliceType?: string, angle?: string, context?: object, persona?: string }} input
 */
export function synthesiseTextSliceMetadata({ content, textSliceType, angle, context, persona }) {
  const body = String(content || '').trim();
  const typeKey = String(textSliceType || '').trim();
  if (!body || !typeKey) return null;

  if (typeKey === 'wifi') {
    return synthesiseWifiTextMetadata({
      content: body,
      angle: angle || 'sheer_diversity',
      wifiContext: context,
      persona,
    });
  }

  const sliceLabel = TEXT_SLICE_LABELS[typeKey] || typeKey.replace(/_/g, ' ');
  const sourceLabel = TEXT_SLICE_SOURCES[typeKey] || sliceLabel;
  const angleLabel = angle ? String(angle).replace(/_/g, ' ') : sliceLabel.toLowerCase();
  const generateValue = longestContentSubstring(body, 180);
  const count = Number(context?.count ?? context?.totalVisits ?? context?.installedCount ?? 0);
  const samples = Array.isArray(context?.samples) ? context.samples.slice(0, 4) : [];

  const dataValue = count > 0
    ? `${count} ${sliceLabel.toLowerCase()} signal(s) fed a ${angleLabel} caption.`
    : `${sliceLabel} data fed a ${angleLabel} caption.`;

  const inferenceChain = [
    { step: 'data', value: dataValue, source: sourceLabel },
    { step: 'classify', value: angleLabel, confidence: 'high' },
    {
      step: 'infer',
      value: 'One hook in the slice was treated as the whole story.',
      confidence: 'low',
      isBiased: true,
      biasNote: 'A single detail from this slice cannot represent your full digital habits.',
    },
    { step: 'generate', value: generateValue },
  ];

  const dataPoints = [];
  if (count > 0) dataPoints.push(String(count));
  for (const s of samples) dataPoints.push(String(s));
  if (!dataPoints.length) dataPoints.push(sliceLabel);

  const ingredients = [
    { label: `${sliceLabel} signals`, weight: 86, dataPoints: dataPoints.slice(0, 6) },
    { label: 'Post caption', weight: 74, dataPoints: [clip(body, 80)] },
    { label: 'Persona lens', weight: 44, dataPoints: [String(persona || 'productivite')] },
  ];

  const highlights = [];
  if (generateValue && body.includes(generateValue)) {
    highlights.push({ phrase: generateValue, stepIndex: 3, ingredientIndex: 1 });
  }
  for (const sample of samples) {
    if (sample && body.toLowerCase().includes(String(sample).toLowerCase()) && highlights.length < 3) {
      highlights.push({ phrase: String(sample), stepIndex: 0, ingredientIndex: 0 });
    }
  }

  const thinking = [
    { label: 'ANGLE PICK', detail: clip(`I leaned into the ${angleLabel} angle for this ${sliceLabel.toLowerCase()} post.`, 180) },
    {
      label: 'DATA HOOK',
      detail: clip(
        samples[0]
          ? `I anchored on “${samples[0]}” because it was the most concrete signal in the slice.`
          : `I picked the loudest pattern visible in the ${sliceLabel.toLowerCase()} slice.`,
        180,
      ),
    },
    { label: 'PERSONA LENS', detail: clip(`I filtered the takeaway through the ${persona || 'productivite'} persona tone.`, 180) },
  ];

  return { inferenceChain, ingredients, highlights, thinking };
}
