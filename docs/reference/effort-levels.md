# Reasoning Effort Levels

*~8 min read · [← Back to README](../../README.md#prompt-engineering-deep-dive)*

> **Mental model:** Effort is a **behavioural dial**, not a strict token budget. It shifts how much Claude thinks before responding, how willing it is to read related files, how long the response gets, and how persistently it pushes through multi-step work. A higher dial doesn't make the model smarter — it changes its bias.

---

## TL;DR

- **The API knows 5 levels:** `low` · `medium` · `high` · `xhigh` · `max`, with `high` as the default.
- **Claude Code adds a 6th:** `ultracode` — `xhigh` reasoning plus standing permission to orchestrate multi-agent [workflows](https://code.claude.com/docs/en/workflows). It's not an API level.
- **`max` and `ultracode` are session-only by design** — they can't be persisted in `settings.json`.
- **`xhigh` is broadly available now:** Fable 5, Mythos 5, Opus 4.8, Opus 4.7, and Sonnet 5 all support it (no longer a single-model exclusive).
- **Current defaults (July 2026):** Opus 4.8 → `high` on all surfaces; Sonnet 5 → `high` on API and Claude Code.
- **Context quality often beats more effort.** A model on Low with great context regularly outperforms the same model on Max with poor context.
- **Higher ≠ always better.** Anthropic's own guidance: `max` shows diminishing returns and is more prone to overthinking on routine work.

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

## The six levels

| Effort | Available | Behaviour | Reach for it when… |
|---|---|---|---|
| **Low** | API + Claude Code | Fastest. Skips thinking on simple problems, minimum tool use, terse responses. | Fast interactive queries where you're steering — file renames, simple greps, build commands. |
| **Medium** | API + Claude Code | Balanced. Thinks when warranted, skips when not. | General coding, small refactors, writing tests, autonomous sessions where the plan is clear. |
| **High** | API + Claude Code *(default)* | Almost always engages thinking, reads related files unprompted, gives thorough responses. | Multi-file refactors, complex debugging. The default on current models. |
| **xHigh** | Fable 5, Mythos 5, Opus 4.8/4.7, Sonnet 5 | A notch above high — more thorough reasoning, more willing to explore, more persistent. | Long autonomous agentic sessions. |
| **Max** | API + Claude Code, session-only | Highest capability, no token constraints on reasoning. | Architecture decisions, subtle bugs, security reviews — genuinely hard problems. Skip for routine work. |
| **Ultracode** | Claude Code only, session-only | `xhigh` reasoning **plus** automatic multi-agent workflow orchestration — Claude fans work out to background subagents on every substantive task. | Exhaustive audits, migrations, deep research — when thoroughness matters more than token cost. |

> ⚠️ **Anthropic's official guidance for `max`:** reserve it for genuinely frontier problems. On most workloads it adds significant cost for relatively small quality gains, and on some structured-output tasks it can lead to overthinking. — [Effort API docs](https://platform.claude.com/docs/en/build-with-claude/effort)

---

## Defaults by model

| Model | Default effort | Notes |
|---|---|---|
| **Opus 4.8** | `high` | All surfaces (API, Claude Code, claude.ai) |
| **Sonnet 5** | `high` | API and Claude Code |
| **Fable 5** | `high` | Adaptive thinking always on — it can't be disabled |
| **Haiku 4.5** | n/a | Effort dial isn't meaningful on Haiku |

> 📜 **History:** effort defaults churned through spring 2026 — dropped to `medium` for all plans in early March (a speed/cost tune that hit quality), then standardized back to `high` everywhere in Claude Code v2.1.117 (April 2026). If a guide tells you Pro/Max users are on a nerfed `medium` default, that's the fossil record — **check `/effort` in your session.**

---

## When to use what

| Task | Model + Effort |
|---|---|
| File renames, simple greps, build commands | Sonnet 5, Low |
| General coding, small refactors, writing tests | Sonnet 5, Medium |
| Multi-file refactors, complex debugging | Sonnet 5, High |
| Long autonomous agentic sessions | Opus 4.8, xHigh |
| Architecture decisions, subtle bugs, security reviews | Opus 4.8 or Fable 5, Max |
| Exhaustive multi-agent audits, migrations, deep research | Ultracode |

---

## The plan-with-high / execute-with-low pattern

A repeatable cost-saver for harder tasks:

1. **Plan in Opus 4.8 (or Fable 5) at xHigh or Max.** Get a clean, atomic, unambiguous plan with explicit task boundaries. This is where deep reasoning earns its keep.
2. **Execute in Sonnet 5 at lower effort.** Sonnet follows clear plans closely without drift. If the plan leaves no room for interpretation, execution is cheap.

The pattern fails when the plan has gaps — Sonnet at low effort won't catch ambiguity it inherits, so the cleanup costs more than the savings. Invest in the plan; the execution comes for free.

---

## Effort ≠ intelligence — the context-quality trap

> 💡 **The most actionable insight here:** effort level is partly a **context-quality proxy**. A model on Low with great context regularly beats the same model on Max with poor context — the extra thinking budget gets spent reconstructing state the session should already have.

**Practical heuristic:** if you're reaching for Max on a task that shouldn't need it, ~80% of the time the fix is upstream — not in how hard the model thinks:

- A sharper [`CLAUDE.md`](https://code.claude.com/docs/en/memory) that names files, conventions, and constraints explicitly.
- A clearer plan with atomic, zero-ambiguity tasks.
- Files referenced by path, not "the thing we discussed earlier."
- Errors pasted in full, not paraphrased.

A project that works fine on High but falls apart on Medium is telling you something about your context setup, not the model.

---

## Setting effort

Mechanisms, in increasing order of persistence:

| Mechanism | How | Persistence |
|---|---|---|
| **Per-turn keyword** | `ultrathink` in your prompt — adds an in-context instruction; *does not change the API effort* | This turn only |
| **Per-session command** | `/effort <level>` — or `/effort` (no args) for an interactive slider; `/effort auto` resets to model default | Current session |
| **Per-session flag** | `claude --effort <level>` at launch | Current session |
| **Persistent (low / medium / high / xhigh)** | `"effortLevel": "high"` in `~/.claude/settings.json` (user) or `.claude/settings.json` (project) | All sessions |

```bash
# Quick raise for one turn (in-context only — see gotcha below)
> ultrathink — design the migration strategy here

# Raise for the session
/effort xhigh
/effort ultracode    # xhigh + automatic multi-agent workflows
```

To persist a level project-wide, add the key to your existing `.claude/settings.json` (don't overwrite the file):

```json
{
  "effortLevel": "high"
}
```

> `max` and `ultracode` are session-only by design and cannot be set via `settings.json`.

---

## Known gotchas

### `ultrathink` doesn't change the API effort

Per Anthropic's docs, `ultrathink` "adds an in-context instruction" and **the effort level sent to the API is unchanged**. If you're already running `xhigh` or `max`, the in-context "think harder" cue is essentially redundant. **For a deliberately deeper turn, prefer `/effort max` (set, prompt, then `/effort auto`) over the keyword.**

### Tokenizer overhead on newer models

Opus 4.7+, Opus 4.8, and Fable 5 use a tokenizer that produces **~30% more tokens for the same text** than pre-4.7 models ([pricing docs](https://platform.claude.com/docs/en/about-claude/pricing)) — sessions burn through limits faster at the same effort. Budget accordingly on long agentic runs.

### `ultracode` is not an API level

Setting `effort: "ultracode"` in an API request will fail — it exists only in Claude Code, where it means "xhigh + standing permission to orchestrate workflows."

---

## Decision shortcut

If you remember nothing else from this page:

1. **Check your current effort with `/effort`** — defaults have churned and your `settings.json` may be stale.
2. **Stay on the model default (`high`)** unless you have a specific reason to change.
3. **Reach for `max` only when the problem genuinely needs it** — architecture, subtle bugs, security review. Skip for routine work.
4. **Before raising effort, fix context.** Sharper `CLAUDE.md`, atomic plan, named files. ~80% of the time that's the actual fix.
5. **Plan with Opus at xHigh/Max, execute with Sonnet** at a lower effort when the work is large enough to split.
6. **Use `ultracode` deliberately** — it fans work out to background subagents; wonderful for audits, wasteful for one-line fixes.

---

## Sources

- [Claude Code model-config docs](https://code.claude.com/docs/en/model-config.md) — canonical reference for `effortLevel`, `/effort`, and precedence
- [Anthropic Effort API docs](https://platform.claude.com/docs/en/build-with-claude/effort) — per-level behaviour and the `max` guidance
- [Claude Code workflows docs](https://code.claude.com/docs/en/workflows) — what `ultracode` actually unlocks
- [Model overview](https://platform.claude.com/docs/en/about-claude/models/overview) — per-model effort support

---

## See also

- [Models — specs and pricing](models.md) — model IDs, when to pick which
- [Slash commands reference](commands.md) — `/effort`, `/usage`, `/model`
- [README → Prompt Engineering Deep Dive](../../README.md#prompt-engineering-deep-dive) — `think` directives, Explore→Plan→Code→Commit, TDD workflow
- [FAQ](faq.md) — pricing, plan limits, Fast Mode

---

[← Back to README](../../README.md#prompt-engineering-deep-dive) · [Models](models.md) · [Commands](commands.md)
