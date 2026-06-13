/** Normalize tell-me-more labels/values for display (strip noise, fix typos). */
export function formatAnalysisDisplayText(text) {
  let out = String(text ?? '').trim();
  if (!out) return out;
  out = out.replace(/\bprofessionnal\b/gi, 'professional');
  out = out.replace(/\/fees\b/gi, '');
  out = out.replace(/\s*\(last 7 days\)/gi, '');
  return out.replace(/\s{2,}/g, ' ').trim();
}

/** Split label text into two balanced lines for compact chip buttons. */
export function splitLabelTwoLines(text) {
  const words = formatAnalysisDisplayText(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length <= 1) {
    return { line1: words[0] ?? '', line2: '' };
  }

  const mid = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, mid).join(' '),
    line2: words.slice(mid).join(' '),
  };
}

const CHAIN_CHIP_LINES = {
  'What we checked': ['What we', 'checked'],
  'What it means': ['What it', 'means'],
  'Why this post': ['Why this', 'post'],
};

export function chainChipLines(label) {
  if (CHAIN_CHIP_LINES[label]) {
    const [line1, line2] = CHAIN_CHIP_LINES[label];
    return { line1, line2 };
  }
  return splitLabelTwoLines(label);
}
