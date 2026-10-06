# Examples

Copy-ready files for the lessons: skills, hooks, subagents and settings snippets. Each sits in the folder of the lesson that uses it, under `examples/<level>/<NN-lesson>/`.

Nothing here runs on its own. Files that Claude Code would load from a project carry a different name in this folder, so they stay inert until you copy them:

- `dot-claude/` becomes `.claude/` in your project;
- `dot-mcp.json` becomes `.mcp.json`;
- `CLAUDE.example.md` becomes `CLAUDE.md`, and `AGENTS.example.md` becomes `AGENTS.md`.

Every executable example follows the guide's [safety contract](../CONTRIBUTING.md#adding-a-skill). Its header says what it does, when it runs, how to remove it, and whether it was tested in a Claude Code session at this edition's version. Review each file before you copy it into a project.

## Index

Each example is listed here, with its lesson, platforms and test line, when the lesson that uses it is published.

- [`intermediate/01-first-skill/`](intermediate/01-first-skill/README.md): the `five-whys` skill and the unfinished `tdd` skill, for [Turn a repeated workflow into a skill](../docs/intermediate/01-first-skill.md). Any platform. Tested in Claude Code v2.1.285 (stable) on macOS, 2026-10-06.
- [`intermediate/05-hooks/`](intermediate/05-hooks/README.md): three teaching hooks (protect-files, format-after-edit and desktop-notify) and the settings that register them, for [Enforce a rule with a hook](../docs/intermediate/05-hooks.md). macOS, Linux and WSL 2, with bash, jq and python3. Tested in Claude Code v2.1.285 (stable) on macOS, 2026-10-06.
- [`intermediate/06-subagents/`](intermediate/06-subagents/README.md): the read-only `code-reviewer` subagent, for [Delegate to a custom subagent](../docs/intermediate/06-subagents.md). Any platform. Tested in Claude Code v2.1.285 (stable) on macOS, 2026-10-06.
- [`intermediate/07-mcp/`](intermediate/07-mcp/README.md): Chrome DevTools MCP at project scope, pinned, with its data flows to Google and npm turned off, for [Connect a tool with MCP](../docs/intermediate/07-mcp.md). macOS, Linux and WSL 2, with Node.js and Chrome. Tested in Claude Code v2.1.285 (stable) on macOS, 2026-10-06.
