# Changelog — Claude Code & Ecosystem Updates

*[← Back to README](../../README.md#updates--deprecations)*

Major changes, new features, and deprecations through May 2026. For Anthropic's authoritative release notes (always more current than this file), see [docs.anthropic.com/release-notes/claude-code](https://docs.anthropic.com/en/release-notes/claude-code).

---

## 🆕 New features

### Models & performance

- **Claude Opus 4.7** *(current flagship, May 2026)* — Sharper adaptive thinking, better long-context grounding, more reliable tool calling. Same pricing as Opus 4.6.
- **Claude Sonnet 4.6** *(current balanced tier, May 2026)* — Replaces Sonnet 4.5 as the default everyday model.
- **1M context window** — Beta via API (200K in subscriptions).
- **Fast Mode** — 2.5× faster responses with `/fast` (runs on Opus 4.6 underneath).
- **Haiku 4.5** — Fast, lightweight model for simple tasks (unchanged).

### Agent features

- **Agent Teams** *(experimental)* — Multi-agent collaboration in a single session. Enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- **Team leads & teammates** — Hierarchical agent structure with shared task lists.
- **Parallel agent execution** — Multiple agents working simultaneously.

### Commands & tools

- `/fast` — Toggle Fast Mode for rapid responses.
- `/auth login`, `/auth status`, `/auth logout` — Authentication management.
- `/debug` — Troubleshoot the current session.
- `/teleport` — Send a session to claude.ai/code for web access.
- `/rename` — Auto-generate descriptive session names.
- `/hooks` — Interactive menu for hook configuration.

### MCP ecosystem

- **MCP Registry** — Official registry live at [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/).
- **MCP Apps** — Interactive UI components from servers.
- **OAuth support** — Built-in client-credentials authentication.
- **Agentic AI Foundation** — MCP now maintained by the Linux Foundation.
- **Async operations** — Non-blocking server operations.
- **Server discovery** — `.well-known` URLs for automatic discovery.

### Hooks enhancements

- **New hook events** — `TeammateIdle` and `TaskCompleted`.
- **`PreToolUse` `updatedInput`** — Hooks can now modify tool parameters.
- **Interactive configuration** — `/hooks` command for easier setup.

### Other features

- **Automatic memory** — Recording and recall across sessions.
- **PDF support** — Read PDFs with page-range selection.
- **Shift+Enter** — Built-in newline support (zero setup needed).
- **Wildcard permissions** — More flexible tool permission patterns.

---

## 📝 Changed

### Subscription & pricing

- **Pro plan** — Now includes ALL models (Opus 4.7, Sonnet 4.6, Haiku 4.5, plus the previous-generation 4.6/4.5). Previously: Sonnet 4 only.
- **Usage metrics** — Changed from token counts to message counts. Pro: ~45 messages per 5-hour window. Easier to understand and track.
- **Unified subscription** — One subscription for both web (claude.ai) and CLI.
- **Average costs** — Pro users spend ~$6/day on coding (90% under $12/day).

### MCP ecosystem

- **MCP governance** — Donated to the Agentic AI Foundation (Linux Foundation). Open governance, vendor-neutral.
- **Registry status** — Changed from "future vision" to live production service.

### Model IDs

Use specific model IDs instead of generic references:

- `claude-opus-4-7` (current flagship; previously `claude-opus-4-6`)
- `claude-sonnet-4-6` (current balanced; previously `claude-sonnet-4-5-20250929`)
- `claude-haiku-4-5-20251001` (unchanged)

Previous-generation IDs (`claude-opus-4-6`, `claude-sonnet-4-5-20250929`) remain accessible — useful when you need stable behavior or Fast Mode (which still runs on Opus 4.6).

### Commands

- **Authentication** — Use `/auth login` instead of `/login`.
- **Terminal setup** — Shift+Enter is now built-in; `/terminal-setup` still available for iTerm2/VSCode custom bindings.

---

## ❌ Deprecated

### Subscription tiers

- **Separate Opus access** — No longer needed; Opus is included in Pro ($20/mo). No separate "Opus-only" tier.

### Workarounds

- **Manual token calculations** — Use `/cost` instead. Built-in token tracking, real-time usage monitoring.

### Legacy commands

- `/login` and `/logout` — Use `/auth login` and `/auth logout` instead. Still functional but the new commands are preferred.

---

## 📅 Important dates

- **September 2025** — MCP Registry launched.
- **January 2026** — Claude 4.5 / 4.6 model family released (Opus 4.6, Sonnet 4.5, Haiku 4.5).
- **February 2026** — Agent Teams experimental release. Fast Mode launch promotion ended Feb 16.
- **May 2026** — Opus 4.7 and Sonnet 4.6 released.

---

## 🔮 Coming soon

Based on the public roadmap and experimental features:

- Agent Teams general availability
- 1M context window in subscriptions (currently API-only)
- Enhanced MCP Apps capabilities
- Persistent agent teams across sessions
- Visual team dashboard

---

[← Back to README](../../README.md#updates--deprecations) · [FAQ](faq.md) · [Further reading](further-reading.md)
