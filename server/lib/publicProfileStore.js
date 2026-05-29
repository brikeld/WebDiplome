import {
  buildProfileSlug,
  mapPostForInsert,
  mapPostRowForApi,
  mapProfileRowForApi,
  mapSyncPayloadToProfileRow,
} from './publicProfileMapping.js';

function throwIfError(result, label) {
  if (result?.error) throw new Error(`${label}: ${result.error.message}`);
  return result?.data;
}

export function createPublicProfileStore(supabase) {
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

  return {
    async upsertProfileSync({ userId, payload, replacePosts = false }) {
      const existing = await findProfileByUserId(userId);
      const slug = existing?.slug ?? buildProfileSlug(payload?.firstname, payload?.lastname, userId);
      const row = mapSyncPayloadToProfileRow(payload, userId, slug);
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
  };
}
