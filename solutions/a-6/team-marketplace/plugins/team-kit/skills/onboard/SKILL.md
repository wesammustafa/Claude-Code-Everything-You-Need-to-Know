---
# What: a plugin skill that explains a repository's shared Claude Code setup to a new teammate: what is committed and shared, what stays personal, and what the team-kit plugin adds.
# Runs: when you type /team-kit:onboard, or when Claude matches your request to the description, in a session where the team-kit plugin is enabled.
# Side effects: none intended. It tells Claude to read files only and change none; it pre-approves no tools, so each tool call follows your permission settings.
# Requires: Claude Code. Platforms: any.
# Remove: delete this skill's folder, skills/onboard/, from the team-kit plugin, or turn the plugin off.
# Tested in Claude Code v2.1.285 (stable) on macOS, 2026-10-09
name: onboard
description: Explains this repository's shared Claude Code setup to a new teammate, covering what is committed and shared, what stays personal, and what the team-kit plugin adds. Use when someone asks how the team's Claude Code setup works or what they get by cloning the repository.
---

Explain this repository's shared Claude Code setup to a teammate who has just cloned it. Read files only; don't change any.

1. Read the shared setup, skipping any file that doesn't exist:
   - `.claude/settings.json`: permissions, hooks, and the marketplaces and plugins it turns on;
   - `CLAUDE.md` and the files in `.claude/rules/`: the project's instructions to Claude;
   - `.claude/skills/` and `.claude/agents/`: project skills and subagents;
   - `.mcp.json`: project MCP servers;
   - each marketplace that `.claude/settings.json` declares by a local path, and the skills and agents of the plugins it lists.
2. Name the personal files, which each teammate keeps out of the repository: `.claude/settings.local.json`, `CLAUDE.local.md` and the user folder `~/.claude/`. Don't open them. Say whether the repository's `.gitignore` lists the first two.
3. Report in three short sections: Shared with the team, Personal to you, and Added by team-kit. Give each file one line on what it does for the teammate. If a file you expected is missing, say so rather than guess what it would hold.

Keep the report short and concrete: file names and what each one changes, no general advice.
