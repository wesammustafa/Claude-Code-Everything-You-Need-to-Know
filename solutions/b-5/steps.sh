#!/bin/sh
# b-5: commit the project CLAUDE.md and an ignore rule for CLAUDE.local.md,
# which stays uncommitted, then commit a new source file that follows the rule.
set -eu
cp "$SOLUTION/CLAUDE.md" "$SOLUTION/CLAUDE.local.md" .
printf '%s\n' CLAUDE.local.md >> .gitignore
git add CLAUDE.md .gitignore
git commit -q -m "Add project instructions for Claude Code"
cp "$SOLUTION/src/stats.js" src/stats.js
cp "$SOLUTION/test/stats.test.js" test/stats.test.js
git add src/stats.js test/stats.test.js
git commit -q -m "Count the links in a page"
