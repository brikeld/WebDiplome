import {
  buildProfileSlug,
  mapPostForInsert,
  mapPostRowForApi,
  mapProfileRowForApi,
  mapPersonaBlurbsForApi,
  mapPersonaBlurbsForStorage,
  mapSyncPayloadToProfileRow,
} from './publicProfileMapping.js';

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

  async function resolveWallpaperUrl(userId, payload, existing) {
    const directUrl = String(payload?.wallpaperUrl ?? payload?.wallpaper_url ?? '').trim();
    if (directUrl) return directUrl;

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

    return existing?.wallpaper_url ?? null;
  }

  return {
    async getProfileByUserId(userId) {
      const row = await findProfileByUserId(userId);
      if (!row) return null;
      return mapProfileRowForApi(row, await readPosts(row.id));
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

      return mapProfileRowForApi(saved, await readPosts(saved.id));
    },

    async listProfiles() {
      const rows = throwIfError(
        await supabase.from('profiles').select('*').order('updated_at', { ascending: false }),
        'list profiles',
      );
      return Promise.all((rows ?? []).map(async (row) => mapProfileRowForApi(row, await readPosts(row.id))));
    },

    async getProfileBySlug(slug) {
      const row = throwIfError(
        await supabase.from('profiles').select('*').eq('slug', slug).maybeSingle(),
        'get profile',
      );
      if (!row) return null;
      return mapProfileRowForApi(row, await readPosts(row.id));
    },

    async getProfileRowBySlug(slug) {
      return throwIfError(
        await supabase.from('profiles').select('*').eq('slug', slug).maybeSingle(),
        'get profile row',
      );
    },

    async appendPosts({ profileId, userId, posts, source = 'generated' }) {
      const rows = (Array.isArray(posts) ? posts : [])
        .filter((p) => p && p.content)
        .map((p) => mapPostForInsert(p, profileId, userId, source));
      if (rows.length === 0) return [];
      const inserted = throwIfError(
        await supabase.from('posts').insert(rows).select('*'),
        'append posts',
      );
      return (inserted ?? []).map(mapPostRowForApi);
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

    /** Wipe profile, posts, jobs, assets, and the Supabase auth user. */
    async deleteAccountForUser(userId) {
      const profile = await findProfileByUserId(userId);
      if (!profile) {
        await supabase.auth.admin.deleteUser(userId).catch(() => null);
        return { deleted: false, slug: null };
      }

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

      const authDelete = await supabase.auth.admin.deleteUser(userId);
      if (authDelete.error) {
        throw new Error(`delete auth user: ${authDelete.error.message}`);
      }

      return { deleted: true, slug: profile.slug };
    },
  };
}
