const CHAIN_EMOJI = {
  'what we checked': '🔎',
  'what it means': '🧠',
  'why this post': '✍️',
};

const CHAIN_EMOJI_BY_INDEX = ['🔎', '🧠', '✍️'];

const THINKING_EMOJI = {
  'WHAT I SAW': '👀',
  'WHAT I IGNORED': '🙈',
  'WHAT WEIGHED MOST': '⚖️',
  'THE LEAP': '➡️',
  'WHERE I CHEATED': '🃏',
  'WHY THIS ANGLE': '🎯',
  'WORD I PICKED': '✏️',
  'ALMOST WROTE': '💭',
  'PERSONA LENS': '🎭',
  'CHART READ': '📊',
  'ONE NUMBER': '🔢',
  'ANGLE PICK': '🧭',
  'SSID HOOK': '📶',
  'DATA HOOK': '🪝',
  'EMOTION': '😶',
  'CHECKED': '✅',
};

const THINKING_KEYWORDS = [
  ['IGNORE', '🙈'],
  ['WEIGH', '⚖️'],
  ['CHEAT', '🃏'],
  ['LEAP', '➡️'],
  ['ANGLE', '🎯'],
  ['WORD', '✏️'],
  ['WROTE', '💭'],
  ['PERSONA', '🎭'],
  ['CHART', '📊'],
  ['NUMBER', '🔢'],
  ['HOOK', '🪝'],
  ['SAW', '👀'],
  ['EMOTION', '😶'],
  ['CHECK', '✅'],
];

const INGREDIENT_EMOJI = {
  'installed apps': '📲',
  'activity rhythm': '⏱️',
  'risk signals': '🛡️',
  'location signals': '📍',
  'recent files': '📁',
  'browsing patterns': '🌐',
  'chart signal': '📊',
  'post caption': '💬',
  'persona lens': '🎭',
  'wi-fi signals': '📶',
  'wifi signals': '📶',
};

const INGREDIENT_KEYWORDS = [
  ['screenshot', '📸'],
  ['browser', '🌐'],
  ['browsing', '🌐'],
  ['wifi', '📶'],
  ['wi-fi', '📶'],
  ['location', '📍'],
  ['security', '🔒'],
  ['risk', '🛡️'],
  ['activity', '⏱️'],
  ['rhythm', '⏱️'],
  ['caption', '💬'],
  ['persona', '👤'],
  ['chart', '📊'],
  ['email', '✉️'],
  ['music', '🎵'],
  ['screen', '🖥️'],
  ['file', '📁'],
  ['app', '📱'],
];

function normalizeKey(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, '-');
}

function normalizeThinkingKey(text) {
  return String(text ?? '').trim().toUpperCase();
}

function matchKeywordEmoji(text, pairs, fallback) {
  const hay = String(text ?? '').toLowerCase();
  for (const [needle, emoji] of pairs) {
    if (hay.includes(needle)) return emoji;
  }
  return fallback;
}

/** One emoji per compact chip in the tell-me-more analysis sections. */
export function chipEmojiForLabel(label, kind = 'thinking', index = 0) {
  if (kind === 'chain') {
    return CHAIN_EMOJI[normalizeKey(label)] ?? CHAIN_EMOJI_BY_INDEX[index] ?? '🔎';
  }

  if (kind === 'ingredient') {
    const key = normalizeKey(label);
    if (INGREDIENT_EMOJI[key]) return INGREDIENT_EMOJI[key];
    return matchKeywordEmoji(label, INGREDIENT_KEYWORDS, '📋');
  }

  const thinkingKey = normalizeThinkingKey(label);
  if (THINKING_EMOJI[thinkingKey]) return THINKING_EMOJI[thinkingKey];
  return matchKeywordEmoji(thinkingKey, THINKING_KEYWORDS, '💡');
}
