import {
  avatarSrcFromProfile,
  displayNameFromProfile,
  formatRelativeTimeAgo,
  getPersonaScoresNormalized,
  machineHandleFromProfile,
  normalizePersonaKey,
  profileBioText,
  resolveDominantPersonaKey,
} from './profileUtils.js';
import { personaUiColor } from './personaColors.js';

const APP_CATEGORY = {
  safari: 'browser',
  chrome: 'browser',
  arc: 'browser',
  firefox: 'browser',
  cursor: 'development',
  code: 'development',
  terminal: 'development',
  figma: 'design',
  photoshop: 'design',
  illustrator: 'design',
  premiere: 'video',
  'after effects': 'video',
  blender: '3d',
  discord: 'social',
  whatsapp: 'social',
  telegram: 'social',
  slack: 'social',
  spotify: 'media',
  music: 'media',
  notion: 'productivity',
  notes: 'productivity',
  mail: 'productivity',
};

function guessAppCategory(name) {
  const n = String(name ?? '').toLowerCase();
  for (const [needle, cat] of Object.entries(APP_CATEGORY)) {
    if (n.includes(needle)) return cat;
  }
  return 'app';
}

function postFootprintFromProfile(p) {
  const posts = Array.isArray(p?.personaPosts)
    ? p.personaPosts
    : Array.isArray(p?.persona_posts)
      ? p.persona_posts
      : [];
  const byPersona = { productivity: 0, security: 0, popularity: 0 };
  let withAssets = 0;
  let systemPosts = 0;

  for (const post of posts) {
    const key = normalizePersonaKey(post?.persona);
    if (key === 'popularity') byPersona.popularity += 1;
    else if (key === 'security') byPersona.security += 1;
    else if (key === 'productivity') byPersona.productivity += 1;

    if (post?.attachedAsset || post?.attachedImage) withAssets += 1;
    if (post?.compliantType || post?.isCompliantSystemPost) systemPosts += 1;
  }

  return {
    total: posts.length,
    byPersona,
    withAssets,
    systemPosts,
    generatedPosts: Math.max(0, posts.length - systemPosts),
  };
}

function parseGb(value) {
  if (value == null) return null;
  const m = String(value).match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

/** Country name inferred from a locale like "en_CH" / "fr-FR". */
function regionFromLocale(locale) {
  const m = String(locale ?? '').match(/[_-]([A-Z]{2})$/i);
  if (!m) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(m[1].toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

function storageSection(p, ov) {
  const fromOverview = ov?.storage ?? null;
  if (fromOverview) {
    const total = fromOverview.totalGb ?? null;
    const used = fromOverview.usedGb ?? null;
    return {
      totalGb: total,
      usedGb: used,
      freeGb:
        fromOverview.freeGb ?? (used != null && total != null ? Math.max(0, Math.round((total - used) * 10) / 10) : null),
      usePercent:
        fromOverview.usePercent ?? (used != null && total > 0 ? Math.round((used / total) * 1000) / 10 : null),
      smartStatus: fromOverview.smartStatus ?? null,
    };
  }

  const used = parseGb(p?.storageUsed ?? p?.storage_used);
  const total = parseGb(p?.storageTotal ?? p?.storage_total);
  if (used == null && total == null) return null;
  return {
    totalGb: total,
    usedGb: used,
    freeGb: used != null && total != null ? Math.max(0, Math.round((total - used) * 10) / 10) : null,
    usePercent: used != null && total > 0 ? Math.round((used / total) * 1000) / 10 : null,
    smartStatus: null,
  };
}

function batterySection(p, ov) {
  if (ov?.battery) return ov.battery;
  const percent = p?.batteryPercent ?? p?.battery_percent ?? null;
  const cycles = p?.batteryCycles ?? p?.battery_cycles ?? null;
  if (percent == null && cycles == null) return null;
  return {
    percent,
    charging: null,
    powerSource: null,
    cycles,
    condition: p?.batteryCondition ?? null,
    healthPercent: p?.batteryHealthPercent ?? null,
  };
}

/**
 * Map live WebDiplome profile (+ server harvestOverview + adjusted persona
 * scores) → ProfileOverview view model. Sections are null when the harvest
 * has nothing to show so the UI can skip them entirely.
 */
export function buildProfileOverviewData(profile, { adjustedScores, dominantPersona } = {}) {
  if (!profile) return null;

  const ov = profile.harvestOverview && typeof profile.harvestOverview === 'object'
    ? profile.harvestOverview
    : null;

  const baselineScores = getPersonaScoresNormalized(profile);
  const scores = {
    productivity: Math.round(Number(adjustedScores?.productivity ?? baselineScores.productivity) || 0),
    security: Math.round(Number(adjustedScores?.security ?? baselineScores.security) || 0),
    social: Math.round(Number(adjustedScores?.popularity ?? adjustedScores?.social ?? baselineScores.social) || 0),
  };
  const scoreDrift = {
    baseline: {
      productivity: Math.round(baselineScores.productivity),
      security: Math.round(baselineScores.security),
      social: Math.round(baselineScores.social),
    },
    live: scores,
    deltas: {
      productivity: scores.productivity - Math.round(baselineScores.productivity),
      security: scores.security - Math.round(baselineScores.security),
      social: scores.social - Math.round(baselineScores.social),
    },
    globalScore:
      profile.globalScore != null
        ? Math.round(Number(profile.globalScore))
        : profile.global_score != null
          ? Math.round(Number(profile.global_score))
          : null,
  };

  const dom = dominantPersona ?? resolveDominantPersonaKey(profile) ?? 'productivity';
  const name = displayNameFromProfile(profile);
  const collectedAt = profile.collectedAt ?? profile.collected_at;
  const lastAt = profile.lastAnalysisAt ?? profile.last_analysis_at ?? collectedAt;

  const machine = ov?.machine ?? {};
  const languages = Array.isArray(machine.languages)
    ? machine.languages
    : Array.isArray(profile.systemLanguages)
      ? profile.systemLanguages
      : Array.isArray(profile.system_languages)
        ? profile.system_languages
        : [];

  const mostUsed = Array.isArray(ov?.apps?.mostUsed) && ov.apps.mostUsed.length > 0
    ? ov.apps.mostUsed
    : Array.isArray(profile.mostUsedApps)
      ? profile.mostUsedApps
      : Array.isArray(profile.most_used_apps)
        ? profile.most_used_apps
        : [];
  const primaryApps = mostUsed.slice(0, 8).map((appName) => ({
    name: String(appName),
    category: guessAppCategory(appName),
  }));

  const locale = machine.locale ?? null;
  const locationInferred =
    profile.locationInferred ?? profile.location_inferred ?? regionFromLocale(locale);

  return {
    dominantPersona: dom,
    personaAccent: personaUiColor(dom),
    profile: {
      user_id: machineHandleFromProfile(profile).replace('@', ''),
      username: name,
      avatarSrc: avatarSrcFromProfile(profile),
      dominantPersona: dom,
      last_activity: lastAt ? formatRelativeTimeAgo(lastAt) : '—',
      device_name: machine.name ?? profile.machineName ?? profile.machine_name ?? '—',
    },
    scores,
    scoreDrift,
    bio: { text: profileBioText(profile) },

    environment: {
      machineName: machine.name ?? profile.machineName ?? profile.machine_name ?? null,
      machineModel: machine.model ?? profile.machineModel ?? profile.machine_model ?? null,
      hardwareChip: machine.chip ?? profile.hardwareChip ?? profile.hardware_chip ?? null,
      ram: machine.ram ?? profile.ram ?? null,
      osVersion: machine.osVersion ?? profile.osVersion ?? profile.os_version ?? null,
      appearance: machine.appearance ?? profile.appearance ?? null,
      screenResolution:
        machine.screenResolution ?? profile.screenResolution ?? profile.screen_resolution ?? null,
      locale,
      displays: Array.isArray(ov?.displays) ? ov.displays : [],
    },
    storage: storageSection(profile, ov),
    battery: batterySection(profile, ov),
    memory: ov?.memory ?? null,

    security: ov?.security
      ? {
          sip: ov.security.sip ?? null,
          filevault: ov.security.filevault ?? null,
          gatekeeper: ov.security.gatekeeper ?? null,
          crashCount7d: ov?.diagnostics?.crashCount7d ?? null,
          errorCount24h: ov?.diagnostics?.errorCount24h ?? null,
          smartStatus: ov?.storage?.smartStatus ?? null,
        }
      : null,

    harvest: {
      collectedAt: collectedAt ?? '',
      lastAnalysisAt: lastAt ?? '',
      collectedAgo: collectedAt ? formatRelativeTimeAgo(collectedAt) : '—',
      analysisAgo: lastAt ? formatRelativeTimeAgo(lastAt) : '—',
      uptimeDays: ov?.usage?.uptimeDays ?? profile.uptimeDays ?? profile.uptime_days ?? null,
      applications:
        ov?.apps?.installedCount ?? profile.applications ?? profile.apps_count ?? null,
    },

    postFootprint: postFootprintFromProfile(profile),

    activity: {
      appUsage7d: Array.isArray(ov?.usage?.appUsage7d) ? ov.usage.appUsage7d : [],
      recentFilesCount: ov?.usage?.recentFilesCount ?? null,
      downloadsCount: ov?.usage?.downloadsCount ?? null,
      uptimeDays: ov?.usage?.uptimeDays ?? profile.uptimeDays ?? null,
    },

    techStack: {
      primaryApps,
      dockApps: Array.isArray(ov?.apps?.dock) ? ov.apps.dock : [],
      installedCount:
        ov?.apps?.installedCount ?? profile.applications ?? profile.apps_count ?? null,
      fileExtensions: Array.isArray(ov?.files?.extensions) ? ov.files.extensions : [],
    },

    network: {
      wifiNetworks: Array.isArray(ov?.network?.wifiNetworks) ? ov.network.wifiNetworks : [],
      wifiCount: ov?.network?.wifiCount ?? null,
      browserDomains: Array.isArray(ov?.browser?.topDomains) ? ov.browser.topDomains : [],
      browserVisits: ov?.browser?.totalVisits ?? null,
    },

    location: {
      place: locationInferred ?? null,
      source: profile.locationInferred || profile.location_inferred
        ? 'Inferred from network patterns'
        : locationInferred
          ? 'Inferred from system locale'
          : null,
      locale,
      languages,
    },
  };
}
