import { normalizePersonaPercentTriplet } from './personaScores.js';

const STATIC_PROFILE_FIELDS = [
  'machineName',
  'machineModel',
  'hardwareChip',
  'ram',
  'systemLanguages',
  'wallpaperBase64',
];

function hasValue(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Merge camelCase + snake_case aliases; stored JSON uses camelCase. */
export function normalizeProfilePayload(body) {
  const out = { ...body };

  if (body.profileSummary !== undefined || body.profile_summary !== undefined) {
    out.profileSummary = body.profileSummary ?? body.profile_summary;
  }
  if (body.userDescription !== undefined || body.user_description !== undefined) {
    out.userDescription = body.userDescription ?? body.user_description;
  }
  if (body.personaPosts !== undefined || body.persona_posts !== undefined) {
    out.personaPosts = body.personaPosts ?? body.persona_posts;
  }
  if (body.personaScores !== undefined || body.persona_scores !== undefined) {
    const raw = body.personaScores ?? body.persona_scores;
    out.personaScores = normalizePersonaPercentTriplet(raw);
  }
  if (body.machineName !== undefined || body.machine_name !== undefined) {
    out.machineName = body.machineName ?? body.machine_name;
  }
  if (body.machineModel !== undefined || body.machine_model !== undefined) {
    out.machineModel = body.machineModel ?? body.machine_model;
  }
  if (body.hardwareChip !== undefined || body.hardware_chip !== undefined) {
    out.hardwareChip = body.hardwareChip ?? body.hardware_chip;
  }

  delete out.profile_summary;
  delete out.user_description;
  delete out.persona_posts;
  delete out.persona_scores;
  delete out.machine_name;
  delete out.machine_model;
  delete out.hardware_chip;

  return out;
}

export function mergeStaticProfileFields(incoming, existing) {
  if (!existing || typeof existing !== 'object') return incoming;

  const out = { ...incoming };
  for (const field of STATIC_PROFILE_FIELDS) {
    if (!hasValue(out[field]) && hasValue(existing[field])) {
      out[field] = existing[field];
    }
  }
  return out;
}
