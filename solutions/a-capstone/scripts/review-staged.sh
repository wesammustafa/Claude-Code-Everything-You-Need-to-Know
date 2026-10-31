#!/usr/bin/env bash
# Reviews the staged change with one read-only `claude -p` run.
#   scripts/review-staged.sh [result.json]
# Saves the run's JSON to the path given, or to .practice/a-4-result.json,
# prints the review, and exits non-zero when nothing is staged or the run fails.
set -uo pipefail

out="${1:-.practice/a-4-result.json}"

if git diff --cached --quiet; then
  echo "Nothing is staged: stage a change with git add, then run this again." >&2
  exit 1
fi

mkdir -p "$(dirname "$out")"
if ! git diff --cached | claude -p "/team-review the staged diff on stdin" \
  --output-format json \
  --permission-mode dontAsk \
  --allowedTools "Read,Grep,Glob" \
  --tools "Read,Grep,Glob" \
  --settings '{"disableAllHooks": true}' \
  --strict-mcp-config \
  --max-turns 5 \
  --max-budget-usd 0.50 > "$out"; then
  echo "claude -p failed; see $out" >&2
  exit 1
fi

jq -r '.result' "$out"
if [ "$(jq -r '.is_error' "$out")" != "false" ]; then
  echo "The review run reported an error." >&2
  exit 1
fi
