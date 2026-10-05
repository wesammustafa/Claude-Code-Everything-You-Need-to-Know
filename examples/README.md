# Examples

Copy-ready files for the lessons: skills, hooks, subagents and settings snippets. Each sits in the folder of the lesson that uses it, under `examples/<level>/<NN-lesson>/`.

Nothing here runs on its own. Files that Claude Code would load from a project carry a different name in this folder, so they stay inert until you copy them:

- `dot-claude/` becomes `.claude/` in your project;
- `dot-mcp.json` becomes `.mcp.json`;
- `CLAUDE.example.md` becomes `CLAUDE.md`, and `AGENTS.example.md` becomes `AGENTS.md`.

Every executable example follows the guide's [safety contract](../CONTRIBUTING.md#adding-a-skill). Its header says what it does, when it runs, how to remove it, and whether it was tested in a Claude Code session at this edition's version. Review each file before you copy it into a project.

## Index

Each example is listed here, with its lesson, platforms and test line, when the lesson that uses it is published.
