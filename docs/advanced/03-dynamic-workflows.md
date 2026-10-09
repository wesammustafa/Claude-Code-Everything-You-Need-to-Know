# Run and save a dynamic workflow

<sub>**Advanced** · Lesson 3 of 7 · about 20 minutes, plus run time · Needs: [Choose an orchestration pattern](02-orchestration-patterns.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-09</sub>

## Goal

By the end of this lesson you can have Claude write a dynamic workflow for a job that fans out across many files, keep the run small, and save it as a command that takes its input from `args`.

## You need

- One of your own repositories with at least two folders that each hold a `TODO` or `FIXME` comment that still applies to the code: `git grep -n -E 'TODO|FIXME'` lists them. If yours has none, use a local clone of a project that has some; you won't push to it. Run the check from your copy of the practice template, with Node.js LTS. Set up the repository's `.practice/` folder as [Beginner lesson 1](../beginner/01-install-and-look-around.md#you-need) describes, if you haven't yet.
- Usage: heavy. Each run starts several subagents, and `/deep-research` also searches the web ([Run a bundled workflow](https://code.claude.com/docs/en/workflows#run-a-bundled-workflow)). Cheap variant: skip step 3, keep each run to one small folder, and start Claude Code with `--model sonnet` as step 1 shows.

> [!NOTE]
> On Pro, dynamic workflows are off until you turn them on from the **Dynamic workflows** row in `/config`, and the size guideline defaults to `small` ([Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows), [Set a size guideline](https://code.claude.com/docs/en/workflows#set-a-size-guideline)).

## The idea

A dynamic workflow is a JavaScript script that Claude writes for your task. A runtime runs it in the background while your session stays responsive ([Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows)). The script starts the subagents and keeps their results in its own variables, so only the final answer reaches your conversation: the script, not Claude, [holds the plan](02-orchestration-patterns.md#the-idea) ([When to use a workflow](https://code.claude.com/docs/en/workflows#when-to-use-a-workflow)).

Because the plan is code, you can read it before it runs, independent agents can check each other's findings before they're reported, and you can save a run that did what you wanted as a command, `/<name>`, that can take new input from `args` each time ([When to use a workflow](https://code.claude.com/docs/en/workflows#when-to-use-a-workflow), [Pass input to a saved workflow](https://code.claude.com/docs/en/workflows#pass-input-to-a-saved-workflow)).

A size guideline tells Claude how many agents to aim for when it writes the script. It is advice, not a cap ([Set a size guideline](https://code.claude.com/docs/en/workflows#set-a-size-guideline)).

## Worked example

1. At the root of your repository, start Claude Code in Manual mode:

   ```bash
   claude --permission-mode manual
   ```

   For the cheap variant, start it on Sonnet instead:

   ```bash
   claude --permission-mode manual --model sonnet
   ```

   The status bar shows `⏸ manual mode on` ([Switch permission modes](https://code.claude.com/docs/en/permission-modes#switch-permission-modes)). In Manual mode, Claude Code asks before every workflow run, unless you've told it not to ask again for that workflow in this project, so you see each plan before it starts ([Approve the plan before it runs](https://code.claude.com/docs/en/workflows#approve-the-plan-before-it-runs)).

   When nothing else assigns a model, a workflow's agents run on your session's model ([Cost](https://code.claude.com/docs/en/workflows#cost)). `--model` sets it for this session only, where `/model` would also save it as your default ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags), [Commands](https://code.claude.com/docs/en/commands#all-commands)).
2. Set the size guideline:

   ```text
   /config workflowSizeGuideline=small
   ```

   `small` asks Claude for the fewest agents; the docs suggest it "when you want to bound what a workflow spends". Claude Code keeps this choice in `~/.claude.json`, not in the repository, and it applies from your next prompt ([All settings](https://code.claude.com/docs/en/settings-reference#workflowsizeguideline), [Set a size guideline](https://code.claude.com/docs/en/workflows#set-a-size-guideline)).
3. Skip this step in the cheap variant. Run the bundled research workflow ([Run a bundled workflow](https://code.claude.com/docs/en/workflows#run-a-bundled-workflow)). It needs the WebSearch tool, which Amazon Bedrock doesn't offer ([WebSearch tool behavior](https://code.claude.com/docs/en/tools-reference#websearch-tool-behavior)):

   ```text
   /deep-research What changed in the Node.js permission model between v20 and v22?
   ```

   Claude Code lists the planned phases and asks whether to run it. Because you ran the workflow by name, it also offers **Yes, and don't ask again for `<name>` in `<path>`** ([Approve the plan before it runs](https://code.claude.com/docs/en/workflows#approve-the-plan-before-it-runs)). Choose **Yes, run it**. The run works in the background. Its agents use your permission rules, so in Manual mode a search or a page fetch can stop for your approval, and the run waits until you answer ([Behavior and limits](https://code.claude.com/docs/en/workflows#behavior-and-limits)). When it finishes, the report appears in your session, citing its sources. Wait for it before you go on.
4. Ask for a workflow of your own. Replace `<folder>` with a small folder of your repository:

   ```text
   use a workflow to audit every file under <folder> for errors that are caught and then ignored, and adversarially verify each finding before reporting it
   ```

   Asking for "a workflow" in your own words tells Claude to write one for this task ([Ask for a workflow in your prompt](https://code.claude.com/docs/en/workflows#ask-for-a-workflow-in-your-prompt)). Claude Code then asks whether to run it, listing the planned phases, with **Yes, run it**, **View raw script** and **No**. A script Claude wrote for this task gets no don't-ask-again option. Choose **View raw script** to read it first, or press `Ctrl+G` to open it in your editor ([Approve the plan before it runs](https://code.claude.com/docs/en/workflows#approve-the-plan-before-it-runs)). It has the shape of the docs' example, though yours will differ:

   ```javascript
   export const meta = {
     name: 'audit-routes',
     description: 'Audit every route handler for missing auth checks',
   }

   const found = await agent('List every .ts file under src/routes/.', {
     schema: { type: 'object', required: ['files'], properties: { files: { type: 'array', items: { type: 'string' } } } },
   })

   const audits = await pipeline(found.files, file =>
     agent(`Audit ${file} for missing authentication checks.`, { label: file }),
   )

   return audits.filter(Boolean)
   ```

   `agent()` starts one subagent, `pipeline()` runs one per item in a list, and `parallel()` runs a set of agents at the same time ([What the saved script looks like](https://code.claude.com/docs/en/workflows#what-the-saved-script-looks-like)). Then choose **Yes, run it**.
5. While it works, run `/workflows` and select your audit run; when the session has only one run, it opens that run directly. The progress view shows each phase with its agent counts. `↑` and `↓` select, `Enter` opens a phase and then an agent (its prompt, its recent tool calls and its result), `Esc` backs out, and `p` pauses the run or resumes it ([Watch the run](https://code.claude.com/docs/en/workflows#watch-the-run)). A one-line progress summary also shows in the task panel below the input box ([Run a bundled workflow](https://code.claude.com/docs/en/workflows#run-a-bundled-workflow)).
6. When the run finishes and its findings appear in your session, run `/workflows`, select your audit run, not the `/deep-research` one, and press `s`. In the save dialog, `Tab` switches between `.claude/workflows/` in your project, shared with everyone who clones the repository once you commit it, and `~/.claude/workflows/`, available in every project but only to you. Make sure `.claude/workflows/` in your project is selected, pressing `Tab` if it isn't, then press `Enter` ([Save the workflow for reuse](https://code.claude.com/docs/en/workflows#save-the-workflow-for-reuse)). Claude Code writes the script as a `.js` file to the closest `.claude/workflows/` folder that already exists between your working directory and the repository root, or to `.claude/workflows/` at the root if there's none yet. From your next session on, the workflow runs as a command, `/<name>`, listed in `/` autocomplete beside `/deep-research` ([Bundled workflows](https://code.claude.com/docs/en/workflows#bundled-workflows)).

## Your turn

**Brief:** build a workflow that finds every `TODO` and `FIXME` comment in a folder you name, checks whether each one still applies to the current code, and reports only the ones that do. Keep it small: have its agents check the comments in a few batches, not one agent per comment. Pick two folders that each still hold at least one `TODO` or `FIXME` that applies: a report that finds none cites no `path:line` and fails the check.

**Acceptance criteria:**

- It's saved in `.claude/workflows/`, committed, and runs by name. Its first statement stays `export const meta`, a plain object literal with a `name` and a `description`: a variable, a function call or a spread there drops `/<name>` from `/` autocomplete ([Edit a saved script](https://code.claude.com/docs/en/workflows#edit-a-saved-script)).
- It reads the folder from `args`, so `Run /<name> on <folder>` works on any folder without editing the script.
- Each reported item starts with its `TODO` or `FIXME` line as a `path:line` from the repository root, then says in one line why it still applies, without citing any other `path:line`. Items that no longer apply are left out.
- A run on one small folder shows no `Large workflow` warning in the task panel. With a guideline chosen, the warning appears when a run schedules more agents than the guideline's count ([Cost](https://code.claude.com/docs/en/workflows#cost)).

One way to get there: write the first version with a "use a workflow" request on one folder, and save it as in step 6. Then run `/workflow-authoring`, which loads the reference Claude works from when it writes scripts, and ask Claude to change the saved script so it takes the folder from `args` ([Edit a saved script](https://code.claude.com/docs/en/workflows#edit-a-saved-script)). Run `/reload-skills`, then ask `Run /<name> on <folder>`.

When the script meets the other criteria, commit it. Then run it by name on two different folders, without editing it between the runs. After each run, ask Claude to save the report:

```text
Save that report to .practice/a-3-run1.md: the folder you ran it on as the first line, then one line per item that still applies, starting with its path:line, and nothing else.
```

Use `.practice/a-3-run2.md` for the second folder.

## Check

You are done when all of these are true:

- [ ] A committed script in `.claude/workflows/` has a literal `export const meta`, with a `name` and a `description`, as its first statement, and reads its input from `args`: `git ls-tree -r --name-only HEAD .claude/workflows` lists it.
- [ ] `.practice/a-3-run1.md` and `.practice/a-3-run2.md` name two different folders on their first lines, and each cites at least one `path:line` inside its folder.
- [ ] Every cited `path:line` exists and holds `TODO` or `FIXME`.
- [ ] Self-check (not tested): you ran the saved workflow by name for both reports without editing it between the runs, and neither run showed a `Large workflow` warning in the task panel.

Run `npm run check -- a-3 --dir <your repo>` from your practice copy.

If the first item fails, check that the script is committed (`git check-ignore -v .claude/workflows/<file>.js` names any ignore rule that hides it; add it with `git add -f` and commit it) and that it reads `args`. If a report cites a `path:line` outside its folder, or none inside it, make sure the script reads the folder from `args` and reports only files inside it, start `claude` at the repository root so paths start there, and run it again on a folder where a `TODO` or `FIXME` still applies. If a cited line holds no `TODO` or `FIXME`, either the report cites other lines in its reasons or the file changed after the run: ask Claude to cite only the `TODO` and `FIXME` lines, or run the workflow again and save the new report with the prompt above.

## Watch out

- In auto mode, Claude Code asks only before your first workflow launch: any **Yes** records consent in your user settings, and later launches start without asking. A workflow's agents use your permission rules, and when your session is in accept-edits, auto or bypass mode, they run in that same mode ([Approve the plan before it runs](https://code.claude.com/docs/en/workflows#approve-the-plan-before-it-runs), [Permission modes](https://code.claude.com/docs/en/sub-agents#permission-modes)). Read each script before you approve it, and stay in Manual mode for a workflow you haven't read.
- A run can use meaningfully more tokens than the same task in conversation, and it counts toward your plan's usage and rate limits. Try a workflow on one small folder first, and ask Claude to use a smaller model for stages that don't need the strongest one. `/workflows` shows each agent's token usage as the run goes, and `x` on a selected run stops it. When a run grows unusually large, its progress line shows a `Large workflow` warning. Once you choose a size guideline, its agent count replaces the warning's built-in agent threshold, and a large projected token total can still trigger it. The warning doesn't pause or limit the run ([Cost](https://code.claude.com/docs/en/workflows#cost)).
- `p` pauses and resumes a run, but a run you stopped doesn't resume with `p`: ask Claude to relaunch it with the same script, in the same session or one you reopen with `claude --resume`. Agents that were still running when you stopped start over ([Resume after a pause](https://code.claude.com/docs/en/workflows#resume-after-a-pause)). An agent whose output stops for too long also starts over on its own, and `/workflows` adds `(retry 1)` to its name ([When an agent stalls and restarts](https://code.claude.com/docs/en/workflows#when-an-agent-stalls-and-restarts)). At v2.1.285, an agent also starts over from its prompt when its connection stalls for a few minutes mid-response (fixed in v2.1.286) or your Mac wakes from sleep (fixed in v2.1.290) ([CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)), so keep the machine awake while a run works.

## Go further

- [This guide's own saved workflow](../../.claude/workflows/stale-docs-audit.js): a real script that reads `args`, groups its agents into phases, and has separate agents verify each claim before it's reported.
- [Example workflow prompts](https://code.claude.com/docs/en/workflows#example-workflow-prompts): more task shapes, such as migrating many files or fixing until a check passes.
- [When a run hits your usage limit](https://code.claude.com/docs/en/workflows#when-a-run-hits-your-usage-limit): when a run waits for your limit to reset instead of failing.

---

<sub>Sources: [Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Create custom subagents](https://code.claude.com/docs/en/sub-agents) · [CLI reference](https://code.claude.com/docs/en/cli-reference) · [Commands](https://code.claude.com/docs/en/commands) · [All settings](https://code.claude.com/docs/en/settings-reference) · [Tools reference](https://code.claude.com/docs/en/tools-reference) · [Claude Code CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)</sub>

<sub>← [Choose an orchestration pattern](02-orchestration-patterns.md) · [Advanced index](README.md) · [Script Claude Code with `claude -p`](04-headless.md) → · Topic: [Subagents and parallel work](../topics/subagents-and-parallel-work.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-3)</sub>
