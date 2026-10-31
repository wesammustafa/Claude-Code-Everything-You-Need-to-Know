# Brief: get linkcheck ready for a new teammate

**From:** the team lead

A new teammate starts Monday with only what's in git: commit a setup that works like ours. Each need says what goes wrong today; you choose how to solve it.

## What we need

1. **Team boundaries.** Claude must never read `.env` files. It may run `npm test` without asking, but a person approves a `git push` before it runs, even in auto mode. Shell commands run in the sandbox for everyone, not only for whoever ran `/sandbox`.
2. **`samples/` must not change.** The tests depend on the exact files there, including the link that's broken on purpose, and last week a session edited one. Claude's file-editing tools must not be able to change them, while Claude can still edit everything else. If the protection runs a script, a script that can't run must still block the edit.
3. **Memory that stays short.** Claude should know the npm scripts without anyone pasting them, and our testing conventions should load only when Claude works on the files under `test/`.
4. **A job we repeat.** We keep asking Claude to run the link checker on a folder and explain each broken link. Anyone should be able to start it by name, and Claude should pick it up on its own when someone asks to check links.
5. **A second opinion that can't change anything.** Before we commit, we want each change reviewed by something that can only read the code.
6. **The docs in a browser.** Claude should open the docs in a browser through Chrome DevTools MCP, which we reviewed at one version. Everyone runs that version, and nothing leaves our machines that doesn't need to: usage statistics, CrUX lookups and update checks stay off.
7. **One official plugin.** Everyone in the repository gets `claude-code-setup` from the official marketplace.

8. **A real bug, fixed with your setup.** Reproduce the malformed-percent crash in `capstone/intermediate-bug.md` with your link-check workflow, fix it while `samples/` stays protected, add a regression test, and have your reviewer review the fix before you commit the source fix and its regression test together. Log that review as the capstone page shows.

## Done when

- `npm test` passes and nothing is left uncommitted.
- `npm run check -- i-capstone` passes.
