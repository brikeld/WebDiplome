import { describe, expect, it } from 'vitest';
import { createPublicProfileStore } from '../server/lib/publicProfileStore.js';

function makeQuery(state, table) {
  const query = {
    _filters: [],
    select() {
      return this;
    },
    eq(column, value) {
      this._filters.push([column, value]);
      return this;
    },
    async order() {
      const rows = state[table] ?? [];
      return {
        data: rows.filter((row) =>
          this._filters.every(([column, value]) => row[column] === value),
        ),
        error: null,
      };
    },
    async maybeSingle() {
      const rows = state[table] ?? [];
      return {
        data: rows.find((row) =>
          this._filters.every(([column, value]) => row[column] === value),
        ) ?? null,
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
      return this;
    },
  };
  return query;
}

function makeSupabase() {
  const state = {
    nextProfileId: 'profile-1',
    profiles: [],
    posts: [],
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
});
