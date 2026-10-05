# FAQ — Claude Code & Claude Plans

> [!NOTE]
> From the previous edition, not yet re-verified. The guide is being rebuilt as lessons; this page keeps the earlier material reachable until they land.

*[← Back to README](../../README.md#faq)*

A consolidated FAQ covering models, pricing, tokens, plans, Fast Mode, worktrees, and Pro-plan optimization. For Skills-specific questions, see [`docs/skills.md` → Skills FAQ](../skills.md#skills-faq).

---

## Models

### Q: What Claude models are available in 2026?

As of October 4, 2026: **Sonnet 5.5**, **Opus 5.5** ([default](https://code.claude.com/docs/en/model-config#default-model-setting) since Claude Code v2.1.280), **Fable 5.1** (Mythos class), and **Haiku 4.5**, with Fable 5, Opus 5, Opus 4.8/4.7/4.6/4.5, and Sonnet 5/4.6 available as legacy models. Full specs, model IDs, and pricing live in one place, [Models](models.md), so this FAQ doesn't duplicate them.

**Key features:**

- **Adaptive thinking** — current models scale reasoning depth automatically; on Fable 5 it can't be disabled.
- **1M context window** — standard on Sonnet 5, Opus 4.8, and Fable 5 (no beta flag, no long-context surcharge).
- **Fast Mode**: up to 2.5× faster output at 2× pricing, on Opus 5.5 (the default), Opus 5, and Opus 4.8. Toggle with `/fast`.

> Anthropic ships new models often. Check the [official model overview](https://platform.claude.com/docs/en/about-claude/models/overview) for the current list.

### Q: Can I use the 1M context window?

Yes. 1M-token context is **standard** on Sonnet 5, Opus 4.8, and Fable 5 — in Claude Code and via the API — and the full window bills at standard per-token pricing.

**Best for:** analyzing entire large codebases at once, processing extensive documentation, complex multi-file refactoring.

---

## Reasoning effort

### Q: How many reasoning effort levels are there, and what's my default?

The API knows **five** (`low / medium / high / xhigh / max`, default `high`, except `medium` on Opus 5.5); Claude Code adds **`ultracode`**, a separate toggle (not an effort level) that turns on automatic multi-agent workflow orchestration at the session's effort level (v2.1.284+). `max` is session-only; `ultracode` can be saved with its own [`ultracode` setting](https://code.claude.com/docs/en/settings-reference#ultracode).

Current Claude Code defaults (as of October 4, 2026): Opus 5.5 and Sonnet 5.5 → `medium`; Opus 4.7 → `xhigh`; every other model that supports effort → `high`. On the API, Sonnet 5.5 defaults to `high`. Run `/effort` to see and change yours. Full breakdown: [Effort levels](effort-levels.md).

### Q: Does `ultrathink` actually raise effort?

It adds an in-context "think harder" instruction but **does not change the API effort level**. If you're already on `xhigh` or `max`, the keyword is essentially redundant. For a deliberately deeper turn, set `/effort max`, prompt, then `/effort auto` to reset.

### Q: Why can't I persist `max` or `ultracode` in `settings.json`?

Only `max` is session-only: `"effortLevel"` in `settings.json` accepts `low` / `medium` / `high` / `xhigh`, so set `max` per session with `/effort`. `ultracode` isn't an effort level, and you can save it with its own [`ultracode` setting](https://code.claude.com/docs/en/settings-reference#ultracode).

---

## Skills & commands

### Q: What's the difference between custom slash commands and skills?

They're officially one system now — `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md` both create `/deploy`. See [`docs/skills.md` → Skills FAQ](../skills.md#skills-faq) for security best practices, team sharing, and troubleshooting.

---

## Tokens & limits

### Q: How many messages do I get on the Pro plan?

Anthropic no longer publishes exact message counts. Third-party estimates put Pro at roughly **~45 messages per 5-hour rolling window** — and Claude Code's five-hour rate limits were **doubled on May 6, 2026** for Pro/Max/Team, with peak-hours limit reductions removed ([announcement](https://www.anthropic.com/news/higher-limits-spacex)). Limits reset every 5 hours; Sonnet 5.5, Opus 5.5, and Haiku 4.5 (plus legacy Opus and Sonnet models) are included. Depending on your plan and seat tier, [Fable usage can bill to usage credits](https://code.claude.com/docs/en/model-config#fable-and-usage-credits) instead of your plan's included limits.

### Q: How are tokens counted?

Everything in your interaction counts: your prompts, Claude's responses, system instructions, tool definitions, and any file content Claude reads.

| Input | Token cost |
|---|---|
| English text | ~1 token per 0.75 words (1,000 tokens ≈ 750 words) |
| Punctuation / code symbols | Each counts as ~1 token |
| Images | `(width_px × height_px) / 750` tokens |
| File reads | Each line counts; `CLAUDE.md` adds context every session |

> 💡 Use the [Claude tokenizer](https://claude-tokenizer.vercel.app/) for an exact count, or `/usage` inside Claude Code to track live usage. Note: Fable 5 and Opus 4.7+ use a tokenizer that produces ~30% more tokens for the same text than older models.

### Q: How much code can I work on per 5-hour window?

Enough for a focused feature session on a small-to-mid project. Tokens are shared across reading existing code, Claude's analysis, your back-and-forth, and the file edits themselves — so treat any lines-per-window number as an order-of-magnitude guess, not a budget.

---

## Pricing & plans

### Q: What are the Claude subscription plans?

As of October 4, 2026 (verify on [claude.com/pricing](https://claude.com/pricing) before committing):

| Plan | Price | Models | Usage limit | Claude Code |
|---|---|---|---|---|
| **Free** | $0 | Limited | Base | Not included |
| **Pro** | $20/mo ($17/mo annual) | All | ~5-hour rolling window | Full |
| **Max 5x** | from $100/mo | All | 5× Pro | Full |
| **Max 20x** | $200/mo | All | 20× Pro | Full |

- **Unified subscription** — one subscription covers both web (claude.ai) and CLI (Claude Code).
- **All models** means the current lineup (Sonnet 5.5, Opus 5.5, Haiku 4.5) plus legacy Opus and Sonnet models; for Fable, [claude.com/pricing](https://claude.com/pricing) lists "Usage credits" on Pro and "50% of weekly limits" on Max 5x and Max 20x.

### Q: API pricing (pay-as-you-go)?

See the [Models page](models.md#pricing) for the full table. Headline rates: Sonnet 5.5 $2/$10, Opus 5.5 $4/$20, Fable 5.1 $10/$50, Haiku 4.5 $1/$5. Legacy Sonnet 5 also stays at $2/$10: its introductory price became the standard price on August 10, 2026, so the increase to $3/$15 planned for September 1, 2026 did not happen.

### Q: Pro vs. Max 5x vs. Max 20x?

Same models, more capacity — Max 5x is ~5× Pro's usage, Max 20x is ~20×.

**Upgrade if:** you frequently hit Pro limits, run multiple parallel sessions or agent teams, or need guaranteed availability during peak hours.

---

## Fast Mode

### Q: What is Fast Mode and when should I use it?

Fast Mode (research preview) delivers up to **2.5× faster output** at **2× pricing**, running on **Opus 5.5** (the default fast-mode model since Claude Code v2.1.280; [fast mode docs](https://code.claude.com/docs/en/fast-mode)). Opus 5 and Opus 4.8 also support it, at $10/$50 per MTok.

- Toggle with `/fast` in the CLI, the **Toggle fast mode** command in the VS Code extension, or the model menu at claude.ai/code. The **↯** indicator confirms it's on.
- On subscription plans, fast mode draws from usage credits rather than plan limits.

| | Standard Opus 5.5 | Fast Mode |
|---|---|---|
| Input (per MTok) | $4 | $8 |
| Output (per MTok) | $20 | $40 |

> ⚠️ Fast mode on Opus 4.7 was deprecated on June 25, 2026 and **removed on July 24, 2026** (Claude Code v2.1.219); Opus 4.6 doesn't support fast mode (its fast requests run at standard speed).

**Use it for:** rapid iteration, live debugging, time-sensitive deployments, demo prep.
**Skip it for:** long background tasks and exploratory work — speed doesn't help work you're not watching.

---

## Sessions, terminals & worktrees

### Q: What happens when I run multiple Claude Code sessions in different terminals?

**Usage limits are shared.** All Claude Code sessions on your account draw from the same 5-hour budget — running 3 parallel sessions exhausts it ~3× faster.

**Conversation context is independent.** Each terminal has its own history; Claude in tab 1 doesn't know what happened in tab 2. Each session analyzes the codebase independently.

### Q: How do Git worktrees affect Claude Code sessions?

Worktrees create a hybrid:

- **Separate working directories** — each worktree shows different file contents. Edits in feature-A don't appear in feature-B.
- **Shared `.git`** — git history, branches, and commit logs are visible across all worktrees. Claude can see commits from other features (but not their working changes).

```bash
# Terminal 1: feature/auth
git commit -m "Add auth middleware"

# Terminal 2: feature/payment
cat middleware.js        # Won't show auth changes
git log --oneline --all  # WILL show the auth commit
```

### Q: How do I get fully separate Claude Code contexts?

Use **separate clones** instead of worktrees:

```bash
~/project-auth/     # Complete separate clone
~/project-payment/  # Complete separate clone
```

Each clone has its own `.git`, no shared state, fully isolated views.

---

## Optimization

### Q: How do I maximize my Pro usage?

**Session management:**

- `/compact` to reduce context in long sessions.
- Close unused sessions to avoid accidental token consumption.
- Start fresh contexts when switching task types.

**Token efficiency:**

- Batch related work — let one session deliver a feature, don't re-explain context across sessions.
- Use `/model` strategically: Haiku for simple tasks, Sonnet 5 for everyday, Opus 4.8 when reasoning depth matters.
- Be specific in prompts to avoid back-and-forth.

**Project structure:**

- Keep `CLAUDE.md` concise — it loads every session.
- Point Claude at specific files rather than letting it scan the whole repo.

---

[← Back to README](../../README.md#faq) · [Skills FAQ](../skills.md#skills-faq) · [Changelog](changelog.md)
