/**
 * Normalize 3 numeric axis scores into integer percentages summing to 100.
 * Uses largest-remainder rounding to keep totals stable.
 */
export function normalizePersonaPercentTriplet(scores) {
  const toNum = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  };

  const p = toNum(scores?.productivity ?? scores?.productivite);
  const s = toNum(scores?.security ?? scores?.securite);
  const so = toNum(scores?.social ?? scores?.popularity ?? scores?.popularite);
  const total = p + s + so;
  if (total <= 0) return { productivity: 34, security: 33, social: 33 };

  const raw = [
    { key: 'productivity', value: (p / total) * 100 },
    { key: 'security', value: (s / total) * 100 },
    { key: 'social', value: (so / total) * 100 },
  ];
  const floored = raw.map((r) => ({ ...r, floor: Math.floor(r.value), frac: r.value - Math.floor(r.value) }));
  let remainder = 100 - floored.reduce((acc, r) => acc + r.floor, 0);
  floored.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < floored.length && remainder > 0; i += 1) {
    floored[i].floor += 1;
    remainder -= 1;
  }
  const out = { productivity: 0, security: 0, social: 0 };
  for (const r of floored) out[r.key] = r.floor;
  return out;
}

