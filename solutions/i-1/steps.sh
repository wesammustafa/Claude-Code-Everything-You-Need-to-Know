#!/bin/sh
# i-1: commit the downloaded five-whys skill and the finished tdd skill, then
# the reviewed test and code a /tdd run wrote, in one commit, and save that commit.
set -eu
mkdir -p .claude/skills/five-whys .claude/skills/tdd
cp "$SOLUTION/.claude/skills/five-whys/SKILL.md" .claude/skills/five-whys/SKILL.md
cp "$SOLUTION/.claude/skills/tdd/SKILL.md" .claude/skills/tdd/SKILL.md
git add .claude/skills/five-whys .claude/skills/tdd
git commit -q -m "Add project skills"
cp "$SOLUTION/src/slug.js" src/slug.js
cp "$SOLUTION/test/slug.test.js" test/slug.test.js
git add src/slug.js test/slug.test.js
git commit -q -m "Turn a Markdown heading into its anchor"
mkdir -p .practice
git rev-parse HEAD > .practice/i-1-commit.txt
