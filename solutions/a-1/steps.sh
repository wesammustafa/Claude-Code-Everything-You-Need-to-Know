#!/bin/sh
# a-1: ignore Claude Code's worktrees, make one change in each of two
# worktrees, save the listing while both exist, then merge both branches
# and remove the worktrees.
set -eu
# `claude --worktree` makes .claude/worktrees/ at the git root, the copy's
# root above project/, so the rule goes in the .gitignore there.
top=$(git rev-parse --show-toplevel)
printf '.claude/worktrees/\n' >> "$top/.gitignore"
git add :/.gitignore
git commit -q -m "Ignore Claude Code worktrees"
wt="$top/.claude/worktrees"
# Each worktree is a checkout of the whole copy, so project/ is inside it.
git worktree add -q -b worktree-docs-pass "$wt/docs-pass"
git worktree add -q -b worktree-test-pass "$wt/test-pass"
cp "$SOLUTION/src/cli.js" "$wt/docs-pass/project/src/cli.js"
git -C "$wt/docs-pass" add project/src/cli.js
git -C "$wt/docs-pass" commit -q -m "Document the exit codes in the usage comment"
cp "$SOLUTION/test/stats.test.js" "$wt/test-pass/project/test/stats.test.js"
git -C "$wt/test-pass" add project/test/stats.test.js
git -C "$wt/test-pass" commit -q -m "Test that a repeated link counts each time"
mkdir -p .practice
git worktree list --porcelain > .practice/a-1-worktrees.txt
git merge -q --no-edit worktree-docs-pass
git merge -q --no-edit worktree-test-pass
git worktree remove "$wt/docs-pass"
git worktree remove "$wt/test-pass"
