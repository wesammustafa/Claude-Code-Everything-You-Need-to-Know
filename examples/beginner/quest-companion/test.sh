#!/usr/bin/env bash
# Smoke test for the quest companion skill, without Claude: SKILL.md opens
# with frontmatter that names the skill after its folder, has a description
# and a test line, runs by name only, takes the question as its argument, and
# reads only the app's own files.
# Run: bash test.sh (needs bash and awk). Exits non-zero on the first failure.
set -euo pipefail
cd "$(dirname "$0")"

fail() { echo "FAIL: $*" >&2; exit 1; }

frontmatter() { awk 'NR == 1 { if ($0 != "---") exit 1; next } /^---$/ { exit } { print }' "$1"; }
field() { frontmatter "$1" | awk -v key="$2" 'index($0, key ": ") == 1 { print substr($0, length(key) + 3) }'; }

skill=dot-claude/skills/quest/SKILL.md
[ -f "$skill" ] || fail "quest has no SKILL.md"
frontmatter "$skill" > /dev/null || fail "$skill does not start with ---"
[ "$(field "$skill" name)" = "quest" ] || fail "$skill: name is not quest"
[ -n "$(field "$skill" description)" ] || fail "$skill: no description"
frontmatter "$skill" | grep -q '^# Not yet tested\|^# Tested in Claude Code' || fail "$skill: no test line in its header"
[ "$(field "$skill" disable-model-invocation)" = "true" ] || fail "quest should run by name only"
grep -qF "\$ARGUMENTS" "$skill" || fail "quest does not use \$ARGUMENTS"
grep -qF ".practice/learn.json" "$skill" || fail "quest should read the app's saved progress"
grep -qF "learn/course.json" "$skill" || fail "quest should read the app's course"
grep -qF "Change no files" "$skill" || fail "quest should change no files"

echo "PASS: quest companion skill"
