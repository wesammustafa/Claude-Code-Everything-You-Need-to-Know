#!/bin/sh
# i-capstone: commit the link-check skill, the read-only reviewer and a deny
# rule that keeps Claude's edits out of samples/, save the capstone's hook
# file, write the log of the reviewer's run, then commit the bug fix.
set -eu
mkdir -p .claude/skills/check-links .claude/agents
cp "$SOLUTION/.claude/skills/check-links/SKILL.md" .claude/skills/check-links/SKILL.md
cp "$SOLUTION/.claude/agents/reviewer.md" .claude/agents/reviewer.md
cp "$SOLUTION/.claude/settings.json" .claude/settings.json
git add .claude/skills/check-links/SKILL.md .claude/agents/reviewer.md .claude/settings.json
git commit -q -m "Ready the repository for a new teammate"
mkdir -p .practice
cp "$SOLUTION/.practice/i-capstone-hook.json" .practice/i-capstone-hook.json
printf '%s\n' reviewer > .practice/i-capstone-agents.txt
# After the review, the malformed-percent fix and its regression test land
# together, last.
cp "$SOLUTION/src/check-links.js" src/check-links.js
cp "$SOLUTION/test/check-links.test.js" test/check-links.test.js
git add src/check-links.js test/check-links.test.js
git commit -q -m "Report a malformed percent escape as a broken link"
