#!/bin/bash
# protect-files.sh: blocks Claude's Edit and Write tools on protected files.
# This is the hooks guide's "Block edits to protected files" script, unchanged
# below this header. Lesson 5 shows where its substring match is too broad and
# has you fix it.
# Runs: PreToolUse, matcher Edit|Write (see settings.snippet.json).
# Side effects: none. Exit 2 blocks the tool call, and the stderr line goes to
# Claude as the reason. It sees only Edit and Write, not shell commands.
# Requires: bash and jq. Platforms: macOS, Linux, WSL2.
# Remove: delete its PreToolUse entry from .claude/settings.json, then this file.
# Tested in Claude Code v2.1.285 (stable) on macOS, 2026-10-06

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Normalize Windows backslash separators so the patterns below match
FILE_PATH="${FILE_PATH//\\//}"

PROTECTED_PATTERNS=(".env" "package-lock.json" ".git/")

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $FILE_PATH matches protected pattern '$pattern'" >&2
    exit 2
  fi
done

exit 0
