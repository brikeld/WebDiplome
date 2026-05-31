/** Deterministic [0, 1) float from a string seed (browser + Node safe). */
export function seededFloat(seedStr) {
  let h = 2166136261;
  const s = String(seedStr ?? '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0x1_0000_0000;
}
