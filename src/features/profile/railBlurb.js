/** Matches server/lib/personaBlurbs.js MAX_BLURB_CHARS */
export const RAIL_BLURB_MAX_CHARS = 120;

export function clampRailBlurb(text) {
  const t = String(text ?? '').trim();
  if (t.length <= RAIL_BLURB_MAX_CHARS) return t;
  const cut = t.slice(0, RAIL_BLURB_MAX_CHARS - 1).trimEnd();
  const sp = cut.lastIndexOf(' ');
  const end = sp > RAIL_BLURB_MAX_CHARS * 0.55 ? cut.slice(0, sp) : cut;
  return `${end}…`;
}
