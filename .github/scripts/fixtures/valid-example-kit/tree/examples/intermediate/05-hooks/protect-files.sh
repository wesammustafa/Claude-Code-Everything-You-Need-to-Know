#!/usr/bin/env bash
# Blocks edits to .env files. Reads the PreToolUse JSON on stdin.
set -euo pipefail
path=$(jq -r ".tool_input.file_path // empty")
case "$path" in
  */.env|*/.env.*) echo "Blocked: $path" >&2; exit 2 ;;
esac
exit 0
