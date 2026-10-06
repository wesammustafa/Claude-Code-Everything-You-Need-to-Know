<a id="models--specifications--pricing"></a>
# Models and effort

<sub>Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

Which model a session runs and how hard it thinks are two separate choices. This page is the lookup for both: the model aliases, the effort levels and the ways to set them. Which model and effort a task needs is taught in the Intermediate lesson [Pick the model and effort](../intermediate/03-model-and-effort.md). To compare the current models and find their IDs, see Anthropic's [models overview](https://platform.claude.com/docs/en/about-claude/models/overview).

<a id="the-current-lineup-july-2026"></a><a id="the-current-lineup-as-of-october-4-2026"></a><a id="the-headliners"></a><a id="claude-sonnet-5--the-new-default"></a><a id="claude-sonnet-5-legacy"></a><a id="claude-opus-48--the-opus-flagship"></a><a id="claude-opus-48-legacy"></a><a id="claude-fable-5--the-mythos-class"></a><a id="claude-fable-5-legacy"></a>
## Aliases

An alias picks the recommended model of a family, so you never need a version number. Pick one with `/model <alias>`, `claude --model <alias>` or the `model` setting ([Model configuration](https://code.claude.com/docs/en/model-config#model-aliases)).

| Alias | On the Anthropic API it uses | Reach for it when |
|---|---|---|
| `sonnet` | The latest Sonnet | Day-to-day coding |
| `opus` | The latest Opus | Complex reasoning |
| `fable` | The Fable model for your provider | The hardest, longest-running tasks |
| `best` | Fable where your account has it, otherwise Opus | You want the strongest model available to you |
| `haiku` | Haiku | Quick, simple tasks |
| `opusplan` | Opus in plan mode, then Sonnet to carry out the plan | You want deep planning and cheaper execution |
| `opus[1m]` | Opus with a 1 million token context window | Very long sessions, on a provider where `opus` doesn't already have that window |

- An alias moves to a newer model over time. To stay on one version, use its full model name, such as `claude-opus-5-5`, from the [models overview](https://platform.claude.com/docs/en/about-claude/models/overview).
- `default` isn't an alias: it clears any model you picked and returns to your account's default.
- On other providers an alias can resolve to an older model: `sonnet` does on Claude Platform on AWS, Amazon Bedrock, Google Cloud's Agent Platform and Microsoft Foundry, and `opus` does on Microsoft Foundry. The [alias table](https://code.claude.com/docs/en/model-config#model-aliases) lists them.
- Fable can draw on usage credits depending on your plan and seat ([Fable and usage credits](https://code.claude.com/docs/en/model-config#fable-and-usage-credits)).

The default model differs by account type and provider. Check yours with `/model` or `/status`, and see [Default model setting](https://code.claude.com/docs/en/model-config#default-model-setting) for the rules.

## Effort levels

Effort controls how much the model reasons on each step. Lower effort answers sooner and spends fewer tokens; higher effort checks more of its own work ([Adjust effort level](https://code.claude.com/docs/en/model-config#adjust-effort-level)).

| Level | Fits |
|---|---|
| `low` | Quick exchanges where you review each result: a first sketch, a rename |
| `medium` | Day-to-day work with a clear scope, such as a new feature, on the models where it is the default; elsewhere, a cheaper level that gives up some capability |
| `high` | Work where edge cases are likely, such as fixing a bug in existing code |
| `xhigh` | Deeper reasoning at a higher token spend |
| `max` | Hard problems Claude works through without you; test it before relying on it, since it can overthink |

- Which levels a model offers, and which one it starts at, differ by model: see the [levels per model](https://code.claude.com/docs/en/model-config#adjust-effort-level) in the docs. `/effort status` prints the level in effect.
- Set a level the model doesn't offer and Claude Code uses the highest level it does offer below that.
- The scale is calibrated per model, so `high` on one model is not the same amount of reasoning as `high` on another.

## Setting effort

| Where | How long it lasts |
|---|---|
| `/effort <level>`, or `/effort` for a slider | Saved as your default for that model; press `s` in the slider for this session only |
| The effort slider in `/model` | The same as `/effort` |
| `claude --effort <level>` | This session |
| `CLAUDE_CODE_EFFORT_LEVEL` environment variable | Every session started with it. It overrides the other sources, though a `maxEffortLevel` cap still applies |
| `modelSettings` or `effortLevel` in a settings file | Every session the file applies to. `modelSettings` sets one model's level; a top-level `effortLevel` in your user settings doesn't apply to the newest models |
| `effort` in a skill's or subagent's frontmatter | While that skill or subagent runs |

`/effort auto` clears the level you saved for the current model; the model then uses an `effortLevel` from your settings if one applies, otherwise its own default ([Set the effort level](https://code.claude.com/docs/en/model-config#set-the-effort-level)).

## Gotchas

- `max` applies to the current session only, unless you set it with `CLAUDE_CODE_EFFORT_LEVEL`. The `effortLevel` and `modelSettings` settings don't accept it.
- `ultrathink` in a prompt asks for deeper reasoning on that turn only and leaves the effort level unchanged. Phrases such as "think hard" are ordinary text ([Use ultrathink](https://code.claude.com/docs/en/model-config#use-ultrathink-for-one-off-deep-reasoning)).
- Ultracode is a setting, not an effort level: with it on, Claude plans a [dynamic workflow](https://code.claude.com/docs/en/workflows) for each substantive task, at whatever level the session runs ([Model configuration](https://code.claude.com/docs/en/model-config#adjust-effort-level)).
- Switching models in the middle of a session recomputes the whole request, and on most models so does changing effort, so Claude Code may ask you to confirm first ([Prompt caching](https://code.claude.com/docs/en/prompt-caching)).

<a id="fast-mode"></a>
## Related pages

- Fast mode, which the docs mark "in research preview": a faster configuration of supported Opus models that subscription plans pay for with usage credits only. See [Fast mode](https://code.claude.com/docs/en/fast-mode), and the [Fast mode](../intermediate/electives/fast-mode.md) Elective.
- Choosing a model and effort for a task: Anthropic's [Choosing a Claude model and effort level in Claude Code](https://claude.com/blog/claude-model-and-effort-level-in-claude-code).
- Retirement dates: [Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations).

<a id="pricing"></a><a id="subscription-plans"></a><a id="api-pay-as-you-go"></a>
The guide carries no prices or plan limits. See [claude.com/pricing](https://claude.com/pricing) for plans and [API pricing](https://platform.claude.com/docs/en/about-claude/pricing) for per-token rates.

---

<sub>Sources: [Model configuration](https://code.claude.com/docs/en/model-config) · [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) · [Prompt caching](https://code.claude.com/docs/en/prompt-caching) · [Fast mode](https://code.claude.com/docs/en/fast-mode) · [Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations) · [Pricing](https://claude.com/pricing) · [API pricing](https://platform.claude.com/docs/en/about-claude/pricing)</sub>

<sub>Up: [Reference](README.md)</sub>
