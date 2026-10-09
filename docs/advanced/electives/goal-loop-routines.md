# `/goal`, `/loop` and routines

<sub>**Advanced** · Elective · about 20 minutes, plus run time · Needs: [Put bounds on autonomous runs](../07-bounded-runs.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-09</sub>

> [!NOTE]
> "Routines are in research preview. Behavior, limits, and the API surface may change." ([Automate work with routines](https://code.claude.com/docs/en/routines))

## Goal

By the end of this Elective you can keep Claude working without prompting each step: toward a condition with `/goal`, on an interval with `/loop`, and on a schedule in the cloud with a routine.

## You need

- Your copy of the practice template, with Node.js LTS, for the Worked example, and one of your own repositories for Your turn.
- For the routine, steps 7 to 9 only: a Pro, Max, Team or Enterprise plan, signed in with `/login` ([Availability by subscription plan](https://code.claude.com/docs/en/feature-availability#availability-by-subscription-plan)). Routines need a Claude subscription, so with a Console API key or a cloud provider, skip those steps ([Feature availability](https://code.claude.com/docs/en/feature-availability#features-that-require-a-claude-subscription)). On Team and Enterprise, an Owner can turn routines off for everyone ([Automate work with routines](https://code.claude.com/docs/en/routines)).
- Also for the routine: GitHub access for cloud sessions to your copy, through the Claude GitHub App or `/web-setup`; with the App, a private copy needs the App installed on it ([GitHub authentication options](https://code.claude.com/docs/en/claude-code-on-the-web#github-authentication-options)). On Team and Enterprise, either way needs an Owner first: the GitHub connector for the App's browser sign-in, or Quick setup for `/web-setup` ([Connect GitHub](https://code.claude.com/docs/en/web-quickstart#connect-github), [Quick setup for Team and Enterprise](https://code.claude.com/docs/en/claude-code-on-the-web#quick-setup-for-team-and-enterprise)).
- Usage: moderate. A goal runs several turns, each loop run sends the session's whole context again ([Why usage climbs in a long session](https://code.claude.com/docs/en/costs#why-usage-climbs-in-a-long-session)), and a routine run is a full cloud session that draws on your plan ([Usage and limits](https://code.claude.com/docs/en/routines#usage-and-limits)). The steps keep each one small: Sonnet, a turn limit, a short loop and a routine that runs once. Cheap variant: skip the routine (steps 7 to 9).

## The idea

`/goal`, `/loop` and a routine each start Claude's next run without you ([Compare ways to keep a session running](https://code.claude.com/docs/en/goal#compare-ways-to-keep-a-session-running), [Compare scheduling options](https://code.claude.com/docs/en/scheduled-tasks#compare-scheduling-options)):

| | Next run starts when | Stops when |
|---|---|---|
| `/goal` | A turn ends and a second model, the evaluator, judges your condition not yet met | It's judged met or impossible, a turn hits an error you must fix, or `/goal clear` |
| `/loop` | An interval passes, while the session is idle | You cancel it, Claude ends a self-paced loop, or it expires |
| Routine | A schedule, an API call or a GitHub event, in the cloud | You pause or delete it; a one-off turns itself off |

The evaluator reads only the conversation, so your condition should name a check whose result shows in Claude's output, such as "`npm test` exits 0", say what must not change, and end with a turn limit ([Write an effective condition](https://code.claude.com/docs/en/goal#write-an-effective-condition)). Goals and loops keep the session's permission mode: in auto mode they run unattended, and in Manual mode Claude asks first ([Set a goal](https://code.claude.com/docs/en/goal#set-a-goal), [Compare scheduling options](https://code.claude.com/docs/en/scheduled-tasks#compare-scheduling-options)).

> [!WARNING]
> A routine runs as a full cloud session that doesn't stop for approval, apart from some artifact actions, and it acts as you: its commits and pull requests carry your GitHub user ([Create a routine](https://code.claude.com/docs/en/routines#create-a-routine)). It can use every tool of each connector it includes, writes included, without asking, and every connector on your claude.ai account is included by default ([Create from the web](https://code.claude.com/docs/en/routines#create-from-the-web), [Connectors](https://code.claude.com/docs/en/routines#connectors)). Remove the connectors a routine doesn't need, and keep its prompt to read-only work while you learn.

## Worked example

Work in your practice copy, on a new branch.

1. Make the branch and the log folder, which git already ignores in the copy, then start Claude Code on Sonnet:

   ```bash
   git switch -c keep-working
   mkdir -p .practice
   claude --model sonnet
   ```

   **Windows:** `New-Item -ItemType Directory -Force .practice` replaces the `mkdir` line.

   The status bar shows the permission mode ([Switch permission modes](https://code.claude.com/docs/en/permission-modes#switch-permission-modes)). If it shows `⏸ manual mode on`, approve each tool call as Claude asks; if it shows `⏵⏵ auto mode on`, the goal's turns and the loop's runs go ahead on their own.
2. Set a goal. The link checker reports a link such as `setup.md?plain=1` as broken even when `setup.md` exists, because it strips only the `#` part of a link:

   ```text
   /goal npm test exits 0, a new test in test/links.test.js shows that a link such as setup.md?plain=1 to a file that exists is not reported as broken, no existing test changes, and the fix is committed; or stop after 8 turns
   ```

   Claude starts at once, and `◎ /goal active` shows how long the goal has run. After each turn the transcript shows the evaluator's verdict; press `Ctrl+O` for the reason behind it ([Set a goal](https://code.claude.com/docs/en/goal#set-a-goal)).
3. When the evaluator judges the condition met, Claude Code clears the goal and records an achieved entry in the transcript ([How evaluation works](https://code.claude.com/docs/en/goal#how-evaluation-works)). Run `/goal`: it shows the achieved condition with its duration, turn count and token spend ([Check status](https://code.claude.com/docs/en/goal#check-status)). In a second terminal, `git log --oneline -1` shows the commit, and `npm test` passes. If `npm test` still fails or `git log` shows no new commit, the goal ended before the fix, for example at its turn limit or judged impossible, and `/goal` shows whether it's still active: ask Claude to finish the fix and commit it.
4. Start a loop that logs the test results every minute:

   ```text
   /loop 1m run npm test and append one line to .practice/loop-log.txt with the time and the number of passing and failing tests. Don't change any other file.
   ```

   Claude schedules it and confirms the cadence and a job ID ([Run on a fixed interval](https://code.claude.com/docs/en/scheduled-tasks#run-on-a-fixed-interval)). Each run fires between your turns, never while Claude is mid-response ([How scheduled tasks run](https://code.claude.com/docs/en/scheduled-tasks#how-scheduled-tasks-run)).
5. In your editor, not through Claude, break one test: in `test/config.test.js`, change the first test's `files: ['.']` to `files: ['docs']`. Wait until the log gains a line that shows a failure, then undo the change with `git restore test/config.test.js`.
6. Ask Claude `cancel the npm test loop`, then `what scheduled tasks do I have?`: none are left ([Manage scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks#manage-scheduled-tasks)). `cat .practice/loop-log.txt` shows a line for each run, at least one of them failing. Your wording will differ.
7. Steps 7 to 9 need a subscription; without one, skip to step 10. Schedule a routine that runs once, in five minutes:

   ```text
   /schedule in 5 minutes, run npm test in this repository and reply with the number of passing and failing tests. Don't edit files, commit or push.
   ```

   Claude asks follow-up questions about the schedule, the repository and the prompt, and confirms the absolute time before it saves ([Create from the CLI](https://code.claude.com/docs/en/routines#create-from-the-cli), [Schedule a one-off run](https://code.claude.com/docs/en/routines#schedule-a-one-off-run)). Tell it to include no connectors; if it can't, remove them as soon as it saves, with `/schedule update` or the routine's **Edit** form at `claude.ai/code/routines` ([Connectors](https://code.claude.com/docs/en/routines#connectors)).\
   If Claude adds a setup note about GitHub access, follow it before the run time; if the time passes first, edit the routine and set a new one-off time ([Repositories and branch permissions](https://code.claude.com/docs/en/routines#repositories-and-branch-permissions), [Edit and control routines](https://code.claude.com/docs/en/routines#edit-and-control-routines)). If Claude replies that you need to authenticate, no routine was saved; if `/schedule` isn't in the command menu, see [`/schedule` returns "Unknown command"](https://code.claude.com/docs/en/routines#schedule-returns-unknown-command).
8. `/schedule list` shows the routine ([Manage routines from the CLI](https://code.claude.com/docs/en/routines#manage-routines-from-the-cli)). After it runs, open it at `claude.ai/code/routines`, open the run and read the transcript for the test counts ([View and interact with runs](https://code.claude.com/docs/en/routines#view-and-interact-with-runs)). The run cloned your default branch, so its count doesn't include the test you added on `keep-working` ([Repositories and branch permissions](https://code.claude.com/docs/en/routines#repositories-and-branch-permissions)). The one-off is now marked **Ran**.
9. Delete the routine: open the menu next to its name and select **Delete** ([Edit and control routines](https://code.claude.com/docs/en/routines#edit-and-control-routines)).\
   If you connected GitHub only for the routine, disconnect it at `claude.ai/customize/connectors`, which deletes the credential whether it came from the browser or from `/web-setup`; the `gh` token itself stays valid on GitHub ([Remove the `/web-setup` token](https://code.claude.com/docs/en/web-quickstart#remove-the-web-setup-token)). If you installed the Claude GitHub App only for the routine, also take your copy out of its repository access, and uninstall it only if nothing else of yours uses it ([Reviewing and modifying installed GitHub Apps](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps)).
10. `git switch -` takes your copy back to the branch you started on; `keep-working` keeps the fix.

## Your turn

In one of your own repositories, pick a chore whose end state a command can prove, such as a failing test or a lint error. Finish it with a goal. Then commit a `.claude/loop.md` that keeps watching it: the file replaces the built-in prompt of a `/loop` you start without a prompt of your own ([Customize the default prompt with loop.md](https://code.claude.com/docs/en/scheduled-tasks#customize-the-default-prompt-with-loop-md)). With a subscription, you can also have a one-off routine run the command in the cloud once your work is on the default branch, or name your branch in the routine's prompt ([Repositories and branch permissions](https://code.claude.com/docs/en/routines#repositories-and-branch-permissions)).

It's done when:

- Your condition names the command that proves the end state, one thing that must not change, and a turn limit.
- The work is committed, and the command exits 0.
- `.claude/loop.md` is committed. It says what to check, and to report in one line without changing any file. `/loop 10m` (an interval and no prompt) ran it at least twice, then you cancelled it ([Run the built-in maintenance prompt](https://code.claude.com/docs/en/scheduled-tasks#run-the-built-in-maintenance-prompt)).
- No scheduled task or routine is left: `what scheduled tasks do I have?` lists none, and any routine you made is deleted.

## Check

You are done when all of these are true:

- [ ] In your repository, the goal's work is committed (`git log -1` shows it), and the command your condition named exits 0.
- [ ] In your practice copy, `.practice/loop-log.txt` holds lines from at least two loop runs, at least one of them failing.
- [ ] `.claude/loop.md` is committed in your repository (`git ls-files .claude/loop.md` prints it), and `git status --porcelain` prints nothing.
- [ ] Self-check (not tested): your condition named the command, one thing that must not change and a turn limit; `/loop 10m` ran your `loop.md` at least twice before you cancelled it; `what scheduled tasks do I have?` lists none; and if you made a routine, you read its run's transcript and deleted it.

If the command still fails, the goal ended before the work did, for example at its turn limit or judged impossible: press `Ctrl+O` to read the last verdict's reason ([How evaluation works](https://code.claude.com/docs/en/goal#how-evaluation-works)), then fix the cause or set a new goal; if `/goal` won't start, it says why, usually an untrusted folder or `disableAllHooks` ([Requirements](https://code.claude.com/docs/en/goal#requirements)). If no log line shows a failure, the loop didn't run while the test was broken: start the loop again as in step 4, break the test as in step 5, wait for a failing line, restore the file, then cancel the loop as in step 6. If `git ls-files` prints nothing, `git check-ignore -v .claude/loop.md` names the rule that hides the file: add it with `git add -f`, then commit.

## Watch out

- A loop fires even while you're away, sending the session's whole context each time, and keeps going until you cancel it or it expires ([Stop a loop](https://code.claude.com/docs/en/scheduled-tasks#stop-a-loop)). On a Pro, Max, Team or Enterprise plan, `/usage` lists your heaviest loops ([Plan usage breakdown](https://code.claude.com/docs/en/costs#plan-usage-breakdown)).
- The evaluator can't confirm a condition that Claude's output can't show, such as "the code is clean". Name a command and its result ([How evaluation works](https://code.claude.com/docs/en/goal#how-evaluation-works)).
- A green status in a routine's run list only means the session started and exited without an infrastructure error. Open the run and read the transcript to see whether the task worked ([View and interact with runs](https://code.claude.com/docs/en/routines#view-and-interact-with-runs)).

## Go further

- [Loop engineering: Getting started with loops](https://claude.com/resources/articles/getting-started-with-loops): Anthropic's Claude Code team on turn-based, goal-based, time-based and proactive loops, and when to use each.
- [Prompt-based hooks](https://code.claude.com/docs/en/hooks-guide#prompt-based-hooks): the kind of Stop hook `/goal` wraps ([How evaluation works](https://code.claude.com/docs/en/goal#how-evaluation-works)), for a check you want in every session.
- [Schedule recurring tasks in Claude Code Desktop](https://code.claude.com/docs/en/desktop-scheduled-tasks): scheduled tasks that run on your machine, with your local files, while the Desktop app is open.

---

<sub>Sources: [Keep Claude working toward a goal](https://code.claude.com/docs/en/goal) · [Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks) · [Automate work with routines](https://code.claude.com/docs/en/routines) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Manage costs effectively](https://code.claude.com/docs/en/costs) · [Feature availability](https://code.claude.com/docs/en/feature-availability) · [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web) · [Get started with Claude Code in the cloud](https://code.claude.com/docs/en/web-quickstart) · [Reviewing and modifying installed GitHub Apps](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps)</sub>

<sub>Back to the [Advanced index](../README.md) · Topic: [Automation](../../topics/automation.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-goal-loop)</sub>
