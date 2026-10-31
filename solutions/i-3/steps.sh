#!/bin/sh
# i-3: commit the changelog skill on a smaller model at low effort, with the
# entry a /changelog run wrote.
set -eu
mkdir -p .claude/skills/changelog
cp "$SOLUTION/.claude/skills/changelog/SKILL.md" .claude/skills/changelog/SKILL.md
cp "$SOLUTION/CHANGELOG.md" CHANGELOG.md
git add .claude/skills/changelog/SKILL.md CHANGELOG.md
git commit -q -m "Write changelog entries on haiku at low effort"
