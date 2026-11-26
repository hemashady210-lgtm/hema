#!/usr/bin/env bash
# Fast local loop when the Supabase CLI / Docker is unavailable:
# recreate a scratch database on a plain Postgres (pgvector + pgTAP installed), load the
# Supabase stub (scripts/db/local-stub.sql), apply every migration in order (each in one
# transaction), load supabase/seed.sql, then run the pgTAP suites with pg_prove.
#
# This is an approximation (see the stub header). Authoritative runs: the Supabase dev
# project (`node scripts/db/supabase-remote.mjs test`) and CI on the Supabase local stack.
#
# Usage: scripts/db/test-local.sh [test files...]   (connection via the usual PG* env vars)
set -euo pipefail

cd "$(dirname "$0")/../.."
DB="${AICRM_LOCAL_DB:-aicrm_local}"

dropdb --if-exists "$DB"
createdb "$DB"
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db/local-stub.sql

for f in supabase/migrations/*.sql; do
  psql -X -q -v ON_ERROR_STOP=1 --single-transaction -d "$DB" -f "$f" >/dev/null
done
echo "migrations applied: $(ls supabase/migrations/*.sql | wc -l)"
# Like the CLI (db.seed), load local demo data before the suites run.
psql -X -q -v ON_ERROR_STOP=1 --single-transaction -d "$DB" -f supabase/seed.sql >/dev/null
echo "seed applied"

if [ "$#" -gt 0 ]; then
  pg_prove -d "$DB" "$@"
else
  pg_prove -d "$DB" supabase/tests/database/*.test.sql
fi
