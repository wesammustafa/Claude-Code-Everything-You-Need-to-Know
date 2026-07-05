# Changelog — Claude Code & Ecosystem Updates

*[← Back to README](../../README.md#updates--deprecations-as-of-july-2026)*

Major changes, new features, and deprecations through early July 2026 (Claude Code v2.1.201). For the authoritative record — always more current than this file — see the [official CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) and the [weekly "What's new" digests](https://code.claude.com/docs/en/whats-new/).

---

## 🆕 New features

### Models

- **Claude Sonnet 5** *(June 30, 2026)* — the new default model in Claude Code (v2.1.197), with a native 1M-token context window. Intro pricing $2/$10 per MTok through Aug 31, 2026.
- **Claude Fable 5 & Mythos 5** *(June 9, 2026)* — the new Mythos-class tier above Opus ($10/$50). Mythos 5 is invitation-only via Project Glasswing.
- **Claude Opus 4.8** *(May 28, 2026)* — Opus-tier flagship at unchanged $5/$25; ~4× less likely than 4.7 to let flaws in its own code pass unflagged.
- **1M context standard** — Opus 4.8/4.7/4.6, Sonnet 5/4.6, and Fable 5 all carry 1M context at standard per-token pricing.

### Orchestration & automation

- **Dynamic workflows** *(v2.1.154, May 28)* — Claude writes and runs orchestration scripts that fan out tens to hundreds of background subagents; watch with `/workflows`. The trigger keyword was renamed "workflow" → **"ultracode"** in v2.1.160, and `/effort ultracode` pairs xhigh reasoning with standing workflow permission.
- **Cloud code review** — `/code-review` accepts `low|medium|high|xhigh|max|ultra` plus `--fix` / `--comment`; `ultra` runs a multi-agent review in the cloud (alias `/ultrareview`, 3 free runs on Pro/Max). `claude ultrareview` runs it non-interactively for CI.
- **Routines** — `/schedule` (alias `/routines`) runs scheduled agents on Anthropic-managed cloud infrastructure; `/loop` and the Cron tools cover local scheduling.
- **Artifacts** *(beta, week of June 15–19)* — publish live, shareable web pages to claude.ai from the CLI (Pro/Max/Team/Enterprise; CSP-sandboxed; 16 MiB).
- **Agent view** *(Research Preview, v2.1.139, May 11)* — `claude agents` opens a live multi-agent dashboard.
- **Subagents** — run in the background by default (v2.1.198); can nest 5 levels deep (v2.1.172); background agents can auto-commit, push, and open a draft PR.
- **Claude in Chrome GA** *(v2.1.198, July 1)*.
- **Auto memory** — on by default since v2.1.59: per-project memory in `~/.claude/projects/<project>/memory/` with a `MEMORY.md` index; manage with `/memory`.

### Commands & CLI

- New in this window: `/cd` (2.1.169), `/goal` and `/scroll-speed` (2.1.139), `/reload-skills` (2.1.152), `/workflows` (2.1.154), `/plugin list` (2.1.163), `/config key=value` (2.1.181), `/dataviz` bundled skill (2.1.198).
- CLI: `claude mcp login|logout` (2.1.186), `claude plugin init` (2.1.157), `claude agents --json` (2.1.145).
- Stacked skill invocations — `/skill-a /skill-b …` run in sequence (v2.1.199).
- `/rewind` can resume from before a `/clear` (v2.1.191).
- Permission rules support `Tool(param:value)` matching with wildcards, e.g. `Agent(model:opus)` (v2.1.178).
- Nested `.claude/` directories are first-class — closest to cwd wins on collisions (v2.1.178).

### Skills & plugins

- **Slash commands and skills are one system** — `.claude/commands/deploy.md` ≡ `.claude/skills/deploy/SKILL.md`; skills follow the [agentskills.io](https://agentskills.io) open standard (released Dec 18, 2025; adopted by ~40 products).
- **Plugins** — full packaging system (skills, commands, agents, hooks, MCP servers, LSP configs); two official marketplaces (claude-plugins-official, auto-registered; anthropics/claude-plugins-community via `/plugin marketplace add`).

### MCP ecosystem

- **Agentic AI Foundation** *(Dec 9, 2025)* — MCP donated to a Linux Foundation directed fund, alongside Block's goose and OpenAI's AGENTS.md.
- **MCP Apps** *(Jan 26, 2026)* — the first official MCP extension: interactive HTML UIs in sandboxed iframes.
- **Spec** — 2025-11-25 is the current ratified revision; the 2026-07-28 release candidate (stateless core, official extensions) is the largest revision since launch and finalizes July 28, 2026.
- **Registry** — [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/), still officially in preview.

---

## 📝 Changed

- **Rate limits** *(May 6, 2026)* — Claude Code's five-hour rate limits doubled for Pro/Max/Team/seat-based Enterprise; peak-hours limit reductions removed for Pro/Max. ([announcement](https://www.anthropic.com/news/higher-limits-spacex))
- **`/cost` + `/stats` → `/usage`** (v2.1.118); **`/extra-usage` → `/usage-credits`** (v2.1.144).
- **`/simplify` → `/code-review`** (v2.1.147, `--fix` added v2.1.152); `/simplify` reintroduced v2.1.154 as a cleanup-only review (reuse, simplification, efficiency).
- **Permission mode "default" renamed "Manual"** (v2.1.200); AskUserQuestion dialogs no longer auto-continue.
- **`/model` persistence** — your selection now persists as the default for new sessions; press `s` for session-only (v2.1.153).
- **Agent teams** *(experimental since Feb 2026)* — v2.1.178 removed `TeamCreate`/`TeamDelete`: one implicit team per session, teammates spawned via the Agent tool's `name` parameter; default display "in-process" (v2.1.179); `teammateMode: "iterm2"` (v2.1.186). Still gated behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- **`/agents` wizard removed** (v2.1.198) — define agents by editing `.claude/agents/` or asking Claude.
- **Fast mode** — defaults to Opus 4.8 since v2.1.154 at $10/$50 (2× for up to 2.5× output speed).
- **`!` bash output** now triggers a Claude response (v2.1.186; opt out with `respondToBashCommands: false`).

---

## ❌ Deprecated / removed

- **Opus 4.1** — deprecated; retires **August 5, 2026**.
- **Opus 4.7 fast mode** — deprecated June 25, 2026; **removed July 24, 2026** (requests error, no fallback). Opus 4.6 fast has silently run at standard speed since June 29, 2026.
- **`TeamCreate` / `TeamDelete`** — removed in v2.1.178; `team_name` in `TaskCreated`/`TaskCompleted`/`TeammateIdle` hook payloads is deprecated.
- **`/agents` setup wizard** — removed in v2.1.198.

---

## 📅 Important dates

- **September 2025** — MCP Registry preview launched.
- **December 9, 2025** — MCP donated to the Agentic AI Foundation (Linux Foundation).
- **December 18, 2025** — Agent Skills open standard released at agentskills.io.
- **January 26, 2026** — MCP Apps became the first official MCP extension.
- **February 5, 2026** — Opus 4.6 released alongside experimental Agent Teams.
- **May 6, 2026** — Five-hour rate limits doubled.
- **May 28, 2026** — Opus 4.8 + dynamic workflows.
- **June 9, 2026** — Fable 5 / Mythos 5.
- **June 30, 2026** — Sonnet 5 becomes Claude Code's default.
- **July 24, 2026** — Opus 4.7 fast mode removal.
- **August 5, 2026** — Opus 4.1 retirement.

---

[← Back to README](../../README.md#updates--deprecations-as-of-july-2026) · [FAQ](faq.md) · [Further reading](further-reading.md)
