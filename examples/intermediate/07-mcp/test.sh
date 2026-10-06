#!/usr/bin/env bash
# Smoke test for the lesson 7 MCP config, without Claude and without starting
# the server: dot-mcp.json parses, pins chrome-devtools-mcp to an exact
# version, and keeps its outbound data flows off: usage statistics and CrUX
# lookups (Google) and update checks (npm).
# Run: bash test.sh (needs bash and jq).
set -euo pipefail
cd "$(dirname "$0")"

fail() { echo "FAIL: $*" >&2; exit 1; }
server='.mcpServers["chrome-devtools"]'

jq -e . dot-mcp.json > /dev/null || fail "dot-mcp.json is not valid JSON"
[ "$(jq -r "$server.command" dot-mcp.json)" = npx ] || fail "the server does not run through npx"
pin=$(jq -r "$server.args[] | select(startswith(\"chrome-devtools-mcp@\"))" dot-mcp.json)
[[ "$pin" =~ ^chrome-devtools-mcp@[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "the package is not pinned to an exact version: ${pin:-none}"
for flag in --no-usage-statistics --no-performance-crux --isolated; do
  jq -e --arg f "$flag" "$server.args | index(\$f)" dot-mcp.json > /dev/null || fail "missing $flag"
done
[ "$(jq -r "$server.env.CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS" dot-mcp.json)" = 1 ] || fail "update checks are not turned off"

echo "PASS: lesson 7 MCP config"
