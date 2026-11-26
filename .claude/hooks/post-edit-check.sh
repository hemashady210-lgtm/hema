#!/usr/bin/env bash
# PostToolUse hook (Edit|Write|MultiEdit): lint the edited file and typecheck its workspace package.
# Exit 2 + stderr feeds problems back to Claude; exit 0 = nothing to report.
set -uo pipefail

input="$(cat)"
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')"
root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

[[ -z "$file" || ! -f "$file" ]] && exit 0
case "$file" in
  *.ts | *.tsx | *.mts | *.cts | *.js | *.jsx | *.mjs | *.cjs) ;;
  *) exit 0 ;;
esac
case "$file" in "$root"/*) ;; *) exit 0 ;; esac
case "$file" in */node_modules/* | */dist/* | "$root"/.claude/*) exit 0 ;; esac

if [[ ! -d "$root/node_modules" ]]; then
  echo "post-edit-check: node_modules missing — run 'pnpm install' to enable lint/typecheck hooks." >&2
  exit 0
fi

cd "$root" || exit 0
problems=""

# 1. ESLint on the edited file only.
if ! out="$(pnpm exec eslint --no-warn-ignored "$file" 2>&1)"; then
  problems+=$'ESLint:\n'"$out"$'\n'
fi

# 2. Typecheck the nearest workspace package that defines a "typecheck" script.
dir="$(dirname "$file")"
pkg=""
while [[ "$dir" != "$root" && "$dir" != "/" ]]; do
  if [[ -f "$dir/package.json" ]] && jq -e '.scripts.typecheck' "$dir/package.json" >/dev/null 2>&1; then
    pkg="$dir"
    break
  fi
  dir="$(dirname "$dir")"
done
if [[ -n "$pkg" ]]; then
  if ! out="$(cd "$pkg" && pnpm run --silent typecheck 2>&1)"; then
    problems+=$'Typecheck ('"${pkg#"$root"/}"$'):\n'"$out"$'\n'
  fi
fi

if [[ -n "$problems" ]]; then
  printf '%s' "$problems" | head -c 8000 >&2
  exit 2
fi
exit 0
