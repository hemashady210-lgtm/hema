#!/usr/bin/env bash
# Runs a CI setup step and retries it ONCE when — and only when — it failed for an
# infrastructure reason: a host port already taken, an image pull or registry error, or a
# network timeout. Anything else (a bad migration, a failing test, a typo) fails right away
# with the step's own exit code, so real failures are never hidden behind a retry.
#
#   scripts/ci/retry-infra.sh [--cleanup '<command>'] -- <command> [args...]
#
# --cleanup runs between the two attempts (e.g. 'supabase stop --no-backup' to remove the
# half-started stack). Only use this for setup steps; never wrap test steps.
set -uo pipefail

cleanup=''
if [[ "${1:-}" == '--cleanup' ]]; then
  cleanup="${2:?--cleanup needs a command}"
  shift 2
fi
[[ "${1:-}" == '--' ]] && shift
(($# > 0)) || {
  echo 'usage: retry-infra.sh [--cleanup <command>] -- <command> [args...]' >&2
  exit 2
}

# Docker / registry / network failures seen on hosted runners. Matched case-insensitively.
INFRA_PATTERN='address already in use|failed to bind host port|port is already allocated|error pulling image|toomanyrequests|TLS handshake timeout|i/o timeout|connection reset by peer|context deadline exceeded|Temporary failure in name resolution|Temporary failure resolving|net/http: request canceled|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up'
RETRY_DELAY="${RETRY_INFRA_DELAY:-10}"

log="$(mktemp)"
trap 'rm -f "$log"' EXIT

for attempt in 1 2; do
  "$@" 2>&1 | tee "$log"
  status="${PIPESTATUS[0]}"
  ((status == 0)) && exit 0
  if ((attempt == 1)) && grep -Eqi -- "$INFRA_PATTERN" "$log"; then
    echo "::warning::Infrastructure failure (exit $status) in: $*. Cleaning up and retrying once."
    if [[ -n "$cleanup" ]]; then bash -c "$cleanup" || true; fi
    sleep "$RETRY_DELAY"
    continue
  fi
  exit "$status"
done
