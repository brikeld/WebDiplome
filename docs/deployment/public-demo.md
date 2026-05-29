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
