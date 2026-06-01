/**
 * Collapse duplicate hosted profiles created by re-signup / re-sync on the same Mac.
 * Newest profile wins; posts from older sibling rows are merged in.
 */

import { mergePostsPrepend } from './postsMerge.js';

function normalizePart(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeMachine(value) {
  return normalizePart(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u2019/g, "'")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function profileIdentityKey(profile) {
  const first = normalizePart(profile?.firstname ?? profile?.firstName);
  const last = normalizePart(profile?.lastname ?? profile?.lastName);
  const machine = normalizeMachine(profile?.machineName ?? profile?.machine_name);
  if (!first || !last || !machine) return null;
  return `${first}|${last}|${machine}`;
}

export function profileUpdatedAtMs(profile) {
  const raw =
    profile?.updatedAt ??
    profile?.updated_at ??
    profile?.collectedAt ??
    profile?.collected_at ??
    null;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Merge personaPosts from every profile that shares the same identity key. */
export function mergeSiblingPostsForProfile(profile, allProfiles) {
  if (!profile) return profile;
  const key = profileIdentityKey(profile);
  if (!key) return profile;

  const siblings = (Array.isArray(allProfiles) ? allProfiles : []).filter(
    (p) => p && profileIdentityKey(p) === key,
  );
  if (siblings.length <= 1) return profile;

  const sorted = [...siblings].sort((a, b) => profileUpdatedAtMs(b) - profileUpdatedAtMs(a));
  let mergedPosts = [];
  for (const sibling of sorted) {
    mergedPosts = mergePostsPrepend(mergedPosts, sibling.personaPosts ?? []);
  }

  return {
    ...profile,
    personaPosts: mergedPosts,
  };
}

/**
 * One public row per real person (name + machine). Newest signup wins;
 * posts from dropped duplicate profiles are merged onto the survivor.
 */
export function dedupeProfilesWithMergedPosts(profiles) {
  const list = (Array.isArray(profiles) ? profiles : []).filter(Boolean);
  if (list.length <= 1) return list;

  const groups = new Map();
  const withoutKey = [];

  for (const profile of list) {
    const key = profileIdentityKey(profile);
    if (!key) {
      withoutKey.push(profile);
      continue;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(profile);
  }

  const merged = [...withoutKey];

  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }

    const sorted = [...group].sort((a, b) => profileUpdatedAtMs(b) - profileUpdatedAtMs(a));
    const canonical = { ...sorted[0] };
    let posts = Array.isArray(canonical.personaPosts) ? canonical.personaPosts : [];
    for (let i = 1; i < sorted.length; i += 1) {
      posts = mergePostsPrepend(posts, sorted[i].personaPosts ?? []);
    }
    canonical.personaPosts = posts;
    merged.push(canonical);
  }

  return merged.sort((a, b) => profileUpdatedAtMs(b) - profileUpdatedAtMs(a));
}
