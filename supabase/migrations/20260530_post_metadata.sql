-- Rich post fields (inferenceChain, ingredients, chartType, etc.) for hosted Supabase posts.
alter table public.posts
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists posts_metadata_gin_idx on public.posts using gin (metadata);
