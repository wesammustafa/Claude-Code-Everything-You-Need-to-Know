---
name: tdd
description: Builds a requested feature test-first, one behavior at a time, and stops at a diff for review. Use when the user asks for a new function or feature, or says test-first or TDD.
---

Build this test-first, one behavior at a time: $ARGUMENTS

1. Red: write one failing test for the next behavior. Run the tests and confirm that it fails, and fails for the reason you expect. Don't change code outside the tests in this step.
2. Green: write the least code that makes the new test pass, then run the whole test suite and confirm that every test passes. Don't change the tests in this step.
3. Refactor: improve the names and structure of the code you just wrote without changing what it does, and run the tests again. They must still pass.

Repeat until the feature is done, then run the whole test suite and show the diff. Don't commit: the user reviews the diff and commits.
