# Models — Specifications & Pricing

*[← Back to README](../../README.md#claude-opus-47-the-latest-flagship)*

The Claude 4 model family at a glance, plus deeper specs for the current flagship. For Anthropic's authoritative list (always more current), see the [official model overview](https://docs.anthropic.com/en/docs/about-claude/models).

---

## The Claude 4 family

| Model | Model ID | Context | Max output | Best for |
|---|---|---|---|---|
| **Opus 4.7** *(flagship)* | `claude-opus-4-7` | 200K (1M beta via API) | 128K | Complex reasoning, large refactors, multi-file analysis |
| **Sonnet 4.6** *(balanced)* | `claude-sonnet-4-6` | 200K | 8K | Everyday coding — most tasks live here |
| **Haiku 4.5** *(fast/cheap)* | `claude-haiku-4-5-20251001` | 200K | 8K | Quick edits, doc updates, light reasoning |

> ⚠️ Anthropic ships new models often. Always check the [official model overview](https://docs.anthropic.com/en/docs/about-claude/models) before pinning a model ID.

**Previous-generation models still available:** `claude-opus-4-6` and `claude-sonnet-4-5-20250929` remain accessible via API and the `/model` switcher. They're no longer the default but useful for cost optimization or pinning a build to a specific behavior.

---

## Claude Opus 4.7 — deep specs

### Key specifications

| Feature | Specification |
|---|---|
| **Model ID** | `claude-opus-4-7` |
| **Context window** | 200K tokens (1M beta via API) |
| **Max output** | 128K tokens |
| **Availability** | Pro, Max, and API plans |
| **Fast Mode** | Available via Opus 4.6 (`/fast` switches the underlying model — see [Fast Mode](#fast-mode) below) |

### What's new in 4.7 vs 4.6

- **Sharper adaptive thinking.** Reasoning depth scales more reliably with task complexity — fewer cases of overthinking trivial prompts or underthinking hard ones.
- **Better long-context grounding.** Multi-file refactoring at the upper end of the 200K window holds the thread tighter than 4.6.
- **Improved tool calling.** Lower rate of malformed JSON and clearer reasoning when picking between similar tools.
- **Same price.** Input/output pricing matches Opus 4.6.

### Capabilities

**1. Extended context window** — 200K standard for everyone; 1M beta via API only. Best for: analyzing entire large codebases at once, processing extensive documentation.

**2. Adaptive thinking** — dynamic reasoning that scales with task complexity. You can hint at depth with `"think"`, `"think hard"`, `"think harder"`, or `"ultrathink"` in your prompt; for the persistent dial, see [Effort levels](effort-levels.md). Opus 4.7 defaults to the `xhigh` effort level on every plan.

**3. Agent teams (experimental)** — multi-agent collaboration in one session. Enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

**4. Top-tier benchmarks** — leading scores on Terminal-Bench 2.0 and SWE-bench Verified.

### When to reach for Opus 4.7

- Complex architectural decisions
- Large-scale refactoring or migrations
- Debugging intricate, multi-file issues
- Production-critical code paths

**Save tokens with Sonnet 4.6 or Haiku 4.5 when:**

- The task is a single-file edit or simple refactor
- You're writing or updating documentation
- You're doing exploratory Q&A about an unfamiliar codebase

---

## Fast Mode

Fast Mode delivers ~2.5× faster responses at 6× the standard token price. It runs on **Opus 4.6** — not 4.7. Toggle with `/fast`; the **↯** indicator confirms it's on. Available via API and Pro/Max plans.

| | Standard Opus 4.6 | Fast Mode (Opus 4.6) |
|---|---|---|
| Input (per MTok) | $5 | $30 (6×) |
| Output (per MTok) | $25 | $150 (6×) |

> 💡 Default to Opus 4.7 for everyday work. Reach for `/fast` only when latency genuinely matters (live debugging, demo prep, time-pressured fixes).

---

## Pricing

### Subscription plans

| Plan | Price | Models | Usage |
|---|---|---|---|
| Pro | $20/mo ($17/mo annual) | All | ~45 messages / 5hr |
| Max 5x | $100/mo | All | 5× Pro |
| Max 20x | $200/mo | All | 20× Pro |

### API (pay-as-you-go)

| Model | Input (per MTok) | Output (per MTok) |
|---|---|---|
| Opus 4.7 | $5 | $25 |
| Sonnet 4.6 | $3 | $15 |
| Haiku 4.5 | $1 | $5 |
| Opus 4.6 (Fast Mode only) | $30 | $150 |

> Pricing changes occasionally. Check [anthropic.com/pricing](https://www.anthropic.com/pricing) before committing.

---

[← Back to README](../../README.md#claude-opus-47-the-latest-flagship) · [FAQ](faq.md) · [Changelog](changelog.md)
