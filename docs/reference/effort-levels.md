# Reasoning Effort Levels

*~10 min read · [← Back to README](../../README.md#prompt-engineering-deep-dive)*

> **Mental model:** Effort is a **behavioural dial**, not a strict token budget. It shifts how much Claude thinks before responding, how willing it is to read related files, how long the response gets, and how persistently it pushes through multi-step work. A higher dial doesn't make the model smarter — it changes its bias.

---

## TL;DR

- **5 levels exist:** `low` · `medium` · `high` · `xhigh` · `max` — most users assume 4.
- **`xhigh` is Opus 4.7-only.** Opus 4.6 and Sonnet 4.6 expose only `low / medium / high / max`.
- **Current defaults (May 2026, post-v2.1.117):** Opus 4.7 → `xhigh` on every plan; Opus 4.6 + Sonnet 4.6 → `high` on every plan.
- **Context quality often beats more effort.** A model on Low with great context regularly outperforms the same model on Max with poor context.
- **Higher ≠ always better.** Anthropic's own guidance: max on Opus 4.7 "shows diminishing returns and is more prone to overthinking" on routine work.
- **Persistence has gotchas.** The `ultrathink` keyword doesn't change the API effort, and `"effortLevel": "max"` in `settings.json` silently downgrades — covered below.

---

## What effort actually controls

Effort affects three documented behaviours simultaneously, plus a fourth pattern the community has named:

| Dimension | Low | Medium | High / xHigh / Max |
|---|---|---|---|
| **Thinking depth** | Skips on simple problems | Thinks when warranted | Almost always engages reasoning |
| **Tool-call appetite** | Minimum exploration | Reads what's asked for | Reads related files unprompted |
| **Response length** | Terse | Balanced | Thorough, structured |
| **Agentic persistence** *(community framing)* | Pauses to ask for clarification | Plans ahead, keeps moving | Drives through multi-step work autonomously |

Even at low, Claude will still think on sufficiently hard problems — just less than it would at higher effort.

---

## The five levels

| Effort | Available on | Behaviour | Reach for it when… |
|---|---|---|---|
| **Low** | All Claude 4 models | Fastest. Skips thinking on simple problems, minimum tool use, terse responses, pauses to ask for clarification. | Fast interactive queries where you're steering — file renames, simple greps, build commands. |
| **Medium** | All Claude 4 models | Balanced. Thinks when warranted, skips when not. | General coding, small refactors, writing tests, autonomous sessions where the plan is clear. |
| **High** | All Claude 4 models | Almost always engages thinking, reads related files unprompted, gives thorough responses. | Multi-file refactors, complex debugging. Anthropic's recommended default for most coding on Sonnet 4.6 / Opus 4.6. |
| **xHigh** | **Opus 4.7 only** | A notch above high — more thorough reasoning, more willing to explore, persists across sessions. | Long autonomous agentic sessions. Anthropic's recommended default for most coding on Opus 4.7. |
| **Max** | All Claude 4 models (current session unless via env var) | Highest capability, no token constraints on reasoning. | Architecture decisions, subtle bugs, security reviews — genuinely hard problems. Skip for routine work. |

> ⚠️ **Anthropic's official guidance for Opus 4.7 max:** *"Reserve for genuinely frontier problems. On most workloads `max` adds significant cost for relatively small quality gains, and on some structured-output or less intelligence-sensitive tasks it can lead to overthinking."* — [Effort API docs](https://platform.claude.com/docs/en/build-with-claude/effort)

---

## Defaults by plan and model

| Model | Default effort | Notes |
|---|---|---|
| **Opus 4.7** | `xhigh` | All plans (Pro, Max, Team, Enterprise, API) |
| **Opus 4.6** | `high` | All plans, current as of Claude Code v2.1.117 |
| **Sonnet 4.6** | `high` | API and Claude Code |
| **Haiku 4.5** | n/a | Effort dial isn't meaningful on Haiku |

> 📜 **Why community write-ups still say "medium on Pro/Max":** the 4.6 default has churned. Originally `high`, dropped to `medium` for all plans in early March 2026 (a deliberate speed/cost tune that hit quality), reverted to `high` for API / Bedrock / Team / Enterprise on April 7 in v2.1.94, then standardized to `high` everywhere in v2.1.117. If a guide tells you Pro/Max users are on a nerfed `medium` default, **check `/effort` in your session** — that was true for ~6 weeks but is fixed now. *Tracked in [`anthropics/claude-code` issue #42796](https://github.com/anthropics/claude-code/issues/42796).*

If you had a manual effort level set on a prior model, Opus 4.7 overrides it to `xhigh` on first run — use `/effort` to assert your preference.

---

## Per-model behaviour

| Model | Notes |
|---|---|
| **Haiku 4.5** | Effort parameter behaves differently — not a meaningful dial. Use Haiku for simple lookups, quick edits, boilerplate. |
| **Sonnet 4.6** | Default high. Sonnet **follows directions closely without drift** — if you plan well upfront, you can drop to a lower effort for execution. |
| **Opus 4.6** | Default high. The level whose defaults churned the most over March–April 2026. |
| **Opus 4.7** | Default xhigh. Respects effort more strictly than 4.6 — at lower effort it scopes work tighter rather than going above and beyond. The new tokenizer uses **roughly 1.0–1.35× more tokens per same input than 4.6** (≈1.0–1.1× on code, ≈1.35× on complex text), so sessions burn through limits faster at the same effort. |

---

## When to use what

| Task | Model + Effort |
|---|---|
| File renames, simple greps, build commands | Sonnet Low |
| General coding, small refactors, writing tests | Sonnet Medium |
| Multi-file refactors, complex debugging | Sonnet High |
| Long autonomous agentic sessions | Opus xHigh |
| Architecture decisions, subtle bugs, security reviews | Opus Max |

---

## The plan-with-high / execute-with-low pattern

A repeatable cost-saver for harder tasks:

1. **Plan in Opus xHigh or Max.** Get a clean, atomic, unambiguous plan with explicit task boundaries. This is where deep reasoning earns its keep.
2. **Execute in Sonnet at lower effort.** Sonnet follows clear plans closely without drift. If the plan leaves no room for interpretation, execution is cheap.

The pattern fails when the plan has gaps — Sonnet at low effort won't catch ambiguity it inherits, so the cleanup costs more than the savings. Invest in the plan; the execution comes for free.

---

## Effort ≠ intelligence — the context-quality trap

> 💡 **The most actionable insight here:** effort level is partly a **context-quality proxy**. A model on Low with great context regularly beats the same model on Max with poor context — the extra thinking budget gets spent reconstructing state the session should already have.

**Practical heuristic:** if you're reaching for Max on a task that shouldn't need it, ~80% of the time the fix is upstream — not in how hard the model thinks:

- A sharper [`CLAUDE.md`](https://docs.anthropic.com/en/docs/claude-code/memory) that names files, conventions, and constraints explicitly.
- A clearer plan with atomic, zero-ambiguity tasks.
- Files referenced by path, not "the thing we discussed earlier."
- Errors pasted in full, not paraphrased.

A project that works fine on High but falls apart on Medium is telling you something about your context setup, not the model.

---

## Setting effort

Five mechanisms, in increasing order of persistence:

| Mechanism | How | Persistence |
|---|---|---|
| **Per-turn keyword** | `ultrathink` in your prompt — adds an in-context instruction; *does not change the API effort* | This turn only |
| **Per-session command** | `/effort <level>` — or `/effort` (no args) for an interactive slider; `/effort auto` resets to model default | Current session |
| **Per-session flag** | `claude --effort <level>` at launch | Current session |
| **Persistent (low / medium / high / xhigh)** | `"effortLevel": "high"` in `~/.claude/settings.json` (user) or `.claude/settings.json` (project) | All sessions |
| **Persistent for max** | `CLAUDE_CODE_EFFORT_LEVEL=max` in your shell profile — the only mechanism that reliably persists max | All sessions |

```bash
# Quick raise for one turn (in-context only — see gotcha below)
> ultrathink — design the migration strategy here

# Raise for the session
/effort xhigh

# Persist project-wide (any level except max)
echo '{ "effortLevel": "high" }' > .claude/settings.json

# Persist max — only mechanism that works
export CLAUDE_CODE_EFFORT_LEVEL=max   # add to ~/.zshrc / ~/.bashrc
```

> Precedence (highest to lowest): `CLAUDE_CODE_EFFORT_LEVEL` env var → `--effort` flag → `/effort` command → `effortLevel` in `settings.json` → model default.

---

## Known gotchas

### `ultrathink` doesn't change the API effort

Per Anthropic's docs, `ultrathink` "adds an in-context instruction" and **the effort level sent to the API is unchanged**. The community-discovered consequence: if you're already running `xhigh` or `max`, the in-context "think harder" cue is essentially redundant or, worse, can cause the model to anchor to a "high"-style trace rather than its higher-effort default. **For a deliberately deeper turn on a session at xhigh/max, prefer `/effort max` (set, prompt, then `/effort auto`) over the keyword.**

### `settings.json` silently downgrades `max`

`"effortLevel": "max"` in `settings.json` does not actually persist max — once the UI is interacted with, the value gets quietly downgraded. **Only `CLAUDE_CODE_EFFORT_LEVEL=max` as an environment variable reliably persists max** across sessions.

### Opus 4.7 ignores prior `effortLevel`

If your `settings.json` had a manual effort set for a prior model, Opus 4.7 overrides it to `xhigh` on first run. Use `/effort <level>` to assert your preference, or update `effortLevel` after switching.

### Don't ask for `xhigh` on 4.6 models

`xhigh` only exists on Opus 4.7. Asking for it on Opus 4.6 or Sonnet 4.6 will fall back to the model's accepted ceiling.

---

## Decision shortcut

If you remember nothing else from this page:

1. **Check your current effort with `/effort`** — defaults have churned and your `settings.json` may be stale.
2. **Stay on the model default** unless you have a specific reason to change. (`high` for 4.6 / Sonnet, `xhigh` for 4.7.)
3. **Reach for max only when the problem genuinely needs it** — architecture, subtle bugs, security review. Skip for routine work.
4. **Before raising effort, fix context.** Sharper `CLAUDE.md`, atomic plan, named files. ~80% of the time that's the actual fix.
5. **Plan with Opus xHigh/Max, execute with Sonnet** at a lower effort when the work is large enough to split.

---

## Sources

- [Claude Code model-config docs](https://code.claude.com/docs/en/model-config.md) — canonical reference for `effortLevel`, `/effort`, env var, and precedence
- [Anthropic Effort API docs](https://platform.claude.com/docs/en/build-with-claude/effort) — the `xhigh` / `max` guidance and per-level behaviour
- [Introducing Claude Opus 4.7](https://www.anthropic.com/news/claude-opus-4-7) — model-level context for the new defaults
- [`anthropics/claude-code` issue #42796](https://github.com/anthropics/claude-code/issues/42796) — March/April 2026 default-drop timeline
- [OpenRouter — Opus 4.7 tokenizer analysis](https://openrouter.ai/announcements/opus-47-tokenizer-analysis) — the 1.0–1.35× tokenizer-cost data

---

## See also

- [Models — specs and pricing](models.md) — adaptive thinking, model IDs, when to pick which
- [Slash commands reference](commands.md) — `/effort`, `/cost`, `/model`
- [README → Prompt Engineering Deep Dive](../../README.md#prompt-engineering-deep-dive) — `think` directives, Explore→Plan→Code→Commit, TDD workflow
- [FAQ](faq.md) — pricing, plan limits, Fast Mode

---

[← Back to README](../../README.md#prompt-engineering-deep-dive) · [Models](models.md) · [Commands](commands.md)
