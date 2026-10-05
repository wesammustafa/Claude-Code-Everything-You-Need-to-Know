# Lesson template

Copy the block below into `docs/<level>/NN-<slug>.md` for a core lesson. For an Elective, save it under `docs/<level>/electives/`, write `Elective` in place of the position in the header line, and drop the `npm run check` line. The `lesson-lint` check enforces this shape, and [CONTRIBUTING.md](../CONTRIBUTING.md#lessons) explains each slot.

Replace every example value: the level, position, time, links, Stamp, lesson id (`b-1` here) and the text in each slot. Keep the slot headings exactly as they are.

````markdown
# Write the title as something the Learner does

<sub>**Beginner** · Lesson 1 of 5 · about 15 minutes · Needs: [Beginner index](README.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

## Goal

By the end of this lesson you can do one thing, worded so an onlooker could tell whether it happened.

## You need

- Your copy of the practice template, cloned, with no uncommitted changes. To practice in your own repository instead, keep the template copy for the check.
- Usage: light.

## The idea

The working model in about 150 words at most. Link each fact that can go stale to its official page at first mention.

## Worked example

1. A step with the real command:

   ```bash
   claude
   ```

2. What the Learner sees after it, as text.

## Your turn

1. The exercise, faded by level: the same steps at Beginner, a partial file at Intermediate, a brief with acceptance criteria at Advanced.

## Check

You are done when all of these are true:

- [ ] A state a script can read, with the command that shows it.
- [ ] Self-check (not tested): one thing only a live session can show.

Run `npm run check -- b-1` in your practice copy. In your own repository, run `npm run check -- b-1 --dir <your repo>` from your practice copy instead.

If the first item fails, the one most likely cause and how to fix it.

## Watch out

- At most three items: safety first, then cost, then gotchas.

## Go further

- At most three links: an Elective, the official page, an Academy lesson.

---

<sub>Sources: [Official page](https://code.claude.com/docs/en/overview)</sub>

<sub>← [Previous lesson](README.md) · [Beginner index](README.md) · [Next lesson](README.md) → · Topic: [Topic](../topics/README.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-1)</sub>
````
