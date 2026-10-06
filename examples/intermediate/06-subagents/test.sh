#!/usr/bin/env bash
# Smoke test for the lesson 6 subagent, without Claude: the file opens with
# frontmatter that has a name and a description, as Claude Code requires, and
# its tools list leaves out Edit, Write, NotebookEdit, Bash, PowerShell and Monitor.
# Run: bash test.sh (needs bash and awk).
set -euo pipefail
cd "$(dirname "$0")"

fail() { echo "FAIL: $*" >&2; exit 1; }
frontmatter() { awk 'NR == 1 { if ($0 != "---") exit 1; next } /^---$/ { exit } { print }' "$1"; }
field() { frontmatter "$1" | awk -v key="$2" 'index($0, key ": ") == 1 { print substr($0, length(key) + 3) }'; }

for agent in dot-claude/agents/*.md; do
  frontmatter "$agent" > /dev/null || fail "$agent does not start with ---"
  [ -n "$(field "$agent" name)" ] || fail "$agent: no name, so Claude Code would skip it"
  [ -n "$(field "$agent" description)" ] || fail "$agent: no description, so Claude Code would skip it"
  frontmatter "$agent" | grep -q '^# Not yet tested\|^# Tested in Claude Code' || fail "$agent: no test line in its header"
done

agent=dot-claude/agents/code-reviewer.md
[ "$(field "$agent" name)" = code-reviewer ] || fail "the reviewer is not named code-reviewer"
tools=$(field "$agent" tools)
[ -n "$tools" ] || fail "code-reviewer has no tools list, so it would inherit every tool"
for tool in $(tr ',' ' ' <<<"$tools"); do
  case "$tool" in
    Edit | Write | NotebookEdit | Bash | PowerShell | Monitor) fail "code-reviewer can use $tool" ;;
  esac
done

echo "PASS: lesson 6 subagent"
