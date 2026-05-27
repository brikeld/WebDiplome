/**
 * Persona-flavored "thinking" lines shown one at a time while LM Studio is
 * generating the three posts. Each persona contributes ~10 lines; phrases are
 * shuffled once per generation cycle and cycle through with a short fade so
 * the user has something specific to read instead of a static "generating new
 * content..." label.
 *
 * Persona keys match the post payload's French keys (productivite | securite |
 * popularite) so any consumer can map straight from a post's `persona` field.
 */

export const PERSONA_DISPLAY_LABEL = {
  productivite: 'Productivity',
  securite: 'Security',
  popularite: 'Social',
};

export const GENERATING_PHRASES = [
  // ── Productivity ───────────────────────────────────────────────
  { persona: 'productivite', text: 'Counting your open tabs' },
  { persona: 'productivite', text: 'Tallying screen time' },
  { persona: 'productivite', text: 'Measuring focus blocks' },
  { persona: 'productivite', text: 'Cataloguing app switches' },
  { persona: 'productivite', text: 'Reviewing recent downloads' },
  { persona: 'productivite', text: 'Inspecting calendar gaps' },
  { persona: 'productivite', text: 'Auditing keyboard rhythm' },
  { persona: 'productivite', text: 'Profiling your peak hours' },
  { persona: 'productivite', text: 'Stacking your to-do list' },
  { persona: 'productivite', text: 'Summarizing meeting density' },
  // ── Security ───────────────────────────────────────────────────
  { persona: 'securite', text: 'Verifying all security leaks' },
  { persona: 'securite', text: 'Scanning open WiFi networks' },
  { persona: 'securite', text: 'Cross-checking app permissions' },
  { persona: 'securite', text: 'Tracing your VPN exits' },
  { persona: 'securite', text: 'Sweeping browser fingerprints' },
  { persona: 'securite', text: 'Auditing keychain entries' },
  { persona: 'securite', text: 'Reviewing camera access logs' },
  { persona: 'securite', text: 'Validating SSL certificates' },
  { persona: 'securite', text: 'Profiling your threat model' },
  { persona: 'securite', text: 'Decrypting sandbox traces' },
  // ── Social / Popularity ────────────────────────────────────────
  { persona: 'popularite', text: 'Reading the room' },
  { persona: 'popularite', text: 'Counting your group chats' },
  { persona: 'popularite', text: 'Tallying late-night DMs' },
  { persona: 'popularite', text: 'Decoding your meme rotation' },
  { persona: 'popularite', text: 'Charting friend activity' },
  { persona: 'popularite', text: 'Measuring reply latency' },
  { persona: 'popularite', text: 'Profiling your vibe' },
  { persona: 'popularite', text: 'Sweeping your timeline' },
  { persona: 'popularite', text: 'Mapping your social graph' },
  { persona: 'popularite', text: 'Ranking inside jokes' },
];

/** Fisher-Yates — returns a new array, doesn't mutate input. */
export function shufflePhrases(phrases = GENERATING_PHRASES) {
  const arr = phrases.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shuffledTextsForPersona(personaKey) {
  const texts = GENERATING_PHRASES.filter((p) => p.persona === personaKey).map((p) => p.text);
  return shufflePhrases(texts);
}
