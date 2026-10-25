---
# What: a project skill that builds a feature test-first. Unfinished on purpose: lesson 1's Your turn has you finish it.
# Runs: when you type /tdd <feature>. Once finished, also when Claude matches your request to the description.
# Side effects: Claude edits code and tests and runs your test command, under your session's permission settings. It doesn't commit: you review the diff and commit.
# Requires: Claude Code and a project with a test command. Platforms: any.
# Remove: delete .claude/skills/tdd/.
# Not yet tested in a session at this edition's version
name: tdd
description: TODO
disable-model-invocation: true
---

Build this test-first, one behavior at a time: $ARGUMENTS

1. Red: write one failing test for the next behavior. Run the tests and confirm that it fails, and fails for the reason you expect. Don't change code outside the tests in this step.
2. Green: TODO
3. Refactor: TODO

Repeat until the feature is done, then run the whole test suite and show the diff. Don't commit: the user reviews the diff and commits.
