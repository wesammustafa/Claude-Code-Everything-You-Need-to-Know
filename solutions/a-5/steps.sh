#!/bin/sh
# a-5: commit the hand-started report workflow, write the run list `gh run
# list --json` saves for its one run on that commit, then tear it down.
# The replay runs offline, so this record is the one that can't be real.
set -eu
mkdir -p .github/workflows
cp "$SOLUTION/.github/workflows/linkcheck-report.yml" .github/workflows/linkcheck-report.yml
git add .github/workflows/linkcheck-report.yml
git commit -q -m "Add a workflow that reports broken links"
sha=$(git rev-parse HEAD)
mkdir -p .practice
cat > .practice/a-5-runs.json <<JSON
[{"conclusion":"success","databaseId":1,"event":"workflow_dispatch","headSha":"$sha","status":"completed","workflowName":"Link check report"}]
JSON
git rm -q .github/workflows/linkcheck-report.yml
git commit -q -m "Remove the link check report workflow"
