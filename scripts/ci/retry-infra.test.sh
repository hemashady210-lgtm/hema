#!/usr/bin/env bash
# Tests for retry-infra.sh (run in the CI `checks` job): retries once on infrastructure
# failures only, runs the cleanup between attempts, and passes real failures straight through.
set -uo pipefail
cd "$(dirname "$0")"
export RETRY_INFRA_DELAY=0
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fails=0

check() { # name expected-status actual-status expected-runs actual-runs
  if [[ "$2" == "$3" && "$4" == "$5" ]]; then
    echo "ok   $1"
  else
    echo "FAIL $1 (status $3, expected $2; runs $5, expected $4)"
    fails=$((fails + 1))
  fi
}

# A fake step: counts its runs in $tmp/runs; fails with $1 (exit $2) until run $3 succeeds.
cat >"$tmp/step.sh" <<'EOF'
#!/usr/bin/env bash
n=$(($(cat "$TMP/runs" 2>/dev/null || echo 0) + 1)); echo "$n" >"$TMP/runs"
if ((n < $3)); then echo "$1"; exit "$2"; fi
echo "started"
EOF
chmod +x "$tmp/step.sh"
export TMP="$tmp"
runs() { cat "$tmp/runs"; }
reset() { rm -f "$tmp/runs" "$tmp/cleaned"; }

reset
./retry-infra.sh -- "$tmp/step.sh" '' 1 1 >/dev/null
check 'success runs once' 0 $? 1 "$(runs)"

reset
./retry-infra.sh --cleanup "touch $tmp/cleaned" -- "$tmp/step.sh" \
  'failed to bind host port 0.0.0.0:54322/tcp: address already in use' 1 2 >/dev/null
check 'port collision is retried once and recovers' 0 $? 2 "$(runs)"
[[ -f "$tmp/cleaned" ]] && echo 'ok   cleanup ran between attempts' ||
  { echo 'FAIL cleanup did not run'; fails=$((fails + 1)); }

reset
./retry-infra.sh -- "$tmp/step.sh" 'Error response from daemon: toomanyrequests' 7 9 >/dev/null
check 'a second infrastructure failure is not retried again' 7 $? 2 "$(runs)"

reset
./retry-infra.sh --cleanup "touch $tmp/cleaned" -- "$tmp/step.sh" \
  'ERROR: syntax error at or near "selec" (SQLSTATE 42601)' 3 2 >/dev/null
check 'a real failure (bad migration) fails at once with its own code' 3 $? 1 "$(runs)"
[[ ! -f "$tmp/cleaned" ]] && echo 'ok   no cleanup for real failures' ||
  { echo 'FAIL cleanup ran for a real failure'; fails=$((fails + 1)); }

((fails == 0)) && echo 'all passed' || exit 1
