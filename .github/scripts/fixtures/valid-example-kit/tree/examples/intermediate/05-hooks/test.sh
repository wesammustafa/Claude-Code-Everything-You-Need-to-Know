#!/usr/bin/env bash
# Smoke test: pipe sample input to the hook and check its exit code.
set -u
cd "$(dirname "$0")" || exit 1
echo "{\"tool_input\":{\"file_path\":\"$PWD/.env\"}}" | bash protect-files.sh 2>/dev/null
[ $? -eq 2 ] || { echo "expected exit 2" >&2; exit 1; }
echo ok
