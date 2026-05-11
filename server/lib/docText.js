import pdfParse from 'pdf-parse';

export const MAX_DOC_CHARS = 4096;
const SUPPORTED_TEXT_EXTS = new Set(['.txt', '.md', '.py', '.js', '.ts', '.css']);
const PDF_EXT = '.pdf';
const PDF_TIMEOUT_MS = 3000;

function normalizeWhitespace(s) {
  // Drop control chars except \n, collapse internal runs of horizontal whitespace,
  // strip trailing/leading spaces on each line, then collapse 3+ newlines into two.
  const stripped = String(s || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  const linesNormalized = stripped
    .replace(/[ \t]+/g, ' ')        // collapse horizontal whitespace runs
    .replace(/^ | $/gm, '')         // strip leading/trailing spaces per line
    .replace(/\n{3,}/g, '\n\n');    // collapse 3+ newlines into two
  return linesNormalized.trim();
}

function clamp(s) {
  return s.length > MAX_DOC_CHARS ? s.slice(0, MAX_DOC_CHARS) : s;
}

async function extractPdf(buf) {
  const parsePromise = pdfParse(buf).then((r) => r?.text ?? '');
  const timeoutPromise = new Promise((_resolve, reject) =>
    setTimeout(() => reject(new Error('pdf-parse timeout')), PDF_TIMEOUT_MS),
  );
  return Promise.race([parsePromise, timeoutPromise]);
}

export async function extractDocText(buf, ext) {
  if (!buf || buf.length === 0) return null;
  const e = String(ext || '').toLowerCase();
  try {
    let text;
    if (e === PDF_EXT) {
      text = await extractPdf(buf);
    } else if (SUPPORTED_TEXT_EXTS.has(e)) {
      text = buf.toString('utf8');
    } else {
      return null;
    }
    const normalized = normalizeWhitespace(text);
    if (!normalized) return null;
    return clamp(normalized);
  } catch {
    return null;
  }
}
