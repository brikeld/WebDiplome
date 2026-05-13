import { promises as fs } from 'fs';
import path from 'path';

export const DEFAULT_SLOT_PROMPTS = {
  browser: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. The user's browser history data is listed above. Pick ONE specific site or browsing pattern, make a witty self-aware observation about it (max 200 chars). Touch of humor. No hashtags.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
    temperature: 0.85,
    maxTokens: 900,
  },
  chart: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. A chart of your installed app categories (or related usage data) is attached. React to what it reveals about you — pick ONE category or bar, be honest and a little self-deprecating (max 200 chars). No hashtags.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
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
      'You profile digital citizens from system data. Read the JSON (user + profile). Write ONE short introduction in French (max 140 characters) describing observable digital habits/tools — factual, no moral judgment.\nReturn ONLY valid JSON: {"description":"..."}. No markdown, no line breaks in the string. /no_think',
    temperature: 0.55,
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
