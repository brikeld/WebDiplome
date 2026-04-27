/**
 * Display-only cleanup for post body text.
 */
export function sanitizePostContent(text) {
  if (text == null) return '';
  if (typeof text !== 'string') return String(text);
  return text
    .replace(/Stay inspired!?\s*/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
