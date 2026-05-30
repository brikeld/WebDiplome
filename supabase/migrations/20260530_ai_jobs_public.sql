-- Allow public AI jobs (comments, blurbs) without a profile owner row.
alter table public.generation_jobs alter column profile_id drop not null;
alter table public.generation_jobs alter column user_id drop not null;
