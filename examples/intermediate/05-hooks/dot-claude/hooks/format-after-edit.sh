#!/usr/bin/env bash
# format-after-edit.sh: tidies a file right after Claude edits or writes it.
# It removes spaces and tabs at the ends of lines and leaves exactly one
# newline at the end of the file, keeping Windows line endings if the file
# has them.
# Runs: PostToolUse, matcher Edit|Write (see settings.snippet.json).
# Side effects: rewrites the edited file in place, only when that changes it.
# It changes only source files with an extension listed below, such as .js,
# .py or .sh, so Markdown (where two trailing spaces are a line break),
# patches, snapshots and data files stay as they are. It also skips binary
# files and files outside the project. It never blocks: it always exits 0.
# Requires: bash, jq and python3. Platforms: macOS, Linux, WSL2.
# Remove: delete its PostToolUse entry from .claude/settings.json, then this file.
# Tested in Claude Code v2.1.285 (stable) on macOS, 2026-10-06
set -u

file=$(jq -r '.tool_input.file_path // empty')
project=${CLAUDE_PROJECT_DIR:-$PWD}

[ -n "$file" ] && [ -f "$file" ] || exit 0
case "$file" in
  "$project"/*) ;;
  *) exit 0 ;;
esac
case "$file" in
  *.js | *.mjs | *.cjs | *.jsx | *.ts | *.tsx | *.py | *.rb | *.go | *.rs | \
  *.java | *.kt | *.c | *.h | *.cpp | *.hpp | *.cs | *.php | *.sh | *.css | *.scss) ;;
  *) exit 0 ;;
esac

python3 - "$file" <<'PY' || true
import re, sys

path = sys.argv[1]
with open(path, "rb") as f:
    data = f.read()
if not data or b"\0" in data:
    sys.exit(0)
try:
    text = data.decode("utf-8")
except UnicodeDecodeError:
    sys.exit(0)

newline = "\r\n" if "\r\n" in text else "\n"
tidy = re.sub(r"[ \t]+(?=\r?$)", "", text, flags=re.M).rstrip("\r\n") + newline
if tidy != text:
    with open(path, "wb") as f:
        f.write(tidy.encode("utf-8"))
PY
exit 0
