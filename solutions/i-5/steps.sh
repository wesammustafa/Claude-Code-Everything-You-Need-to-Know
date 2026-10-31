#!/bin/sh
# i-5: commit the file guard as a fail-closed PreToolUse hook and the test
# gate as a Stop hook, both executable, with the settings that run them.
set -eu
mkdir -p .claude/hooks
cp "$SOLUTION/.claude/hooks/protect-files.sh" "$SOLUTION/.claude/hooks/test-gate.sh" .claude/hooks/
chmod +x .claude/hooks/protect-files.sh .claude/hooks/test-gate.sh
cp "$SOLUTION/.claude/settings.json" .claude/settings.json
git add .claude/hooks/protect-files.sh .claude/hooks/test-gate.sh .claude/settings.json
git commit -q -m "Guard protected files and gate stopping on the tests"
