---
name: team-review
description: The team's review of a change to linkcheck, run the same way on a laptop and in CI. Use on a staged diff or a pull request.
---

Review the change you are given (a staged diff on stdin, or the pull request's diff) and change no file.

Report each finding as `file:line` and why, in this order:

1. A bug: a link that would be reported wrongly, or a crash on some input.
2. A changed function in `src/` without a test in `test/` that fails without the change.
3. An error message that doesn't start with `linkcheck:` or doesn't say what to do next.

If you find nothing, say so in one line.
