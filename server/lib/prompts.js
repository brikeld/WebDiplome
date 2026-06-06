import { promises as fs } from 'fs';
import path from 'path';

export const DEFAULT_SLOT_PROMPTS = {
  browser: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. Browser context is listed above with a suggested angle line. Follow that angle — pick ONE concrete domain, tab title, or browsing pattern. Vary tone: dry, self-aware, amused, or quietly guilty (max 200 chars). No hashtags.\nReturn valid JSON with content, sentiment, and the analysis fields described below. /no_think",
    temperature: 0.88,
    maxTokens: 900,
  },
  chart: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. A data chart about your digital life is attached. React to what it reveals — pick ONE specific number, bar, or pattern, be honest and a little self-aware (max 200 chars). No hashtags.\nReturn valid JSON with content, sentiment, and the analysis fields described below. /no_think",
    temperature: 0.85,
    maxTokens: 900,
  },
  app_usage: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. Recently used apps are listed above with a suggested angle line. Follow that angle — pick ONE app or usage pattern. Honest, slightly self-aware, maybe funny — not a résumé of every app (max 200 chars). No hashtags.\nReturn valid JSON with content, sentiment, and the analysis fields described below. /no_think",
    temperature: 0.88,
    maxTokens: 900,
  },
  image: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. A photo or screenshot from the user's files is attached in the user message. The caption MUST be grounded in what is actually visible in that image: name at least TWO concrete visual details (objects, UI, text on screen, colors, setting). Do not write about browser history, apps, or other profile JSON unless you can see them in the image. Profile JSON is only for voice/tone. Touch of humor (max 200 chars). No hashtags.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
    temperature: 0.82,
    maxTokens: 900,
  },
  wifi: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. WiFi network context is listed above, including a suggested angle line. Follow that angle — pick ONE concrete SSID, cluster, or stat from the data. Do not default to generic café jokes unless the angle is café-related. Vary tone: dry, self-aware, paranoid, or amused as fits the angle (max 200 chars). No hashtags.\nReturn valid JSON with content, sentiment, and the analysis fields described below. /no_think",
    temperature: 0.88,
    maxTokens: 900,
  },
  downloads: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. Recent downloads are listed above with a suggested angle line. Follow that angle — pick ONE download. Funny, honest, maybe slightly embarrassing — not a file inventory (max 200 chars). No hashtags.\nReturn valid JSON with content, sentiment, and the analysis fields described below. /no_think",
    temperature: 0.88,
    maxTokens: 900,
  },
  recent_files: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. Recent file activity is listed above with a suggested angle line. Follow that angle — pick ONE file type, folder, late-night habit, or volume stat. Sound like you noticed something about how you work (max 200 chars). No hashtags.\nReturn valid JSON with content, sentiment, and the analysis fields described below. /no_think",
    temperature: 0.86,
    maxTokens: 900,
  },
  app_stack: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. Installed-app categories are listed above with a suggested angle line. Follow that angle — pick ONE category contrast, hoarding habit, or creative-stack detail. Dry wit, not a software list (max 200 chars). No hashtags.\nReturn valid JSON with content, sentiment, and the analysis fields described below. /no_think",
    temperature: 0.86,
    maxTokens: 900,
  },
  security_posture: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. Security posture data is listed above with a suggested angle line. Follow that angle — SIP/FileVault/VPN apps or honest anxiety. No corporate security jargon (max 200 chars). No hashtags.\nReturn valid JSON with content, sentiment, and the analysis fields described below. /no_think",
    temperature: 0.84,
    maxTokens: 900,
  },
  ai_tools: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. AI tool signals are listed above with a suggested angle line. Follow that angle — installed stack, recent use, or stack creep. Playful self-awareness, not a product review (max 200 chars). No hashtags.\nReturn valid JSON with content, sentiment, and the analysis fields described below. /no_think",
    temperature: 0.88,
    maxTokens: 900,
  },
  document: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. A document from your files is attached below. Reference something concrete from it — a phrase, a topic, a vibe — without quoting verbatim. Sound like you're casually mentioning something you were working on, with humor (max 200 chars). No hashtags.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
    temperature: 0.80,
    maxTokens: 900,
  },
  leaderboard: {
    system: "You write first-person social media posts in English — short, casual, like a real tweet. You have just been ranked on a top-5 leaderboard by an opaque scoring algorithm. The board title, your rank (1–5), and (optionally) your previous rank (if it was set) are listed in the context above. Write ONE post (max 200 chars) reacting to the rank or the change — confident, slightly self-aware, lean into the algorithm's reductive framing. If previousUserRank is provided, acknowledge the move (climbed / dropped / new). No hashtags.\nReturn ONLY valid JSON: {\"content\":\"...\",\"sentiment\":\"positive\"|\"negative\"}. /no_think",
    temperature: 0.80,
    maxTokens: 1200,
  },
  leaderboard_rationales: {
    system: `You write very short rationales for a satirical surveillance leaderboard. You will be given a board title, the board's scoring rule in plain English, and 5 entries with rank + score + isUser + hidden. For the ONE entry marked "isUser":true, use the provided real signal hint to ground the rationale. For each clone (isUser:false), you may invent a short personality line, BUT the "signal" field for clones must ONLY restate "score N" (N = that clone's rounded score) — never include the user's score, never invent app counts, file counts, or any other fabricated data. For any entry marked "hidden":true, emit phrase:null and signal:null. Phrases are lower-case, max 90 chars, no hashtags, no emojis. Return ONLY valid JSON: {"rationales":[{"rank":1,"phrase":"...","signal":"..."}, ...]} with exactly 5 entries, one per rank, in ascending rank order. /no_think`,
    temperature: 0.6,
    maxTokens: 600,
  },
  leaderboard_climb_tip: {
    system: `You write ONE short, plain tip for climbing a satirical surveillance leaderboard. You get the board title, how the board scores people, the user's rank (1–5), and their signal hint. Write a single simple sentence the user can actually follow — conversational, not technical. Start with "To climb this board," then one concrete action tied to the scoring rule. If rank is 1, say they are already at the top and what to keep doing. Max 110 characters. No emojis, no hashtags. Return ONLY valid JSON: {"climbTip":"..."}. /no_think`,
    temperature: 0.65,
    maxTokens: 120,
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

/**
 * Per-board fallback rationales used when the LM Studio rationales call fails
 * or returns malformed JSON. selfPhrase is used for the user; clonePhrases[] is
 * cycled by clone index. Clone signals are filled in at runtime ("score N").
 */
export const RATIONALE_TEMPLATES = {
  most_productive: {
    selfPhrase: 'shipping more than you sleep',
    clonePhrases: [
      'quietly outproducing the room',
      'mostly creative tools today',
      'late-night work bursts',
      'one big push, then silence',
    ],
  },
  closest_to_burnout: {
    selfPhrase: 'editing files past midnight again',
    clonePhrases: [
      'no social apps in days',
      'work app open all weekend',
      'back-to-back since dawn',
      'inbox at 1am energy',
    ],
  },
  most_likely_change_jobs: {
    selfPhrase: 'tab open on a job board',
    clonePhrases: [
      'glassdoor-curious this week',
      'low file output, high comms',
      'recruiter dm season',
      'updating the resume quietly',
    ],
  },
  ignoring_health: {
    selfPhrase: 'no health app installed and it shows',
    clonePhrases: [
      'café wifi, late-night files',
      'screen time off the chart',
      'fitness app last opened: never',
      'snack runs as cardio',
    ],
  },
  most_secure: {
    selfPhrase: 'vpn on, torrents off',
    clonePhrases: [
      'fewest networks joined',
      'paranoid in a good way',
      'firewall hobbyist energy',
      'never on public wifi',
    ],
  },
  most_socially_isolated: {
    selfPhrase: 'one wifi network, zero pings',
    clonePhrases: [
      'social apps untouched today',
      'lone wolf signal',
      'one chat tab, all week',
      'group chats on mute',
    ],
  },
  most_likely_ghost: {
    selfPhrase: 'reads but doesn\u2019t reply',
    clonePhrases: [
      'comms app open, no sends',
      'last seen yesterday',
      'half-typed messages everywhere',
      'inbox at 0, replies at 0',
    ],
  },
  most_likely_miss_deadline: {
    selfPhrase: 'one more episode before the draft',
    clonePhrases: [
      'tabs open, nothing shipped',
      'deadline tomorrow, vibes today',
      'scrolling through the brief again',
      'almost started, technically',
    ],
  },
  replaced_by_ai_90_days: {
    selfPhrase: 'delegating the thinking to the bots',
    clonePhrases: [
      'copilot does the first pass',
      'prompt engineer by accident',
      'human in the loop, barely',
      'automating themselves out slowly',
    ],
  },
  least_with_expensive_setup: {
    selfPhrase: 'max spec, min output',
    clonePhrases: [
      'studio rig, hobby pace',
      'M-chip, S-tier procrastination',
      'gear envy bait',
      'render farm for one png',
    ],
  },
  procrastinate_right_now: {
    selfPhrase: 'just checking one thing first',
    clonePhrases: [
      'afternoon scroll spiral',
      'inbox zero cosplay',
      'organizing folders instead',
      'one more coffee break',
    ],
  },
  quit_to_countryside: {
    selfPhrase: 'saved a farmhouse listing at 2am',
    clonePhrases: [
      'homestead tab hoarder',
      'job board then cottage pinterest',
      'off-grid curious lately',
      'vanlife research phase',
    ],
  },
  get_hacked_this_month: {
    selfPhrase: 'public wifi and no vpn',
    clonePhrases: [
      'torrent client still installed',
      'password reuse energy',
      'updates snoozed since spring',
      'guest network regular',
    ],
  },
  tracked_by_third_parties: {
    selfPhrase: 'every domain knows their name',
    clonePhrases: [
      'ad pixels everywhere',
      'social logins on everything',
      'browser history is the product',
      'no vpn, full footprint',
    ],
  },
  ignoring_system_warnings: {
    selfPhrase: 'dismissed the dialog three weeks ago',
    clonePhrases: [
      'disk almost full, still downloading',
      'battery service recommended, ignored',
      'filevault off, vibes on',
      'red badge collector',
    ],
  },
  leak_confidential_accident: {
    selfPhrase: 'wrong slack thread, right attachment',
    clonePhrases: [
      'sync folder chaos',
      'screenshot with metadata',
      'reply-all energy',
      'cloud link, no password',
    ],
  },
  messiest_digital_life: {
    selfPhrase: 'downloads folder as filing system',
    clonePhrases: [
      '200 saved wifi networks',
      'installs everything, uses nothing',
      'storage bar permanently red',
      'desktop as inbox',
    ],
  },
  havent_left_house: {
    selfPhrase: 'same home wifi for days',
    clonePhrases: [
      'delivery apps only social life',
      'outside network: not found',
      'couch orbit stable',
      'fresh air last seen: unclear',
    ],
  },
  talking_to_ais_not_people: {
    selfPhrase: 'long chat with claude, zero texts sent',
    clonePhrases: [
      'ai therapist hours',
      'group chat mute, llm unmute',
      'prompts not people',
      'social battery routed to bots',
    ],
  },
  least_sleep: {
    selfPhrase: 'files saved after midnight again',
    clonePhrases: [
      'no sleep app, many late tabs',
      '3am creative burst routine',
      'alarm is a suggestion',
      'circadian rhythm optional',
    ],
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
