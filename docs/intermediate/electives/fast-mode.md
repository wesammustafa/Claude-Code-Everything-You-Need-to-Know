# Fast mode

<sub>**Intermediate** · Elective · about 10 minutes · Needs: [Pick the model and effort](../03-model-and-effort.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-06</sub>

> [!NOTE]
> "Fast mode is in research preview. The feature, pricing, and availability may change based on feedback." ([Speed up responses with fast mode](https://code.claude.com/docs/en/fast-mode))

## Goal

By the end of this Elective you can tell when fast mode is worth its cost, and turn it on and off.

## You need

- Claude Code signed in with a Claude plan, or with a Claude Console account whose organization has fast mode access. Fast mode isn't available on Amazon Bedrock, Google Cloud's Agent Platform, Microsoft Foundry or Claude Platform on AWS ([Requirements](https://code.claude.com/docs/en/fast-mode#requirements)).
- On a Pro, Max, Team or Enterprise plan: usage credits turned on. `/usage-credits` opens the page that turns them on; on Team and Enterprise, a member without billing access runs it to ask the organization's admins. On Team and Enterprise, an Owner also turns fast mode on for the organization.
- Usage: billed beyond your plan (usage credits). Fast mode draws on usage credits even when your plan has usage left. The exercise is optional.

## The idea

Fast mode runs Claude Opus with an API configuration that answers faster, at a higher price per token. It's the same model, with the same quality ([Speed up responses with fast mode](https://code.claude.com/docs/en/fast-mode)). It works only on the Opus models the docs list; turning it on switches you to Opus if you're on another model.

Use it for interactive work where waiting costs you more than tokens do: rapid iteration, live debugging. Leave it off for long autonomous runs, CI and cost-sensitive work. On a subscription plan, every fast-mode token comes from usage credits, never from your plan's included usage.

Turning it on partway through a conversation charges the whole conversation so far once at fast mode's uncached rate, so turn it on at the start of a session.

## Worked example

1. Start `claude` and run `/fast`. If usage credits are off on a Claude plan, it reports `Fast mode requires usage credits`, and you can stop here: you've seen what fast mode needs.
2. To turn it on, press `Space` in the `/fast` panel, then `Enter`. Claude Code confirms `Fast mode ON`, a small `↯` icon appears next to the prompt, and you're on Opus.
3. Run `/fast` again, toggle it off and confirm. You stay on Opus; switch back with `/model` if you were on another model.

## Your turn

This exercise is optional, because it spends usage credits.

1. Start a new session, turn fast mode on before your first prompt, and do a few minutes of quick back-and-forth work.
2. Turn it off when you're done, and check what it cost: on Pro and Max, the **Usage credits** section of **Settings > Usage** on claude.ai; on Team and Enterprise, `/usage`; on Claude Console, the Console's **Usage** and **Cost** pages ([See where fast mode spend appears](https://code.claude.com/docs/en/fast-mode#see-where-fast-mode-spend-appears)).

## Check

You are done when all of these are true:

- [ ] `/fast` shows whether fast mode is on, or tells you what your account needs first.
- [ ] Self-check (not tested): you can name a task you would use fast mode for and one you wouldn't, and say where its cost comes from on your plan.

If `/fast` says `Fast mode has been disabled by your organization`, an Owner hasn't turned it on for your Team or Enterprise organization, or your organization's managed settings turn it off.

## Go further

- [Fast mode vs effort level](https://code.claude.com/docs/en/fast-mode#fast-mode-vs-effort-level): the two ways to get faster answers, and combining them.
- [Require per-session opt-in](https://code.claude.com/docs/en/fast-mode#require-per-session-opt-in): start every session with fast mode off.

---

<sub>Sources: [Speed up responses with fast mode](https://code.claude.com/docs/en/fast-mode)</sub>

<sub>Back to the [Intermediate index](../README.md) · Topic: [Models, effort and cost](../../topics/models-effort-and-cost.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-fast-mode)</sub>
