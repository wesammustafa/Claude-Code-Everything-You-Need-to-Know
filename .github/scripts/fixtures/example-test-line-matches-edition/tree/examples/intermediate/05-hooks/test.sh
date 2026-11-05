#!/bin/sh
fail() { echo "FAIL: $1"; exit 1; }
head -n 5 dot-claude/hooks/protect-files.sh | grep -q '^# Not yet tested\|^# Tested in Claude Code' || fail "protect-files.sh: no test line in its header"
