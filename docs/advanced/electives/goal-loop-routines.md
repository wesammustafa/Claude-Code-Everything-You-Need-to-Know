# <a id="goal-loop-and-routines"></a>`/loop` and cloud scheduled tasks

<sub>**Advanced** · Elective · about 15 minutes, plus run time · Needs: [Put bounds on autonomous runs](../07-bounded-runs.md) · Verified against Claude Code v2.1.292 (stable) on 2026-10-15</sub>

> [!NOTE]
> "Scheduled tasks are in research preview. Behavior, limits, and the API surface may change." ([Automate work with scheduled tasks](https://code.claude.com/docs/en/routines))

## Goal

By the end of this Elective you can keep Claude working without prompting each step: on an interval in your session with `/loop`, and on a schedule in the cloud with a cloud scheduled task.

## You need

- Your copy of the practice template, with Node.js LTS, for the Worked example, and one of your own repositories for Your turn.
- For the cloud scheduled task, steps 5 to 7 only: a Pro, Max, Team or Enterprise plan, signed in with `/login` ([Availability by subscription plan](https://code.claude.com/docs/en/feature-availability#availability-by-subscription-plan)). Cloud scheduled tasks need a Claude subscription, so with a Console API key or a cloud provider, skip those steps ([Feature availability](https://code.claude.com/docs/en/feature-availability#features-that-require-a-claude-subscription)). On Team and Enterprise, an Owner can turn cloud scheduled tasks off for everyone with the **Scheduled tasks (Was Routines)** toggle ([Automate work with scheduled tasks](https://code.claude.com/docs/en/routines)).
- Also for the cloud scheduled task: GitHub access for cloud sessions to your copy, through the Claude GitHub App or `/web-setup`; with the App, a private copy needs the App installed on it ([GitHub authentication options](https://code.claude.com/docs/en/claude-code-on-the-web#github-authentication-options)). On Team and Enterprise, either way needs an Owner first: the GitHub connector for the App's browser sign-in, or Quick setup for `/web-setup` ([Connect GitHub](https://code.claude.com/docs/en/web-quickstart#connect-github), [Quick setup for Team and Enterprise](https://code.claude.com/docs/en/claude-code-on-the-web#quick-setup-for-team-and-enterprise)).
- Usage: moderate. Each loop run sends the session's whole context again ([Why usage climbs in a long session](https://code.claude.com/docs/en/costs#why-usage-climbs-in-a-long-session)), and a cloud scheduled task run is a full cloud session that draws on your plan ([Usage and limits](https://code.claude.com/docs/en/routines#usage-and-limits)). The steps keep each one small: Sonnet, a short loop and a task that runs once. Cheap variant: skip the cloud scheduled task (steps 5 to 7).

## The idea

`/loop` and a cloud scheduled task each start Claude's next run without you ([Compare scheduling options](https://code.claude.com/docs/en/scheduled-tasks#compare-scheduling-options)):

| | Next run starts when | Stops when |
|---|---|---|
| `/loop` | An interval passes, while your session is open and idle | You cancel it, Claude ends a self-paced loop, or it expires |
| Cloud scheduled task | A schedule, an API call or a GitHub event, in the cloud | You pause or delete it; a one-off turns itself off |

A loop runs in your session, on your files, and keeps the session's permission mode: in auto mode its runs go ahead unattended, and in Manual mode Claude asks first. A cloud scheduled task runs on a fresh clone of your repository, so it keeps working with your laptop closed but sees only what you've pushed ([Compare scheduling options](https://code.claude.com/docs/en/scheduled-tasks#compare-scheduling-options), [Automate work with scheduled tasks](https://code.claude.com/docs/en/routines)). To keep Claude working toward a condition rather than on a clock, use `/goal`, which [lesson 3](../03-dynamic-workflows.md) teaches.

> [!WARNING]
> A cloud scheduled task runs as a full cloud session that starts in auto mode, unless auto mode is unavailable, so a classifier model, not you, allows or blocks the actions that would otherwise wait for your approval. It still stops for your answer in cases such as an action that prompts even in auto mode (one matching an ask rule, for example) or after repeated blocks ([Permission prompts during a run](https://code.claude.com/docs/en/routines#permission-prompts-during-a-run)). It acts as you: its commits and pull requests carry your GitHub user ([Create a scheduled task](https://code.claude.com/docs/en/routines#create-a-scheduled-task)). Claude can use each connector the task includes, writes included, and every connector on your claude.ai account is included by default ([Create from the web](https://code.claude.com/docs/en/routines#create-from-the-web), [Connectors](https://code.claude.com/docs/en/routines#connectors)). Remove the connectors a task doesn't need, and keep its prompt to read-only work while you learn.

## Worked example

Work in your practice copy.

1. Make the log folder, which git already ignores in the copy, then start Claude Code on Sonnet:

   ```bash
   mkdir -p .practice
   claude --model sonnet
   ```

   **Windows:** `New-Item -ItemType Directory -Force .practice` replaces the `mkdir` line.

   The status bar shows the permission mode ([Switch permission modes](https://code.claude.com/docs/en/permission-modes#switch-permission-modes)). If it shows `⏸ manual mode on`, approve each tool call as Claude asks; if it shows `⏵⏵ auto mode on`, the loop's runs go ahead on their own.
2. Start a loop that logs the test results every minute:

   ```text
   /loop 1m run npm test and append one line to .practice/loop-log.txt with the time and the number of passing and failing tests. Don't change any other file.
   ```

   Claude schedules it and confirms the cadence and a job ID ([Run on a fixed interval](https://code.claude.com/docs/en/scheduled-tasks#run-on-a-fixed-interval)). Each run fires between your turns, never while Claude is mid-response ([How session-scoped scheduled tasks run](https://code.claude.com/docs/en/scheduled-tasks#how-session-scoped-scheduled-tasks-run)).
3. In your editor, not through Claude, break one test: in `test/config.test.js`, change the first test's `files: ['.']` to `files: ['docs']`. Wait until the log gains a line that shows a failure, then undo the change with `git restore test/config.test.js`.
4. Ask Claude `cancel the npm test loop`, then `what scheduled tasks do I have?`: none are left ([Manage session-scoped scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks#manage-session-scoped-scheduled-tasks)). `cat .practice/loop-log.txt` shows a line for each run, at least one of them failing. Your wording will differ.
5. Steps 5 to 7 need a subscription; without one, you're done with the Worked example. Schedule a cloud scheduled task that runs once, in five minutes:

   ```text
   /schedule in 5 minutes, run npm test in this repository and reply with the number of passing and failing tests. Don't edit files, commit or push.
   ```

   Claude asks follow-up questions about the schedule, the repository and the prompt, and confirms the absolute time before it saves ([Create from the CLI](https://code.claude.com/docs/en/routines#create-from-the-cli), [Schedule a one-off run](https://code.claude.com/docs/en/routines#schedule-a-one-off-run)). The earlier name, routines, still appears in Claude's replies while it sets up a task and, in some accounts, in the app's sidebar entry and page title ([Where the name routines still appears](https://code.claude.com/docs/en/routines#where-the-name-routines-still-appears)). Tell it to include no connectors; if it can't, remove them as soon as it saves, with `/schedule update` or the task's **Edit** dialog at `claude.ai/code/routines` ([Connectors](https://code.claude.com/docs/en/routines#connectors)).\
   If Claude adds a setup note about GitHub access, follow it before the run time; if the time passes first, edit the task and set a new one-off time ([Repositories and branch permissions](https://code.claude.com/docs/en/routines#repositories-and-branch-permissions), [Edit and control scheduled tasks](https://code.claude.com/docs/en/routines#edit-and-control-scheduled-tasks)). If Claude replies that you need to authenticate, no task was saved; if `/schedule` isn't in the command menu, see [`/schedule` returns "Unknown command"](https://code.claude.com/docs/en/routines#schedule-returns-unknown-command).
6. `/schedule list` shows the task ([Manage scheduled tasks from the CLI](https://code.claude.com/docs/en/routines#manage-scheduled-tasks-from-the-cli)). After it runs, open it at `claude.ai/code/routines`, open the run and read the transcript for the test counts ([View and interact with runs](https://code.claude.com/docs/en/routines#view-and-interact-with-runs)). The run cloned your default branch, not your working tree ([Repositories and branch permissions](https://code.claude.com/docs/en/routines#repositories-and-branch-permissions)). The one-off is now marked **Completed** ([Schedule a one-off run](https://code.claude.com/docs/en/routines#schedule-a-one-off-run)).
7. Delete the task: open the menu next to its name and select **Delete** ([Edit and control scheduled tasks](https://code.claude.com/docs/en/routines#edit-and-control-scheduled-tasks)).\
   If you connected GitHub only for the task, disconnect it at `claude.ai/customize/connectors`, which deletes the credential whether it came from the browser or from `/web-setup`; the `gh` token itself stays valid on GitHub ([Remove the `/web-setup` token](https://code.claude.com/docs/en/web-quickstart#remove-the-web-setup-token)). If you installed the Claude GitHub App only for the task, also take your copy out of its repository access, and uninstall it only if nothing else of yours uses it ([Reviewing and modifying installed GitHub Apps](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps)).

## Your turn

In one of your own repositories, pick a check a command can run, such as the test suite or a lint command. Commit a `.claude/loop.md` that keeps watching it: the file replaces the built-in prompt of a `/loop` you start without a prompt of your own ([Customize the default prompt with loop.md](https://code.claude.com/docs/en/scheduled-tasks#customize-the-default-prompt-with-loop-md)). With a subscription, you can also have a one-off cloud scheduled task run the command in the cloud once your work is on the default branch, or name your branch in the task's prompt ([Repositories and branch permissions](https://code.claude.com/docs/en/routines#repositories-and-branch-permissions)).

It's done when:

- `.claude/loop.md` is committed. It says what to check, and to report in one line without changing any file. `/loop 10m` (an interval and no prompt) ran it at least twice, then you cancelled it ([Run the built-in maintenance prompt](https://code.claude.com/docs/en/scheduled-tasks#run-the-built-in-maintenance-prompt)).
- No scheduled task is left: `what scheduled tasks do I have?` lists none, and any cloud scheduled task you made is deleted.

## Check

You are done when all of these are true:

- [ ] In your practice copy, `.practice/loop-log.txt` holds lines from at least two loop runs, at least one of them failing.
- [ ] `.claude/loop.md` is committed in your repository (`git ls-files .claude/loop.md` prints it), and `git status --porcelain` prints nothing.
- [ ] Self-check (not tested): `/loop 10m` ran your `loop.md` at least twice before you cancelled it; `what scheduled tasks do I have?` lists none; and if you made a cloud scheduled task, you read its run's transcript and deleted it.

If no log line shows a failure, the loop didn't run while the test was broken: start the loop again as in step 2, break the test as in step 3, wait for a failing line, restore the file, then cancel the loop as in step 4. If `git ls-files` prints nothing, `git check-ignore -v .claude/loop.md` names the rule that hides the file: add it with `git add -f`, then commit.

## Watch out

- A loop fires even while you're away, sending the session's whole context each time, and keeps going until you cancel it or it expires ([Stop a loop](https://code.claude.com/docs/en/scheduled-tasks#stop-a-loop)). On a Pro, Max, Team or Enterprise plan, `/usage` lists your heaviest loops ([Plan usage breakdown](https://code.claude.com/docs/en/costs#plan-usage-breakdown)).
- `Esc` doesn't stop a fixed-interval loop such as `/loop 1m`: ask Claude to cancel it ([Stop a loop](https://code.claude.com/docs/en/scheduled-tasks#stop-a-loop)).
- A green status in a cloud scheduled task's run list only means the session started and exited without an infrastructure error. Open the run and read the transcript to see whether the task worked ([View and interact with runs](https://code.claude.com/docs/en/routines#view-and-interact-with-runs)).

## Go further

- [Loop engineering: Getting started with loops](https://claude.com/resources/articles/getting-started-with-loops): Anthropic's Claude Code team on turn-based, goal-based, time-based and proactive loops, and when to use each.
- [Add a GitHub trigger](https://code.claude.com/docs/en/routines#add-a-github-trigger): run a cloud scheduled task on pull request or release events, with the Claude GitHub App installed on the repository.
- [Schedule recurring tasks in Claude Code Desktop](https://code.claude.com/docs/en/desktop-scheduled-tasks): scheduled tasks that run on your machine, with your local files, while the Desktop app is open.

---

<sub>Sources: [Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks) · [Automate work with scheduled tasks](https://code.claude.com/docs/en/routines) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Manage costs effectively](https://code.claude.com/docs/en/costs) · [Feature availability](https://code.claude.com/docs/en/feature-availability) · [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web) · [Get started with Claude Code in the cloud](https://code.claude.com/docs/en/web-quickstart) · [Reviewing and modifying installed GitHub Apps](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps)</sub>

<sub>Back to the [Advanced index](../README.md) · Topic: [Automation](../../topics/automation.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-goal-loop)</sub>
