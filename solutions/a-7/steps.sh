#!/bin/sh
# a-7: commit the bounded runner and the settings file that holds its
# bounds, then write the JSON a real run of one cleanup slice saves.
set -eu
mkdir -p scripts
cp "$SOLUTION/scripts/bounded-run.sh" scripts/bounded-run.sh
cp "$SOLUTION/.claude/bounded-run.json" .claude/bounded-run.json
chmod +x scripts/bounded-run.sh
git add scripts/bounded-run.sh .claude/bounded-run.json
git commit -q -m "Add a bounded runner for a cleanup slice"
mkdir -p .practice
printf '%s\n' '{"type":"result","subtype":"success","is_error":false,"result":"Added a test for slugify on an empty heading; npm test passes.","session_id":"00000000-0000-0000-0000-000000000000","num_turns":3,"total_cost_usd":0.12}' > .practice/a-7-slice.json
