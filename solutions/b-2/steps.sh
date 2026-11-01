#!/bin/sh
# b-2: snapshot git's status while the plan is on screen, save the plan,
# make the planned change, snapshot again and commit.
set -eu
mkdir -p .practice
git status --porcelain > .practice/b-2-before.txt
printf '%s\n' src/config.js test/config.test.js > .practice/b-2-plan.txt
cp "$SOLUTION/src/config.js" src/config.js
cp "$SOLUTION/test/config.test.js" test/config.test.js
git status --porcelain > .practice/b-2-after.txt
git add src/config.js test/config.test.js
git commit -q -m "Reject an empty linkcheck.json and unknown keys"
