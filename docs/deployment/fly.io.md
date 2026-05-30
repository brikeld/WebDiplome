# Deploy on Fly.io

Two Fly apps: **API** (`webdiplome-api`) and **website** (`webdiplome-web`).

## 1. Install CLI (once)

```bash
brew install flyctl
fly auth login
```

## 2. Deploy API

From the repo root:

```bash
cd /Users/brikeld/Documents/Repo/WebDiplome

# First time only — creates the app (say no to Postgres/Redis)
fly launch --no-deploy

# Set secrets (use YOUR app URL if you picked a different name)
fly secrets set \
  SUPABASE_URL="https://qjaoxjwtkikyefnumcvw.supabase.co" \
  SUPABASE_ANON_KEY="your-anon-key" \
  SUPABASE_SERVICE_ROLE_KEY="your-secret-key" \
  AI_WORKER_TOKEN="your-worker-token" \
  PUBLIC_BASE_URL="https://webdiplome-api.fly.dev"

fly deploy
```

Test: open `https://webdiplome-api.fly.dev/api/profiles` — expect `[]`.

## 3. Deploy website

If your API URL is not `https://webdiplome-api.fly.dev`, edit `fly.web.toml` → `[build.args]` first.

```bash
# First time only
fly launch --config fly.web.toml --no-deploy

npm run deploy:web
```

Your site: `https://webdiplome-web.fly.dev`

## 4. AI PC worker

On the dedicated AI computer (not Fly):

```bash
WEBDIPLOME_API_ORIGIN="https://webdiplome-api.fly.dev" \
AI_WORKER_TOKEN="same token as API secrets" \
LM_STUDIO_BASE_URL="http://127.0.0.1:1234" \
npm run worker:ai
```

## 5. Electron app

Build the DMG with the hosted API:

```bash
cd /Users/brikeld/Documents/Repo/Diplome_/testCreationAcc
WEBDIPLOME_API_ORIGIN="https://webdiplome-api.fly.dev" npm run make:demo
```

Upload the DMG to Supabase Storage bucket `app-releases` and add an `app_releases` row (see `public-demo.md`).
