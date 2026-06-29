#!/usr/bin/env bash
#
# Migrate accounts + profiles + posts from an OLD Supabase project (Postgres)
# into a NEW one, over a DIRECT database connection (works even when the old
# project's HTTPS APIs are 402-restricted for egress).
#
# Uploaded Storage files (images) are NOT migrated — they are only reachable
# through the restricted Storage API. DB rows that reference them still move;
# the image bytes must be re-uploaded/regenerated later.
#
# Usage:
#   export OLD_DB_URL='postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:5432/postgres'
#   export NEW_DB_URL='postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:5432/postgres'
#   bash scripts/migrate-supabase.sh test     # connectivity check only
#   bash scripts/migrate-supabase.sh migrate   # full migration
#
set -euo pipefail

PG_BIN="${PG_BIN:-/opt/homebrew/opt/libpq/bin}"
PSQL="$PG_BIN/psql"
PG_DUMP="$PG_BIN/pg_dump"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_SQL="$ROOT_DIR/supabase/migrations/20260529_public_demo.sql"
DUMP_DIR="$ROOT_DIR/.migration-dump"
MODE="${1:-test}"

: "${OLD_DB_URL:?Set OLD_DB_URL to the OLD project's direct connection string}"
: "${NEW_DB_URL:?Set NEW_DB_URL to the NEW project's direct connection string}"

count() { # $1 = db url, $2 = sql -> prints a single number (or ERR)
  "$PSQL" "$1" -tAc "$2" 2>/dev/null || echo "ERR"
}

banner() { printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }

test_conn() {
  banner "Connectivity"
  echo "OLD auth.users:   $(count "$OLD_DB_URL" 'select count(*) from auth.users;')"
  echo "OLD profiles:     $(count "$OLD_DB_URL" 'select count(*) from public.profiles;')"
  echo "OLD posts:        $(count "$OLD_DB_URL" 'select count(*) from public.posts;')"
  echo "NEW auth.users:   $(count "$NEW_DB_URL" 'select count(*) from auth.users;')"
  echo "NEW profiles:     $(count "$NEW_DB_URL" "select count(*) from public.profiles;")"
  echo
  echo "If OLD shows ERR, the direct DB connection is also blocked — you'll need"
  echo "to lift the restriction (Pro for one cycle) to migrate. If it shows numbers,"
  echo "you're clear to run:  bash scripts/migrate-supabase.sh migrate"
}

migrate() {
  test_conn

  # Safety: refuse to clobber a NEW project that already has data.
  local new_users new_profiles
  new_users="$(count "$NEW_DB_URL" 'select count(*) from auth.users;')"
  new_profiles="$(count "$NEW_DB_URL" 'select count(*) from public.profiles;')"
  if [[ "$new_profiles" != "0" && "$new_profiles" != "ERR" ]]; then
    echo "ERROR: NEW project already has $new_profiles profiles. Aborting to avoid duplicates." >&2
    echo "If you intend to overwrite, truncate the NEW tables first, then re-run." >&2
    exit 1
  fi

  banner "1/4 Applying schema to NEW project"
  "$PSQL" "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA_SQL"

  mkdir -p "$DUMP_DIR"

  banner "2/4 Dumping data from OLD project"
  # auth.users only — enough to satisfy public FKs (logins not preserved).
  "$PG_DUMP" "$OLD_DB_URL" --data-only --no-owner --no-privileges \
    --table=auth.users -f "$DUMP_DIR/auth_users.sql"
  # all public app tables, in dependency order.
  "$PG_DUMP" "$OLD_DB_URL" --data-only --no-owner --no-privileges \
    --schema=public -f "$DUMP_DIR/public_data.sql"
  echo "Wrote $DUMP_DIR/auth_users.sql and $DUMP_DIR/public_data.sql"

  banner "3/4 Loading auth.users into NEW project"
  # session_replication_role=replica disables triggers + FK checks during load.
  { echo "SET session_replication_role = replica;"; cat "$DUMP_DIR/auth_users.sql"; } \
    | "$PSQL" "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f -

  banner "4/4 Loading public data into NEW project"
  { echo "SET session_replication_role = replica;"; cat "$DUMP_DIR/public_data.sql"; } \
    | "$PSQL" "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f -

  banner "Done — verification"
  echo "NEW auth.users:   $(count "$NEW_DB_URL" 'select count(*) from auth.users;')"
  echo "NEW profiles:     $(count "$NEW_DB_URL" 'select count(*) from public.profiles;')"
  echo "NEW posts:        $(count "$NEW_DB_URL" 'select count(*) from public.posts;')"
  echo "NEW comments:     $(count "$NEW_DB_URL" 'select count(*) from public.comments;')"
  echo
  echo "Reminder: uploaded images were NOT migrated (Storage was 402-blocked)."
  echo "Update public.app_releases.download_url to your GitHub Release DMG if needed."
}

case "$MODE" in
  test) test_conn ;;
  migrate) migrate ;;
  *) echo "Usage: bash scripts/migrate-supabase.sh [test|migrate]" >&2; exit 2 ;;
esac
