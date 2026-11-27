#!/usr/bin/env bash
# Serves the `api` Edge Function with the host's Deno against the local Supabase stack.
# Use when the CLI's edge-runtime container cannot download npm modules (e.g. behind a
# TLS-intercepting proxy, as in the cloud sandbox). CI and normal machines use the edge runtime
# started by `supabase start` (http://127.0.0.1:54321/functions/v1/api).
#   scripts/dev/serve-api.sh            → http://127.0.0.1:54399/api
set -euo pipefail
cd "$(dirname "$0")/../.."
eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)=')"
export SUPABASE_URL="$API_URL" SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" SUPABASE_SECRET_KEY="$SECRET_KEY"
export DENO_SERVE_ADDRESS="tcp:127.0.0.1:${API_PORT:-54399}"
exec deno run --config supabase/functions/api/deno.json --allow-net --allow-env --allow-read \
  supabase/functions/api/index.ts
