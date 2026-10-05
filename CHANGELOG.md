# Changelog

Editions of this guide, newest first. An edition is tagged `vYYYY.MM`, and a correction between editions `vYYYY.MM.N`. Each edition stays readable at its tag.

## Unreleased

Baseline: Claude Code v2.1.285 (stable), frozen on 2026-10-05.

Every change in the next edition is verified against this version, the `stable` dist-tag of [`@anthropic-ai/claude-code`](https://www.npmjs.com/package/@anthropic-ai/claude-code?activeTab=versions) on 2026-10-05. It stays frozen until the edition ships, unless a later `stable` release removes, renames or changes the default of something a lesson teaches.

### Changed

- The reference pages are rewritten for lookup: [Models and effort](docs/reference/models.md), [Commands by level](docs/reference/commands.md) and [Further learning](docs/reference/further-reading.md). They carry no prices, plan limits or model specifications, and link the official pages for those.

### Removed

<a id="removed-changelog-mirror"></a>
- The guide's summary of Claude Code releases, docs/reference/changelog.md, is now a stub that points to the official [CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) and [What's new](https://code.claude.com/docs/en/whats-new).

<a id="removed-further-reading-listings"></a>
- From Further learning: model announcements, a token calculator, third-party MCP server examples and an MCP authentication post, hook and workflow collections, terminal and note-taking tools, another coding assistant, and an agent-interoperability announcement. No lesson uses them.

<a id="removed-live-config"></a>
- The repo's live Claude Code setup no longer runs anything when you clone the repo and trust the folder. Gone: the spoken Notification hook with its text-to-speech and LLM helper scripts, the 14 allow rules, the five subagent personas in `.claude/agents/`, the seven slash commands in `.claude/commands/`, and the skills catalog and workflow recipes in docs/skills.md that described them. `.claude/` keeps a deny rule for reading `.env` files, the claude-md-review skill and the stale-docs-audit workflow. To keep a spoken notification of your own, add a Notification hook to `~/.claude/settings.json`.

### Added

- A listing policy in [CONTRIBUTING.md](CONTRIBUTING.md#listing-policy) and a form to suggest a resource.
- Agent rules in [AGENTS.md](AGENTS.md), which a new [CLAUDE.md](CLAUDE.md) imports.
- A rewritten [CONTRIBUTING.md](CONTRIBUTING.md), a pull request template with a claim table and a dry-run section, and a CODEOWNERS file.
