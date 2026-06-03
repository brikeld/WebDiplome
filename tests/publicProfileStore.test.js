import { describe, expect, it } from 'vitest';
import { createPublicProfileStore } from '../server/lib/publicProfileStore.js';

function makeQuery(state, table) {
  const query = {
    _filters: [],
    _inFilter: null,
    select() {
      return this;
    },
    then(resolve, reject) {
      const rows = state[table] ?? [];
      return Promise.resolve({
        data: rows.filter((row) => this._matches(row)),
        error: null,
      }).then(resolve, reject);
    },
    eq(column, value) {
      this._filters.push([column, value]);
      return this;
    },
    in(column, values) {
      this._inFilter = [column, new Set(values)];
      return this;
    },
    _matches(row) {
      return (
        this._filters.every(([column, value]) => row[column] === value) &&
        (!this._inFilter || this._inFilter[1].has(row[this._inFilter[0]]))
      );
    },
    async order() {
      const rows = state[table] ?? [];
      return {
        data: rows.filter((row) => this._matches(row)),
        error: null,
      };
    },
    async maybeSingle() {
      const rows = state[table] ?? [];
      return {
        data: rows.find((row) => this._matches(row)) ?? null,
        error: null,
      };
    },
    upsert(row) {
      const saved = {
        id: state.nextProfileId,
        created_at: new Date().toISOString(),
        ...row,
      };
      const idx = state.profiles.findIndex((profile) => profile.user_id === saved.user_id);
      if (idx >= 0) {
        state.profiles[idx] = { ...state.profiles[idx], ...saved, id: state.profiles[idx].id };
      } else {
        state.profiles.push(saved);
        state.nextProfileId = `profile-${Number(state.nextProfileId.split('-')[1]) + 1}`;
      }
      return {
        select() {
          return {
            async single() {
              return { data: saved, error: null };
            },
          };
        },
      };
    },
    insert(rows) {
      const inserted = rows.map((row, index) => ({
        id: `post-${state.posts.length + index + 1}`,
        ...row,
      }));
      state.posts.push(...inserted);
      return {
        async select() {
          return { data: inserted, error: null };
        },
      };
    },
    delete() {
      return {
        eq: async (column, value) => {
          state[table] = (state[table] ?? []).filter((row) => row[column] !== value);
          return { data: null, error: null };
        },
        in: async (column, values) => {
          const remove = new Set(values);
          state[table] = (state[table] ?? []).filter((row) => !remove.has(row[column]));
          return { data: null, error: null };
        },
      };
    },
  };
  return query;
}

function makeSupabase({ authDeleteError = null } = {}) {
  const state = {
    nextProfileId: 'profile-1',
    profiles: [],
    posts: [],
    generation_jobs: [],
    assets: [],
  };
  return {
    state,
    from(table) {
      return makeQuery(state, table);
    },
    storage: {
      from() {
        return {
          remove: async () => ({ data: null, error: null }),
        };
      },
    },
    auth: {
      admin: {
        deleteUser: async () => ({ data: null, error: authDeleteError }),
      },
    },
  };
}

describe('public profile store', () => {
  it('upserts a new synced profile and creates its join post', async () => {
    const supabase = makeSupabase();
    const store = createPublicProfileStore(supabase);

    const profile = await store.upsertProfileSync({
      userId: '555efeaf-d1f7-48e2-816b-38329e99b91d',
      payload: {
        firstname: 'Brikeld',
        lastname: 'Hoxha',
        machineName: 'Brikeld MacBook Pro',
        dominantPersona: 'productivity',
        profileSummary: '',
        dataJson: { MACHINE_IDENTITY: { user_identity: { full_name: 'Brikeld Hoxha' } } },
      },
    });

    expect(profile.slug).toBe('brikeld-hoxha-555efeaf');
    expect(profile.personaPosts).toHaveLength(1);
    expect(profile.personaPosts[0].compliantJoin).toEqual({
      userDisplayName: 'Brikeld Hoxha',
    });
  });

  it('deletes profile data even when auth user deletion is unavailable', async () => {
    const supabase = makeSupabase({
      authDeleteError: { message: 'User not found' },
    });
    supabase.state.profiles.push({
      id: 'profile-1',
      user_id: 'user-1',
      slug: 'brikeld-hoxha-user1',
      firstname: 'Brikeld',
      lastname: 'Hoxha',
      machine_name: 'Brikeld MacBook Pro',
    });
    supabase.state.posts.push({ id: 'post-1', profile_id: 'profile-1', user_id: 'user-1' });
    supabase.state.generation_jobs.push({ id: 'job-1', profile_id: 'profile-1', user_id: 'user-1' });
    supabase.state.assets.push({ id: 'asset-1', owner_user_id: 'user-1', bucket: 'uploads-public', path: 'a.jpg' });
    const store = createPublicProfileStore(supabase);

    const result = await store.deleteAccountForUser('user-1');

    expect(result.deleted).toBe(true);
    expect(result.deletedSlugs).toEqual(['brikeld-hoxha-user1']);
    expect(result.authDeleteError).toBe('User not found');
    expect(supabase.state.profiles).toEqual([]);
    expect(supabase.state.posts).toEqual([]);
    expect(supabase.state.generation_jobs).toEqual([]);
    expect(supabase.state.assets).toEqual([]);
  });
});
