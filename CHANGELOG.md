# Changelog

Editions of this guide, newest first. An edition is tagged `vYYYY.MM`, and a correction between editions `vYYYY.MM.N`. Each edition stays readable at its tag.

## Unreleased

Baseline: Claude Code v2.1.285 (stable), frozen on 2026-10-05.

Every change in the next edition is verified against this version, the `stable` dist-tag of [`@anthropic-ai/claude-code`](https://www.npmjs.com/package/@anthropic-ai/claude-code?activeTab=versions) on 2026-10-05. It stays frozen until the edition ships, unless a later `stable` release removes, renames or changes the default of something a lesson teaches.

Edition 2: the Intermediate path, with checked exercises. Advanced is still being rebuilt.

### Added

- The [Intermediate level](docs/intermediate/README.md): eight lessons, from a first skill to plugins, by way of project memory, model and effort, permissions and the sandbox, hooks, subagents and MCP, and a capstone that sets a repository up for a new teammate. Every lesson and the capstone has a check in the [practice template](https://github.com/wesammustafa/claude-code-practice). You can run the lesson checks against your own repository with `--dir`; the capstone runs in the template copy.
- Four Intermediate Electives: [skill patterns](docs/intermediate/electives/skill-patterns.md), [Claude in Chrome](docs/intermediate/electives/claude-in-chrome.md), [the status line](docs/intermediate/electives/status-line.md) and [fast mode](docs/intermediate/electives/fast-mode.md).
- [Examples](examples/README.md) for the Intermediate lessons: two skills, three hook scripts, a read-only reviewer subagent and a pinned Chrome DevTools MCP configuration. Each one is inert until you copy it into a project, and has a smoke test.

### Changed

- The animated Claude mascot is back beside README's title, and the social card shows it in place of the trail blazes. It comes from [shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice) under the MIT License.
- The topic pages, [Commands by level](docs/reference/commands.md) and the [Feature map](docs/reference/feature-map.md) link the Intermediate lessons and Electives.
- docs/reference/effort-levels.md and docs/skills.md are now stubs that point to the lessons and reference pages that replace them, and the `mcp-servers/` and `specialized-agents/` stubs point to the MCP and subagent lessons.

### Removed

<a id="removed-legacy-intermediate"></a>
- The previous edition's pages on skills, hooks, MCP and fast mode under `docs/legacy/`, and the subagents section of the subagents and parallel work page: the Intermediate lessons and Electives replace them. Links to the previous edition's README sections land on a line that points to the new page.
- The skill-resolution diagram, which no page used any more.

## v2026.10 - 2026-10-05

Verified against Claude Code v2.1.285 (stable).

Edition 1: the Beginner path, with checked exercises, and the structure the next two levels build on. Intermediate and Advanced are being rebuilt; copies of the previous edition's README sections on skills, hooks, subagents and parallel work, MCP and fast mode stay readable under `docs/legacy/`, labelled as not yet re-verified.

### Added

- The [Beginner level](docs/beginner/README.md): five lessons, from installing Claude Code to giving a project its memory, a capstone and three Electives. Every lesson and the capstone has a check you run in the [practice template](https://github.com/wesammustafa/claude-code-practice), whose `solutions` branch passes every check.
- A front door that places you at a level, and indexes for the three levels, the [topics](docs/topics/README.md) and the [reference pages](docs/reference/README.md), including a [Feature map](docs/reference/feature-map.md) and a [glossary](docs/reference/glossary.md).
- Pages from the previous edition, kept readable under `docs/legacy/` with a note until the lessons that replace them land.
- Issue forms for lesson trouble, bugs and stale facts, with a "Stuck on this lesson?" link at the bottom of every lesson.
- Checks on every pull request: internal links and anchors, page stamps, lesson structure, images, em dashes, config validation and the safety of `examples/`. Scheduled checks watch external links, expiry markers and new `stable` releases, and open an issue when something needs attention.
- A listing policy in [CONTRIBUTING.md](CONTRIBUTING.md#listing-policy) and a form to suggest a resource.
- Agent rules in [AGENTS.md](AGENTS.md), which a new [CLAUDE.md](CLAUDE.md) imports.
- A rewritten [CONTRIBUTING.md](CONTRIBUTING.md), a pull request template with a claim table and a dry-run section, and a CODEOWNERS file.

### Changed

- The listing freeze has ended: resource suggestions are reviewed against the [listing bar](CONTRIBUTING.md#the-listing-bar) again.
- The guide has its own mark, three trail blazes climbing a post, in place of the mascot image, so it no longer uses a likeness of an Anthropic character. A new social card goes with it, carrying nothing that can go stale.
- The reference pages are rewritten for lookup: [Models and effort](docs/reference/models.md), [Commands by level](docs/reference/commands.md) and [Further learning](docs/reference/further-reading.md). They carry no prices, plan limits or model specifications, and link the official pages for those.

### Removed

<a id="removed-changelog-mirror"></a>
- The guide's summary of Claude Code releases, docs/reference/changelog.md, is now a stub that points to the official [CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) and [What's new](https://code.claude.com/docs/en/whats-new).

<a id="removed-listings"></a>
- Third-party listings that no lesson uses: the skills ecosystem catalog (registries, curated lists and community skill names), the MCP server tables and the MCP ecosystem survey, the four MCP server walkthroughs in `mcp-servers/`, the SuperClaude and BMAD frameworks, and the ten role prompts and nine role descriptions in `specialized-agents/`. The [listing policy](CONTRIBUTING.md#listing-policy) says what the guide lists now. Old links to these pages and sections land on a line that says so.

<a id="removed-further-reading-listings"></a>
- From Further learning: model announcements, a token calculator, third-party MCP server examples and an MCP authentication post, hook and workflow collections, terminal and note-taking tools, another coding assistant, and an agent-interoperability announcement. No lesson uses them.

<a id="removed-live-config"></a>
- The repo's live Claude Code setup no longer runs anything when you clone the repo and trust the folder. Gone: the spoken Notification hook with its text-to-speech and LLM helper scripts, the 14 allow rules, the five subagent personas in `.claude/agents/`, the seven slash commands in `.claude/commands/`, and the skills catalog and workflow recipes in docs/skills.md that described them. `.claude/` keeps a deny rule for reading `.env` files, the claude-md-review skill and the stale-docs-audit workflow. To keep a spoken notification of your own, add a Notification hook to `~/.claude/settings.json`.
