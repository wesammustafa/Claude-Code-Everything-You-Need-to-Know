<a id="slash-commands--cheatsheet"></a>
# Commands by level

<sub>Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

The built-in commands and bundled skills the lessons use, grouped by the level that teaches them. It is not the full list: the official [commands reference](https://code.claude.com/docs/en/commands#all-commands) has every command and its options, and typing `/` in a session shows the commands available to you. Each lesson name below becomes a link when the lesson is published.

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

- `/skills`: list the skills available in this session. *Turn a repeated workflow into a skill*
- `/doctor`: check your setup; `/doctor prompt-audit` checks your instruction files. *Organize project memory and see what loaded*
- `/model`: switch the model and save it as your default; for models that support it, the left and right arrow keys adjust effort. *Pick the model and effort*
- `/effort`: set the effort level. *Pick the model and effort*
- `/permissions`: manage allow, ask and deny rules. *Permissions, settings scopes and the sandbox*
- `/sandbox`: turn the sandbox on or off. *Permissions, settings scopes and the sandbox*
- `/hooks`: see which hooks are configured. *Enforce a rule with a hook*
- `/agents`: a reminder of how to create and manage subagents. *Delegate to a custom subagent*
- `/mcp`: manage MCP server connections and sign-ins. *Connect a tool with MCP*
- `/plugin`: browse, install and manage plugins. *Install and manage plugins*

Electives: `/statusline` (the status line); `/chrome` (Claude in Chrome); `/fast` (fast mode).

## Advanced

- `/workflows`: watch, pause, resume and save dynamic workflows. *Run and save a dynamic workflow*
- `/install-github-app`: install the Claude GitHub App for a repository, with optional workflow and secret setup. *GitHub Actions*
- `/usage`: the session's cost, your plan's usage limits and activity stats. *Put bounds on autonomous runs*

Electives: `/background` (agent view) and `/tasks` (background work in this session); `/goal`, `/loop` and `/schedule` (`/goal`, `/loop` and routines).

<a id="custom-slash-commands-skills"></a>
## Your own commands

A command you write yourself is a skill: a `SKILL.md` file in `.claude/skills/<name>/`, or a Markdown file in `.claude/commands/`, the older format ([Extend Claude with skills](https://code.claude.com/docs/en/skills)). The Intermediate lesson *Turn a repeated workflow into a skill* teaches them.

## Shortcuts and cheat sheets

- [Interactive mode](https://code.claude.com/docs/en/interactive-mode): keyboard shortcuts, input modes and interactive features.
- [Claude Code cheatsheet](https://support.claude.com/en/articles/14553413-claude-code-cheatsheet): the commands and shortcuts worth learning first.

---

<sub>Sources: [Commands](https://code.claude.com/docs/en/commands) · [Checkpointing](https://code.claude.com/docs/en/checkpointing) · [Manage sessions](https://code.claude.com/docs/en/sessions) · [Extend Claude with skills](https://code.claude.com/docs/en/skills) · [Interactive mode](https://code.claude.com/docs/en/interactive-mode) · [Claude Code cheatsheet](https://support.claude.com/en/articles/14553413-claude-code-cheatsheet)</sub>

<sub>Up: [Reference](README.md)</sub>
