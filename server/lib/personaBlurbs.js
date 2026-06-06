import { normalizePersonaPercentTriplet } from './personaScores.js';
import {
  buildChatBody,
  lmChatCompletion,
  extractChoiceText,
  parsePrefillSuggestion,
  dominantPersonaKey,
  JSON_CONTENT_PREFILL,
} from './commentSuggestions.js';
import {
  extractAppCategorySlice,
  formatAppCategoryAsText,
  extractMostUsedAppsSlice,
  formatAppUsageAsText,
  extractSecuritySlice,
  extractBrowserSlice,
  formatBrowserSliceAsText,
  extractWifiSlice,
  formatWifiSliceAsText,
  extractDownloadsSlice,
  formatDownloadsAsText,
} from './dataSlices.js';

const PERSONA_ORDER = ['productivite', 'securite', 'popularite'];
const MAX_BLURB_CHARS = 200;

const PERSONA_HINTS = {
  productivite: 'productivity, focus, throughput, tools and file activity',
  securite: 'security posture, risk, caution, protection habits',
  popularite: 'social visibility, communication apps, public online footprint',
};

const SCORE_KEY_BY_PERSONA = {
  productivite: 'productivity',
  securite: 'security',
  popularite: 'social',
};

const FALLBACK_BLURBS = {
  productivite: 'Productivity score reflects work tools, file churn, and focused active hours on this machine.',
  securite: 'Security score tracks SIP, FileVault, Gatekeeper hygiene, VPN use, and update posture.',
  popularite: 'Social score reads communication apps, browser habits, and how public the footprint looks.',
};

function normalizeScoresInput(scores, profile) {
  if (scores && typeof scores === 'object') {
    return normalizePersonaPercentTriplet({
      productivity: scores.productivity,
      security: scores.security,
      social: scores.social ?? scores.popularity,
    });
  }
  if (profile?.personaScores) {
    return normalizePersonaPercentTriplet(profile.personaScores);
  }
  return { productivity: 0, security: 0, social: 0 };
}

function buildPersonaHarvestContext(electronData, persona) {
  if (!electronData || typeof electronData !== 'object') return '';

  const parts = [];
  if (persona === 'productivite') {
    const usage = formatAppUsageAsText(extractMostUsedAppsSlice(electronData));
    const categories = formatAppCategoryAsText(extractAppCategorySlice(electronData));
    if (usage) parts.push(usage);
    if (categories) parts.push(categories);
  } else if (persona === 'securite') {
    const sec = extractSecuritySlice(electronData);
    parts.push(
      `Security: SIP ${sec.sip}, FileVault ${sec.filevault}, Gatekeeper ${sec.gatekeeper}. Tools: ${sec.securityApps.join(', ') || 'none listed'}.`,
    );
    const wifi = formatWifiSliceAsText(extractWifiSlice(electronData));
    if (wifi) parts.push(wifi);
  } else {
    const browser = formatBrowserSliceAsText(extractBrowserSlice(electronData));
    const categories = extractAppCategorySlice(electronData);
    if (browser) parts.push(browser);
    if (categories.recentlyUsed?.length) {
      parts.push(`Recently used apps: ${categories.recentlyUsed.slice(0, 8).join(', ')}`);
    }
    const downloads = formatDownloadsAsText(extractDownloadsSlice(electronData));
    if (downloads) parts.push(downloads);
  }

  return parts.join('\n').slice(0, 1200);
}

function buildBlurbUserPayload(profile, electronData, scores, persona, mainPersona) {
  const triplet = normalizeScoresInput(scores, profile);
  const scoreKey = SCORE_KEY_BY_PERSONA[persona];
  const scorePercent = triplet[scoreKey] ?? 0;
  const name = `${profile?.firstname ?? profile?.firstName ?? ''} ${profile?.lastname ?? profile?.lastName ?? ''}`.trim();

  return JSON.stringify({
    persona_axis: persona,
    score_percent: scorePercent,
    main_persona: mainPersona,
    user: {
      name: name || 'User',
      machine: profile?.machineName ?? profile?.machine_name ?? null,
      bio: String(profile?.profileSummary ?? profile?.userDescription ?? '').slice(0, 200),
    },
    harvest: buildPersonaHarvestContext(electronData, persona),
  });
}

function buildPlainBlurbPayload(profile, scores, persona, mainPersona) {
  const triplet = normalizeScoresInput(scores, profile);
  const scoreKey = SCORE_KEY_BY_PERSONA[persona];
  const scorePercent = triplet[scoreKey] ?? 0;
  const name = `${profile?.firstname ?? profile?.firstName ?? ''} ${profile?.lastname ?? profile?.lastName ?? ''}`.trim();
  return [
    `User: ${name || 'User'} (main persona: ${mainPersona}).`,
    `Axis: ${persona}. Score: ${scorePercent}%.`,
    `Write one observational sentence about this axis score using harvested machine data.`,
  ].join('\n');
}

function buildBlurbPrompt(persona, mainPersona, scorePercent) {
  const dominantNote = persona === mainPersona ? 'This is their dominant persona.' : '';
  return [
    'Complete the in-progress assistant JSON. It already starts {"content":',
    `Write ONLY the blurb text (max ${MAX_BLURB_CHARS} chars), then close with "}.`,
    `One complete sentence about the user's ${persona} score (${scorePercent}%) grounded in the harvest JSON.`,
    `Tone: sharp profile copy, third person, mentions the % naturally. ${PERSONA_HINTS[persona]}. ${dominantNote}`,
    'One concrete detail from harvest. English. Must end with . ! or ? — never cut off mid-sentence. No lists. No markdown. /no_think',
  ].join(' ');
}

function buildMinimalBlurbPrompt(persona, scorePercent) {
  return `Finish {"content":" with one ${persona} blurb (max ${MAX_BLURB_CHARS} chars) about a ${scorePercent}% score. Mention the %. One complete sentence ending with . ! or ?. English. Close with "}. /no_think`;
}

async function generateOneBlurb({
  persona,
  mainPersona,
  baseUrl,
  model,
  userPayload,
  plainUserPayload,
  scorePercent,
  timeoutMs,
  retries,
}) {
  const strategies = [
    {
      label: 'prefill',
      systemPrompt: buildBlurbPrompt(persona, mainPersona, scorePercent),
      payload: userPayload,
      assistantPrefill: JSON_CONTENT_PREFILL,
      maxTokens: 128,
      temperature: 0.5,
    },
    {
      label: 'prefill-plain',
      systemPrompt: buildMinimalBlurbPrompt(persona, scorePercent),
      payload: plainUserPayload,
      assistantPrefill: JSON_CONTENT_PREFILL,
      maxTokens: 144,
      temperature: 0.4,
    },
  ];

  let lastRaw = '';
  for (let i = 0; i < strategies.length; i += 1) {
    const s = strategies[i];
    const body = buildChatBody({
      model,
      systemPrompt: s.systemPrompt,
      userPayload: s.payload,
      imageData: null,
      temperature: s.temperature,
      maxTokens: s.maxTokens,
      assistantPrefill: s.assistantPrefill,
      jsonMode: false,
    });

    let resp;
    try {
      resp = await lmChatCompletion({ baseUrl, timeoutMs, retries, body });
    } catch (e) {
      console.warn(`[persona-blurbs] ${persona} ${s.label} LM error:`, String(e?.message ?? e));
      continue;
    }

    const choiceText = extractChoiceText(resp);
    lastRaw = choiceText;
    const content = parsePrefillSuggestion(choiceText, MAX_BLURB_CHARS);
    if (content) return content;

    console.warn(
      `[persona-blurbs] ${persona} ${s.label} parse failed; len=${lastRaw.length}; head:`,
      lastRaw.slice(0, 200),
    );
  }

  console.warn(`[persona-blurbs] ${persona} fallback after failed parse`);
  return FALLBACK_BLURBS[persona] ?? 'Score reflects harvested activity on this machine.';
}

export async function generatePersonaBlurbs({
  baseUrl,
  model,
  profile,
  electronData = null,
  scores = null,
  timeoutMs = 120000,
  retries = 1,
}) {
  const mainPersona = dominantPersonaKey(profile);
  const triplet = normalizeScoresInput(scores, profile);
  const out = {};

  for (const persona of PERSONA_ORDER) {
    const scoreKey = SCORE_KEY_BY_PERSONA[persona];
    const scorePercent = triplet[scoreKey] ?? 0;
    const userPayload = buildBlurbUserPayload(profile, electronData, triplet, persona, mainPersona);
    const plainUserPayload = buildPlainBlurbPayload(profile, triplet, persona, mainPersona);

    try {
      out[persona] = await generateOneBlurb({
        persona,
        mainPersona,
        baseUrl,
        model,
        userPayload,
        plainUserPayload,
        scorePercent,
        timeoutMs,
        retries,
      });
    } catch (e) {
      console.warn(`[persona-blurbs] ${persona} failed:`, String(e?.message ?? e));
      out[persona] = FALLBACK_BLURBS[persona];
    }
  }

  return out;
}
