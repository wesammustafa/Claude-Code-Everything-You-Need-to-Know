#!/bin/sh
# a-4: commit the script that reviews the staged change with one read-only
# `claude -p` run, then write the JSON a real run of it saves.
set -eu
mkdir -p scripts
cp "$SOLUTION/scripts/review-staged.sh" scripts/review-staged.sh
chmod +x scripts/review-staged.sh
git add scripts/review-staged.sh
git commit -q -m "Add a script that reviews staged changes"
mkdir -p .practice
printf '%s\n' '{"type":"result","subtype":"success","is_error":false,"result":"No issues found in the staged change.","session_id":"00000000-0000-0000-0000-000000000000","num_turns":2,"total_cost_usd":0.05}' > .practice/a-4-result.json
