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
