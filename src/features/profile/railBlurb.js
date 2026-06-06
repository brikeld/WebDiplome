/** Matches server/lib/personaBlurbs.js MAX_BLURB_CHARS */
export const RAIL_BLURB_MAX_CHARS = 200;

export function clampRailBlurb(text) {
  const t = String(text ?? '').trim();
  if (t.length <= RAIL_BLURB_MAX_CHARS) return t;
  const slice = t.slice(0, RAIL_BLURB_MAX_CHARS);
  let lastPunct = -1;
  for (let i = 0; i < slice.length; i += 1) {
    if ('.!?'.includes(slice[i])) lastPunct = i;
  }
  const minBreak = Math.floor(RAIL_BLURB_MAX_CHARS * 0.35);
  if (lastPunct >= minBreak) return slice.slice(0, lastPunct + 1).trim();
  const sp = slice.lastIndexOf(' ');
  if (sp > minBreak) return `${slice.slice(0, sp).trim()}…`;
  return `${slice.slice(0, RAIL_BLURB_MAX_CHARS - 1).trim()}…`;
}
