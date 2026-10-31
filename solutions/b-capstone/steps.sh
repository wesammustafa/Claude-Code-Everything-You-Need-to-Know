#!/bin/sh
# b-capstone: snapshot before the plan, save the plan, fix the missing-folder
# bug with its regression test in one commit, and save that commit.
set -eu
mkdir -p .practice
git status --porcelain > .practice/capstone-before.txt
printf '%s\n' src/check-links.js src/cli.js test/links.test.js > .practice/capstone-plan.txt
cp "$SOLUTION/src/check-links.js" "$SOLUTION/src/cli.js" src/
cp "$SOLUTION/test/links.test.js" test/links.test.js
git add src/check-links.js src/cli.js test/links.test.js
git commit -q -m "Report a missing folder in linkcheck.json"
git rev-parse HEAD > .practice/capstone-commit.txt
