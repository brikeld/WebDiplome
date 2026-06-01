export const RAIL_PERSONAS = [
  {
    key: 'productivity',
    label: 'Productivity',
    fallback: 'Code output, file activity and focused active hours.',
  },
  {
    key: 'security',
    label: 'Security',
    fallback: 'System protection: SIP, FileVault, Gatekeeper and update hygiene.',
  },
  {
    key: 'social',
    label: 'Social',
    fallback: 'Communication apps, network exposure and public activity.',
  },
];

export function normalizeRailDominant(key) {
  const k = String(key ?? '').toLowerCase();
  if (k === 'social' || k === 'popularite' || k === 'popularity') return 'social';
  if (k === 'productivite') return 'productivity';
  if (k === 'securite') return 'security';
  return RAIL_PERSONAS.some((p) => p.key === k) ? k : 'productivity';
}

export function orderRailPersonasByDominant(dominantKey) {
  const dom = normalizeRailDominant(dominantKey);
  const dominant = RAIL_PERSONAS.find((p) => p.key === dom) ?? RAIL_PERSONAS[0];
  const rest = RAIL_PERSONAS.filter((p) => p.key !== dominant.key);
  return [dominant, ...rest];
}
