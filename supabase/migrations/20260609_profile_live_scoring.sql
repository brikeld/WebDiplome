alter table public.profiles
  add column if not exists live_scoring_records jsonb not null default '{}'::jsonb;
