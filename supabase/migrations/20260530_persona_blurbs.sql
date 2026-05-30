-- Fixed persona blurbs per public profile (same for all visitors).
alter table public.profiles
  add column if not exists persona_blurbs jsonb not null default '{}'::jsonb;
