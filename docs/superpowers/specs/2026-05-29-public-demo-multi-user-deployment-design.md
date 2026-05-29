# Public Demo Multi-User Deployment Design

## Goal

Make WebDiplome and the Electron collector usable by multiple known demo users, with all profiles, posts, rankings, and generated content public. The system should be easy to update during the project and should not require an Apple Developer account.

## Demo Constraints

- Audience is a small group of people known by the project owner.
- Profiles, posts, comments, rankings, and leaderboards are public by default.
- The project may run only for a short demo period, so the design favors fast deployment and reversible choices over heavy production infrastructure.
- The dedicated AI computer is not the developer laptop. It runs the local model/LM Studio and a small worker process.
- LM Studio is never exposed directly to the public internet.
- Consent and acceptance screens live in `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc`.
- The macOS app is distributed without Apple Developer signing/notarization. Users may need to bypass Gatekeeper manually for the demo.

## Recommended Architecture

Use Supabase as the hosted system of record and keep the existing Node/Express servers as the project API layer.

```text
Electron app on user machine
  -> signs in / links account
  -> asks for consent before harvesting
  -> harvests local data
  -> uploads profile, posts, assets to hosted WebDiplome API

WebDiplome website
  -> reads public profiles, posts, rankings, comments from hosted API
  -> lets visitors browse public users
  -> lets signed-in users request new AI-generated content

Hosted WebDiplome API
  -> verifies user identity for writes
  -> stores data in Supabase Postgres
  -> stores images, documents, and DMG builds in Supabase Storage
  -> creates generation jobs for the AI worker

AI PC worker
  -> polls hosted API for queued jobs
  -> reads the job payload
  -> calls local LM Studio on the AI PC
  -> posts generated content back to hosted API
```

The AI PC makes outbound HTTPS requests to the hosted API. This avoids router port forwarding and avoids exposing the model server.

## Accounts and Public Visibility

Use Supabase Auth for demo accounts. Each real demo user has:

- `auth.users.id` from Supabase Auth
- one public profile row
- one linked demo device for the first implementation
- public posts
- public ranking entries

For the first demo, use email/password auth. In the staging/demo Supabase project, disable email confirmation to avoid deliverability problems during the critique session. The Electron app stores the session locally in its app data directory after sign-in. The website can also sign in with the same account, but public browsing does not require sign-in.

Public read policy:

- Anyone can read profiles, posts, rankings, comments, public assets, and app release metadata.
- Only the owning authenticated user can write their own profile/posts through the API.
- Only the AI worker can claim and complete generation jobs.

## Supabase Data Model

Initial tables:

- `profiles`
  - `id uuid primary key`
  - `user_id uuid references auth.users(id)`
  - `slug text unique`
  - `firstname text`
  - `lastname text`
  - `display_name text`
  - `machine_name text`
  - `global_score numeric`
  - `persona_scores jsonb`
  - `dominant_persona text`
  - `profile_summary text`
  - `wallpaper_url text`
  - `raw_profile jsonb`
  - `collected_at timestamptz`
  - `created_at timestamptz`
  - `updated_at timestamptz`

- `posts`
  - `id uuid primary key`
  - `profile_id uuid references profiles(id)`
  - `user_id uuid references auth.users(id)`
  - `persona text`
  - `content text`
  - `sentiment text`
  - `attached_asset jsonb`
  - `leaderboard jsonb`
  - `source text`
  - `created_at timestamptz`

- `assets`
  - `id uuid primary key`
  - `owner_user_id uuid references auth.users(id)`
  - `sha256 text`
  - `bucket text`
  - `path text`
  - `mime_type text`
  - `size_bytes bigint`
  - `created_at timestamptz`

- `comments`
  - `id uuid primary key`
  - `post_id uuid references posts(id)`
  - `author_profile_id uuid references profiles(id)`
  - `persona text`
  - `content text`
  - `created_at timestamptz`

- `generation_jobs`
  - `id uuid primary key`
  - `profile_id uuid references profiles(id)`
  - `user_id uuid references auth.users(id)`
  - `status text`
  - `request_payload jsonb`
  - `result_posts jsonb`
  - `error text`
  - `claimed_by text`
  - `claimed_at timestamptz`
  - `created_at timestamptz`
  - `completed_at timestamptz`

- `app_releases`
  - `id uuid primary key`
  - `platform text`
  - `version text`
  - `download_url text`
  - `size_label text`
  - `created_at timestamptz`

Optional later tables:

- `devices`
- `leaderboard_snapshots`
- `profile_events`
- `audit_logs`

## Storage Buckets

Use these buckets:

- `uploads-public`: public image/document assets attached to posts and profiles.
- `app-releases`: public DMG downloads.

Assets keep the current SHA-256 naming behavior. The hosted API computes hashes and reuses existing files when content already exists.

## Electron App Changes

All acceptance and consent UX belongs in `/Users/brikeld/Documents/Repo/Diplome_/testCreationAcc`.

Required flow:

1. First launch shows account screen.
2. User signs in or creates a demo account.
3. App shows a consent screen before any harvest.
4. Consent text explains:
   - the app analyzes local computer data
   - selected profile data, scores, generated posts, and attached assets are uploaded
   - all demo profiles and posts are public
   - the user can ask the project owner to delete their data during the demo
5. User accepts.
6. App runs the collector.
7. App syncs to hosted WebDiplome API instead of `localhost:3001`.

Do not block local development. Keep env/config support:

- local API: `http://localhost:3001`
- staging API: configured by `WEBDIPLOME_API_ORIGIN`
- production API: configured by `WEBDIPLOME_API_ORIGIN`

The Electron app should store:

- Supabase session
- accepted consent version
- selected API environment

## No Apple Developer Account Distribution

For this demo, build an unsigned DMG with Electron Forge.

Expected user experience:

- The DMG downloads from the WebDiplome landing page.
- macOS may show a warning because the app is unsigned/not notarized.
- Known demo users can open it manually from Finder with Control-click/Open or the equivalent Privacy & Security approval.

The landing page can include a short download note outside the app. The formal consent/acceptance screen remains inside the Electron repo.

Auto-update is not required for the first demo because unsigned macOS auto-update is not reliable. Use a manual update loop:

1. Build new DMG.
2. Upload new DMG.
3. Update the `app_releases` row for the macOS build.
4. Landing page download button points to the newest DMG.
5. Demo users download the new build when told.

## Hosted API Changes

The existing WebDiplome Express servers should become one deployable API service sharing the Supabase database. For the first demo, a single Express API is simpler:

- profile/assets/public reads
- authenticated profile sync writes
- generation job creation
- AI worker job polling/completion
- comments and ranking endpoints

The local file-backed paths remain available only in local/dev mode until the Supabase path is stable.

Endpoints to add or replace:

- `GET /api/profiles`
- `GET /api/profiles/:slug`
- `POST /api/profile/sync`
- `POST /api/upload`
- `GET /api/posts`
- `GET /api/profiles/:slug/posts`
- `POST /api/comments`
- `GET /api/leaderboards`
- `POST /api/generation-jobs`
- `GET /api/worker/jobs/next`
- `POST /api/worker/jobs/:id/complete`
- `POST /api/worker/jobs/:id/fail`
- `GET /api/app-releases/latest?platform=mac`

## AI Worker on Dedicated PC

Create a small Node worker in `/Users/brikeld/Documents/Repo/WebDiplome/worker/` that can be copied/run on the AI PC.

The worker:

- reads `AI_WORKER_TOKEN`
- reads `WEBDIPLOME_API_ORIGIN`
- reads `LM_STUDIO_BASE_URL`
- polls the hosted API every few seconds
- claims one queued job at a time
- calls LM Studio locally
- posts generated posts back to the hosted API

The API authenticates the worker with a long random token stored as a server secret. The worker token is never committed.

## Replacing Mock Bots

Use real users everywhere possible.

Fallback rule:

```text
minimum_people_for_ui = 5
visible_people = real_public_profiles
if visible_people.length < minimum_people_for_ui:
  append demo_profiles until the UI has 5 people
```

Demo profiles must be marked as `source: "demo"` so the UI can later hide them when enough real users exist.

Apply this rule to:

- leaderboard rows
- profile browsing
- comment authors
- landing page public examples

AI-generated comment suggestions can stay, but posted comments should be associated with a real authenticated profile when possible.

## Website Changes

The WebDiplome landing page needs:

- DMG download button wired to the latest macOS release URL
- public user/profile entry points
- hosted API origins configured through environment variables

The app UI needs:

- public profile list route
- profile detail route by slug
- feed/rankings that are not tied to newest profile only
- real-user leaderboards using Supabase/API data
- demo fallback users when there are too few real users

## Deployment Workflow

Use staging first.

Staging:

- Supabase staging project
- hosted API staging service
- WebDiplome staging site
- AI worker pointed at staging API
- unsigned staging DMG

Production/demo:

- Supabase production project
- hosted API production service
- WebDiplome production site
- AI worker pointed at production API
- unsigned production DMG

Update workflow:

1. Change code locally.
2. Run local build/tests.
3. Deploy to staging.
4. Test with one or two known users.
5. Deploy production/demo.
6. Build and upload new DMG if Electron changed.

## Project Owner Setup Needed

Most code and configuration can be implemented in the repos, but these external resources require project-owner access:

- Supabase project creation.
- Supabase project URL, anon key, and service-role key.
- Hosted API provider account or deployment target.
- Website hosting account or deployment target.
- Supabase Storage access for the `app-releases` bucket.
- AI PC access to install Node dependencies, set environment variables, run LM Studio, and start the worker.

Secrets must not be committed. Store them in local `.env` files, hosted provider secrets, and the AI PC worker environment.

## Security and Privacy Boundaries

This is public-by-default, but still needs basic protection:

- require auth for writes
- require worker token for AI jobs
- never expose Supabase service role key to frontend or Electron renderer
- never expose LM Studio to the internet
- keep raw local harvest data out of public API responses unless intentionally displayed
- provide a manual deletion endpoint/tool for demo cleanup

## Acceptance Criteria

- Multiple real users can create accounts.
- Multiple real users can run the Electron app and sync profiles without overwriting each other.
- Website can show all public profiles.
- Any visitor can open another user's public profile, posts, and rankings.
- Rankings compare multiple real users.
- Mock/demo users appear only when there are too few real users to fill a UI.
- AI generation requested by a remote user runs on the dedicated AI PC through a queued worker flow.
- LM Studio is not public.
- DMG is downloadable from the WebDiplome landing page.
- DMG distribution does not require an Apple Developer account.
- Consent/acceptance UI is implemented in the Electron repo.
- Local dev mode still works for both repos.

## Non-Goals For First Demo

- Apple notarization/signing.
- Automatic app updates.
- Payments.
- Private profiles.
- Advanced moderation.
- Long-term analytics.
- Multi-worker AI scheduling.
