# Public Demo Multi-User Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the two-repo demo public and multi-user: real users sign in, accept public data collection in the Electron app, sync public profiles/posts/assets to Supabase, browse each other on WebDiplome, and request AI generation through a polling worker on the dedicated AI PC.

**Architecture:** WebDiplome keeps an Express API layer, but production/demo data moves from repo-local JSON files to Supabase Postgres and Supabase Storage. The Electron app authenticates through the hosted API, syncs profile data and candidate assets, and creates generation jobs. The AI PC runs a Node worker that polls the hosted API, calls local LM Studio, and writes generated posts back through the API.

**Tech Stack:** React 18, Vite, Express 5, Vitest, Supabase Auth/Postgres/Storage, Electron Forge DMG, Node worker, LM Studio OpenAI-compatible API.

---

## Scope Check

This plan is intentionally an MVP for a short public critique/demo. It does not add Apple signing, automatic updates, private profiles, payments, moderation, or long-term analytics. The plan keeps local JSON mode working when Supabase environment variables are absent, so the existing local demo is not blocked while hosted mode is added.

## File Structure

### WebDiplome

- Create `supabase/migrations/20260529_public_demo.sql`: Supabase schema, RLS policies, storage buckets, and indexes.
- Create `.env.example`: documented local/staging/production variables.
- Modify `package.json`: add Supabase dependency and worker scripts.
- Create `server/lib/env.js`: reads required environment variables and decides hosted mode.
- Create `server/lib/supabaseClient.js`: server anon/service Supabase clients.
- Create `server/lib/publicProfileStore.js`: Supabase profile/post/comment/release store.
- Create `server/lib/publicProfileMapping.js`: pure payload mapping, slug generation, and compatibility helpers.
- Create `server/lib/publicLeaderboards.js`: real-user leaderboard assembly with demo fallback rows.
- Create `server/lib/storageStore.js`: SHA-256 file naming and Supabase Storage upload helpers.
- Create `server/lib/auth.js`: bearer auth and worker-token auth middleware/helpers.
- Create `server/lib/generationJobStore.js`: job create/claim/complete/fail store.
- Create `server/routes/authRoutes.js`: email/password signup/login/session endpoints.
- Create `server/routes/publicDemoRoutes.js`: hosted profile, posts, comments, leaderboards, releases, upload routes.
- Create `server/routes/generationJobRoutes.js`: user job creation and worker polling/completion routes.
- Modify `server.js`: mount hosted routes when Supabase mode is enabled, preserve file-backed dev routes otherwise.
- Modify `server-generate.js`: keep local generation for dev only; do not use it as the production AI path.
- Create `worker/ai-worker.js`: AI PC polling worker.
- Create `worker/README.md`: how to run the AI worker on the dedicated computer.
- Create `src/lib/apiClient.js`: frontend fetch helpers and API origin handling.
- Create `src/lib/profileDirectory.js`: public profile selection and demo fallback logic.
- Modify `src/app/App.jsx`: load selected public profile by slug/id and stop choosing only `profiles[0]`.
- Modify `src/landing-page/LandingPage.jsx`: fetch latest DMG release and show public profile entry points.
- Modify `src/features/profile/tabs/LeaderboardsTab.jsx`: use hosted multi-user leaderboards.
- Modify `src/features/feed/LeaderboardBlock.jsx`: support real users plus fallback demo rows.
- Modify `src/features/commenting/CommentsCapsule.jsx`: use real public comments when available, then fallback demo comments.
- Add tests under `tests/publicDemo*.test.js`.
- Add `docs/deployment/public-demo.md`: Supabase, hosting, AI PC, and unsigned DMG runbook.

### Electron Repo: `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc`

- Modify `package.json`: add scripts for unsigned demo DMG and hosted demo config.
- Modify `main.js`: store auth session, consent version, API origin, and list generation candidate assets.
- Modify `preload.js`: expose auth/session/config/asset IPC methods.
- Modify `renderer/index.html`: add account screen, public-demo acceptance screen, and CSP for hosted API.
- Modify `renderer/app.js`: sign up/login, require public consent, sync to hosted API, create hosted generation jobs, and keep localhost dev fallback.
- Modify `renderer/styles.css`: style account and public consent screens.
- Modify `python/post_generator/webDiplomeGenerateClient.js`: point production generation requests to hosted jobs, keep local stream generation in dev.
- Add `docs/public-demo-user-instructions.md`: instructions for known demo users to open an unsigned DMG.

---

### Task 1: Supabase Schema And Environment Foundation

**Files:**
- Create: `supabase/migrations/20260529_public_demo.sql`
- Create: `.env.example`
- Modify: `package.json`
- Create: `tests/supabaseSchema.test.js`

- [ ] **Step 1: Write the schema coverage test**

Create `tests/supabaseSchema.test.js`:

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260529_public_demo.sql', 'utf8');

describe('public demo Supabase schema', () => {
  it('declares every MVP table', () => {
    for (const table of [
      'profiles',
      'posts',
      'assets',
      'comments',
      'generation_jobs',
      'app_releases',
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
  });

  it('enables public read and authenticated owner write policies', () => {
    expect(sql).toContain('alter table public.profiles enable row level security');
    expect(sql).toContain('profiles_public_read');
    expect(sql).toContain('profiles_owner_write');
    expect(sql).toContain('posts_public_read');
    expect(sql).toContain('comments_public_read');
  });

  it('declares public storage buckets for uploads and DMG releases', () => {
    expect(sql).toContain("'uploads-public'");
    expect(sql).toContain("'app-releases'");
  });
});
```

- [ ] **Step 2: Run the failing schema test**

Run:

```bash
npm test -- tests/supabaseSchema.test.js
```

Expected: FAIL because `supabase/migrations/20260529_public_demo.sql` does not exist.

- [ ] **Step 3: Add the Supabase migration**

Create `supabase/migrations/20260529_public_demo.sql`:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique,
  firstname text not null default '',
  lastname text not null default '',
  display_name text not null default 'Demo User',
  machine_name text not null default '',
  global_score numeric,
  persona_scores jsonb not null default '{}'::jsonb,
  dominant_persona text,
  profile_summary text not null default '',
  wallpaper_url text,
  raw_profile jsonb not null default '{}'::jsonb,
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  persona text not null,
  content text not null default '',
  sentiment text,
  attached_asset jsonb,
  leaderboard jsonb,
  source text not null default 'sync',
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  sha256 text not null,
  bucket text not null,
  path text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  unique(bucket, path)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_profile_id uuid references public.profiles(id) on delete set null,
  persona text,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','claimed','complete','failed')),
  request_payload jsonb not null default '{}'::jsonb,
  result_posts jsonb,
  error text,
  claimed_by text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  version text not null,
  download_url text not null,
  size_label text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists profiles_user_id_idx on public.profiles(user_id);
create index if not exists profiles_updated_at_idx on public.profiles(updated_at desc);
create index if not exists posts_profile_id_created_at_idx on public.posts(profile_id, created_at desc);
create index if not exists comments_post_id_created_at_idx on public.comments(post_id, created_at asc);
create index if not exists generation_jobs_status_created_at_idx on public.generation_jobs(status, created_at asc);
create index if not exists app_releases_platform_created_at_idx on public.app_releases(platform, created_at desc);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.assets enable row level security;
alter table public.comments enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.app_releases enable row level security;

drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles for select using (true);

drop policy if exists profiles_owner_write on public.profiles;
create policy profiles_owner_write on public.profiles
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts for select using (true);

drop policy if exists posts_owner_write on public.posts;
create policy posts_owner_write on public.posts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists assets_public_read on public.assets;
create policy assets_public_read on public.assets for select using (true);

drop policy if exists assets_owner_write on public.assets;
create policy assets_owner_write on public.assets
  for all using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists comments_public_read on public.comments;
create policy comments_public_read on public.comments for select using (true);

drop policy if exists comments_signed_in_write on public.comments;
create policy comments_signed_in_write on public.comments
  for insert with check (auth.role() = 'authenticated');

drop policy if exists generation_jobs_owner_read on public.generation_jobs;
create policy generation_jobs_owner_read on public.generation_jobs
  for select using (auth.uid() = user_id);

drop policy if exists generation_jobs_owner_insert on public.generation_jobs;
create policy generation_jobs_owner_insert on public.generation_jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists app_releases_public_read on public.app_releases;
create policy app_releases_public_read on public.app_releases for select using (true);

insert into storage.buckets (id, name, public)
values ('uploads-public', 'uploads-public', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('app-releases', 'app-releases', true)
on conflict (id) do update set public = excluded.public;
```

- [ ] **Step 4: Add environment documentation**

Create `.env.example`:

```bash
# WebDiplome hosted API
PORT=3001
PUBLIC_BASE_URL=http://localhost:3001
VITE_API_ORIGIN=http://localhost:3001
VITE_GENERATE_API_ORIGIN=http://localhost:3001

# Supabase hosted demo mode. Leave blank to use local JSON dev mode.
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI worker auth. Generate with: openssl rand -hex 32
AI_WORKER_TOKEN=

# LM Studio defaults for the AI PC worker
LM_STUDIO_BASE_URL=http://127.0.0.1:1234
LM_STUDIO_MODEL=google/gemma-4-e2b
LM_STUDIO_TIMEOUT_MS=180000
LM_STUDIO_RETRIES=1
```

- [ ] **Step 5: Add dependencies and scripts**

Modify `package.json`:

```json
{
  "scripts": {
    "worker:ai": "node worker/ai-worker.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.4"
  }
}
```

Keep all existing scripts and dependencies; add only the new script and dependency.

- [ ] **Step 6: Verify schema foundation**

Run:

```bash
npm install
npm test -- tests/supabaseSchema.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add package.json package-lock.json .env.example supabase/migrations/20260529_public_demo.sql tests/supabaseSchema.test.js
git commit -m "feat: add public demo supabase foundation"
```

---

### Task 2: Hosted Mode Configuration And Supabase Clients

**Files:**
- Create: `server/lib/env.js`
- Create: `server/lib/supabaseClient.js`
- Create: `tests/hostedEnv.test.js`

- [ ] **Step 1: Write environment behavior tests**

Create `tests/hostedEnv.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { buildServerConfig } from '../server/lib/env.js';

describe('buildServerConfig', () => {
  it('keeps hosted mode disabled when Supabase keys are missing', () => {
    const cfg = buildServerConfig({});
    expect(cfg.hostedMode).toBe(false);
  });

  it('enables hosted mode only when all Supabase server keys exist', () => {
    const cfg = buildServerConfig({
      SUPABASE_URL: 'https://demo.supabase.co',
      SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      AI_WORKER_TOKEN: 'worker',
    });
    expect(cfg.hostedMode).toBe(true);
    expect(cfg.supabaseUrl).toBe('https://demo.supabase.co');
    expect(cfg.publicBaseUrl).toBe('http://localhost:3001');
  });

  it('normalizes trailing slashes', () => {
    const cfg = buildServerConfig({
      PUBLIC_BASE_URL: 'https://api.example.com/',
      SUPABASE_URL: 'https://demo.supabase.co/',
      SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    });
    expect(cfg.publicBaseUrl).toBe('https://api.example.com');
    expect(cfg.supabaseUrl).toBe('https://demo.supabase.co');
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npm test -- tests/hostedEnv.test.js
```

Expected: FAIL because `server/lib/env.js` does not exist.

- [ ] **Step 3: Create server config**

Create `server/lib/env.js`:

```js
function trimSlash(value, fallback = '') {
  const v = String(value || fallback).trim();
  return v.replace(/\/+$/, '');
}

export function buildServerConfig(env = process.env) {
  const supabaseUrl = trimSlash(env.SUPABASE_URL);
  const supabaseAnonKey = String(env.SUPABASE_ANON_KEY || '').trim();
  const supabaseServiceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const aiWorkerToken = String(env.AI_WORKER_TOKEN || '').trim();
  const publicBaseUrl = trimSlash(env.PUBLIC_BASE_URL, 'http://localhost:3001');
  const hostedMode = Boolean(supabaseUrl && supabaseAnonKey && supabaseServiceRoleKey);

  return {
    hostedMode,
    publicBaseUrl,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    aiWorkerToken,
    lmStudioBaseUrl: trimSlash(env.LM_STUDIO_BASE_URL, 'http://127.0.0.1:1234'),
    lmStudioModel: String(env.LM_STUDIO_MODEL || 'google/gemma-4-e2b').trim(),
    lmStudioTimeoutMs: parseInt(env.LM_STUDIO_TIMEOUT_MS || '180000', 10),
    lmStudioRetries: parseInt(env.LM_STUDIO_RETRIES || '1', 10),
  };
}

export const serverConfig = buildServerConfig();
```

- [ ] **Step 4: Create Supabase clients**

Create `server/lib/supabaseClient.js`:

```js
import { createClient } from '@supabase/supabase-js';
import { serverConfig } from './env.js';

export function createSupabaseClients(config = serverConfig) {
  if (!config.hostedMode) {
    return { anon: null, service: null };
  }

  const baseOptions = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  };

  return {
    anon: createClient(config.supabaseUrl, config.supabaseAnonKey, baseOptions),
    service: createClient(config.supabaseUrl, config.supabaseServiceRoleKey, baseOptions),
  };
}

export const supabaseClients = createSupabaseClients();
```

- [ ] **Step 5: Verify config**

Run:

```bash
npm test -- tests/hostedEnv.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add server/lib/env.js server/lib/supabaseClient.js tests/hostedEnv.test.js
git commit -m "feat: add hosted mode configuration"
```

---

### Task 3: Profile Mapping And Supabase Public Store

**Files:**
- Create: `server/lib/publicProfileMapping.js`
- Create: `server/lib/publicProfileStore.js`
- Create: `tests/publicProfileMapping.test.js`
- Create: `server/lib/publicLeaderboards.js`
- Create: `tests/publicLeaderboards.test.js`

- [ ] **Step 1: Write mapping tests**

Create `tests/publicProfileMapping.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  buildProfileSlug,
  mapSyncPayloadToProfileRow,
  mapPostForInsert,
} from '../server/lib/publicProfileMapping.js';

describe('public profile mapping', () => {
  it('builds stable readable slugs', () => {
    expect(buildProfileSlug('Brikeld', 'Hoxha', 'abc-123')).toBe('brikeld-hoxha-abc123');
    expect(buildProfileSlug('', '', 'abc-123')).toBe('demo-user-abc123');
  });

  it('maps Electron sync payload to Supabase profile row', () => {
    const row = mapSyncPayloadToProfileRow({
      firstname: 'Ada',
      lastname: 'Lovelace',
      machineName: 'Ada-Mac',
      globalScore: 81,
      personaScores: { productivity: 50, security: 25, social: 25 },
      dominantPersona: 'productivity',
      profileSummary: 'Analytical, late-night builder.',
      wallpaperUrl: 'https://cdn/wallpaper.jpg',
      collectedAt: '2026-05-29T10:00:00Z',
    }, 'user-1', 'ada-user1');

    expect(row).toMatchObject({
      user_id: 'user-1',
      slug: 'ada-user1',
      firstname: 'Ada',
      lastname: 'Lovelace',
      display_name: 'Ada Lovelace',
      machine_name: 'Ada-Mac',
      global_score: 81,
      dominant_persona: 'productivity',
      profile_summary: 'Analytical, late-night builder.',
      wallpaper_url: 'https://cdn/wallpaper.jpg',
    });
    expect(row.raw_profile.firstname).toBe('Ada');
  });

  it('maps posts for insert without losing attached assets or leaderboard data', () => {
    const post = mapPostForInsert({
      persona: 'securite',
      content: 'Firewall disabled.',
      sentiment: 'negative',
      attachedAsset: { kind: 'image', url: '/uploads/a.png' },
      leaderboard: { boardId: 'most_secure' },
      createdAt: '2026-05-29T11:00:00Z',
    }, 'profile-1', 'user-1', 'sync');

    expect(post).toMatchObject({
      profile_id: 'profile-1',
      user_id: 'user-1',
      persona: 'securite',
      content: 'Firewall disabled.',
      sentiment: 'negative',
      attached_asset: { kind: 'image', url: '/uploads/a.png' },
      leaderboard: { boardId: 'most_secure' },
      source: 'sync',
      created_at: '2026-05-29T11:00:00Z',
    });
  });
});
```

- [ ] **Step 2: Run the failing mapping tests**

Run:

```bash
npm test -- tests/publicProfileMapping.test.js
```

Expected: FAIL because `server/lib/publicProfileMapping.js` does not exist.

- [ ] **Step 3: Create mapping helpers**

Create `server/lib/publicProfileMapping.js`:

```js
function cleanPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function shortUserSuffix(userId) {
  return String(userId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toLowerCase();
}

export function buildProfileSlug(firstname, lastname, userId) {
  const base = [cleanPart(firstname), cleanPart(lastname)].filter(Boolean).join('-') || 'demo-user';
  const suffix = shortUserSuffix(userId);
  return suffix ? `${base}-${suffix}` : base;
}

function displayNameFromPayload(payload) {
  const first = String(payload?.firstname ?? payload?.firstName ?? '').trim();
  const last = String(payload?.lastname ?? payload?.lastName ?? '').trim();
  return [first, last].filter(Boolean).join(' ') || 'Demo User';
}

export function mapSyncPayloadToProfileRow(payload, userId, slug) {
  const first = String(payload?.firstname ?? payload?.firstName ?? '').trim();
  const last = String(payload?.lastname ?? payload?.lastName ?? '').trim();
  return {
    user_id: userId,
    slug,
    firstname: first,
    lastname: last,
    display_name: displayNameFromPayload(payload),
    machine_name: String(payload?.machineName ?? payload?.machine_name ?? '').trim(),
    global_score: Number.isFinite(Number(payload?.globalScore ?? payload?.global_score))
      ? Number(payload?.globalScore ?? payload?.global_score)
      : null,
    persona_scores: payload?.personaScores ?? payload?.persona_scores ?? {},
    dominant_persona: payload?.dominantPersona ?? payload?.dominant_persona ?? null,
    profile_summary: String(payload?.profileSummary ?? payload?.userDescription ?? '').trim(),
    wallpaper_url: payload?.wallpaperUrl ?? payload?.wallpaper_url ?? null,
    raw_profile: payload && typeof payload === 'object' ? payload : {},
    collected_at: payload?.collectedAt ?? payload?.collected_at ?? null,
    updated_at: new Date().toISOString(),
  };
}

export function mapProfileRowForApi(row, posts = []) {
  if (!row) return null;
  return {
    id: row.slug,
    profileUuid: row.id,
    userId: row.user_id,
    slug: row.slug,
    firstname: row.firstname,
    lastname: row.lastname,
    displayName: row.display_name,
    machineName: row.machine_name,
    globalScore: row.global_score,
    personaScores: row.persona_scores ?? {},
    dominantPersona: row.dominant_persona,
    profileSummary: row.profile_summary,
    userDescription: row.profile_summary,
    wallpaperUrl: row.wallpaper_url,
    collectedAt: row.collected_at,
    personaPosts: posts,
  };
}

export function mapPostRowForApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    persona: row.persona,
    content: row.content,
    sentiment: row.sentiment,
    attachedAsset: row.attached_asset ?? null,
    leaderboard: row.leaderboard ?? null,
    source: row.source,
    createdAt: row.created_at,
  };
}

export function mapPostForInsert(post, profileId, userId, source = 'sync') {
  return {
    profile_id: profileId,
    user_id: userId,
    persona: String(post?.persona || 'productivite'),
    content: String(post?.content || ''),
    sentiment: post?.sentiment === 'positive' || post?.sentiment === 'negative' ? post.sentiment : null,
    attached_asset: post?.attachedAsset ?? post?.attached_asset ?? null,
    leaderboard: post?.leaderboard ?? null,
    source,
    created_at: post?.createdAt ?? post?.created_at ?? new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Create Supabase public store**

Create `server/lib/publicProfileStore.js`:

```js
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
```

- [ ] **Step 5: Write public leaderboard tests**

Create `tests/publicLeaderboards.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { buildPublicLeaderboards } from '../server/lib/publicLeaderboards.js';

describe('buildPublicLeaderboards', () => {
  it('uses real profiles first and pads with demo rows only below five people', () => {
    const boards = buildPublicLeaderboards([
      { slug: 'ada', displayName: 'Ada', globalScore: 91, personaScores: { productivity: 80, security: 60, social: 50 } },
      { slug: 'grace', displayName: 'Grace', globalScore: 75, personaScores: { productivity: 60, security: 80, social: 40 } },
    ]);
    expect(boards[0].entries).toHaveLength(5);
    expect(boards[0].entries[0].source).toBe('real');
    expect(boards[0].entries.some((e) => e.source === 'demo')).toBe(true);
  });
});
```

- [ ] **Step 6: Create public leaderboard builder**

Create `server/lib/publicLeaderboards.js`:

```js
const DEMO_ROWS = [
  { slug: 'demo-alex', displayName: 'Alex Johnson', handle: '@AlexLaptop', globalScore: 74, personaScores: { productivity: 74, security: 66, social: 61 }, source: 'demo' },
  { slug: 'demo-mira', displayName: 'Mira Laurent', handle: '@MiraBook', globalScore: 68, personaScores: { productivity: 64, security: 71, social: 50 }, source: 'demo' },
  { slug: 'demo-sam', displayName: 'Sam Park', handle: '@SamStudio', globalScore: 63, personaScores: { productivity: 58, security: 65, social: 75 }, source: 'demo' },
  { slug: 'demo-rio', displayName: 'Rio Chen', handle: '@RioAir', globalScore: 59, personaScores: { productivity: 69, security: 52, social: 60 }, source: 'demo' },
  { slug: 'demo-teo', displayName: 'Teo Muller', handle: '@TeoMac', globalScore: 55, personaScores: { productivity: 55, security: 59, social: 49 }, source: 'demo' },
];

const BOARDS = [
  { id: 'global_score', title: 'Global score', key: 'globalScore', persona: 'productivite' },
  { id: 'productivity_score', title: 'Productivity score', key: 'productivity', persona: 'productivite' },
  { id: 'security_score', title: 'Security score', key: 'security', persona: 'securite' },
  { id: 'social_score', title: 'Social score', key: 'social', persona: 'popularite' },
];

function scoreFor(profile, key) {
  if (key === 'globalScore') return Number(profile.globalScore ?? profile.global_score ?? 0);
  return Number(profile.personaScores?.[key] ?? profile.persona_scores?.[key] ?? 0);
}

function rowFor(profile, board) {
  return {
    slug: profile.slug,
    name: profile.displayName || profile.display_name || 'Demo User',
    handle: profile.handle || (profile.machineName ? `@${profile.machineName}` : `@${profile.slug || 'demo'}`),
    avatarSrc: profile.avatarSrc || profile.wallpaperUrl || profile.wallpaper_url || null,
    avatarInitials: profile.avatarInitials || String(profile.displayName || profile.display_name || '?').slice(0, 2).toUpperCase(),
    score: scoreFor(profile, board.key),
    source: profile.source || 'real',
    isUser: false,
  };
}

export function buildPublicLeaderboards(realProfiles, minimumRows = 5) {
  const real = Array.isArray(realProfiles) ? realProfiles.filter(Boolean).map((p) => ({ ...p, source: 'real' })) : [];
  const people = real.length >= minimumRows ? real : [...real, ...DEMO_ROWS.slice(0, minimumRows - real.length)];

  return BOARDS.map((board) => {
    const entries = people
      .map((p) => rowFor(p, board))
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
    return { boardId: board.id, title: board.title, persona: board.persona, entries };
  });
}
```

- [ ] **Step 7: Verify mapping and leaderboards**

Run:

```bash
npm test -- tests/publicProfileMapping.test.js
npm test -- tests/publicLeaderboards.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add server/lib/publicProfileMapping.js server/lib/publicProfileStore.js server/lib/publicLeaderboards.js tests/publicProfileMapping.test.js tests/publicLeaderboards.test.js
git commit -m "feat: add public profile supabase mapping"
```

---

### Task 4: Auth Routes And Write Protection

**Files:**
- Create: `server/lib/auth.js`
- Create: `server/routes/authRoutes.js`
- Create: `tests/authHelpers.test.js`

- [ ] **Step 1: Write auth helper tests**

Create `tests/authHelpers.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { extractBearerToken, isWorkerAuthorized } from '../server/lib/auth.js';

describe('auth helpers', () => {
  it('extracts bearer tokens case-insensitively', () => {
    expect(extractBearerToken('Bearer abc')).toBe('abc');
    expect(extractBearerToken('bearer xyz')).toBe('xyz');
    expect(extractBearerToken('Token abc')).toBe(null);
  });

  it('authorizes worker token only on exact match', () => {
    expect(isWorkerAuthorized('secret', 'secret')).toBe(true);
    expect(isWorkerAuthorized('secret', 'wrong')).toBe(false);
    expect(isWorkerAuthorized('', 'wrong')).toBe(false);
  });
});
```

- [ ] **Step 2: Run failing auth tests**

Run:

```bash
npm test -- tests/authHelpers.test.js
```

Expected: FAIL because `server/lib/auth.js` does not exist.

- [ ] **Step 3: Create auth helpers**

Create `server/lib/auth.js`:

```js
export function extractBearerToken(headerValue) {
  const match = String(headerValue || '').match(/^bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function isWorkerAuthorized(expectedToken, providedToken) {
  return Boolean(expectedToken && providedToken && expectedToken === providedToken);
}

export function requireHostedUser(supabase) {
  return async (req, res, next) => {
    try {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) return res.status(401).json({ error: 'Missing bearer token' });
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) return res.status(401).json({ error: 'Invalid bearer token' });
      req.authUser = data.user;
      req.authToken = token;
      return next();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };
}

export function requireWorker(config) {
  return (req, res, next) => {
    const provided = req.headers['x-ai-worker-token'];
    if (!isWorkerAuthorized(config.aiWorkerToken, provided)) {
      return res.status(401).json({ error: 'Invalid worker token' });
    }
    return next();
  };
}
```

- [ ] **Step 4: Create auth routes**

Create `server/routes/authRoutes.js`:

```js
import express from 'express';

export function createAuthRoutes({ supabaseAnon }) {
  const router = express.Router();

  router.post('/signup', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const { data, error } = await supabaseAnon.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ user: data.user, session: data.session });
  });

  router.post('/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    return res.json({ user: data.user, session: data.session });
  });

  return router;
}
```

- [ ] **Step 5: Verify auth helpers**

Run:

```bash
npm test -- tests/authHelpers.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add server/lib/auth.js server/routes/authRoutes.js tests/authHelpers.test.js
git commit -m "feat: add hosted auth routes"
```

---

### Task 5: Hosted Public API Routes

**Files:**
- Create: `server/routes/publicDemoRoutes.js`
- Modify: `server.js`
- Create: `tests/publicDemoRoutes.test.js`

- [ ] **Step 1: Write route shape tests**

Create `tests/publicDemoRoutes.test.js`:

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('hosted public demo routes', () => {
  const src = readFileSync('server/routes/publicDemoRoutes.js', 'utf8');

  it('declares public profile, release, upload, and sync endpoints', () => {
    expect(src).toContain("router.get('/profiles'");
    expect(src).toContain("router.get('/profiles/:slug'");
    expect(src).toContain("router.post('/profile/sync'");
    expect(src).toContain("router.post('/upload'");
    expect(src).toContain("router.get('/app-releases/latest'");
    expect(src).toContain("router.get('/leaderboards'");
    expect(src).toContain("router.post('/comments'");
  });
});
```

- [ ] **Step 2: Run failing route shape tests**

Run:

```bash
npm test -- tests/publicDemoRoutes.test.js
```

Expected: FAIL because `server/routes/publicDemoRoutes.js` does not exist.

- [ ] **Step 3: Create public demo routes**

Create `server/routes/publicDemoRoutes.js`:

```js
import express from 'express';
import multer from 'multer';
import { requireHostedUser } from '../lib/auth.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export function createPublicDemoRoutes({ supabaseService, profileStore, storageStore, buildLeaderboards }) {
  const router = express.Router();
  const requireUser = requireHostedUser(supabaseService);

  router.get('/profiles', async (_req, res) => {
    try {
      res.json(await profileStore.listProfiles());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/profiles/:slug', async (req, res) => {
    try {
      const profile = await profileStore.getProfileBySlug(req.params.slug);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      res.json(profile);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/profile/sync', requireUser, async (req, res) => {
    try {
      const profile = await profileStore.upsertProfileSync({
        userId: req.authUser.id,
        payload: req.body ?? {},
        replacePosts: req.body?.replacePersonaPosts === true,
      });
      res.json({ success: true, profile });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/leaderboards', async (_req, res) => {
    try {
      const profiles = await profileStore.listProfiles();
      res.json({ success: true, leaderboards: buildLeaderboards(profiles) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/comments', requireUser, async (req, res) => {
    try {
      const authorProfile = await profileStore.getProfileRowBySlug(String(req.body?.authorProfileSlug || ''));
      if (!authorProfile || authorProfile.user_id !== req.authUser.id) {
        return res.status(403).json({ error: 'Author profile owner required' });
      }
      const content = String(req.body?.content || '').trim();
      if (!content) return res.status(400).json({ error: 'content required' });
      const comment = await profileStore.addComment({
        postId: req.body?.postId,
        authorProfileId: authorProfile.id,
        persona: req.body?.persona ?? null,
        content,
      });
      res.json({ success: true, comment });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/upload', requireUser, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'missing file' });
      const asset = await storageStore.uploadPublicAsset({
        ownerUserId: req.authUser.id,
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      });
      res.json(asset);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/app-releases/latest', async (req, res) => {
    try {
      const platform = String(req.query.platform || 'mac');
      const release = await profileStore.latestRelease(platform);
      if (!release) return res.status(404).json({ error: 'No release found' });
      res.json({
        platform: release.platform,
        version: release.version,
        downloadUrl: release.download_url,
        sizeLabel: release.size_label,
        createdAt: release.created_at,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
```

- [ ] **Step 4: Mount hosted routes in `server.js`**

Add imports near the top of `server.js`:

```js
import { serverConfig } from './server/lib/env.js';
import { supabaseClients } from './server/lib/supabaseClient.js';
import { createAuthRoutes } from './server/routes/authRoutes.js';
import { createPublicDemoRoutes } from './server/routes/publicDemoRoutes.js';
import { createPublicProfileStore } from './server/lib/publicProfileStore.js';
import { createStorageStore } from './server/lib/storageStore.js';
import { buildPublicLeaderboards } from './server/lib/publicLeaderboards.js';
```

Add this block after the `/uploads` static middleware and before the existing local `/api/upload` route:

```js
if (serverConfig.hostedMode) {
  const profileStore = createPublicProfileStore(supabaseClients.service);
  const storageStore = createStorageStore({
    supabase: supabaseClients.service,
    publicBaseUrl: serverConfig.publicBaseUrl,
  });
  app.use('/api/auth', createAuthRoutes({ supabaseAnon: supabaseClients.anon }));
  app.use('/api', createPublicDemoRoutes({
    supabaseService: supabaseClients.service,
    profileStore,
    storageStore,
    buildLeaderboards: buildPublicLeaderboards,
  }));
  console.log('[hosted] Supabase public demo routes enabled');
} else {
  console.log('[local] File-backed demo routes enabled');
}
```

Wrap the existing local file-backed route declarations in `if (!serverConfig.hostedMode) { ... }` so hosted mode does not expose destructive single-profile writes. The final `app.listen` remains outside the conditional.

Leave `server-generate.js` as a local development server only. In hosted mode, `VITE_GENERATE_API_ORIGIN` should point to the hosted API service and generation should flow through `/api/generation-jobs` plus the AI worker.

- [ ] **Step 5: Verify route shape**

Run:

```bash
npm test -- tests/publicDemoRoutes.test.js
npm run build
```

Expected: tests PASS and build PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add server.js server/routes/publicDemoRoutes.js tests/publicDemoRoutes.test.js
git commit -m "feat: add hosted public profile api"
```

---

### Task 6: Supabase Storage Uploads

**Files:**
- Create: `server/lib/storageStore.js`
- Create: `tests/storageStore.test.js`

- [ ] **Step 1: Write storage helper tests**

Create `tests/storageStore.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { filenameForBuffer, publicStorageUrl } from '../server/lib/storageStore.js';

describe('storage helpers', () => {
  it('uses sha256 content addressing', () => {
    const result = filenameForBuffer(Buffer.from('hello'), 'photo.png', 'image/png');
    expect(result).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824.png');
  });

  it('builds Supabase public storage URLs', () => {
    expect(publicStorageUrl('https://demo.supabase.co', 'uploads-public', 'a.png')).toBe(
      'https://demo.supabase.co/storage/v1/object/public/uploads-public/a.png',
    );
  });
});
```

- [ ] **Step 2: Run failing storage tests**

Run:

```bash
npm test -- tests/storageStore.test.js
```

Expected: FAIL because `server/lib/storageStore.js` does not exist.

- [ ] **Step 3: Create storage store**

Create `server/lib/storageStore.js`:

```js
import crypto from 'crypto';
import path from 'path';
import { serverConfig } from './env.js';

const MIME_EXT = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/avif', '.avif'],
  ['application/pdf', '.pdf'],
  ['text/plain', '.txt'],
  ['text/markdown', '.md'],
]);

export function filenameForBuffer(buffer, originalName = '', mimeType = '') {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const mimeExt = MIME_EXT.get(String(mimeType || '').toLowerCase()) || '';
  const origExt = path.extname(String(originalName || '')).toLowerCase();
  return `${hash}${mimeExt || origExt}`;
}

export function publicStorageUrl(supabaseUrl, bucket, objectPath) {
  return `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${objectPath}`;
}

export function createStorageStore({ supabase, bucket = 'uploads-public', config = serverConfig }) {
  if (!supabase) throw new Error('Supabase service client required');

  return {
    async uploadPublicAsset({ ownerUserId, buffer, originalName, mimeType }) {
      const filename = filenameForBuffer(buffer, originalName, mimeType);
      const objectPath = filename;
      const upload = await supabase.storage
        .from(bucket)
        .upload(objectPath, buffer, { contentType: mimeType || 'application/octet-stream', upsert: true });
      if (upload.error) throw new Error(`storage upload: ${upload.error.message}`);

      const row = {
        owner_user_id: ownerUserId,
        sha256: filename.split('.')[0],
        bucket,
        path: objectPath,
        mime_type: mimeType || 'application/octet-stream',
        size_bytes: buffer.length,
      };
      const inserted = await supabase.from('assets').upsert(row, { onConflict: 'bucket,path' }).select('*').single();
      if (inserted.error) throw new Error(`asset row: ${inserted.error.message}`);

      return {
        filename,
        path: objectPath,
        bucket,
        url: publicStorageUrl(config.supabaseUrl, bucket, objectPath),
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
      };
    },
  };
}
```

- [ ] **Step 4: Verify storage helpers**

Run:

```bash
npm test -- tests/storageStore.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add server/lib/storageStore.js tests/storageStore.test.js
git commit -m "feat: add hosted asset storage"
```

---

### Task 7: Generation Jobs API And AI Worker

**Files:**
- Create: `server/lib/generationJobStore.js`
- Create: `server/routes/generationJobRoutes.js`
- Create: `worker/ai-worker.js`
- Create: `worker/README.md`
- Modify: `server.js`
- Create: `tests/generationJobs.test.js`

- [ ] **Step 1: Write generation job route/source tests**

Create `tests/generationJobs.test.js`:

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('generation job implementation', () => {
  it('exposes worker claim and complete endpoints', () => {
    const src = readFileSync('server/routes/generationJobRoutes.js', 'utf8');
    expect(src).toContain("router.get('/worker/jobs/next'");
    expect(src).toContain("router.post('/worker/jobs/:id/complete'");
    expect(src).toContain("router.post('/worker/jobs/:id/fail'");
  });

  it('worker calls local LM Studio and hosted API', () => {
    const src = readFileSync('worker/ai-worker.js', 'utf8');
    expect(src).toContain('LM_STUDIO_BASE_URL');
    expect(src).toContain('/api/worker/jobs/next');
    expect(src).toContain('/api/worker/jobs/');
    expect(src).toContain('generatePersonaPosts');
  });
});
```

- [ ] **Step 2: Run failing generation job tests**

Run:

```bash
npm test -- tests/generationJobs.test.js
```

Expected: FAIL because the job route and worker files do not exist.

- [ ] **Step 3: Create generation job store**

Create `server/lib/generationJobStore.js`:

```js
function throwIfError(result, label) {
  if (result?.error) throw new Error(`${label}: ${result.error.message}`);
  return result?.data;
}

export function createGenerationJobStore(supabase) {
  if (!supabase) throw new Error('Supabase service client required');

  return {
    async createJob({ userId, profileId, requestPayload }) {
      return throwIfError(
        await supabase
          .from('generation_jobs')
          .insert({
            user_id: userId,
            profile_id: profileId,
            status: 'queued',
            request_payload: requestPayload ?? {},
          })
          .select('*')
          .single(),
        'create generation job',
      );
    },

    async claimNext(workerName) {
      const next = throwIfError(
        await supabase
          .from('generation_jobs')
          .select('*')
          .eq('status', 'queued')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        'read next generation job',
      );
      if (!next) return null;

      return throwIfError(
        await supabase
          .from('generation_jobs')
          .update({
            status: 'claimed',
            claimed_by: workerName,
            claimed_at: new Date().toISOString(),
          })
          .eq('id', next.id)
          .eq('status', 'queued')
          .select('*')
          .maybeSingle(),
        'claim generation job',
      );
    },

    async completeJob({ jobId, posts }) {
      return throwIfError(
        await supabase
          .from('generation_jobs')
          .update({
            status: 'complete',
            result_posts: posts,
            completed_at: new Date().toISOString(),
            error: null,
          })
          .eq('id', jobId)
          .select('*')
          .single(),
        'complete generation job',
      );
    },

    async failJob({ jobId, error }) {
      return throwIfError(
        await supabase
          .from('generation_jobs')
          .update({
            status: 'failed',
            error: String(error || 'Generation failed'),
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId)
          .select('*')
          .single(),
        'fail generation job',
      );
    },
  };
}
```

- [ ] **Step 4: Create generation job routes**

Create `server/routes/generationJobRoutes.js`:

```js
import express from 'express';
import { requireHostedUser, requireWorker } from '../lib/auth.js';

export function createGenerationJobRoutes({ config, supabaseService, profileStore, jobStore }) {
  const router = express.Router();
  const requireUser = requireHostedUser(supabaseService);
  const requireAiWorker = requireWorker(config);

  router.post('/generation-jobs', requireUser, async (req, res) => {
    try {
      const slug = String(req.body?.profileSlug || '').trim();
      const profile = slug ? await profileStore.getProfileRowBySlug(slug) : null;
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      if (profile.user_id !== req.authUser.id) return res.status(403).json({ error: 'Profile owner required' });

      const job = await jobStore.createJob({
        userId: req.authUser.id,
        profileId: profile.id,
        requestPayload: req.body?.requestPayload ?? {},
      });
      res.json({ success: true, jobId: job.id, status: job.status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/worker/jobs/next', requireAiWorker, async (req, res) => {
    try {
      const workerName = String(req.query.worker || 'ai-pc');
      const job = await jobStore.claimNext(workerName);
      res.json({ job });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/worker/jobs/:id/complete', requireAiWorker, async (req, res) => {
    try {
      const job = await jobStore.completeJob({ jobId: req.params.id, posts: req.body?.posts ?? [] });
      await profileStore.appendPosts({
        profileId: job.profile_id,
        userId: job.user_id,
        posts: req.body?.posts ?? [],
        source: 'generated',
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/worker/jobs/:id/fail', requireAiWorker, async (req, res) => {
    try {
      await jobStore.failJob({ jobId: req.params.id, error: req.body?.error });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
```

- [ ] **Step 5: Create AI worker**

Create `worker/ai-worker.js`:

```js
import { generatePersonaPosts, generateUserSummary } from '../server/lib/personaPostGenerator.js';
import { loadPrompts } from '../server/lib/prompts.js';

const API = String(process.env.WEBDIPLOME_API_ORIGIN || 'http://localhost:3001').replace(/\/$/, '');
const TOKEN = String(process.env.AI_WORKER_TOKEN || '');
const WORKER_NAME = String(process.env.AI_WORKER_NAME || 'ai-pc');
const LM_STUDIO_BASE_URL = String(process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234').replace(/\/$/, '');
const LM_STUDIO_MODEL = String(process.env.LM_STUDIO_MODEL || 'google/gemma-4-e2b');
const TIMEOUT_MS = parseInt(process.env.LM_STUDIO_TIMEOUT_MS || '180000', 10);
const RETRIES = parseInt(process.env.LM_STUDIO_RETRIES || '1', 10);
const POLL_MS = parseInt(process.env.AI_WORKER_POLL_MS || '5000', 10);

function headers() {
  return { 'Content-Type': 'application/json', 'x-ai-worker-token': TOKEN };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

async function fetchAssetAsAssignment(assetCandidate, targetPersona) {
  if (!assetCandidate?.url) return null;
  const res = await fetch(assetCandidate.url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = assetCandidate.mime || res.headers.get('content-type') || 'image/jpeg';
  if (String(mime).startsWith('image/')) {
    return {
      persona: targetPersona || 'popularite',
      asset: {
        kind: 'image',
        base64: buf.toString('base64'),
        mime,
        filename: assetCandidate.filename || 'asset',
      },
    };
  }
  const text = buf.toString('utf8').slice(0, 8000);
  return {
    persona: targetPersona || 'productivite',
    asset: {
      kind: 'document',
      text,
      mime,
      filename: assetCandidate.filename || 'document',
    },
  };
}

async function processJob(job) {
  const payload = job.request_payload || {};
  const profile = payload.profile || {};
  const dataJson = payload.dataJson || payload.data_json || {};
  const user = payload.user || {};
  const existingPosts = Array.isArray(payload.existingPosts) ? payload.existingPosts : [];
  const userPayload = JSON.stringify({ user, profile: dataJson });
  const prompts = await loadPrompts(process.cwd());
  const assetAssignment = await fetchAssetAsAssignment(
    Array.isArray(payload.assetCandidates) ? payload.assetCandidates[0] : null,
    payload.assetPersona || 'popularite',
  );

  const profileSummary = profile.profileSummary || profile.userDescription || await generateUserSummary({
    baseUrl: LM_STUDIO_BASE_URL,
    model: LM_STUDIO_MODEL,
    userPayload,
    timeoutMs: TIMEOUT_MS,
    retries: RETRIES,
    prompts,
  });

  const posts = await generatePersonaPosts({
    baseUrl: LM_STUDIO_BASE_URL,
    model: LM_STUDIO_MODEL,
    userPayload,
    timeoutMs: TIMEOUT_MS,
    retries: RETRIES,
    assetAssignment,
    prompts,
    dataJson,
    profile: { ...profile, profileSummary, userDescription: profileSummary },
    existingPosts,
    chartUploadDir: null,
  });

  return posts.filter(Boolean);
}

async function tick() {
  if (!TOKEN) throw new Error('AI_WORKER_TOKEN is required');
  const { job } = await fetchJson(`${API}/api/worker/jobs/next?worker=${encodeURIComponent(WORKER_NAME)}`, {
    headers: headers(),
  });
  if (!job) return;

  try {
    const posts = await processJob(job);
    await fetchJson(`${API}/api/worker/jobs/${job.id}/complete`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ posts }),
    });
    console.log(`[worker] completed ${job.id} with ${posts.length} posts`);
  } catch (err) {
    await fetchJson(`${API}/api/worker/jobs/${job.id}/fail`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ error: err.message }),
    }).catch(() => {});
    console.error(`[worker] failed ${job.id}:`, err.message);
  }
}

async function loop() {
  for (;;) {
    try {
      await tick();
    } catch (err) {
      console.error('[worker] tick failed:', err.message);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

loop();
```

- [ ] **Step 6: Document AI worker setup**

Create `worker/README.md`:

```md
# WebDiplome AI Worker

Run this on the dedicated AI PC, not on public hosting.

```bash
npm install
export WEBDIPLOME_API_ORIGIN="https://your-hosted-api.example.com"
export AI_WORKER_TOKEN="same secret configured on the hosted API"
export LM_STUDIO_BASE_URL="http://127.0.0.1:1234"
export LM_STUDIO_MODEL="google/gemma-4-e2b"
npm run worker:ai
```

LM Studio must be reachable only from this AI PC. Do not expose LM Studio directly to the public internet.
```

- [ ] **Step 7: Mount generation routes in `server.js`**

Add imports:

```js
import { createGenerationJobStore } from './server/lib/generationJobStore.js';
import { createGenerationJobRoutes } from './server/routes/generationJobRoutes.js';
```

Inside the hosted-mode setup block:

```js
const jobStore = createGenerationJobStore(supabaseClients.service);
app.use('/api', createGenerationJobRoutes({
  config: serverConfig,
  supabaseService: supabaseClients.service,
  profileStore,
  jobStore,
}));
```

- [ ] **Step 8: Verify generation job source**

Run:

```bash
npm test -- tests/generationJobs.test.js
node --check worker/ai-worker.js
```

Expected: PASS and `node --check` exits 0.

- [ ] **Step 9: Commit**

Run:

```bash
git add server.js server/lib/generationJobStore.js server/routes/generationJobRoutes.js worker/ai-worker.js worker/README.md tests/generationJobs.test.js
git commit -m "feat: add ai generation job worker flow"
```

---

### Task 8: Multi-User Web UI And Demo Fallback People

**Files:**
- Create: `src/lib/apiClient.js`
- Create: `src/lib/profileDirectory.js`
- Modify: `src/app/App.jsx`
- Modify: `src/landing-page/LandingPage.jsx`
- Modify: `src/features/feed/LeaderboardBlock.jsx`
- Modify: `src/features/commenting/CommentsCapsule.jsx`
- Create: `tests/profileDirectory.test.js`

- [ ] **Step 1: Write profile directory tests**

Create `tests/profileDirectory.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { mergeRealAndDemoPeople, selectProfileBySlug } from '../src/lib/profileDirectory.js';

describe('profile directory helpers', () => {
  it('selects requested slug before falling back to newest profile', () => {
    const profiles = [{ slug: 'one' }, { slug: 'two' }];
    expect(selectProfileBySlug(profiles, 'two')).toEqual({ slug: 'two' });
    expect(selectProfileBySlug(profiles, 'missing')).toEqual({ slug: 'one' });
  });

  it('fills public people with demo people only when there are too few real users', () => {
    const real = [{ id: 'r1', source: 'real' }, { id: 'r2', source: 'real' }];
    const demo = [{ id: 'd1', source: 'demo' }, { id: 'd2', source: 'demo' }, { id: 'd3', source: 'demo' }];
    expect(mergeRealAndDemoPeople(real, demo, 5).map((p) => p.id)).toEqual(['r1', 'r2', 'd1', 'd2', 'd3']);
    expect(mergeRealAndDemoPeople([...real, { id: 'r3' }, { id: 'r4' }, { id: 'r5' }], demo, 5).every((p) => p.source !== 'demo')).toBe(true);
  });
});
```

- [ ] **Step 2: Run failing directory tests**

Run:

```bash
npm test -- tests/profileDirectory.test.js
```

Expected: FAIL because `src/lib/profileDirectory.js` does not exist.

- [ ] **Step 3: Create frontend API helpers**

Create `src/lib/apiClient.js`:

```js
export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3001';

export async function fetchJson(path, options = {}) {
  const res = await fetch(`${API_ORIGIN}${path}`, options);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json;
}

export async function fetchProfiles() {
  return fetchJson('/api/profiles');
}

export async function fetchProfile(slug) {
  return fetchJson(`/api/profiles/${encodeURIComponent(slug)}`);
}

export async function fetchLatestMacRelease() {
  return fetchJson('/api/app-releases/latest?platform=mac');
}
```

- [ ] **Step 4: Create profile directory helpers**

Create `src/lib/profileDirectory.js`:

```js
export const DEMO_PUBLIC_PEOPLE = [
  { id: 'demo-alex', source: 'demo', displayName: 'Alex Johnson', handle: '@AlexLaptop', avatarSrc: '/imgs/AlexP.png', globalScore: 74 },
  { id: 'demo-mira', source: 'demo', displayName: 'Mira Laurent', handle: '@MiraBook', avatarInitials: 'ML', globalScore: 68 },
  { id: 'demo-sam', source: 'demo', displayName: 'Sam Park', handle: '@SamStudio', avatarInitials: 'SP', globalScore: 63 },
  { id: 'demo-rio', source: 'demo', displayName: 'Rio Chen', handle: '@RioAir', avatarInitials: 'RC', globalScore: 59 },
  { id: 'demo-teo', source: 'demo', displayName: 'Teo Muller', handle: '@TeoMac', avatarInitials: 'TM', globalScore: 55 },
];

export function selectProfileBySlug(profiles, slug) {
  const list = Array.isArray(profiles) ? profiles : [];
  if (slug) {
    const found = list.find((p) => p?.slug === slug || p?.id === slug);
    if (found) return found;
  }
  return list[0] ?? null;
}

export function mergeRealAndDemoPeople(realPeople, demoPeople = DEMO_PUBLIC_PEOPLE, minimum = 5) {
  const real = Array.isArray(realPeople) ? realPeople.filter(Boolean) : [];
  if (real.length >= minimum) return real;
  return [...real, ...demoPeople.slice(0, minimum - real.length)];
}
```

- [ ] **Step 5: Update `App.jsx` profile loading**

Modify `src/app/App.jsx`:

```js
import { fetchProfiles, fetchProfile } from '@/lib/apiClient.js';
import { selectProfileBySlug } from '@/lib/profileDirectory.js';
```

Replace the `fetch(`${API_ORIGIN}/api/profiles`)` profile load logic with:

```js
const loadProfiles = async () => {
  const profiles = await fetchProfiles();
  const selectedSlug = new URLSearchParams(window.location.search).get('profile');
  const selected = selectProfileBySlug(profiles, selectedSlug);
  if (!selected) return null;
  if (selectedSlug && selected.slug === selectedSlug) {
    return fetchProfile(selectedSlug).catch(() => selected);
  }
  return selected;
};
```

Use `loadProfiles()` in the initial polling effect and `reloadProfileFromApi()`. Continue using `mergeProfileFromApi(prev, incoming)` after a profile is loaded.

- [ ] **Step 6: Add DMG release fetch to landing page**

Modify `src/landing-page/LandingPage.jsx`:

```js
import { useEffect, useRef, useState } from 'react';
import { fetchLatestMacRelease } from '@/lib/apiClient.js';
```

Inside `LandingPage`:

```js
const [release, setRelease] = useState(null);

useEffect(() => {
  let cancelled = false;
  fetchLatestMacRelease()
    .then((r) => { if (!cancelled) setRelease(r); })
    .catch(() => { if (!cancelled) setRelease(null); });
  return () => { cancelled = true; };
}, []);
```

Set the download link/button href to:

```js
const downloadUrl = release?.downloadUrl || '#';
const downloadLabel = release
  ? `SocialScore.dmg · macOS · ${release.sizeLabel || release.version}`
  : 'SocialScore.dmg · coming soon';
```

- [ ] **Step 7: Update fallback people usage**

In `LeaderboardBlock.jsx` and `CommentsCapsule.jsx`, import `mergeRealAndDemoPeople` and use real rows/comments from API first. When there are fewer than five people for a leaderboard or comment row, fill with `DEMO_PUBLIC_PEOPLE`. Mark fallback rows with `source: 'demo'` and keep their existing visual style.

- [ ] **Step 8: Verify frontend helpers**

Run:

```bash
npm test -- tests/profileDirectory.test.js
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add src/lib/apiClient.js src/lib/profileDirectory.js src/app/App.jsx src/landing-page/LandingPage.jsx src/features/feed/LeaderboardBlock.jsx src/features/commenting/CommentsCapsule.jsx tests/profileDirectory.test.js
git commit -m "feat: browse public multi-user profiles"
```

---

### Task 9: Electron Auth, Public Consent, And Hosted Sync

**Files in `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc`:**
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `renderer/index.html`
- Modify: `renderer/app.js`
- Modify: `renderer/styles.css`
- Modify: `package.json`

- [ ] **Step 1: Add hosted config and unsigned DMG script**

Modify Electron `package.json`:

```json
{
  "scripts": {
    "make": "bash build_python.sh && electron-forge make",
    "make:demo": "CSC_IDENTITY_AUTO_DISCOVERY=false bash build_python.sh && electron-forge make"
  }
}
```

Keep existing scripts. Add only `make:demo`.

- [ ] **Step 2: Add session/config IPC in `main.js`**

Add constants after `DATA_DIR` is created:

```js
const SESSION_FILE = path.join(DATA_DIR, "webdiplome_session.json");
const CONSENT_FILE = path.join(DATA_DIR, "public_demo_consent.json");
const WEBDIPLOME_API_ORIGIN =
  process.env.WEBDIPLOME_API_ORIGIN ||
  process.env.WEBDIPLOME_URL ||
  "http://localhost:3001";
const PUBLIC_DEMO_CONSENT_VERSION = "2026-05-29-public-demo-v1";
```

Add IPC handlers:

```js
ipcMain.handle("get-webdiplome-config", () => ({
  apiOrigin: WEBDIPLOME_API_ORIGIN.replace(/\/$/, ""),
  consentVersion: PUBLIC_DEMO_CONSENT_VERSION,
}));

ipcMain.handle("read-webdiplome-session", () => {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    return JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
  } catch {
    return null;
  }
});

ipcMain.handle("save-webdiplome-session", (_evt, session) => {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session ?? null, null, 2), "utf8");
  return { success: true };
});

ipcMain.handle("read-public-demo-consent", () => {
  try {
    if (!fs.existsSync(CONSENT_FILE)) return null;
    return JSON.parse(fs.readFileSync(CONSENT_FILE, "utf8"));
  } catch {
    return null;
  }
});

ipcMain.handle("save-public-demo-consent", (_evt, payload) => {
  const record = {
    version: PUBLIC_DEMO_CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
    ...(payload && typeof payload === "object" ? payload : {}),
  };
  fs.writeFileSync(CONSENT_FILE, JSON.stringify(record, null, 2), "utf8");
  return record;
});
```

- [ ] **Step 3: Expose IPC in `preload.js`**

Add:

```js
getWebDiplomeConfig: () => ipcRenderer.invoke("get-webdiplome-config"),
readWebDiplomeSession: () => ipcRenderer.invoke("read-webdiplome-session"),
saveWebDiplomeSession: (session) => ipcRenderer.invoke("save-webdiplome-session", session),
readPublicDemoConsent: () => ipcRenderer.invoke("read-public-demo-consent"),
savePublicDemoConsent: (payload) => ipcRenderer.invoke("save-public-demo-consent", payload ?? {}),
```

- [ ] **Step 4: Add account and public consent screens**

In `renderer/index.html`, update CSP:

```html
content="default-src 'self'; connect-src http://127.0.0.1:5050 http://localhost:3001 https:; img-src http://127.0.0.1:5050 http://localhost:3001 https: data:; font-src 'self' data:; style-src 'self' 'unsafe-inline';"
```

Add before `screen-intro`:

```html
<div id="screen-account" class="screen hidden">
  <div class="reg-wrap">
    <h1 class="reg-title">Public demo account</h1>
    <p class="reg-subtitle">Create or enter the account that will publish this Mac profile to WebDiplome.</p>
    <input id="account-email" class="text-input" type="email" placeholder="email" autocomplete="email">
    <input id="account-password" class="text-input" type="password" placeholder="password" autocomplete="current-password">
    <div class="account-actions">
      <button type="button" class="btn-pill btn-primary" id="btn-account-login">Log in</button>
      <button type="button" class="btn-pill btn-outline" id="btn-account-signup">Create account</button>
    </div>
    <p class="account-error" id="account-error"></p>
  </div>
</div>

<div id="screen-public-demo-consent" class="screen hidden">
  <div class="reg-wrap">
    <h1 class="reg-title">Public profile consent</h1>
    <p class="reg-subtitle">This critique demo publishes your score, profile, posts, rankings, and selected attached assets publicly on WebDiplome.</p>
    <div class="consent-collect-block">
      <div class="consent-collect-heading">By continuing you accept</div>
      <ul class="consent-collect-list">
        <li>Your analyzed profile is public.</li>
        <li>Your generated posts and rankings are public.</li>
        <li>Selected uploaded screenshots/images/documents may appear in generated posts.</li>
        <li>You can ask the project owner to delete your demo data.</li>
      </ul>
    </div>
    <button type="button" class="btn-pill btn-primary" id="btn-public-demo-accept">Accept public demo</button>
  </div>
</div>
```

- [ ] **Step 5: Add account/consent logic in `renderer/app.js`**

Add global state near constants:

```js
let webDiplomeConfig = { apiOrigin: "http://localhost:3001", consentVersion: "dev" };
let webDiplomeSession = null;
let publicDemoConsent = null;
```

Add helpers:

```js
async function initHostedDemoState() {
  webDiplomeConfig = await window.api.getWebDiplomeConfig();
  webDiplomeSession = await window.api.readWebDiplomeSession();
  publicDemoConsent = await window.api.readPublicDemoConsent();
}

function authHeaders() {
  const token = webDiplomeSession?.access_token || webDiplomeSession?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function hostedFetch(path, options = {}) {
  const headers = { ...(options.headers || {}), ...authHeaders() };
  const res = await fetch(`${webDiplomeConfig.apiOrigin}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

async function submitAccount(mode) {
  const email = document.getElementById("account-email").value.trim();
  const password = document.getElementById("account-password").value;
  const path = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
  const json = await hostedFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  webDiplomeSession = json.session;
  await window.api.saveWebDiplomeSession(webDiplomeSession);
  if (!publicDemoConsent || publicDemoConsent.version !== webDiplomeConfig.consentVersion) {
    showScreen("public-demo-consent");
  } else {
    showScreen("intro");
  }
}
```

Change startup:

```js
window.addEventListener("DOMContentLoaded", async () => {
  await initHostedDemoState();
  if (!webDiplomeSession) {
    showScreen("account");
    return;
  }
  if (!publicDemoConsent || publicDemoConsent.version !== webDiplomeConfig.consentVersion) {
    showScreen("public-demo-consent");
    return;
  }
  showScreen("intro");
});
```

Add event listeners:

```js
document.getElementById("btn-account-login").addEventListener("click", () => {
  submitAccount("login").catch((err) => {
    document.getElementById("account-error").textContent = err.message;
  });
});

document.getElementById("btn-account-signup").addEventListener("click", () => {
  submitAccount("signup").catch((err) => {
    document.getElementById("account-error").textContent = err.message;
  });
});

document.getElementById("btn-public-demo-accept").addEventListener("click", async () => {
  publicDemoConsent = await window.api.savePublicDemoConsent({
    publicProfiles: true,
    publicPosts: true,
    publicRankings: true,
  });
  showScreen("intro");
});
```

- [ ] **Step 6: Point sync to hosted API**

Replace constants:

```js
const WEBDIPLOME_SYNC_RETRIES = 2;
```

Use dynamic URLs inside upload/sync:

```js
function webDiplomeApiUrl(path) {
  return `${webDiplomeConfig.apiOrigin}${path}`;
}
```

Update `uploadOneAttachedAsset` fetch:

```js
const resp = await fetch(webDiplomeApiUrl("/api/upload"), {
  method: "POST",
  headers: authHeaders(),
  body: form,
});
```

Update `syncProfileToWebDiplome`:

```js
const resp = await fetch(webDiplomeApiUrl("/api/profile/sync"), {
  method: "POST",
  headers: { "Content-Type": "application/json", ...authHeaders() },
  body: JSON.stringify(payload),
});
if (resp.ok) return resp.json();
```

Keep local fallback: if `webDiplomeConfig.apiOrigin` includes `localhost:3001` and `/api/profile/sync` returns 404, retry the old `/api/profile` endpoint and return `{ success: true, profile: null }`.

- [ ] **Step 7: Queue hosted generation jobs from Electron**

After successful profile sync in `renderProfile`, add:

```js
async function requestHostedGeneration(syncPayload, dataJson, syncedProfile) {
  if (!webDiplomeSession) return null;
  const profileSlug = syncedProfile?.slug || syncedProfile?.id;
  if (!profileSlug) return null;

  const job = await hostedFetch("/api/generation-jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profileSlug,
      requestPayload: {
        user: userData,
        profile: syncPayload,
        dataJson,
        existingPosts: generatedPosts,
        assetCandidates: [],
        assetPersona: "popularite",
      },
    }),
  });
  return job;
}
```

Call it after profile sync:

```js
const syncResult = await syncProfileToWebDiplome(syncPayload);
try {
  await requestHostedGeneration(syncPayload, data, syncResult?.profile);
} catch (e) {
  console.warn("[generation-job] queued generation failed", e);
}
```

This first pass sends no extra asset candidates. Task 10 adds candidate uploads.

- [ ] **Step 8: Add styles**

Add to `renderer/styles.css`:

```css
.text-input {
  width: 100%;
  border: 1px solid rgba(255,255,255,0.25);
  background: rgba(255,255,255,0.08);
  color: #fff;
  border-radius: 8px;
  padding: 12px 14px;
  font: inherit;
  margin-bottom: 10px;
}

.account-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.account-error {
  min-height: 20px;
  color: #ff8a8a;
  font-size: 12px;
}
```

- [ ] **Step 9: Manual Electron verification**

Run:

```bash
npm start
```

Expected:
- app opens to account screen if no session exists
- login/signup stores a session JSON in app data
- public demo acceptance appears before harvest
- existing persona consent still appears before collection
- sync sends Authorization header to hosted API

- [ ] **Step 10: Commit Electron repo changes**

Run from `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc`:

```bash
git add package.json main.js preload.js renderer/index.html renderer/app.js renderer/styles.css
git commit -m "feat: add public demo auth and consent"
```

---

### Task 10: Electron Candidate Asset Uploads For AI Worker

**Files in `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc`:**
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `renderer/app.js`

- [ ] **Step 1: Add asset listing IPC**

In `main.js`, add:

```js
ipcMain.handle("list-generation-assets", () => {
  const roots = [
    path.join(DATA_DIR, "assets", "recent_images"),
    path.join(DATA_DIR, "assets", "screenshots"),
    path.join(DATA_DIR, "assets", "docs"),
  ];
  const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".pdf", ".txt", ".md"]);
  const out = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root)) {
      const full = path.join(root, name);
      if (!fs.statSync(full).isFile()) continue;
      if (!allowed.has(path.extname(name).toLowerCase())) continue;
      const rel = path.relative(DATA_DIR, full);
      out.push({ filename: name, relativePath: rel, sizeBytes: fs.statSync(full).size });
    }
  }
  return out.sort((a, b) => a.sizeBytes - b.sizeBytes).slice(0, 6);
});
```

- [ ] **Step 2: Expose asset listing in preload**

Add:

```js
listGenerationAssets: () => ipcRenderer.invoke("list-generation-assets"),
```

- [ ] **Step 3: Upload candidates in renderer**

Add to `renderer/app.js`:

```js
async function uploadGenerationAssetCandidates() {
  const candidates = await window.api.listGenerationAssets();
  const uploaded = [];
  for (const candidate of candidates) {
    const file = await window.api.readDataFileBase64(candidate.relativePath);
    if (!file?.base64) continue;
    const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: file.mime || "application/octet-stream" });
    const form = new FormData();
    form.append("file", blob, file.filename || candidate.filename);
    const resp = await fetch(webDiplomeApiUrl("/api/upload"), {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    if (!resp.ok) continue;
    const json = await resp.json();
    uploaded.push({
      filename: json.filename || candidate.filename,
      url: json.url,
      mime: file.mime || "application/octet-stream",
      sizeBytes: candidate.sizeBytes,
    });
  }
  return uploaded;
}
```

Update `requestHostedGeneration`:

```js
const assetCandidates = await uploadGenerationAssetCandidates();
```

Use `assetCandidates` in the request payload.

- [ ] **Step 4: Manual verification**

Run Electron against hosted/local API:

```bash
npm start
```

Expected:
- `/api/upload` receives 0 to 6 candidate files
- `/api/generation-jobs` payload contains `assetCandidates`
- AI worker can fetch the first candidate URL

- [ ] **Step 5: Commit**

Run:

```bash
git add main.js preload.js renderer/app.js
git commit -m "feat: upload ai generation asset candidates"
```

---

### Task 11: DMG Release Download And Runbook

**Files:**
- Create: `docs/deployment/public-demo.md`
- Modify: `src/landing-page/LandingPage.jsx`
- Modify: `src/landing-page/landingPage.css`
- In Electron repo create: `docs/public-demo-user-instructions.md`

- [ ] **Step 1: Add deployment runbook**

Create `docs/deployment/public-demo.md`:

```md
# Public Demo Deployment Runbook

## Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/20260529_public_demo.sql`.
3. In Authentication settings, disable email confirmation for the short critique demo.
4. Copy project URL, anon key, and service role key.
5. Keep the service role key only in hosted API secrets.

## Hosted API

Set:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_WORKER_TOKEN=
PUBLIC_BASE_URL=
```

Start with:

```bash
npm run server
```

## Website

Set:

```bash
VITE_API_ORIGIN=https://your-api-host
VITE_GENERATE_API_ORIGIN=https://your-api-host
```

Build:

```bash
npm run build
```

## AI PC

Run:

```bash
npm install
WEBDIPLOME_API_ORIGIN=https://your-api-host \
AI_WORKER_TOKEN=replace-with-64-hex-character-worker-token \
LM_STUDIO_BASE_URL=http://127.0.0.1:1234 \
npm run worker:ai
```

## Unsigned DMG

From `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc`:

```bash
npm run make:demo
```

Upload the DMG to Supabase Storage bucket `app-releases`, then insert or update:

```sql
insert into public.app_releases (platform, version, download_url, size_label)
values ('mac', '1.0.0-demo', 'https://demo-project.supabase.co/storage/v1/object/public/app-releases/SocialScore-demo.dmg', '18.4 MB');
```
```

- [ ] **Step 2: Add user instructions in Electron repo**

Create `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc/docs/public-demo-user-instructions.md`:

```md
# Opening The Unsigned Demo App

This demo build is unsigned because the project does not use an Apple Developer account.

1. Download the DMG from WebDiplome.
2. Open the DMG and drag the app to Applications.
3. If macOS blocks the app, Control-click the app and choose Open.
4. If macOS still blocks it, open System Settings > Privacy & Security and allow the app.
5. Sign in with the demo account you created.
6. Read and accept the public demo consent screen before running the analysis.

Everything generated for this critique demo is public on WebDiplome.
```

- [ ] **Step 3: Style disabled/no-release state**

In `src/landing-page/landingPage.css`, add a disabled download state:

```css
.lp-download-link[aria-disabled="true"] {
  opacity: 0.55;
  pointer-events: none;
}
```

Apply the class/attribute to the landing download anchor when no release is returned.

- [ ] **Step 4: Verify docs and build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run in WebDiplome:

```bash
git add docs/deployment/public-demo.md src/landing-page/LandingPage.jsx src/landing-page/landingPage.css
git commit -m "docs: add public demo deployment runbook"
```

Run in Electron repo:

```bash
git add docs/public-demo-user-instructions.md
git commit -m "docs: add unsigned demo app instructions"
```

---

### Task 12: End-To-End Staging Verification

**Files:**
- Modify only if verification exposes bugs in files touched by Tasks 1-11.

- [ ] **Step 1: Run WebDiplome tests and build**

Run:

```bash
npm test
npm run build
```

Expected: all tests PASS and production build completes.

- [ ] **Step 2: Run WebDiplome API locally in hosted mode**

Create a local `.env` from `.env.example` with staging Supabase keys, then run:

```bash
npm run server
```

Expected:
- console prints `[hosted] Supabase public demo routes enabled`
- `GET http://localhost:3001/api/profiles` returns `[]` or public profiles

- [ ] **Step 3: Run AI worker against local hosted API**

On the AI PC or local staging machine:

```bash
WEBDIPLOME_API_ORIGIN=http://localhost:3001 \
AI_WORKER_TOKEN=replace-with-64-hex-character-worker-token \
LM_STUDIO_BASE_URL=http://127.0.0.1:1234 \
npm run worker:ai
```

Expected:
- worker polls without auth errors
- when no jobs exist, it logs no failures

- [ ] **Step 4: Run Electron app against local hosted API**

From `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc`:

```bash
WEBDIPLOME_API_ORIGIN=http://localhost:3001 npm start
```

Expected:
- account screen appears
- user can sign up/log in
- public demo consent appears
- persona consent appears
- harvest completes
- profile sync creates one `profiles` row
- job creation creates one `generation_jobs` row

- [ ] **Step 5: Verify worker completes generated posts**

With LM Studio running on the AI PC:

```bash
npm run worker:ai
```

Expected:
- job moves from `queued` to `complete`
- `posts` table receives generated posts for that profile
- WebDiplome profile reload shows those posts

- [ ] **Step 6: Verify multi-user behavior**

Repeat Electron signup/sync with a second demo account.

Expected:
- first profile remains visible
- second profile appears in `/api/profiles`
- WebDiplome can open both profiles
- leaderboards contain real users first and demo fallback rows only if fewer than five people exist

- [ ] **Step 7: Build unsigned DMG**

From Electron repo:

```bash
npm run make:demo
```

Expected:
- Electron Forge creates a `.dmg`
- no Apple Developer account is required

- [ ] **Step 8: Upload DMG and release row**

Upload the `.dmg` to Supabase Storage bucket `app-releases` and insert the release row from the runbook.

Expected:
- `GET /api/app-releases/latest?platform=mac` returns the DMG URL
- landing page download button opens that URL

- [ ] **Step 9: Final commits**

Commit any verification fixes with focused messages. Do not commit `.env`, Supabase keys, generated local data, or uploaded assets.

---

## Self-Review

- Spec coverage: covered Supabase schema/storage, public profiles/posts/rankings, Electron consent/auth, AI PC worker, mock fallback users, unsigned DMG, and staging workflow.
- Scope control: excluded Apple signing, auto-update, private profiles, payments, moderation, and multi-worker scheduling.
- Type consistency: profile identifiers use Supabase UUID internally and public `slug` externally; Electron sends bearer tokens; worker uses `x-ai-worker-token`.
- Known implementation risk: current `server.js` is large, so Task 5 should keep the hosted route mount small and avoid refactoring unrelated local routes.
