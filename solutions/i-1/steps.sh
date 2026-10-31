#!/bin/sh
# i-1: commit the finished tdd skill, then the reviewed test and code a /tdd
# run wrote, in one commit, and save that commit.
set -eu
mkdir -p .claude/skills/tdd
cp "$SOLUTION/.claude/skills/tdd/SKILL.md" .claude/skills/tdd/SKILL.md
git add .claude/skills/tdd/SKILL.md
git commit -q -m "Add a tdd skill that stops at a reviewed diff"
cp "$SOLUTION/src/slug.js" src/slug.js
cp "$SOLUTION/test/slug.test.js" test/slug.test.js
git add src/slug.js test/slug.test.js
git commit -q -m "Turn a Markdown heading into its anchor"
mkdir -p .practice
git rev-parse HEAD > .practice/i-1-commit.txt
