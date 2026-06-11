/**
 * Renders the post content in Demi Oblique (italic) with inline quote marks;
 * important phrases are underlined in black and clickable.
 *
 * Each highlight links a literal substring to a chain step + ingredient.
 * Clicking a phrase calls onSelect({stepIndex, ingredientIndex, phrase}) so
 * the parent panel can switch view and pulse the linked target.
 *
 * Phrases are matched case-insensitively against the content, in the order
 * they appear in the text. Overlapping/missing phrases are skipped silently.
 */

function normalizePostContent(content) {
  if (content == null) return '';
  return String(content)
    .replace(/^\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSegments(content, highlights) {
  const normalized = normalizePostContent(content);
  if (!normalized) return [];
  if (!Array.isArray(highlights) || highlights.length === 0) {
    return [{ kind: 'text', text: normalized }];
  }

  // Locate the first occurrence (case-insensitive) of each highlight phrase.
  const lower = normalized.toLowerCase();
  const located = [];
  highlights.forEach((h, i) => {
    if (!h || typeof h.phrase !== 'string') return;
    const phrase = h.phrase.trim();
    if (!phrase) return;
    const start = lower.indexOf(phrase.toLowerCase());
    if (start === -1) return;
    located.push({
      start,
      end: start + phrase.length,
      stepIndex: Number(h.stepIndex),
      ingredientIndex: Number(h.ingredientIndex),
      phrase,
      key: `${i}-${start}`,
    });
  });

  // Sort by start; drop any that overlap an earlier one.
  located.sort((a, b) => a.start - b.start);
  const cleaned = [];
  let cursor = 0;
  for (const item of located) {
    if (item.start < cursor) continue;
    cleaned.push(item);
    cursor = item.end;
  }

  // Walk the content building text + highlight segments.
  const out = [];
  let pos = 0;
  for (const item of cleaned) {
    if (item.start > pos) {
      out.push({ kind: 'text', text: normalized.slice(pos, item.start) });
    }
    out.push({
      kind: 'highlight',
      text: normalized.slice(item.start, item.end),
      stepIndex: item.stepIndex,
      ingredientIndex: item.ingredientIndex,
      key: item.key,
    });
    pos = item.end;
  }
  if (pos < normalized.length) {
    out.push({ kind: 'text', text: normalized.slice(pos) });
  }
  return out;
}

export default function PostTextHighlights({ content, highlights, onSelect, activeIngredientIndex = null }) {
  const segments = buildSegments(content, highlights);
  const lastIndex = segments.length - 1;

  return (
    <div className="inference-panel__post-quote">
      <p className="inference-panel__post-text">
        {segments.map((seg, i) => {
          const openQuote = i === 0 ? '\u201C' : '';
          const closeQuote = i === lastIndex ? '\u201D' : '';

          if (seg.kind === 'text') {
            return (
              <span key={`t-${i}`}>
                {openQuote}
                {seg.text}
                {closeQuote}
              </span>
            );
          }

          return (
            <button
              key={`h-${seg.key}`}
              type="button"
              className={`inference-panel__highlight${activeIngredientIndex === seg.ingredientIndex ? ' is-open' : ''}`}
              onClick={() =>
                onSelect?.({
                  stepIndex: seg.stepIndex,
                  ingredientIndex: seg.ingredientIndex,
                  phrase: seg.text,
                })
              }
            >
              {openQuote}
              {seg.text}
              {closeQuote}
            </button>
          );
        })}
      </p>
    </div>
  );
}
