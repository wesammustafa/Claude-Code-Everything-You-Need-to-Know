#!/bin/sh
# i-2: commit two rules scoped with paths:, save the lesson's hook file, and
# write the load log its InstructionsLoaded hook writes when a session imports
# package.json and reads a file the CLI rule covers.
set -eu
mkdir -p .claude/rules
cp "$SOLUTION/.claude/rules/cli.md" "$SOLUTION/.claude/rules/testing.md" .claude/rules/
git add .claude/rules/cli.md .claude/rules/testing.md
git commit -q -m "Scope the CLI and testing rules to the files they cover"
mkdir -p .practice
cp "$SOLUTION/.practice/i-2-hook.json" .practice/i-2-hook.json
here=$(pwd -P)
printf 'session_start\t%s/CLAUDE.md\ninclude\t%s/package.json\npath_glob_match\t%s/.claude/rules/cli.md\n' "$here" "$here" "$here" > .practice/i-2-loaded.txt
