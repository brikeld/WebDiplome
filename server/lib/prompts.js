import { promises as fs } from 'fs';
import path from 'path';

export const DEFAULT_SLOT_PROMPTS = {
  browser: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. The user's browser history data is listed above. Pick ONE specific site or browsing pattern, make a witty self-aware observation about it (max 200 chars). Touch of humor. No hashtags.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
    temperature: 0.85,
    maxTokens: 900,
  },
  chart: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. A data chart about your digital life is attached. React to what it reveals — pick ONE specific number, bar, or pattern, be honest and a little self-aware (max 200 chars). No hashtags.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
    temperature: 0.85,
    maxTokens: 900,
  },
  app_usage: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. Your recently used apps are listed above. Pick ONE app or usage pattern that reveals something about you — honest, slightly self-aware, maybe funny (max 200 chars). No hashtags.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
    temperature: 0.85,
    maxTokens: 900,
  },
  image: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. A photo from your own files is attached. Describe or react to what you see — specific detail, natural voice, touch of humor (max 200 chars). No hashtags.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
    temperature: 0.82,
    maxTokens: 900,
  },
  wifi: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. Your WiFi network history is listed above. Make a wry, location-aware comment — maybe about the number of cafés, a trip pattern, or a funny network name (max 200 chars). No hashtags.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
    temperature: 0.85,
    maxTokens: 900,
  },
  downloads: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. Your recent downloads are listed above. Pick ONE download that reveals something about you — funny, honest, maybe slightly embarrassing (max 200 chars). No hashtags.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
    temperature: 0.85,
    maxTokens: 900,
  },
  document: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. A document from your files is attached below. Reference something concrete from it — a phrase, a topic, a vibe — without quoting verbatim. Sound like you're casually mentioning something you were working on, with humor (max 200 chars). No hashtags.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
    temperature: 0.80,
    maxTokens: 900,
  },
  leaderboard: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. The user has just been ranked on a top-5 leaderboard by an opaque scoring algorithm. The board title, the user's rank (1–5), and (optionally) their previous rank are listed in the context above. Write ONE post (max 200 chars) reacting to the rank or the change — confident, slightly self-aware, lean into the algorithm's reductive framing. If previousUserRank is provided, acknowledge the move (climbed / dropped / new). No hashtags.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
    temperature: 0.8,
    maxTokens: 1200,
  },
};

export const DEFAULT_PROMPTS = {
  personaPosts: {
    productivite: {
      system:
        'You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) about something from their workflow or productivity. Sound like a human: a bit self-aware, natural rhythm, maybe slightly ironic or proud. No hashtags. No motivational-speaker tone.\nReturn ONLY valid JSON: {"content":"...","sentiment":"positive"|"negative"}. /no_think',
      temperature: 0.7,
      maxTokens: 900,
    },
    popularite: {
      system:
        'You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) about their online presence or social life. Sound like a human: genuine, maybe a little playful or self-deprecating. No hashtags. No hype-machine tone.\nReturn ONLY valid JSON: {"content":"...","sentiment":"positive"|"negative"}. /no_think',
      temperature: 0.7,
      maxTokens: 900,
    },
    securite: {
      system:
        'You write social media posts AS the person described in the profile JSON — first-person, casual, like a real tweet or short post. ONE post (max 200 characters) touching on their digital life or data habits. Sound like a human: honest, maybe a touch anxious or relieved. No hashtags. No security-textbook tone.\nReturn ONLY valid JSON: {"content":"...","sentiment":"positive"|"negative"}. /no_think',
      temperature: 0.7,
      maxTokens: 900,
    },
  },
  imageExtension:
    "\n\nAn image from the user's files is attached. Write the post as if the user is sharing or reacting to this image — describe what you see in a natural way, integrate it into the post voice. The post should feel like a genuine image caption or reaction.",
  documentExtension:
    "\n\nA document from the user's files is attached. Its filename and a text excerpt of its contents are included below the JSON. Write the post as if the user is referencing or reacting to this document — incorporate something concrete from the excerpt (a phrase, a fact, a vibe) without quoting it verbatim. The post should feel like a genuine reference to something they were working on.",
  userSummary: {
    system:
      'You write a profile bio AS the person in the JSON — first person, English only, one complete sentence (max 120 characters). Read user + profile; use profile.SCORING_DATA.PERSONA_SCORES.dominant_persona (productivite | securite | popularite).\n\nMatch the voice of their social posts:\n- productivite: workflow-obsessed, dry wit or quiet pride about how they work — not a résumé or app inventory\n- popularite: online-life energy, playful or self-deprecating — one specific habit, not a catalog of apps\n- securite: honest about their digital footprint, lightly anxious or relieved — not corporate security jargon\n\nGround it in ONE vivid detail from the data (a tool, a pattern, a vibe). Never list stacks like "Adobe, Blender, Claude, Ollama". No hashtags. No moralizing. End with . ! or ? — never "..." or "…".\nReturn ONLY valid JSON: {"description":"..."}. No markdown, no line breaks in the string. /no_think',
    temperature: 1,
    maxTokens: 900,
  },
};

function mergePersonaPosts(defaults, override) {
  const out = {};
  for (const key of Object.keys(defaults)) {
    const o = override?.[key];
    out[key] = {
      system: typeof o?.system === 'string' && o.system ? o.system : defaults[key].system,
      temperature: typeof o?.temperature === 'number' ? o.temperature : defaults[key].temperature,
      maxTokens: typeof o?.maxTokens === 'number' ? o.maxTokens : defaults[key].maxTokens,
    };
  }
  return out;
}

function mergeUserSummary(defaults, override) {
  const o = override || {};
  return {
    system: typeof o.system === 'string' && o.system ? o.system : defaults.system,
    temperature: typeof o.temperature === 'number' ? o.temperature : defaults.temperature,
    maxTokens: typeof o.maxTokens === 'number' ? o.maxTokens : defaults.maxTokens,
  };
}

function mergeSlotPrompts(defaults, override) {
  const out = {};
  for (const key of Object.keys(defaults)) {
    const o = override?.[key];
    out[key] = {
      system: typeof o?.system === 'string' && o.system ? o.system : defaults[key].system,
      temperature: typeof o?.temperature === 'number' ? o.temperature : defaults[key].temperature,
      maxTokens: typeof o?.maxTokens === 'number' ? o.maxTokens : defaults[key].maxTokens,
    };
  }
  return out;
}

export async function loadPrompts(dataDir) {
  try {
    const raw = await fs.readFile(path.join(dataDir, 'prompts.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      personaPosts: mergePersonaPosts(DEFAULT_PROMPTS.personaPosts, parsed?.personaPosts),
      slotPrompts: mergeSlotPrompts(DEFAULT_SLOT_PROMPTS, parsed?.slotPrompts),
      imageExtension:
        typeof parsed?.imageExtension === 'string' && parsed.imageExtension
          ? parsed.imageExtension
          : DEFAULT_PROMPTS.imageExtension,
      documentExtension:
        typeof parsed?.documentExtension === 'string' && parsed.documentExtension
          ? parsed.documentExtension
          : DEFAULT_PROMPTS.documentExtension,
      userSummary: mergeUserSummary(DEFAULT_PROMPTS.userSummary, parsed?.userSummary),
    };
  } catch {
    return { ...DEFAULT_PROMPTS, slotPrompts: DEFAULT_SLOT_PROMPTS };
  }
}
