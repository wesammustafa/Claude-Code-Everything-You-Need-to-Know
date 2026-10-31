#!/bin/sh
# a-capstone: build the shared review in two worktrees (the review skill
# and script, and the team kit's new version), merge both, record a review
# run, commit the pull request workflow and its run record, tear the
# workflow down, and land the last bug fix with its test.
set -eu
# The worktrees go where `claude --worktree` makes them, as in lesson 1.
wt=.claude/worktrees
git worktree add -q -b worktree-review-script "$wt/review-script"
git worktree add -q -b worktree-team-kit "$wt/team-kit"
# Each worktree is a checkout of the whole copy, so project/ is inside it.
mkdir -p "$wt/review-script/project/.claude/skills/team-review"
cp "$SOLUTION/.claude/skills/team-review/SKILL.md" "$wt/review-script/project/.claude/skills/team-review/SKILL.md"
cp "$SOLUTION/scripts/review-staged.sh" "$wt/review-script/project/scripts/review-staged.sh"
git -C "$wt/review-script" add project/.claude/skills/team-review/SKILL.md project/scripts/review-staged.sh
git -C "$wt/review-script" commit -q -m "Run the team review skill from the review script"
kit=team-marketplace/plugins/team-kit/.claude-plugin/plugin.json
cp "$SOLUTION/$kit" "$wt/team-kit/project/$kit"
git -C "$wt/team-kit" add "project/$kit"
git -C "$wt/team-kit" commit -q -m "Release version 0.2.0 of the team kit"
mkdir -p .practice
git worktree list --porcelain > .practice/a-capstone-worktrees.txt
git merge -q --no-edit worktree-review-script
git merge -q --no-edit worktree-team-kit
git worktree remove "$wt/review-script"
git worktree remove "$wt/team-kit"
printf '%s\n' '{"type":"result","subtype":"success","is_error":false,"result":"No issues found in the staged change.","session_id":"00000000-0000-0000-0000-000000000000","num_turns":2,"total_cost_usd":0.08}' > .practice/a-capstone-run.json
mkdir -p .github/workflows
cp "$SOLUTION/.github/workflows/claude-review.yml" .github/workflows/claude-review.yml
git add .github/workflows/claude-review.yml
git commit -q -m "Review pull requests with the team review skill"
printf '%s\n' '[{"conclusion":"success","databaseId":2,"event":"pull_request","status":"completed","workflowName":"Claude review"}]' > .practice/a-capstone-ci.json
git rm -q .github/workflows/claude-review.yml
git commit -q -m "Remove the pull request review workflow"
# The bug fix and its test land together, last.
cp "$SOLUTION/src/check-links.js" src/check-links.js
cp "$SOLUTION/test/check-links.test.js" test/check-links.test.js
git add src/check-links.js test/check-links.test.js
git commit -q -m "Ignore the query string in a link target"
