#!/bin/sh
# i-3: give five-whys its own high effort, then commit the changelog skill on a
# smaller model at low effort, with the entry a /changelog run wrote.
set -eu
skill=.claude/skills/five-whys/SKILL.md
awk 'NR == 1 && $0 == "---" { print; print "effort: high"; next } { print }' \
  "$skill" > "$skill.tmp"
mv "$skill.tmp" "$skill"
mkdir -p .claude/skills/changelog
cp "$SOLUTION/.claude/skills/changelog/SKILL.md" .claude/skills/changelog/SKILL.md
cp "$SOLUTION/CHANGELOG.md" CHANGELOG.md
git add "$skill" .claude/skills/changelog/SKILL.md CHANGELOG.md
git commit -q -m "Write changelog entries on haiku at low effort"
