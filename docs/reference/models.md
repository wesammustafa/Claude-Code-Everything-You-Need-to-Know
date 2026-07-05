# Models — Specifications & Pricing

*[← Back to README](../../README.md#the-claude-5-era-todays-model-lineup)*

The current Claude lineup at a glance, plus deeper specs for the headline models. For Anthropic's authoritative list (always more current), see the [official model overview](https://platform.claude.com/docs/en/about-claude/models/overview).

---

## The current lineup (July 2026)

| Model | Model ID | Context | Max output | Best for |
|---|---|---|---|---|
| **Sonnet 5** *(default)* | `claude-sonnet-5` | 1M | 128K | Everyday coding — most tasks live here |
| **Opus 4.8** *(Opus flagship)* | `claude-opus-4-8` | 1M | 128K | Complex reasoning, large refactors, agent orchestration |
| **Fable 5** *(Mythos class)* | `claude-fable-5` | 1M | 128K | The genuinely hard problems — a tier above Opus |
| **Haiku 4.5** *(fast/cheap)* | `claude-haiku-4-5` | 200K | 64K | Quick edits, doc updates, light reasoning |

> ⚠️ Anthropic ships new models often. Always check the [official model overview](https://platform.claude.com/docs/en/about-claude/models/overview) before pinning a model ID.

**1M context is standard** on all current Opus/Sonnet/Fable models — no beta flag, and the full window bills at standard per-token rates (no long-context surcharge).

**Legacy models still available:** Opus 4.7, Opus 4.6, and Sonnet 4.6 remain accessible via API and the `/model` switcher — useful for pinning a build to a specific behavior. **Opus 4.1 is deprecated and retires August 5, 2026.**

**Mythos 5** (`claude-mythos-5`) is the same underlying model as Fable 5 with safeguards lifted in some areas — invitation-only for approved organizations via Project Glasswing, no self-serve access. See [the announcement](https://www.anthropic.com/news/claude-fable-5-mythos-5).

---

## The headliners

### Claude Sonnet 5 — the new default

Announced June 30, 2026; Claude Code's default model since v2.1.197. The default for Free and Pro on claude.ai too.

- **1M-token context, 128K max output** — whole-codebase work without splitting.
- **Intro pricing:** $2/$10 per MTok through August 31, 2026, then $3/$15.
- Defaults to `high` effort on API and Claude Code.

→ [Announcement](https://www.anthropic.com/news/claude-sonnet-5)

### Claude Opus 4.8 — the Opus flagship

Announced May 28, 2026, replacing Opus 4.7 at **unchanged pricing** ($5/$25).

- Launched alongside **Dynamic Workflows** (research preview) — orchestrating hundreds of parallel subagents.
- Anthropic reports it is **~4× less likely than Opus 4.7** to let flaws in its own code pass unflagged.
- Defaults to `high` effort on all surfaces; supports `xhigh`.
- The default model for Fast Mode (see below).

→ [Announcement](https://www.anthropic.com/news/claude-opus-4-8)

### Claude Fable 5 — the Mythos class

Announced June 9, 2026 with Mythos 5 — the first *Mythos-class* models, a capability tier above Opus.

- **$10/$50 per MTok** (batch $5/$25).
- **Adaptive thinking is always on** — `thinking: {type: "disabled"}` is rejected.
- Dual-use safety classifiers (cyber, bio/chem, distillation) fall back to Opus 4.8 instead of refusing.
- Uses the Opus 4.7 tokenizer — **~30% more tokens for the same text** vs pre-4.7 models; budget accordingly.
- Was included free on Pro/Max/Team from June 9–22, 2026; since June 23 it draws usage credits on subscription plans. GA on API, Bedrock, Google Cloud, and Foundry.

→ [Announcement](https://www.anthropic.com/news/claude-fable-5-mythos-5)

---

## Fast Mode

Fast Mode delivers up to **2.5× faster output at 2× the standard price**, running on **Opus 4.8** (the default fast-mode model since Claude Code v2.1.154). Toggle with `/fast` (CLI-only, v2.1.36+); the **↯** indicator confirms it's on. On subscription plans it draws from usage credits.

| | Standard Opus 4.8 | Fast Mode (Opus 4.8) |
|---|---|---|
| Input (per MTok) | $5 | $10 (2×) |
| Output (per MTok) | $25 | $50 (2×) |

> ⚠️ **Older Opus fast modes are being retired:** Opus 4.7 fast ($30/$150) was deprecated June 25, 2026 and is **removed July 24, 2026** (requests will error, no fallback). Opus 4.6 has silently run at standard speed since June 29, 2026.

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
| Sonnet 5 | $2 *(intro, → $3 after Aug 31, 2026)* | $10 *(intro, → $15)* |
| Opus 4.8 | $5 | $25 |
| Fable 5 | $10 | $50 |
| Haiku 4.5 | $1 | $5 |

- Fable 5 batch: $5/$25. Cache pricing: $12.50 (5-min write) / $20 (1-hr write) / $1 (read) per MTok.
- The Batch API supports **300K output tokens** on Opus 4.8/4.7/4.6 and Sonnet 5/4.6 via the `output-300k-2026-03-24` beta header ([model overview](https://platform.claude.com/docs/en/about-claude/models/overview)).

> Pricing changes occasionally. Check [claude.com/pricing](https://claude.com/pricing) and the [API pricing docs](https://platform.claude.com/docs/en/about-claude/pricing) before committing.

---

[← Back to README](../../README.md#the-claude-5-era-todays-model-lineup) · [FAQ](faq.md) · [Changelog](changelog.md)
