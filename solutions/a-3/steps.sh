#!/bin/sh
# a-3: save the git grep pattern for the old path form, commit the test/
# migration with the workflow that ran it, then commit the audit workflow
# that reads its folder from args and has a second agent check each finding.
set -eu
mkdir -p .practice .claude/workflows
printf '%s\n' 'import\.meta\.url' > .practice/a-3-pattern.txt
cp "$SOLUTION/test/links.test.js" test/links.test.js
cp "$SOLUTION/.claude/workflows/migrate-paths.js" .claude/workflows/migrate-paths.js
git add test/links.test.js .claude/workflows/migrate-paths.js
git commit -q -m "Migrate test paths to import.meta.dirname"
cp "$SOLUTION/.claude/workflows/audit-dropped-errors.js" .claude/workflows/audit-dropped-errors.js
git add .claude/workflows/audit-dropped-errors.js
git commit -q -m "Add a workflow that audits dropped errors"
