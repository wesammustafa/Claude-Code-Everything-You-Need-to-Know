# Intermediate capstone: get a repository ready for a new teammate

<sub>**Intermediate** · Capstone · 30 to 60 minutes · Needs: the eight [Intermediate lessons](README.md), or their skills · Verified against Claude Code v2.1.285 (stable) on 2026-10-06</sub>

This task puts the whole Intermediate level together. It has no worked example: the brief says what the team needs, and you choose how to build it. The [Intermediate Exit](README.md#by-the-end-of-this-level-you-can) is the list of what you can do by the end of this level. The check reads what you commit, and you tick the rest of the Exit yourself under [What the check can't see](#what-the-check-cant-see).

## You need

- Your copy of the practice template, with no uncommitted changes, and Node.js LTS. The capstone runs in the template copy only. If `git status --porcelain` lists files, commit them or set them aside with `git stash push --include-untracked`.
- `jq` and `python3` for hook scripts, and Chrome for the MCP server.
- macOS, Linux or WSL 2: the sandbox needs one of them ([Set up on Windows](https://code.claude.com/docs/en/setup#set-up-on-windows)), and the lessons' hook scripts are bash.
- Usage: moderate.

## The task

A teammate starts on Monday. The brief is in `capstone/intermediate-brief.md` in your practice copy: set the repository up so their Claude Code sessions work the way the team's do, and commit all of it, because they get only what's in git.

Build each part the way its lesson taught:

1. **A skill** that runs the link checker on a folder and explains each broken link. It runs by name and loads on its own when someone asks to check links ([lesson 1](01-first-skill.md)).
2. **Project memory:** `CLAUDE.md` imports `package.json`, and testing conventions live in a rule in `.claude/rules/` scoped to the files under `test/` ([lesson 2](02-organize-memory.md)).
3. **Team settings** in the committed `.claude/settings.json`: deny reading `.env` and `.env.*` files, allow `npm test`, and turn the sandbox on ([lesson 4](04-permissions-and-sandbox.md)). `/sandbox` saves to your local file, which teammates don't get, so add `"sandbox": {"enabled": true}` to the shared one.
4. **A hook** that blocks Claude's Edit and Write tools inside `samples/`, and only there: the tests depend on those exact files ([lesson 5](05-hooks.md)).
5. **A reviewer subagent** with read-only tools ([lesson 6](06-subagents.md)).
6. **Chrome DevTools MCP** at project scope, pinned, with its usage statistics, CrUX lookups and update checks off ([lesson 7](07-mcp.md)).
7. **The `claude-code-setup` plugin**, turned on for everyone at project scope, and installed ([lesson 8](08-plugins.md)).

Then, in a session, try each part: run the skill by name, ask Claude to edit a file in `samples/` with its Edit tool, delegate a review, approve the MCP server and use one of its tools. Pick the model and effort for each job as [lesson 3](03-model-and-effort.md) showed. Commit everything, and make sure `npm test` still passes.

## Check

You are done when all of these are true:

- [ ] A committed project skill runs the link checker by name and can load on its own.
- [ ] A committed, executable `PreToolUse` hook for Edit and Write blocks `samples/` and nothing else.
- [ ] A committed reviewer subagent has only read-only tools.
- [ ] The committed `.mcp.json` runs chrome-devtools-mcp at an exact version, with usage statistics, CrUX lookups and update checks off.
- [ ] The committed `.claude/settings.json` turns on a plugin from one of Anthropic's marketplaces.
- [ ] The committed `.claude/settings.json` denies reading `.env` files and allows a narrow test command.
- [ ] The committed `.claude/settings.json` turns the sandbox on, and `.claude/settings.local.json` stays out of git.
- [ ] A committed `CLAUDE.md` imports a file with `@path`, and the file exists.
- [ ] A committed rule in `.claude/rules/` is scoped with `paths:`, and every scoped rule matches a file in the repository.
- [ ] `npm test` passes, and `git status --porcelain` prints nothing.

Run `npm run check -- i-capstone` in your practice copy. Each item that fails prints what to fix.

## What the check can't see

The check doesn't look at these parts of the Intermediate Exit. Tick them yourself, honestly:

- [ ] I ran my skill by name, and Claude loaded it on its own when I asked it to check links.
- [ ] I saw my hook block an Edit in `samples/` during a session.
- [ ] I delegated a review to my subagent, and only its summary came back.
- [ ] I approved the MCP server in a session and used one of its tools.
- [ ] I installed the plugin with `claude plugin install claude-code-setup@claude-plugins-official --scope project`, as a teammate does after pulling the settings.
- [ ] I can pick a model and an effort level for a task, and say why.
- [ ] When Claude didn't follow an instruction, I can find out whether its file loaded.

When every box on this page is ticked, you're ready for the [Advanced level](../advanced/README.md). Its "ready if" list is the Intermediate Exit.

If this level helped, a star helps other developers find the guide.

---

<sub>Sources: [Advanced setup](https://code.claude.com/docs/en/setup) · the [Intermediate lessons](README.md), which cite the official pages for each step.</sub>

<sub>← [Install and manage plugins](08-plugins.md) · [Intermediate index](README.md) · [Advanced index](../advanced/README.md) → · [Stuck on this capstone?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-capstone)</sub>
