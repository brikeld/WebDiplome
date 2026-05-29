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
import { PERSONA_UI_LABELS, personaUiColor } from './personaColors.js';

const APP_CATEGORY = {
  safari: 'browser',
  chrome: 'browser',
  cursor: 'development',
  code: 'development',
  figma: 'design',
  photoshop: 'design',
  premiere: 'video',
  blender: '3d',
};

function guessAppCategory(name) {
  const n = String(name ?? '').toLowerCase();
  for (const [needle, cat] of Object.entries(APP_CATEGORY)) {
    if (n.includes(needle)) return cat;
  }
  return 'development';
}

function formatAccountAge(collectedAt) {
  if (!collectedAt) return '—';
  try {
    const created = new Date(collectedAt);
    if (Number.isNaN(created.getTime())) return '—';
    const months =
      (new Date().getFullYear() - created.getFullYear()) * 12 +
      (new Date().getMonth() - created.getMonth());
    if (months < 1) return 'Less than a month';
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
    const years = Math.floor(months / 12);
    return `${years} year${years !== 1 ? 's' : ''}`;
  } catch {
    return '—';
  }
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

function storageFromProfile(p) {
  const used = p?.storageUsed ?? p?.storage_used;
  const total = p?.storageTotal ?? p?.storage_total;
  const parseGb = (v) => {
    if (v == null) return null;
    const m = String(v).match(/([\d.]+)/);
    return m ? parseFloat(m[1]) : null;
  };
  const usedGb = parseGb(used);
  const totalGb = parseGb(total);
  return {
    total_gb: totalGb ?? 0,
    used_gb: usedGb ?? 0,
    free_gb: usedGb != null && totalGb != null ? Math.max(0, totalGb - usedGb) : 0,
    usage_percent:
      usedGb != null && totalGb != null && totalGb > 0
        ? Math.round((usedGb / totalGb) * 1000) / 10
        : 0,
    battery_percent: p?.batteryPercent ?? p?.battery_percent ?? null,
    battery_condition: p?.batteryCondition ?? '—',
    battery_health_percent: p?.batteryHealthPercent ?? null,
    battery_cycles: p?.batteryCycles ?? p?.battery_cycles ?? null,
  };
}

/**
 * Map live WebDiplome profile + adjusted persona scores → ProfileOverview shape.
 */
export function buildProfileOverviewData(profile, { adjustedScores, dominantPersona } = {}) {
  if (!profile) return null;

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
  const apps = Array.isArray(profile.mostUsedApps)
    ? profile.mostUsedApps
    : Array.isArray(profile.most_used_apps)
      ? profile.most_used_apps
      : [];

  const primaryApps = apps.slice(0, 6).map((name) => ({
    name: String(name),
    category: guessAppCategory(name),
  }));

  const languages = Array.isArray(profile.systemLanguages)
    ? profile.systemLanguages
    : Array.isArray(profile.system_languages)
      ? profile.system_languages
      : [];

  const bio = profileBioText(profile);
  const roleGuess = bio
    ? bio.split(/[.!?]/)[0]?.slice(0, 80) || '—'
    : 'Creative developer';
  const postFootprint = postFootprintFromProfile(profile);
  const globalScore =
    profile.globalScore != null
      ? Math.round(Number(profile.globalScore))
      : profile.global_score != null
        ? Math.round(Number(profile.global_score))
        : null;

  return {
    dominantPersona: dom,
    profile: {
      user_id: machineHandleFromProfile(profile).replace('@', ''),
      username: name,
      avatarSrc: avatarSrcFromProfile(profile),
      dominantPersona: dom,
      status: 'online',
      last_activity: lastAt ? formatRelativeTimeAgo(lastAt) : '—',
      account_created: collectedAt ?? '',
      device_name: profile.machineName ?? profile.machine_name ?? '—',
    },
    scores,
    scoreDrift,
    globalScore,
    bio: {
      text: bio,
      preview: bio ? (bio.length > 140 ? `${bio.slice(0, 137)}…` : bio) : '',
    },
    environment: {
      wallpaperSrc: avatarSrcFromProfile(profile),
      appearance: profile.appearance ?? '—',
      osVersion: profile.osVersion ?? profile.os_version ?? '—',
      hardwareChip: profile.hardwareChip ?? profile.hardware_chip ?? '—',
      ram: profile.ram ?? '—',
      machineName: profile.machineName ?? profile.machine_name ?? '—',
      machineModel: profile.machineModel ?? profile.machine_model ?? '—',
      screenResolution: profile.screenResolution ?? profile.screen_resolution ?? '—',
    },
    harvest: {
      collectedAt: collectedAt ?? '',
      lastAnalysisAt: lastAt ?? '',
      collectedAgo: collectedAt ? formatRelativeTimeAgo(collectedAt) : '—',
      analysisAgo: lastAt ? formatRelativeTimeAgo(lastAt) : '—',
      uptimeDays: profile.uptimeDays ?? profile.uptime_days ?? '—',
      applications: profile.applications ?? profile.apps_count ?? null,
    },
    postFootprint,
    identity: {
      device: {
        model: profile.hardwareChip ?? profile.hardware_chip ?? profile.machineModel ?? 'Mac',
        macos_version: profile.osVersion ?? profile.os_version ?? '—',
        hostname: profile.machineName ?? profile.machine_name ?? '—',
      },
      location_inferred: profile.locationInferred ?? profile.location_inferred ?? '—',
      languages,
      ui_theme: profile.appearance ?? '—',
      screen_resolution: profile.screenResolution ?? '—',
    },
    activity: {
      peak_hours: {
        primary: profile.peakHoursPrimary ?? '10 PM - 2 AM',
        secondary: profile.peakHoursSecondary ?? '2 PM - 4 PM',
      },
      most_active_day: profile.mostActiveDay ?? 'Thursday',
      days_order: ['Thursday', 'Tuesday', 'Wednesday', 'Friday', 'Monday', 'Saturday', 'Sunday'],
      sleep_pattern: profile.sleepPattern ?? 'Observed from system activity',
      uptime: profile.uptimeDays ? `${profile.uptimeDays} day(s)` : '—',
      current_status: profile.uptimeDays ? `Machine uptime ${profile.uptimeDays}d` : 'Active',
    },
    tech_stack: {
      primary_apps: primaryApps.length > 0 ? primaryApps : [{ name: '—', category: 'development' }],
      ai_tools: profile.aiTools ?? ['Cursor'],
      design_tools_count: profile.designToolsCount ?? apps.length,
      total_apps_installed: profile.applications ?? profile.apps_count ?? '—',
      languages_detected: profile.languagesDetected ?? ['JavaScript', 'Python'],
      vcs: profile.vcs ?? 'Git',
    },
    network: {
      wifi_networks_recent: profile.wifiNetworks ?? ['—'],
      vpn_detected: profile.vpnDetected ?? '—',
      open_ports: profile.openPorts ?? [],
      connectivity_status: 'Active',
    },
    storage: storageFromProfile(profile),
    security: {
      sip: { status: profile.sipStatus ?? '—' },
      filevault: { status: profile.filevaultStatus ?? '—' },
      gatekeeper: { status: profile.gatekeeperStatus ?? '—' },
      pending_updates: profile.pendingUpdates ?? '—',
      crash_reports_7days: profile.crashReports7d ?? 0,
      disk_smart_status: profile.diskSmartStatus ?? '—',
    },
    behavioral: {
      profile_type: PERSONA_UI_LABELS[dom] ?? 'Profile',
      badges: [
        `${PERSONA_UI_LABELS[dom] ?? 'Persona'} focus`,
        profile.hardwareChip ? String(profile.hardwareChip) : null,
        profile.ram ? String(profile.ram) : null,
      ].filter(Boolean),
      inferred_role: roleGuess,
      school_detected: profile.schoolDetected ?? '—',
      work_context: profile.workContext ?? 'Personal machine',
    },
    lifestyle: {
      entertainment_apps: profile.entertainmentApps ?? [],
      health_tracking: profile.healthApps ?? [],
      gaming: profile.gamingApps ?? [],
      last_music_activity: profile.lastMusicActivity ?? '—',
    },
    personaAccent: personaUiColor(dom),
  };
}
