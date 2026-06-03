import {
  buildProfileSlug,
  mapPostForInsert,
  mapPostRowForApi,
  mapProfileRowForApi,
  mapPersonaBlurbsForApi,
  mapPersonaBlurbsForStorage,
  mapSyncPayloadToProfileRow,
} from './publicProfileMapping.js';
import { resolveHostedPublicUrl } from './publicMediaUrls.js';
import { repairProfileWallpaperIfNeeded } from './repairProfileWallpaper.js';
import {
  createCompliantJoinPost,
  hasCompliantJoinPost,
  joinCreatedAtAfterExisting,
} from './compliantSystemPosts.js';
import {
  dedupeProfilesWithMergedPosts,
  mergeSiblingPostsForProfile,
  profileIdentityKey,
} from './hostedProfileDedupe.js';
import {
  filterProfilesNotDeleted,
  isProfileSlugDeleted,
} from './deletedProfileSlugs.js';
import { getHostedAccountState } from './hostedAccountDeletion.js';

function throwIfError(result, label) {
  if (result?.error) throw new Error(`${label}: ${result.error.message}`);
  return result?.data;
}

function parseWallpaperBase64(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return null;
  const mime = match[1] || 'image/jpeg';
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) return null;
  return { mime, buffer };
}

export function createPublicProfileStore(supabase, { storageStore } = {}) {
  if (!supabase) throw new Error('Supabase service client required');

  async function findProfileByUserId(userId) {
    const data = throwIfError(
      await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      'find profile',
    );
    return data ?? null;
  }

  async function readPosts(profileId) {
    const data = throwIfError(
      await supabase
        .from('posts')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false }),
      'read posts',
    );
    return (data ?? []).map(mapPostRowForApi);
  }

  async function listAllProfilesWithPosts() {
    const rows = throwIfError(
      await supabase.from('profiles').select('*').order('updated_at', { ascending: false }),
      'list profiles',
    );
    const safeRows = await Promise.all((rows ?? []).map((row) => ensureWebSafeWallpaper(row)));
    return Promise.all(
      safeRows.map(async (row) => mapProfileRowForApi(row, await readPosts(row.id))),
    );
  }

  function withMergedSiblingPosts(profile, directory) {
    return mergeSiblingPostsForProfile(profile, directory);
  }

  /** Remove all posts, jobs, assets, and profile row for one hosted account. */
  async function purgeProfileData({ userId, profileId, slug = null }) {
    if (profileId) {
      throwIfError(
        await supabase.from('generation_jobs').delete().eq('profile_id', profileId),
        'delete generation jobs by profile',
      );
      throwIfError(
        await supabase.from('posts').delete().eq('profile_id', profileId),
        'delete posts by profile',
      );
    }
    if (userId) {
      throwIfError(
        await supabase.from('generation_jobs').delete().eq('user_id', userId),
        'delete generation jobs by user',
      );
      throwIfError(
        await supabase.from('posts').delete().eq('user_id', userId),
        'delete posts by user',
      );

      const assets = throwIfError(
        await supabase.from('assets').select('bucket, path').eq('owner_user_id', userId),
        'list assets',
      );

      const byBucket = new Map();
      for (const asset of assets ?? []) {
        if (!asset?.bucket || !asset?.path) continue;
        if (!byBucket.has(asset.bucket)) byBucket.set(asset.bucket, []);
        byBucket.get(asset.bucket).push(asset.path);
      }
      for (const [bucket, paths] of byBucket) {
        await supabase.storage.from(bucket).remove(paths);
      }

      throwIfError(await supabase.from('assets').delete().eq('owner_user_id', userId), 'delete assets');
      throwIfError(await supabase.from('profiles').delete().eq('user_id', userId), 'delete profile');
    }

    return { userId, profileId, slug };
  }

  /** Posts whose profile row was removed without cascade (legacy cleanup). */
  async function deleteOrphanPosts() {
    const profiles = throwIfError(
      await supabase.from('profiles').select('id'),
      'list profile ids',
    );
    const validIds = new Set((profiles ?? []).map((row) => row.id));
    const posts = throwIfError(
      await supabase.from('posts').select('id, profile_id'),
      'list posts for orphan check',
    );
    const orphanIds = (posts ?? [])
      .filter((row) => row?.id && !validIds.has(row.profile_id))
      .map((row) => row.id);
    if (orphanIds.length === 0) return 0;
    throwIfError(
      await supabase.from('posts').delete().in('id', orphanIds),
      'delete orphan posts',
    );
    return orphanIds.length;
  }

  /** Delete by public slug (admin cleanup). */
  async function deleteProfileBySlug(slug) {
    const needle = String(slug || '').trim();
    if (!needle) throw new Error('slug required');

    const row = throwIfError(
      await supabase.from('profiles').select('*').eq('slug', needle).maybeSingle(),
      'find profile by slug',
    );
    if (!row) {
      const orphansRemoved = await deleteOrphanPosts();
      return { deleted: false, slug: needle, reason: 'profile not found', orphansRemoved };
    }

    await purgeProfileData({ userId: row.user_id, profileId: row.id, slug: row.slug });

    const authDelete = await supabase.auth.admin.deleteUser(row.user_id);
    if (authDelete.error) {
      throw new Error(`delete auth user: ${authDelete.error.message}`);
    }

    return { deleted: true, slug: row.slug, profileId: row.id, userId: row.user_id };
  }

  /** Delete all profiles + posts matching a name prefix (e.g. `jane-doe`). */
  async function deleteProfilesByNamePrefix(firstname, lastname) {
    const base = buildProfileSlug(firstname, lastname, null).replace(/-+$/, '');
    const pattern = `${base}%`;
    const rows = throwIfError(
      await supabase.from('profiles').select('*').like('slug', pattern),
      'list profiles by name prefix',
    );
    const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
    const results = [];
    for (const row of list) {
      await purgeProfileData({ userId: row.user_id, profileId: row.id, slug: row.slug });
      await supabase.auth.admin.deleteUser(row.user_id).catch(() => null);
      results.push({ slug: row.slug, userId: row.user_id });
    }
    return { deleted: results.length, profiles: results, prefix: pattern };
  }

  /**
   * Remove every hosted row for the same real person (name + machine), not only
   * the current auth user — prevents ghost feeds after re-signup.
   */
  async function deleteAllProfilesWithIdentityKey(seedRow, actingUserId = null) {
    const key = profileIdentityKey(
      seedRow
        ? {
            firstname: seedRow.firstname,
            lastname: seedRow.lastname,
            machineName: seedRow.machine_name ?? seedRow.machineName,
          }
        : null,
    );
    if (!key) return { deletedSlugs: [], orphansRemoved: 0 };

    const rows = throwIfError(
      await supabase.from('profiles').select('id, slug, user_id, firstname, lastname, machine_name'),
      'list profiles for identity purge',
    );
    const siblings = (rows ?? []).filter((row) => {
      if (!row?.id) return false;
      return (
        profileIdentityKey({
          firstname: row.firstname,
          lastname: row.lastname,
          machineName: row.machine_name,
        }) === key
      );
    });

    const deletedSlugs = [];
    for (const row of siblings) {
      await purgeProfileData({
        userId: row.user_id,
        profileId: row.id,
        slug: row.slug,
      });
      deletedSlugs.push(String(row.slug));
      if (row.user_id && row.user_id !== actingUserId) {
        await supabase.auth.admin.deleteUser(row.user_id).catch(() => null);
      }
    }

    const orphansRemoved = await deleteOrphanPosts();
    return { deletedSlugs, orphansRemoved };
  }

  async function resolveWallpaperUrl(userId, payload, existing) {
    const parsed = parseWallpaperBase64(payload?.wallpaperBase64 ?? payload?.wallpaper_base64);
    if (parsed && storageStore) {
      const asset = await storageStore.uploadPublicAsset({
        ownerUserId: userId,
        buffer: parsed.buffer,
        originalName: 'profile.jpg',
        mimeType: parsed.mime,
      });
      return asset.url;
    }

    const directUrl = String(payload?.wallpaperUrl ?? payload?.wallpaper_url ?? '').trim();
    if (directUrl) {
      return resolveHostedPublicUrl(directUrl) ?? directUrl;
    }

    const existingUrl = existing?.wallpaper_url ?? null;
    if (existingUrl) {
      return resolveHostedPublicUrl(existingUrl) ?? existingUrl;
    }

    return null;
  }

  async function ensureWebSafeWallpaper(row) {
    if (!row?.wallpaper_url || !storageStore) return row;
    const repaired = await repairProfileWallpaperIfNeeded(row, { storageStore, supabase });
    if (repaired && repaired !== row.wallpaper_url) {
      return { ...row, wallpaper_url: repaired };
    }
    return row;
  }

  async function appendPostsToProfile({ profileId, userId, posts, source = 'generated' }) {
    const rows = (Array.isArray(posts) ? posts : [])
      .filter((p) => p && p.content)
      .map((p) => mapPostForInsert(p, profileId, userId, source));
    if (rows.length === 0) return [];
    const inserted = throwIfError(
      await supabase.from('posts').insert(rows).select('*'),
      'append posts',
    );
    return (inserted ?? []).map(mapPostRowForApi);
  }

  return {
    async getProfileByUserId(userId) {
      const row = await findProfileByUserId(userId);
      if (!row) return null;
      const directory = await listAllProfilesWithPosts();
      const safe = await ensureWebSafeWallpaper(row);
      const api = mapProfileRowForApi(safe, await readPosts(safe.id));
      return withMergedSiblingPosts(api, directory);
    },

    async upsertProfileSync({ userId, payload, replacePosts = false }) {
      const existing = await findProfileByUserId(userId);
      const slug = existing?.slug ?? buildProfileSlug(payload?.firstname, payload?.lastname, userId);
      const row = mapSyncPayloadToProfileRow(payload, userId, slug);
      const incomingSummary = String(payload?.profileSummary ?? payload?.userDescription ?? '').trim();
      if (!incomingSummary && existing?.profile_summary) {
        row.profile_summary = existing.profile_summary;
      }
      row.wallpaper_url = await resolveWallpaperUrl(userId, payload, existing);
      const saved = throwIfError(
        await supabase.from('profiles').upsert(row, { onConflict: 'user_id' }).select('*').single(),
        'upsert profile',
      );

      if (Array.isArray(payload?.personaPosts)) {
        if (replacePosts) {
          throwIfError(await supabase.from('posts').delete().eq('profile_id', saved.id), 'replace posts');
        }
        const posts = payload.personaPosts
          .filter((p) => p && p.content)
          .map((p) => mapPostForInsert(p, saved.id, userId, 'sync'));
        if (posts.length > 0) {
          throwIfError(await supabase.from('posts').insert(posts), 'insert posts');
        }
      }

      const afterSync = await readPosts(saved.id);
      if (!hasCompliantJoinPost(afterSync)) {
        const displayName =
          String(row.display_name || '').trim() ||
          [payload?.firstname, payload?.lastname].map((s) => String(s ?? '').trim()).filter(Boolean).join(' ') ||
          'User';
        const joinPost = createCompliantJoinPost({
          profile: payload,
          userDisplayName: displayName,
          dominantPersona: row.dominant_persona ?? payload?.dominantPersona,
          createdAt: joinCreatedAtAfterExisting(afterSync),
        });
        await appendPostsToProfile({
          profileId: saved.id,
          userId,
          posts: [joinPost],
          source: 'system',
        });
      }

      return mapProfileRowForApi(saved, await readPosts(saved.id));
    },

    async listProfiles() {
      await deleteOrphanPosts();
      const mapped = await listAllProfilesWithPosts();
      const deduped = dedupeProfilesWithMergedPosts(mapped);
      const { deletedProfileIds } = getHostedAccountState();
      return filterProfilesNotDeleted(deduped, deletedProfileIds);
    },

    async listProfilesForLeaderboards() {
      const { deletedProfileIds } = getHostedAccountState();
      const rows = throwIfError(
        await supabase.from('profiles').select('*').order('updated_at', { ascending: false }),
        'list profiles for leaderboards',
      );
      const directory = filterProfilesNotDeleted(
        await listAllProfilesWithPosts(),
        deletedProfileIds,
      );
      const activeRows = (rows ?? []).filter(
        (row) => !isProfileSlugDeleted(row?.slug, deletedProfileIds),
      );
      return Promise.all(
        activeRows.map(async (row) => {
          const api = {
            ...mapProfileRowForApi(row, await readPosts(row.id)),
            _harvest: row.raw_profile ?? {},
          };
          return withMergedSiblingPosts(api, directory);
        }),
      );
    },

    async getProfileBySlug(slug) {
      const { deletedProfileIds } = getHostedAccountState();
      if (isProfileSlugDeleted(slug, deletedProfileIds)) return null;

      const row = throwIfError(
        await supabase.from('profiles').select('*').eq('slug', slug).maybeSingle(),
        'get profile',
      );
      if (!row) return null;
      const safe = await ensureWebSafeWallpaper(row);
      const directory = await listAllProfilesWithPosts();
      const api = mapProfileRowForApi(safe, await readPosts(safe.id));
      return withMergedSiblingPosts(api, directory);
    },

    async getProfileRowBySlug(slug) {
      return throwIfError(
        await supabase.from('profiles').select('*').eq('slug', slug).maybeSingle(),
        'get profile row',
      );
    },

    async appendPosts({ profileId, userId, posts, source = 'generated' }) {
      return appendPostsToProfile({ profileId, userId, posts, source });
    },

    async updateProfileSummary({ profileId, userId, profileSummary }) {
      const summary = String(profileSummary ?? '').trim();
      if (!summary) return null;
      let query = supabase
        .from('profiles')
        .update({ profile_summary: summary, updated_at: new Date().toISOString() })
        .eq('id', profileId);
      if (userId) query = query.eq('user_id', userId);
      const updated = throwIfError(
        await query.select('*').maybeSingle(),
        'update profile summary',
      );
      return updated ?? null;
    },

    async getPersonaBlurbs(profileId) {
      const row = throwIfError(
        await supabase.from('profiles').select('persona_blurbs').eq('id', profileId).maybeSingle(),
        'read persona blurbs',
      );
      return mapPersonaBlurbsForApi(row?.persona_blurbs);
    },

    async savePersonaBlurbs({ profileId, blurbs }) {
      const stored = mapPersonaBlurbsForStorage(blurbs);
      if (!stored.productivite && !stored.securite && !stored.popularite) return null;
      const updated = throwIfError(
        await supabase
          .from('profiles')
          .update({ persona_blurbs: stored, updated_at: new Date().toISOString() })
          .eq('id', profileId)
          .select('persona_blurbs')
          .maybeSingle(),
        'save persona blurbs',
      );
      return mapPersonaBlurbsForApi(updated?.persona_blurbs);
    },

    async latestRelease(platform = 'mac') {
      return throwIfError(
        await supabase
          .from('app_releases')
          .select('*')
          .eq('platform', platform)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        'latest release',
      );
    },

    async addComment({ postId, authorProfileId, persona, content }) {
      const inserted = throwIfError(
        await supabase
          .from('comments')
          .insert({
            post_id: postId,
            author_profile_id: authorProfileId,
            persona,
            content,
          })
          .select('*')
          .single(),
        'add comment',
      );
      return {
        id: inserted.id,
        postId: inserted.post_id,
        authorProfileId: inserted.author_profile_id,
        persona: inserted.persona,
        content: inserted.content,
        createdAt: inserted.created_at,
      };
    },

    deleteAllProfilesWithIdentityKey,

    /** Wipe profile, posts, jobs, assets, and the Supabase auth user. */
    async deleteAccountForUser(userId) {
      const profile = await findProfileByUserId(userId);
      if (!profile) {
        await purgeProfileData({ userId, profileId: null });
        await supabase.auth.admin.deleteUser(userId).catch(() => null);
        const orphansRemoved = await deleteOrphanPosts();
        return { deleted: false, slug: null, deletedSlugs: [], orphansRemoved };
      }

      const { deletedSlugs, orphansRemoved } = await this.deleteAllProfilesWithIdentityKey(
        profile,
        userId,
      );

      const authDelete = await supabase.auth.admin.deleteUser(userId);
      if (authDelete.error) {
        throw new Error(`delete auth user: ${authDelete.error.message}`);
      }

      return {
        deleted: true,
        slug: profile.slug,
        profileId: profile.id,
        deletedSlugs,
        orphansRemoved,
      };
    },

    deleteProfileBySlug,
    deleteProfilesByNamePrefix,
    deleteOrphanPosts,
  };
}
