#!/usr/bin/env bash
# Runs one bounded `claude -p` session on a task and saves its JSON result.
#   scripts/bounded-run.sh "<task>" <result.json>
# The bounds are in .claude/bounded-run.json: narrow allow rules, no git
# commit or push, and a strict sandbox the run refuses to start without.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 \"<task>\" <result.json>" >&2
  exit 2
fi

mkdir -p "$(dirname "$2")"
claude -p "$1" \
  --output-format json \
  --permission-mode dontAsk \
  --strict-mcp-config \
  --settings .claude/bounded-run.json \
  --max-turns 8 \
  --max-budget-usd 2 > "$2"
