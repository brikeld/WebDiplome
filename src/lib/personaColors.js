/** Canonical UI persona colors (match App.jsx / profile header rings). */
export const PERSONA_UI_COLORS = {
  productivity: '#D8D8D8',
  productivite: '#D8D8D8',
  security: '#759AEF',
  securite: '#759AEF',
  popularity: '#CCF847',
  popularite: '#CCF847',
  social: '#CCF847',
};

export const PERSONA_UI_LABELS = {
  productivity: 'Productivity',
  security: 'Security',
  popularity: 'Social',
  social: 'Social',
};

export function personaUiColor(key) {
  return PERSONA_UI_COLORS[String(key ?? '').toLowerCase()] ?? PERSONA_UI_COLORS.productivity;
}

export const PERSONA_UI_KEYS = ['productivity', 'security', 'social'];

export function personaColorAtIndex(index) {
  const key = PERSONA_UI_KEYS[Math.abs(Number(index) || 0) % PERSONA_UI_KEYS.length];
  return personaUiColor(key);
}
