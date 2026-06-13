import { countAiGeneratedPosts } from './generationQueue.js';
import { isCompliantSystemPost } from './postsMerge.js';

const DEFAULT_APPS = ['Safari', 'Google Chrome', 'Notion', 'Visual Studio Code', 'Discord', 'Spotify'];

function personaBucket(persona) {
  const p = String(persona ?? '').toLowerCase();
  if (p.includes('secur')) return 'security';
  if (p.includes('popular') || p === 'social') return 'social';
  return 'productivity';
}

function appsFromPosts(posts) {
  const apps = new Set(DEFAULT_APPS);
  for (const post of posts) {
    const bucket = personaBucket(post?.persona);
    if (bucket === 'productivity') {
      apps.add('Visual Studio Code');
      apps.add('Notion');
      apps.add('Figma');
    } else if (bucket === 'security') {
      apps.add('NordVPN');
      apps.add('Little Snitch');
      apps.add('GlobalProtect');
    } else {
      apps.add('Discord');
      apps.add('Spotify');
      apps.add('Instagram');
    }
  }
  return [...apps];
}

function browserHistoryFromPosts(posts, slug) {
  const host = String(slug || 'profile').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const now = new Date().toISOString();
  return (Array.isArray(posts) ? posts : [])
    .filter((p) => p && String(p.content || '').trim() && !isCompliantSystemPost(p))
    .slice(0, 8)
    .map((post, index) => ({
      url: `https://${host}.demo/posts/${index + 1}`,
      title: String(post.content || '').trim().slice(0, 120),
      visited: post.createdAt ?? post.created_at ?? now,
    }));
}

function appUsageFromApps(apps) {
  const now = Date.now();
  return apps.slice(0, 12).map((app, index) => ({
    app,
    last_used: new Date(now - index * 3_600_000).toISOString(),
    minutes: Math.max(15, 120 - index * 8),
  }));
}

/**
 * Build minimal collector-shaped dataJson from a hosted profile that already has AI posts
 * but no longer has harvest JSON on disk (demo regeneration fallback).
 */
export function synthesizeHarvestDataFromProfile(profileRow, apiProfile) {
  const raw = profileRow?.raw_profile && typeof profileRow.raw_profile === 'object'
    ? profileRow.raw_profile
    : {};
  const api = apiProfile && typeof apiProfile === 'object' ? apiProfile : {};
  const posts = Array.isArray(api.personaPosts) ? api.personaPosts : [];

  const slug = String(api.slug ?? api.id ?? profileRow?.slug ?? '').trim();
  const displayName = String(
    api.displayName
    ?? profileRow?.display_name
    ?? `${api.firstname ?? profileRow?.firstname ?? ''} ${api.lastname ?? profileRow?.lastname ?? ''}`.trim(),
  ).trim() || 'User';

  // Require either existing AI posts or at least a real identity to synthesize from.
  if (countAiGeneratedPosts(posts) === 0 && displayName === 'User' && !slug) return null;
  const machineName = String(
    api.machineName
    ?? api.machine_name
    ?? profileRow?.machine_name
    ?? raw.machineName
    ?? raw.machine_name
    ?? displayName,
  ).trim();
  const apps = appsFromPosts(posts);
  const browserEntries = browserHistoryFromPosts(posts, slug);
  const collectedAt =
    profileRow?.collected_at
    ?? api.collectedAt
    ?? api.collected_at
    ?? new Date().toISOString();

  return {
    collected_at: collectedAt,
    _synthesizedForRegeneration: true,
    MACHINE_IDENTITY: {
      user_identity: { name: displayName },
      hostname: machineName,
      model: raw.machineModel ?? raw.machine_model ?? api.machineModel ?? 'Mac',
      machine_model: raw.machineModel ?? raw.machine_model ?? api.machineModel ?? 'Mac',
      macos_version: raw.macosVersion ?? raw.macos_version ?? 'macOS',
      hardware_snapshot: {
        chip: raw.hardwareChip ?? raw.hardware_chip ?? api.hardwareChip ?? 'Apple Silicon',
        ram: raw.ram ?? api.ram ?? '16 GB',
      },
      chip: raw.hardwareChip ?? raw.hardware_chip ?? api.hardwareChip ?? 'Apple Silicon',
      ram: raw.ram ?? api.ram ?? '16 GB',
      languages: raw.systemLanguages ?? api.systemLanguages ?? ['en', 'fr'],
      locale: raw.locale ?? 'en_US',
      installed_apps: apps,
      dock_apps: apps.slice(0, 6),
    },
    PAST_HISTORY: {
      browser_history: {
        safari: browserEntries,
        chrome: browserEntries.slice(0, 4),
      },
      app_usage_7days: appUsageFromApps(apps),
      wifi_history: [
        {
          ssid: machineName || 'HomeNetwork',
          last_connected: collectedAt,
        },
      ],
      recent_files_7days: browserEntries.slice(0, 5).map((entry, index) => ({
        name: `${entry.title.slice(0, 40) || 'notes'}.txt`,
        path: `~/Documents/demo-${index + 1}.txt`,
        last_opened: entry.visited ?? collectedAt,
      })),
      recent_downloads: [],
      finder_recent_activity: [],
    },
  };
}
