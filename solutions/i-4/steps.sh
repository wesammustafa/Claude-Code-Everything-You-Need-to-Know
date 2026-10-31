#!/bin/sh
# i-4: commit the team's permission rules, with an ask rule before a push and
# the sandbox on, in the shared settings file.
set -eu
mkdir -p .claude
cp "$SOLUTION/.claude/settings.json" .claude/settings.json
git add .claude/settings.json
git commit -q -m "Share the team's permission rules and turn the sandbox on"
