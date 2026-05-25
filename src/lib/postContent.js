/**
 * Display-only cleanup for post body text.
 */
export function sanitizePostContent(text) {
  if (text == null) return '';
  if (typeof text !== 'string') return String(text);

  let t = text.trim();

  // Strip markdown code fence if the LLM returned the full JSON blob inside one
  if (t.startsWith('```')) {
    const firstNewline = t.indexOf('\n');
    if (firstNewline !== -1) {
      t = t.slice(firstNewline + 1);
      const closingFence = t.lastIndexOf('\n```');
      t = (closingFence !== -1 ? t.slice(0, closingFence) : t.replace(/```\s*$/, '')).trim();
    }
  }

  // If the stored value is a JSON object, extract the inner content field
  if (t.startsWith('{')) {
    let extracted = null;
    try {
      const obj = JSON.parse(t);
      if (obj && typeof obj.content === 'string') extracted = obj.content.trim();
    } catch {
      const m = t.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (m) {
        try { extracted = JSON.parse('"' + m[1] + '"').trim(); }
        catch { extracted = m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\').trim(); }
      }
    }
    if (extracted) t = extracted;
  }

  return t
    .replace(/Stay inspired!?\s*/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
