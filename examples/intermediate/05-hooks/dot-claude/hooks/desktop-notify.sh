#!/usr/bin/env bash
# desktop-notify.sh: shows a desktop notification for every Claude Code
# notification, for example when a permission prompt has waited, or a minute
# after Claude finished if you haven't typed since.
# Runs: Notification, every notification type (empty matcher), from your
# user settings, ~/.claude/settings.json: see this example's README.
# Side effects: one notification on this computer. Nothing is logged or sent
# anywhere else. On macOS it uses osascript; on Linux, notify-send if it is
# installed; anywhere else it asks Claude Code to ring the terminal bell.
# Requires: bash and jq. Platforms: macOS, Linux, WSL2.
# Remove: delete its Notification entry from ~/.claude/settings.json, then this file.
# Tested in Claude Code v2.1.285 (stable) on macOS, 2026-10-06
set -u

input=$(cat)
title=$(jq -r '.title // "Claude Code"' <<<"$input")
message=$(jq -r '.message // "Claude Code needs your attention"' <<<"$input")

if command -v osascript > /dev/null 2>&1; then
  # The text goes in as arguments, so quotes in a message can't break the script.
  osascript -e 'on run argv' -e 'display notification (item 2 of argv) with title (item 1 of argv)' -e 'end run' \
    "$title" "$message" > /dev/null 2>&1 || true
elif command -v notify-send > /dev/null 2>&1; then
  notify-send "$title" "$message" > /dev/null 2>&1 || true
else
  # A hook has no terminal of its own, so it returns the bell for Claude Code to write.
  jq -nc '{terminalSequence: "\u0007"}'
fi
exit 0
