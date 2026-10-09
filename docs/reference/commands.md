<a id="slash-commands--cheatsheet"></a>
# Commands by level

<sub>Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

The built-in commands, bundled skills and workflows, and `claude` command-line forms the lessons use, grouped by the level that teaches them. It is not the full list: the official [commands reference](https://code.claude.com/docs/en/commands#all-commands) has every command and its options, the [CLI reference](https://code.claude.com/docs/en/cli-reference#cli-flags) has the command-line flags, and typing `/` in a session shows the commands available to you.

<a id="common-built-in-slash-commands"></a>
## Beginner

- `/status`: your version, model, account and connectivity. [Install, sign in and look around](../beginner/01-install-and-look-around.md)
- `/exit`: end the session. [Install, sign in and look around](../beginner/01-install-and-look-around.md)
- `/plan`: enter plan mode from the prompt, optionally with the task. [Permission modes and plan mode](../beginner/02-permission-modes-and-plan-mode.md)
- `/diff`: review the changes in your working tree, including Claude's edits. [Your first change, from request to commit](../beginner/03-first-change.md)
- `/context`: how full the context window is, as a colored grid. [Keep a session on track](../beginner/04-keep-a-session-on-track.md)
- `/clear`: start a new conversation with empty context. [Keep a session on track](../beginner/04-keep-a-session-on-track.md)
- `/compact`: summarize the conversation so far to free context. [Keep a session on track](../beginner/04-keep-a-session-on-track.md)
- `/rewind`: go back to an earlier point in the conversation, the code, or both ([Checkpointing](https://code.claude.com/docs/en/checkpointing)). [Keep a session on track](../beginner/04-keep-a-session-on-track.md)
- `/resume`: pick up an earlier conversation ([Manage sessions](https://code.claude.com/docs/en/sessions)). [Keep a session on track](../beginner/04-keep-a-session-on-track.md)
- `/init`: write a starting `CLAUDE.md` for the project. [Project memory with CLAUDE.md](../beginner/05-project-memory.md)
- `/memory`: edit `CLAUDE.md` files and manage auto memory. [Project memory with CLAUDE.md](../beginner/05-project-memory.md)

Electives: `/powerup` and `/output-style` ([the built-in teachers](../beginner/electives/built-in-teachers.md)).

## Intermediate

- `/skills`: list the skills available in this session. [Turn a repeated workflow into a skill](../intermediate/01-first-skill.md)
- `/doctor`: check your setup; `/doctor prompt-audit` checks your instruction files. [Organize project memory and see what loaded](../intermediate/02-organize-memory.md)
- `/model`: switch the model and save it as your default; for models that support it, the left and right arrow keys adjust effort. [Pick the model and effort](../intermediate/03-model-and-effort.md)
- `/effort`: set the effort level. [Pick the model and effort](../intermediate/03-model-and-effort.md)
- `/permissions`: manage allow, ask and deny rules. [Permissions, settings scopes and the sandbox](../intermediate/04-permissions-and-sandbox.md)
- `/sandbox`: turn the sandbox on or off. [Permissions, settings scopes and the sandbox](../intermediate/04-permissions-and-sandbox.md)
- `/hooks`: see which hooks are configured. [Enforce a rule with a hook](../intermediate/05-hooks.md)
- `/agents`: a reminder of how to create and manage subagents. [Delegate to a custom subagent](../intermediate/06-subagents.md)
- `/mcp`: manage MCP server connections and sign-ins. [Connect a tool with MCP](../intermediate/07-mcp.md)
- `/plugin`: browse, install and manage plugins. [Install and manage plugins](../intermediate/08-plugins.md)

Electives: `/statusline` ([The status line](../intermediate/electives/status-line.md)); `/chrome` ([Claude in Chrome](../intermediate/electives/claude-in-chrome.md)); `/fast` ([Fast mode](../intermediate/electives/fast-mode.md)).

## Advanced

- `claude --worktree <name>` (`-w`): start a session in an isolated git worktree at `.claude/worktrees/<name>` ([CLI reference](https://code.claude.com/docs/en/cli-reference#cli-flags)). [Parallel sessions with worktrees](../advanced/01-parallel-sessions.md)
- `/tasks`: view and manage background work in this session, including subagents that have finished. [Choose an orchestration pattern](../advanced/02-orchestration-patterns.md)
- `/workflows`: watch, pause, resume and save dynamic workflows. [Run and save a dynamic workflow](../advanced/03-dynamic-workflows.md)
- `/deep-research <question>`: a bundled workflow that fans out web searches on a question, cross-checks the sources and writes a cited report. [Run and save a dynamic workflow](../advanced/03-dynamic-workflows.md)
- `claude -p "<prompt>"`: run one prompt without the interactive interface, print the answer and exit; a script adds `--output-format json`, `--allowedTools` and `--max-turns` ([CLI reference](https://code.claude.com/docs/en/cli-reference#cli-commands)). [Script Claude Code with `claude -p`](../advanced/04-headless.md)
- `/install-github-app`: install the Claude GitHub App for a repository, with optional workflow and secret setup. [GitHub Actions](../advanced/05-github-actions.md)
- `claude plugin validate <dir>`: check a marketplace or a plugin folder before you share it; `--strict` also fails on warnings ([Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference#plugin-validate)). [Share your setup with a team](../advanced/06-share-your-setup.md)
- `/usage`: the session's cost, your plan's usage limits and activity stats. [Put bounds on autonomous runs](../advanced/07-bounded-runs.md)

Electives: `claude agents` and `/background` ([Agent view](../advanced/electives/agent-view.md)); `/goal`, `/loop` and `/schedule` ([`/goal`, `/loop` and routines](../advanced/electives/goal-loop-routines.md)); `claude plugin eval` ([Testing and publishing a plugin](../advanced/electives/publish-a-plugin.md)).

<a id="custom-slash-commands-skills"></a>
## Your own commands

A command you write yourself is a skill: a `SKILL.md` file in `.claude/skills/<name>/`, or a Markdown file in `.claude/commands/`, the older format ([Extend Claude with skills](https://code.claude.com/docs/en/skills)). The Intermediate lesson [Turn a repeated workflow into a skill](../intermediate/01-first-skill.md) teaches them.

## Shortcuts and cheat sheets

- [Interactive mode](https://code.claude.com/docs/en/interactive-mode): keyboard shortcuts, input modes and interactive features.
- [Claude Code cheatsheet](https://support.claude.com/en/articles/14553413-claude-code-cheatsheet): the commands and shortcuts worth learning first.

---

<sub>Sources: [Commands](https://code.claude.com/docs/en/commands) · [CLI reference](https://code.claude.com/docs/en/cli-reference) · [Checkpointing](https://code.claude.com/docs/en/checkpointing) · [Manage sessions](https://code.claude.com/docs/en/sessions) · [Extend Claude with skills](https://code.claude.com/docs/en/skills) · [Interactive mode](https://code.claude.com/docs/en/interactive-mode) · [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference) · [Claude Code cheatsheet](https://support.claude.com/en/articles/14553413-claude-code-cheatsheet)</sub>

<sub>Up: [Reference](README.md)</sub>
