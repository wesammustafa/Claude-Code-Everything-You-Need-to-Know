#!/bin/sh
# a-2: save the pattern chosen for each backlog job, and add the lines
# Intermediate lesson 6's SubagentStart hook logs when job 1 runs as
# parallel subagents. Nothing is committed.
set -eu
mkdir -p .practice
cp "$SOLUTION/.practice/a-2-choices.md" .practice/a-2-choices.md
printf 'general-purpose\ngeneral-purpose\nExplore\n' >> .practice/i-6-agents.txt
