#!/bin/sh
# i-6: commit the read-only test-gaps subagent, save the lesson's hook file,
# and write the log its SubagentStart hook writes when Claude delegates.
set -eu
mkdir -p .claude/agents
cp "$SOLUTION/.claude/agents/test-gaps.md" .claude/agents/test-gaps.md
git add .claude/agents/test-gaps.md
git commit -q -m "Add a read-only subagent that finds untested functions"
mkdir -p .practice
cp "$SOLUTION/.practice/i-6-hook.json" .practice/i-6-hook.json
printf '%s\n' test-gaps > .practice/i-6-agents.txt
