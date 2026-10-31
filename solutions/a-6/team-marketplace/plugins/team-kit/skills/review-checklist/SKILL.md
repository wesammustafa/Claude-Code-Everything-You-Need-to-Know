---
name: review-checklist
description: The team's checklist for reviewing a change to linkcheck. Use before you commit or open a pull request.
---

Review the change against this checklist, and report each item that fails, with the file and line:

1. Every changed function in `src/` has a test in `test/` that fails without the change.
2. `npm test` passes.
3. No file under `samples/` changed, unless the change is about the samples.
4. Error messages start with `linkcheck:` and say what to do next.
