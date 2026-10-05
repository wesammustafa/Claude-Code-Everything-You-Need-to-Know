#!/usr/bin/env bash
# Opens the tracking issue with this exact title, or updates the open one, so
# a scheduled check never piles up duplicates and never opens a pull request.
#
#   tracking-issue.sh "<title>" <check-output-file>
#
# Needs gh and jq, with GH_TOKEN allowed to write issues. RUN_URL, when set,
# links the run that found the problem.
set -euo pipefail

title=$1
output=$2
body=$(mktemp)
{
  echo "A scheduled check found problems${RUN_URL:+ in [this run]($RUN_URL)}. The issue is updated in place while it stays open."
  echo
  echo '```text'
  cat "$output"
  echo '```'
} > "$body"

number=$(gh issue list --state open --limit 200 --json number,title \
  | jq -r --arg t "$title" '[.[] | select(.title == $t) | .number] | first // empty')
if [ -n "$number" ]; then
  gh issue edit "$number" --body-file "$body"
  gh issue comment "$number" --body "Still failing${RUN_URL:+ in [this run]($RUN_URL)}."
else
  gh issue create --title "$title" --body-file "$body"
fi
