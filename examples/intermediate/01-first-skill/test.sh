#!/usr/bin/env bash
# Smoke test for the lesson 1 skills, without Claude: each SKILL.md opens with
# frontmatter that names the skill after its folder and has a description,
# five-whys takes the problem as its argument, and tdd is still the
# unfinished file lesson 1's Your turn asks you to finish.
# Run: bash test.sh (needs bash and awk). Exits non-zero on the first failure.
set -euo pipefail
cd "$(dirname "$0")"

fail() { echo "FAIL: $*" >&2; exit 1; }

# The frontmatter block: the lines between the opening --- on line 1 and the next ---.
frontmatter() { awk 'NR == 1 { if ($0 != "---") exit 1; next } /^---$/ { exit } { print }' "$1"; }
field() { frontmatter "$1" | awk -v key="$2" 'index($0, key ": ") == 1 { print substr($0, length(key) + 3) }'; }

for dir in dot-claude/skills/*/; do
  skill="$dir/SKILL.md"
  name=$(basename "$dir")
  [ -f "$skill" ] || fail "$name has no SKILL.md"
  frontmatter "$skill" > /dev/null || fail "$skill does not start with ---"
  [ "$(field "$skill" name)" = "$name" ] || fail "$skill: name is not $name"
  [ -n "$(field "$skill" description)" ] || fail "$skill: no description"
  frontmatter "$skill" | grep -q '^# Not yet tested\|^# Tested in Claude Code' || fail "$skill: no test line in its header"
done

grep -qF "\$ARGUMENTS" dot-claude/skills/five-whys/SKILL.md || fail "five-whys does not use \$ARGUMENTS"
[ "$(field dot-claude/skills/five-whys/SKILL.md disable-model-invocation)" = "" ] || fail "five-whys must load on its own"
[ "$(field dot-claude/skills/tdd/SKILL.md disable-model-invocation)" = "true" ] || fail "tdd should start as run-by-name only"
grep -q 'TODO' dot-claude/skills/tdd/SKILL.md || fail "tdd should still have its TODOs"

echo "PASS: lesson 1 skills"
