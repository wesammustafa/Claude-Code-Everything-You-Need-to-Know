#!/usr/bin/env bash
# Smoke test for the agent teams Elective's reviewer subagents, without Claude:
# each file opens with frontmatter that has the name and description Claude Code
# requires, with the name matching its file name, and a header test line; its single-line
# tools list leaves out Edit, Write, NotebookEdit, Bash, PowerShell and
# Monitor; and it sets no hooks, mcpServers or permissionMode.
# Run: bash test.sh (needs bash and awk). Reads files only.
set -euo pipefail
cd "$(dirname "$0")"

fail() { echo "FAIL: $*" >&2; exit 1; }
# The frontmatter block: the lines between the opening --- on line 1 and the next ---.
frontmatter() { awk 'NR == 1 { if ($0 != "---") exit 1; next } /^---$/ { exit } { print }' "$1"; }
field() { frontmatter "$1" | awk -v key="$2" 'index($0, key ": ") == 1 { print substr($0, length(key) + 3) }'; }
has_key() { frontmatter "$1" | grep -q "^$2:"; }

for name in security-reviewer test-reviewer; do
  [ -f "dot-claude/agents/$name.md" ] || fail "dot-claude/agents/$name.md is missing"
done

for agent in dot-claude/agents/*.md; do
  frontmatter "$agent" > /dev/null || fail "$agent does not start with ---"
  stem=$(basename "$agent" .md)
  name=$(field "$agent" name)
  [ -n "$name" ] || fail "$agent: no name, so Claude Code would skip it"
  [[ "$name" != *:* ]] || fail "$agent: a name with ':' is not loaded"
  [ "$name" = "$stem" ] || fail "$agent: name is $name, expected $stem"
  [ -n "$(field "$agent" description)" ] || fail "$agent: no description, so Claude Code would skip it"
  frontmatter "$agent" | grep -q '^# Not yet tested\|^# Tested in Claude Code' || fail "$agent: no test line in its header"
  tools=$(field "$agent" tools)
  [ -n "$tools" ] || fail "$agent: no single-line tools list, so it would inherit every tool"
  while read -r tool; do
    case "${tool%%(*}" in
      Edit | Write | NotebookEdit | Bash | PowerShell | Monitor) fail "$agent can use $tool" ;;
    esac
  done < <(tr ',' '\n' <<<"$tools")
  for key in hooks mcpServers permissionMode; do
    ! has_key "$agent" "$key" || fail "$agent sets $key; the reviewers stay read-only with no extra setup"
  done
done

echo "PASS: agent teams reviewer subagents"
