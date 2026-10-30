#!/bin/sh
# b-1: correct the onboarding note's exit-code claim and commit it.
# Runs in <copy>/project; $SOLUTION holds this lesson's files.
set -eu
cp "$SOLUTION/practice/b-1/onboarding.md" practice/b-1/onboarding.md
git add practice/b-1/onboarding.md
git commit -q -m "Correct the exit code in the onboarding note"
