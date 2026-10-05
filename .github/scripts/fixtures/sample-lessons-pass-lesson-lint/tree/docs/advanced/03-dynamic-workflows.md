# Run and save a dynamic workflow

<sub>**Advanced** · Lesson 3 of 7 · about 20 minutes, plus run time · Needs: [Choose an orchestration pattern](#) · Verified against Claude Code v2.1.X (stable) on YYYY-MM-DD</sub>

## Goal

By the end of this lesson you can have Claude write a [dynamic workflow](https://code.claude.com/docs/en/workflows) for a fan-out task, keep its cost bounded, and save it as a command you can rerun with input.

## You need

- A paid plan or API access. **On Pro, workflows are off until you turn on the Dynamic workflows row in `/config`.**
- Your own repository with at least 20 source files, or your template copy. At the end, run `npm run check -- a-3 --dir <repo>` from your template copy, with `<repo>` the repository you used. In your own repository, first run `echo '.practice/' >> .git/info/exclude` once, so git ignores the folder where you save reports.

## The idea

In the previous lesson you saw that a workflow moves the plan out of Claude's turn-by-turn reasoning and into a script. The runtime runs the script in the background, the script spawns the agents, and only the final answer returns to your conversation. That makes a workflow rerunnable, and it lets the script cross-check its own agents' findings.

## Worked example

1. Run the bundled workflow and approve it when asked: `/deep-research What changed in the Node.js permission model between v20 and v22?`
2. Run `/workflows`, select the run and press Enter. Each phase shows its agent count, tokens and elapsed time.
3. Press `Shift+Tab` until the status bar reads `⏸ manual mode on`. In auto mode, Claude Code asks before only your first workflow launch ([Approve the plan before it runs](https://code.claude.com/docs/en/workflows#approve-the-plan-before-it-runs)), so you would not get to read the script.
4. Ask for a workflow of your own, in plain words:

   ```text
   use a workflow to audit every route handler under src/routes/ for missing authentication checks, and adversarially verify each finding before reporting it
   ```

   In your template copy, or any repository without `src/routes/`, name a folder it does have and a check that fits its code.

5. Before it starts, Claude Code shows the planned phases. Choose **View raw script** once to read what will run, then **Yes, run it**.
6. When it finishes, open `/workflows`, select the run, press `s` and save it to `.claude/workflows/`. New sessions pick it up by name; to run it in this session, run `/reload-skills` first ([Edit a saved script](https://code.claude.com/docs/en/workflows#edit-a-saved-script)). Commit it, and anyone who clones the repository can run it.

## Your turn

**Brief.** Build a workflow that finds every `TODO` and `FIXME` comment in a folder you name, checks whether each one still applies to the current code, and reports the ones that do.

**Acceptance criteria:**
- It is saved in `.claude/workflows/` and runs by name.
- It takes the folder as input (`args`), so `Run /<name> on src/payments` works without editing the script.
- Every reported item has a `file:line`, and items that no longer apply are left out.
- A first run on a single small folder stays under your size guideline and shows no `Large workflow` warning.

After each edit to the script, run `/reload-skills` before you run it again. Save the reports of two runs on different folders as `.practice/a-3-run1.md` and `.practice/a-3-run2.md`, each with the folder you ran it on as its first line.

## Check

- [ ] Your script is in `.claude/workflows/`, and it parses as a workflow script.
- [ ] `.practice/a-3-run1.md` and `.practice/a-3-run2.md` name different folders on their first lines, the two reports differ, and every `path:line` in them exists and holds `TODO` or `FIXME`.
- [ ] Self-check (not tested): you did not edit the script between the two runs, three reported items you spot-checked still apply, and in `/workflows` each run's agent count stayed within your size guideline.

Run `npm run check -- a-3 --dir <your repo>` from your template copy (or `npm run check -- a-3` inside the template).

## Watch out

- One run can use far more tokens than doing the task in conversation, and it counts against your plan's limits. Try it on one small folder first.
- The `Large workflow` warning, which appears above 25 agents or 1.5 million projected tokens, is advisory. It does not stop the run; stop it yourself from `/workflows`.
- In auto mode, one Yes approves every later workflow launch.

## Go further

- Elective: [Agent teams](#), for when the workers need to talk to each other.
- Official: [Pass input to a saved workflow](https://code.claude.com/docs/en/workflows#pass-input-to-a-saved-workflow) and [Set a size guideline](https://code.claude.com/docs/en/workflows#set-a-size-guideline).

---

<sub>Sources: [Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows)</sub>

<sub>← [Choose an orchestration pattern](#) · [Advanced index](#) · [Script Claude Code with `claude -p`](#) → · Topic: [Subagents and parallel work](../topics/subagents-and-parallel-work.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-3)</sub>
