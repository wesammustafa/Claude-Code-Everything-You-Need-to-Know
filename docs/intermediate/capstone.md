# Intermediate capstone: get a repository ready for a new teammate

<sub>**Intermediate** · Capstone · 30 to 60 minutes · Needs: the eight [Intermediate lessons](README.md), or their skills · Verified against Claude Code v2.1.308 (stable) on 2026-10-25</sub>

A teammate starts Monday with only what's in git: commit a setup that works like the team's. This capstone has no worked example: the brief says what goes wrong today, and you choose the mechanism for each need. The [Intermediate Exit](README.md#by-the-end-of-this-level-you-can) is the list of what you can do by the end of this level. The check reads what you commit, and you tick the rest of the Exit yourself under [What the check can't see](#what-the-check-cant-see).

## You need

- Your copy of the practice template, with no uncommitted changes, and Node.js LTS. The capstone runs in the template copy only. If `git status --porcelain` lists files, commit them or set them aside with `git stash push --include-untracked`.
- `jq` and `python3` for hook scripts, and Chrome for the MCP server.
- macOS, Linux or WSL 2: the sandbox needs one of them ([Set up on Windows](https://code.claude.com/docs/en/setup#set-up-on-windows)), and the lessons' hook scripts are bash.
- Usage: moderate.

## The task

The brief is in `capstone/intermediate-brief.md` in your practice copy: set the repository up so the new teammate's Claude Code sessions work the way the team's do, and commit all of it. Each need below says what the team wants; pick the mechanism from what the level taught, and the check's hints point back to the lesson when an item fails.

1. **Team boundaries.** Claude must never read `.env` files. It may run `npm test` without asking, but a person approves a `git push` before it runs, even in auto mode. Shell commands run in the sandbox for everyone: `/sandbox` saves to your local file, which teammates don't get. On a machine where the sandbox can't start, such as native Windows, commands then run unsandboxed unless `sandbox.failIfUnavailable` is `true` ([sandbox.failIfUnavailable](https://code.claude.com/docs/en/settings-reference#sandbox-failifunavailable)).
2. **`samples/` must not change.** The tests depend on the exact files there, including the link that's broken on purpose, and last week a session edited one. Make sure Claude's file-editing tools can't change them, while Claude can still edit everything else. If your protection runs a script, it must block the edit when the script can't run.
3. **Memory that stays short.** Claude should know the npm scripts without anyone pasting them, and the testing conventions should load only when Claude works on the files under `test/`.
4. **A job we repeat.** We keep asking Claude to run the link checker on a folder and explain each broken link. Anyone should be able to start it by name, and Claude should pick it up on its own when someone asks to check links.
5. **A second opinion that can't change anything.** Before we commit, we want each change reviewed by something that can only read the code.
6. **The docs in a browser.** Claude should open the docs in a browser through Chrome DevTools MCP, which we reviewed at one version. Everyone runs that version, and nothing leaves our machines that doesn't need to: usage statistics, CrUX lookups and update checks stay off.
7. **One official plugin.** Everyone in the repository should get `claude-code-setup` from the official marketplace.
8. **A real bug, fixed with your setup.** Reproduce the malformed-percent bug in `capstone/intermediate-bug.md` with your link-check workflow: a link such as `[broken](bad%.md)` crashes the checker instead of producing its normal broken-link report. Fix it with Claude while your protection keeps `samples/` unchanged, and tell Claude not to commit until your reviewer has reviewed the fix: in auto mode, Claude Code blocks an action that goes against a boundary you state in the conversation ([Boundaries you state in conversation](https://code.claude.com/docs/en/permission-modes#boundaries-you-state-in-conversation)). Malformed percent escapes are broken links; valid percent-encoded paths must still resolve. Add a regression test that fails before the repair and passes after it. If your copy runs lesson 5's test gate, expect it to send Claude back to work when Claude stops while that test fails. Before you commit, have your reviewer review the fix in a session started with `claude --settings .practice/i-capstone-hook.json`, lesson 6's delegation log with its own log file:

   ```json
   {"hooks":{"SubagentStart":[{"hooks":[{
     "type":"command","command":"jq -r '.agent_type' >> \"$CLAUDE_PROJECT_DIR/.practice/i-capstone-agents.txt\""
   }]}]}}
   ```

   Then commit the source fix and its regression test together.

Then try each part in a session, and pick the model and effort for each job as [lesson 3](03-model-and-effort.md) showed. To see your `samples/` protection work, ask for the Edit tool by name and say it's a test, as in [lesson 5](05-hooks.md#worked-example): `Use your Edit tool, not a shell command, to add a blank line at the end of samples/guide.md. I'm testing whether my protection blocks it.` Claude can also change a file with a shell command, which an `Edit|Write` hook doesn't see ([Filter hooks with matchers](https://code.claude.com/docs/en/hooks-guide#filter-hooks-with-matchers)). If the edit goes through, restore the file with `git restore samples/` and fix your protection. Commit everything, and make sure `npm test` still passes.

## Check

You are done when all of these are true:

- [ ] A committed project skill runs the link checker by name and can load on its own.
- [ ] Claude's file-editing tools can't change `samples/`: a committed `Edit` deny rule covers the folder, or a committed, executable `PreToolUse` hook for Edit and Write blocks it, allows the rest and has `"onFailure": "block"`.
- [ ] A committed reviewer subagent has only tools that read code, and `.practice/i-capstone-agents.txt` shows Claude delegating to it.
- [ ] The committed `.mcp.json` runs chrome-devtools-mcp at an exact version, with usage statistics, CrUX lookups and update checks off.
- [ ] The committed `.claude/settings.json` turns on a plugin from one of Anthropic's marketplaces.
- [ ] The committed `.claude/settings.json` denies reading `.env` files, allows a narrow test command, and asks before a command such as `git push`.
- [ ] The committed `.claude/settings.json` turns the sandbox on, and `.claude/settings.local.json` stays out of git.
- [ ] A committed `CLAUDE.md` imports a file with `@path`, and the file exists.
- [ ] A committed rule in `.claude/rules/` is scoped with `paths:`, and every scoped rule matches a file in the repository.
- [ ] The committed CLI reports malformed percent escapes as broken links, continues checking later links and still resolves valid encoded paths.
- [ ] `npm test` passes, and `git status --porcelain` prints nothing.

Run `npm run check -- i-capstone` in your practice copy. Each item that fails prints what to fix.

## What the check can't see

The check doesn't look at these parts of the Intermediate Exit. Tick them yourself, honestly:

- [ ] I ran my skill by name, and Claude loaded it on its own when I asked it to check links.
- [ ] I saw my protection stop an Edit in `samples/` during a session.
- [ ] I approved the MCP server in a session and used one of its tools.
- [ ] My reviewer reviewed the fix before I committed it.
- [ ] I installed the plugin with `claude plugin install claude-code-setup@claude-plugins-official --scope project`, as a teammate does after pulling the settings.
- [ ] I can pick a model and an effort level for a task, and say why.
- [ ] When Claude didn't follow an instruction, I can find out whether its file loaded.

When every box on this page is ticked, you're ready for the [Advanced level](../advanced/README.md). Its "ready if" list is the Intermediate Exit.

---

<sub>Sources: [Advanced setup](https://code.claude.com/docs/en/setup) · [All settings](https://code.claude.com/docs/en/settings-reference) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide) · the [Intermediate lessons](README.md), which cite the official pages for each step.</sub>

<sub>← [Install and manage plugins](08-plugins.md) · [Intermediate index](README.md) · [Advanced index](../advanced/README.md) → · [Stuck on this capstone?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-capstone)</sub>
