# Models — Specifications & Pricing

*[← Back to README](../../README.md#the-claude-5-era-todays-model-lineup)*

The current Claude lineup at a glance, plus deeper specs for the headline models. For Anthropic's authoritative list (always more current), see the [official model overview](https://platform.claude.com/docs/en/about-claude/models/overview).

---

<a id="the-current-lineup-july-2026"></a>

## The current lineup (as of October 4, 2026)

| Model | Model ID | Context | Max output | Best for |
|---|---|---|---|---|
| **Sonnet 5.5** | `claude-sonnet-5-5` | 1M | 128K | Everyday coding: most tasks live here |
| **Opus 5.5** *(default since v2.1.280)* | `claude-opus-5-5` | 1M | 128K | Complex reasoning, large refactors, agent orchestration |
| **Fable 5.1** *(Mythos class)* | `claude-fable-5-1` | 1M | 128K | The genuinely hard problems, a tier above Opus |
| **Haiku 4.5** *(fast/cheap)* | `claude-haiku-4-5` | 200K | 64K | Quick edits, doc updates, light reasoning |

> ⚠️ Anthropic ships new models often. Always check the [official model overview](https://platform.claude.com/docs/en/about-claude/models/overview) before pinning a model ID.

**1M context is standard** on all current Opus/Sonnet/Fable models — no beta flag, and the full window bills at standard per-token rates (no long-context surcharge).

**Legacy models still available:** Fable 5, Opus 5, Opus 4.8, Opus 4.7, Opus 4.6, Opus 4.5, Sonnet 5, and Sonnet 4.6 remain accessible via API and the `/model` switcher, useful for pinning a build to a specific behavior. **Opus 4.1 was retired on August 5, 2026** (except on Bedrock and Google Cloud, which set their own schedules; see [model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)).

**Mythos 5** (`claude-mythos-5`) is the same underlying model as Fable 5 with safeguards lifted in some areas: invitation-only for approved organizations via Project Glasswing, no self-serve access. See [the announcement](https://www.anthropic.com/news/claude-fable-5-mythos-5). The current Mythos model is **Mythos 5.1** (`claude-mythos-5-1`, released September 1, 2026), the same model as Fable 5.1, available only through Anthropic's trusted access programs.

---

## The headliners

<a id="claude-sonnet-5--the-new-default"></a>

### Claude Sonnet 5 (legacy)

Announced June 30, 2026. It was Claude Code's `default` model on Pro and Team Standard until v2.1.280, when Opus 5.5 became the default ([model config](https://code.claude.com/docs/en/model-config#default-model-setting)). Sonnet 5.5, released September 28, 2026, is now the current Sonnet model.

- **1M-token context, 128K max output** — whole-codebase work without splitting.
- **Pricing:** $2/$10 per MTok. It launched as introductory pricing through August 31, 2026; on August 10, 2026, Anthropic made it the standard price and cancelled the increase to $3/$15 planned for September 1, 2026 ([pricing docs](https://platform.claude.com/docs/en/about-claude/pricing)).
- Defaults to `high` effort on API and Claude Code.

→ [Announcement](https://www.anthropic.com/news/claude-sonnet-5)

<a id="claude-opus-48--the-opus-flagship"></a>

### Claude Opus 4.8 (legacy)

Announced May 28, 2026, replacing Opus 4.7 at **unchanged pricing** ($5/$25).

- Launched alongside **Dynamic Workflows** (research preview) — orchestrating hundreds of parallel subagents.
- Anthropic reports it is **~4× less likely than Opus 4.7** to let flaws in its own code pass unflagged.
- Defaults to `high` effort on all surfaces; supports `xhigh`.
- Was the default model for Fast Mode in Claude Code v2.1.154 through v2.1.218, and still supports it (see below).

→ [Announcement](https://www.anthropic.com/news/claude-opus-4-8)

<a id="claude-fable-5--the-mythos-class"></a>

### Claude Fable 5 (legacy)

Announced June 9, 2026 with Mythos 5: the first *Mythos-class* models, a capability tier above Opus. Fable 5.1, released September 1, 2026, is now the current Fable model.

- **$10/$50 per MTok** (batch $5/$25).
- **Adaptive thinking is always on** — `thinking: {type: "disabled"}` is rejected.
- Dual-use safety classifiers (cyber, bio/chem, distillation) fall back to Opus 4.8 instead of refusing.
- Uses the Opus 4.7 tokenizer — **~30% more tokens for the same text** vs pre-4.7 models; budget accordingly.
- Was included free on Pro/Max/Team from June 9–22, 2026; since June 23, depending on plan and seat tier, [Fable usage can bill to usage credits](https://code.claude.com/docs/en/model-config#fable-and-usage-credits). GA on API, Bedrock, Google Cloud, and Foundry.

→ [Announcement](https://www.anthropic.com/news/claude-fable-5-mythos-5)

---

## Fast Mode

Fast Mode (research preview) delivers up to **2.5× faster output at 2× the standard price**, running on **Opus 5.5** (the default fast-mode model since Claude Code v2.1.280; [Claude Code fast mode docs](https://code.claude.com/docs/en/fast-mode)). Opus 5 and Opus 4.8 also support it, at $10/$50 per MTok. Toggle with `/fast` in the CLI, the **Toggle fast mode** command in the VS Code extension, or the model menu at claude.ai/code; the **↯** indicator confirms it's on. On subscription plans it draws from usage credits.

| | Standard Opus 5.5 | Fast Mode (Opus 5.5) |
|---|---|---|
| Input (per MTok) | $4 | $8 (2×) |
| Output (per MTok) | $20 | $40 (2×) |

> ⚠️ **Older Opus fast modes were retired:** Opus 4.7 fast was deprecated on June 25, 2026 and **removed on July 24, 2026** (Claude Code v2.1.219); API requests to `claude-opus-4-7` with `speed: "fast"` now return an error. Opus 4.6 doesn't support fast mode (its fast requests run at standard speed).

→ [Official fast-mode docs](https://platform.claude.com/docs/en/build-with-claude/fast-mode)

---

## Pricing

### Subscription plans

| Plan | Price | Models | Usage |
|---|---|---|---|
| Pro | $20/mo ($17/mo annual) | All current | Base — five-hour limits doubled May 6, 2026 |
| Max 5x | from $100/mo | All current | 5× Pro |
| Max 20x | $200/mo | All current | 20× Pro |

### API (pay-as-you-go)

| Model | Input (per MTok) | Output (per MTok) |
|---|---|---|
| Sonnet 5.5 | $2 | $10 |
| Opus 5.5 | $4 | $20 |
| Fable 5.1 | $10 | $50 |
| Haiku 4.5 | $1 | $5 |

- Fable 5 batch: $5/$25. Fable 5 cache pricing: $12.50 (5-min write) / $20 (1-hr write) / $1 (read) per MTok; Fable 5.1 cache reads cost $0.25 per MTok.
- The Batch API supports **300K output tokens** on Opus 4.8/4.7/4.6 and Sonnet 5/4.6 via the `output-300k-2026-03-24` beta header ([model overview](https://platform.claude.com/docs/en/about-claude/models/overview)).

> Pricing changes occasionally. Check [claude.com/pricing](https://claude.com/pricing) and the [API pricing docs](https://platform.claude.com/docs/en/about-claude/pricing) before committing.

---

[← Back to README](../../README.md#the-claude-5-era-todays-model-lineup) · [FAQ](faq.md) · [Changelog](changelog.md)
