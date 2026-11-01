# Run and save a dynamic workflow

<sub>**Advanced** · Lesson 3 of 7 · about 20 minutes, plus run time · Needs: [Choose an orchestration pattern](02-orchestration-patterns.md) · Verified against Claude Code v2.1.308 (stable) on 2026-10-25</sub>

## Goal

By the end of this lesson you can keep one session working until a check you can run passes, with `/goal`, and save an audit that fans out across many files, with each finding checked by a second agent, as a workflow command that takes its folder from `args`.

## You need

- One of your own repositories with a test command that passes, such as `npm test`, and a migration it needs in one small folder: an old form that `git grep -n -E '<pattern>'` finds, such as a deprecated call, an old import path or a helper you're replacing ([git grep](https://git-scm.com/docs/git-grep)). No migration in mind? Your copy of the practice template has one: files in `test/` build paths from `import.meta.url`, where Node.js offers [`import.meta.dirname`](https://nodejs.org/api/esm.html#importmetadirname). Run the check from your copy of the practice template, with Node.js LTS. Set up the repository's `.practice/` folder as the [Intermediate index](../intermediate/README.md#prepare-your-own-repository) describes, if you haven't yet.
- Usage: heavy. A goal runs turn after turn, and each workflow run starts several subagents ([Cost](https://code.claude.com/docs/en/workflows#cost)). Cheap variant: keep each run to one small folder, and start Claude Code with `--model sonnet` ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)).

> [!NOTE]
> On Pro, dynamic workflows are off until you turn them on from the **Dynamic workflows** row in `/config`, and the size guideline defaults to `small` ([Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows), [Set a size guideline](https://code.claude.com/docs/en/workflows#set-a-size-guideline)).

## The idea

`/goal <condition>` keeps one session working toward a condition: after each turn, a separate model checks whether it holds, and if not, Claude starts another turn ([Keep Claude working toward a goal](https://code.claude.com/docs/en/goal)). That evaluator doesn't run commands or read files: it judges only what Claude surfaced in the conversation, so name the check Claude must run and what must not change ([Write an effective condition](https://code.claude.com/docs/en/goal#write-an-effective-condition)). Use it when one session can do the job.

A dynamic workflow is for what one session can't do: a JavaScript script Claude writes, which a runtime runs in the background, starting subagents and keeping their results in its own variables ([Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows)). Because the plan is code, you can read it before it runs, have independent agents check each other's findings, and save a run as a command, `/<name>`, that takes new input from `args` each time ([When to use a workflow](https://code.claude.com/docs/en/workflows#when-to-use-a-workflow), [Pass input to a saved workflow](https://code.claude.com/docs/en/workflows#pass-input-to-a-saved-workflow)).

## Worked example

Migrate one small folder in a single session, gated by a goal.

1. Save the `git grep -E` pattern that finds the old form on one line in `.practice/a-3-pattern.txt`, so the check can find the old form in your history. For the practice template's migration, that's:

   ```bash
   printf '%s\n' 'import\.meta\.url' > .practice/a-3-pattern.txt
   ```

   Then start `claude` at the root of your repository. A goal doesn't change your permission mode, and in auto mode, the mode a session starts in, goal turns run without waiting for you ([Set a goal](https://code.claude.com/docs/en/goal#set-a-goal), [Which mode a session starts in](https://code.claude.com/docs/en/permission-modes#which-mode-a-session-starts-in)).
2. Set the goal, with your own pattern and folder:

   ```text
   /goal git grep -n -E 'import\.meta\.url' -- test lists nothing, npm test exits 0, and no file outside test/ changes, or stop after 20 turns
   ```

   It has one measurable end state, the checks that prove it, a constraint, and a turn clause that bounds the run ([Write an effective condition](https://code.claude.com/docs/en/goal#write-an-effective-condition)). Setting a goal starts a turn at once, with the condition as the directive, and a `◎ /goal active` indicator shows while it runs.
3. While it works, run `/goal` with no argument. It shows the condition, how long it has run, the turns evaluated, the token spend and the evaluator's most recent reason ([Check status](https://code.claude.com/docs/en/goal#check-status)). If the goal was already achieved, it shows the achieved condition with its duration, turn count and token spend. When the evaluator judges the condition met, Claude Code clears the goal and records an achieved entry in the transcript ([How evaluation works](https://code.claude.com/docs/en/goal#how-evaluation-works)).
4. Be the last check. The evaluator judged what Claude showed it, so run the checks yourself: `git grep -n -E '<pattern>' -- <folder>` lists nothing, and your test command passes. Read `git diff`, then commit what you accept.

## Your turn

**Brief:** make the release audit a saved command that reports only the findings a second agent confirmed. The release manager runs it on a different folder each release, so it takes the folder as input. The audit looks for errors that are caught and then ignored, and changes no file.

One way to get there:

1. Set the size guideline, so Claude aims for few agents: `/config workflowSizeGuideline=small`. It is advice, not a cap, and applies from your next prompt ([Set a size guideline](https://code.claude.com/docs/en/workflows#set-a-size-guideline)).
2. Start a session in Manual mode, `claude --permission-mode manual` ([Available modes](https://code.claude.com/docs/en/permission-modes#available-modes)). In Manual mode, Claude Code asks before each workflow run, unless you've chosen **Yes, and don't ask again** for that workflow, so you see each plan before it starts ([Approve the plan before it runs](https://code.claude.com/docs/en/workflows#approve-the-plan-before-it-runs)). The workflow's agents get the same permission checks as any other tool call in your session ([Ask for a workflow in your prompt](https://code.claude.com/docs/en/workflows#ask-for-a-workflow-in-your-prompt)). In Manual mode, read each prompt and choose **Yes**, not **Yes, and switch to auto mode** ([Switch permission modes](https://code.claude.com/docs/en/permission-modes#switch-permission-modes)). To avoid prompts on a long run, add the tools the agents need to your allow rules before starting ([Approve the plan before it runs](https://code.claude.com/docs/en/workflows#approve-the-plan-before-it-runs)). Ask for a workflow on a small folder:

   ```text
   use a workflow to audit every file under <folder> for errors that are caught and then ignored, and adversarially verify each finding before reporting it
   ```

   Asking for "a workflow" in your own words tells Claude to write one for this task ([Ask for a workflow in your prompt](https://code.claude.com/docs/en/workflows#ask-for-a-workflow-in-your-prompt)). Claude Code then asks whether to run it, listing the planned phases, with **Yes, run it**, **View raw script** and **No**. Choose **View raw script** to read it first: `agent()` starts one subagent, `pipeline()` runs one per item in a list, and `parallel()` runs a set of agents at the same time ([What the saved script looks like](https://code.claude.com/docs/en/workflows#what-the-saved-script-looks-like)). Then choose **Yes, run it**.
3. While it works, run `/workflows`: the progress view shows each phase with its agent counts, and each agent's prompt, tool calls and result ([Watch the run](https://code.claude.com/docs/en/workflows#watch-the-run)). Answer any permission prompt in your session: in the progress view, `Esc` backs out one level ([Watch the run](https://code.claude.com/docs/en/workflows#watch-the-run)). When the findings appear in your session, select the run in `/workflows` and press `s`. In the save dialog, make sure `.claude/workflows/` in your project is selected, the location shared with everyone who clones the repository (`Tab` switches between the two locations), then press `Enter` ([Save the workflow for reuse](https://code.claude.com/docs/en/workflows#save-the-workflow-for-reuse)).
4. Run `/workflow-authoring`, which loads the reference Claude works from when it writes scripts, and ask Claude to change the saved script so it takes the folder from `args`. Run `/reload-skills` ([Edit a saved script](https://code.claude.com/docs/en/workflows#edit-a-saved-script)).
5. Ask `Run /<name> on <folder>` for a second folder, and read which findings its checking agents confirmed. Run by name, the prompt also offers **Yes, and don't ask again for `<name>` in `<path>`**; choose **Yes, run it** for now, so you still see each plan ([Approve the plan before it runs](https://code.claude.com/docs/en/workflows#approve-the-plan-before-it-runs)). When `git status` shows no change from it, commit the script.

**Acceptance criteria:**

- It's saved in `.claude/workflows/`, committed, and runs by name. Its first statement stays `export const meta`, a plain object literal with a `name` and a `description`: a variable, a function call or a spread there drops `/<name>` from `/` autocomplete ([Edit a saved script](https://code.claude.com/docs/en/workflows#edit-a-saved-script)).
- It reads the folder from `args`, so `Run /<name> on <folder>` works on any folder without editing the script.
- A second agent checks each finding before it's reported: the script calls `agent()` at least twice, once to find and once to check.
- You've run it by name on a second folder, and it changed no file there: `git status` shows no change from it.

## Check

You are done when all of these are true:

- [ ] A committed script in `.claude/workflows/` has a literal `export const meta`, with a `name` and a `description`, as its first statement, reads its input from `args`, and calls `agent()` at least twice: `git ls-tree -r --name-only HEAD .claude/workflows` lists it.
- [ ] The `git grep -E` pattern in `.practice/a-3-pattern.txt` matched in a folder at an earlier commit and matches nothing in that folder at `HEAD`.
- [ ] Self-check (not tested): you ran the saved workflow by name on a second folder and can name a finding its checking agents confirmed or dropped, and before you approved the first run you read its script and can say how many agents it starts.

Run `npm run check -- a-3 --dir <your repo>` from your practice copy.

If the first item fails, read its hint: it names the line or the part of the script to change, and you commit the fix. If the second item fails, commit the migration, or set the goal again for the folder the hint names.

## Watch out

- In auto mode, Claude Code asks only before your first workflow launch: any **Yes** records consent in your user settings, and later launches start without asking. A workflow's agents use your permission rules, and when your session is in accept-edits, auto or bypass mode, they run in that same mode ([Approve the plan before it runs](https://code.claude.com/docs/en/workflows#approve-the-plan-before-it-runs), [Permission modes](https://code.claude.com/docs/en/sub-agents#permission-modes)). Read each script before you approve it, and stay in Manual mode for a workflow you haven't read.
- A run can use meaningfully more tokens than the same task in conversation, and it counts toward your plan's usage and rate limits. Try a workflow on one small folder first. `/workflows` shows each agent's token usage as the run goes, and `x` on a selected run stops it. When a run grows unusually large, its progress line shows a `Large workflow` warning, which doesn't pause or limit the run ([Cost](https://code.claude.com/docs/en/workflows#cost)).
- If Claude keeps answering the goal's evaluator without using a tool for several turns, Claude Code stops the loop and gives you control with the goal still set; `/goal clear` removes a goal ([How evaluation works](https://code.claude.com/docs/en/goal#how-evaluation-works), [Clear a goal](https://code.claude.com/docs/en/goal#clear-a-goal)).

## Go further

- [Distribute a workflow in a plugin](https://code.claude.com/docs/en/workflows#distribute-a-workflow-in-a-plugin): share a saved workflow with other repositories through your team's plugin, as in [lesson 6](06-share-your-setup.md).
- [Compare ways to keep a session running](https://code.claude.com/docs/en/goal#compare-ways-to-keep-a-session-running): `/goal`, `/loop` and a Stop hook, and what starts each next turn.

---

<sub>Sources: [Keep Claude working toward a goal](https://code.claude.com/docs/en/goal) · [Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows) · [Create custom subagents](https://code.claude.com/docs/en/sub-agents) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [CLI reference](https://code.claude.com/docs/en/cli-reference) · [git grep](https://git-scm.com/docs/git-grep) · [Node.js ECMAScript modules](https://nodejs.org/api/esm.html)</sub>

<sub>← [Choose an orchestration pattern](02-orchestration-patterns.md) · [Advanced index](README.md) · [Script Claude Code with `claude -p`](04-headless.md) → · Topic: [Subagents and parallel work](../topics/subagents-and-parallel-work.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-3)</sub>
