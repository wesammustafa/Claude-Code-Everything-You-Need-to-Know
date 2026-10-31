---
name: changelog
description: Adds a one-line entry for the staged changes to CHANGELOG.md. Use when the user asks for a changelog entry.
model: haiku
effort: low
disable-model-invocation: true
---

Read the staged changes with `git diff --staged`. Add one list item (`- `) under `## Unreleased` in CHANGELOG.md that says what changed for someone using the tool, creating the file and the heading if they don't exist. Change no other file.
