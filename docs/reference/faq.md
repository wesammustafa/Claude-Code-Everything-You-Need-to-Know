# FAQ — Claude Code & Claude Plans

*[← Back to README](../../README.md#faq)*

A consolidated FAQ covering models, pricing, tokens, plans, Fast Mode, worktrees, and Pro-plan optimization. For Skills-specific questions, see [`docs/skills.md` → Skills FAQ](../skills.md#skills-faq).

---

## Models

### Q: What Claude models are available in 2026?

As of May 2026, the Claude 4 model family is:

| Model | Model ID | Context window | Max output | Best for |
|---|---|---|---|---|
| **Opus 4.7** *(flagship)* | `claude-opus-4-7` | 200K (1M beta via API) | 128K | Complex reasoning, large refactors |
| **Sonnet 4.6** *(balanced)* | `claude-sonnet-4-6` | 200K | 8K | Everyday coding |
| **Haiku 4.5** *(fast/cheap)* | `claude-haiku-4-5-20251001` | 200K | 8K | Lightweight tasks |

**Key features:**

- **Adaptive thinking** — Opus 4.7 scales reasoning depth automatically; hint with `"think"`, `"think hard"`, or `"ultrathink"`.
- **1M context window** — Beta via API only (not in subscription plans at launch).
- **Fast Mode** — 2.5× faster, 6× pricing. **Runs on Opus 4.6** even when your default is 4.7. Toggle with `/fast`.
- **Previous generation** — `claude-opus-4-6` and `claude-sonnet-4-5-20250929` remain accessible via API and `/model`.

> Anthropic ships new models often. Check the [official model overview](https://docs.anthropic.com/en/docs/about-claude/models) for the current list.

### Q: Can I use Opus 4.7's 1M context window?

The 1M token context window is currently in **beta, API-only**.

- ✅ Available via API with an API key
- ❌ Not available in Pro/Max subscription plans (limited to 200K)
- Beta access required

**How to access:**

- Use the Claude API directly with your API key
- Set model to `claude-opus-4-7`
- Enable beta features in API settings

**Best for:** analyzing entire large codebases at once, processing extensive documentation, complex multi-file refactoring.

---

## Reasoning effort

### Q: How many reasoning effort levels are there, and what's my default?

**Five:** `low / medium / high / xhigh / max`. As of May 2026 (Claude Code v2.1.117+):

| Model | Default |
|---|---|
| Opus 4.7 | `xhigh` (every plan) |
| Opus 4.6 | `high` (every plan) |
| Sonnet 4.6 | `high` (every plan) |
| Haiku 4.5 | n/a |

`xhigh` is Opus 4.7-only. Run `/effort` to see and change yours. For the full breakdown — defaults timeline, persistence ladder, gotchas, decision matrix — see [Effort levels](effort-levels.md).

### Q: I read Pro/Max users are on a "nerfed medium" default. Is that still true?

It was true between early March and late April 2026, but **it's been fixed**. Opus 4.6 / Sonnet 4.6 now default to `high` on all plans (Pro, Max, Team, Enterprise) since Claude Code v2.1.117. Older guides may still report the old behaviour — verify with `/effort` in your session.

### Q: Does `ultrathink` actually raise effort?

It adds an in-context "think harder" instruction but **does not change the API effort level**. If you're already on `xhigh` or `max`, the keyword is essentially redundant. For a deliberately deeper turn, set `/effort max`, prompt, then `/effort auto` to reset.

### Q: Why doesn't `"effortLevel": "max"` in `settings.json` persist?

Known issue — `max` is silently downgraded once the UI is interacted with. The only mechanism that reliably persists max across sessions is the `CLAUDE_CODE_EFFORT_LEVEL=max` environment variable. Add it to your shell profile.

---

## Skills & commands

### Q: What's the difference between custom slash commands and skills?

They're the same thing. Both refer to markdown files in `.claude/commands/` invoked with `/skill-name`. See [`docs/skills.md` → Skills FAQ](../skills.md#skills-faq) for security best practices, team sharing, and troubleshooting.

---

## Tokens & limits

### Q: How many messages do I get on the Pro plan?

~**45 messages per 5-hour rolling window** (roughly 10–40 coding prompts depending on complexity). Limits reset every 5 hours; full access to all current and previous-generation models.

### Q: How are tokens counted?

Everything in your interaction counts: your prompts, Claude's responses, system instructions, tool definitions, and any file content Claude reads.

| Input | Token cost |
|---|---|
| English text | ~1 token per 0.75 words (1,000 tokens ≈ 750 words) |
| Punctuation / code symbols | Each counts as ~1 token |
| Images | `(width_px × height_px) / 750` tokens |
| File reads | Each line counts; `CLAUDE.md` adds context every session |

> 💡 Use the [Claude tokenizer](https://claude-tokenizer.vercel.app/) for an exact count, or `/cost` inside Claude Code to track live usage.

### Q: How much code can I work on per 5-hour window?

**Theoretical:** ~2,900–3,400 lines of pure code per Pro window.

**Practical:** effective for projects in the **1,000–2,000 line range** because tokens are shared across reading existing code, Claude's analysis, your back-and-forth, and the file edits themselves.

---

## Pricing & plans

### Q: What are the Claude subscription plans?

As of May 2026 (verify on [anthropic.com/pricing](https://www.anthropic.com/pricing) before committing):

| Plan | Price | Models | Usage limit | Claude Code |
|---|---|---|---|---|
| **Free** | $0 | Limited | Base | Limited |
| **Pro** | $20/mo ($17/mo annual) | All | ~45 msg / 5hr | Full |
| **Max 5x** | $100/mo | All | 5× Pro | Full |
| **Max 20x** | $200/mo | All | 20× Pro | Full |

- **Unified subscription** — One subscription covers both web (claude.ai) and CLI (Claude Code).
- **All models** means current (Opus 4.7, Sonnet 4.6, Haiku 4.5) plus previous-generation 4.6/4.5.
- **Average costs** — Pro users typically spend ~$6/day; 90% spend under $12/day.

### Q: API pricing (pay-as-you-go)?

| Model | Input (per MTok) | Output (per MTok) |
|---|---|---|
| Opus 4.7 | $5 | $25 |
| Sonnet 4.6 | $3 | $15 |
| Haiku 4.5 | $1 | $5 |
| Opus 4.6 (Fast Mode) | $30 (6×) | $150 (6×) |

### Q: Pro vs. Max 5x vs. Max 20x?

Same models, more capacity:

- **Max 5x ($100/mo)** — ~225 messages/5hr. Heavy daily users; multiple parallel projects.
- **Max 20x ($200/mo)** — ~900 messages/5hr. Teams, power users, production work.

**Upgrade if:** you frequently hit Pro limits, run multiple parallel sessions, or need guaranteed availability during peak hours.

---

## Fast Mode

### Q: What is Fast Mode and when should I use it?

Fast Mode delivers **2.5× faster responses** at **6× pricing**. It runs on **Opus 4.6** specifically — Opus 4.7 doesn't expose Fast Mode (yet).

- Toggle with `/fast`. The **↯** indicator confirms it's on.
- Visual indicator: **↯** appears in the session header.

| | Standard Opus 4.6 | Fast Mode |
|---|---|---|
| Input (per MTok) | $5 | $30 |
| Output (per MTok) | $25 | $150 |

**Use it for:** rapid iteration, live debugging, time-sensitive deployments, demo prep.
**Skip it for:** long background tasks, budget projects, exploratory work, documentation.

> 💡 Toggle on for the focused sprint, toggle off when you're done. The cost difference adds up fast.

---

## Sessions, terminals & worktrees

### Q: What happens when I run multiple Claude Code sessions in different terminals?

**Usage limits are shared.** All Claude Code sessions on your account draw from the same 5-hour message budget — running 3 parallel sessions exhausts it ~3× faster.

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
- Use `/model` strategically: Haiku for simple tasks, Sonnet 4.6 for everyday, Opus 4.7 only when reasoning depth matters.
- Be specific in prompts to avoid back-and-forth.

**Project structure:**

- Keep `CLAUDE.md` concise — it loads every session.
- Point Claude at specific files rather than letting it scan the whole repo.

---

[← Back to README](../../README.md#faq) · [Skills FAQ](../skills.md#skills-faq) · [Changelog](changelog.md)
