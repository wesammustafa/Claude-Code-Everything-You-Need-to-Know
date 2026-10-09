# Agent view

<sub>**Advanced** · Elective · about 20 minutes, plus run time · Needs: [Parallel sessions with worktrees](../01-parallel-sessions.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-09</sub>

> [!NOTE]
> "Agent view is in research preview. The interface and keyboard shortcuts may change as the feature evolves." ([Manage multiple agents with agent view](https://code.claude.com/docs/en/agent-view))

## Goal

By the end of this Elective you can hand several independent tasks to background sessions from one screen, step in only when one needs you, and merge or discard what each one did.

## You need

- Your copy of the practice template, and Node.js LTS, for the Worked example; one of your own repositories for Your turn. You practice in throwaway clones of them whose remote is a folder on your machine, so nothing a session pushes leaves your machine. Step 1 makes the clone for the Worked example.
- macOS, Linux or WSL 2, and two terminals: one for agent view, one for git. On macOS, keep the clones outside Desktop, Documents and Downloads, where a background session can report `Operation not permitted` until you grant it access ([Background sessions can't read Desktop, Documents, or Downloads on macOS](https://code.claude.com/docs/en/agent-view#background-sessions-can%E2%80%99t-read-desktop-documents-or-downloads-on-macos)).
- Usage: moderate. Each session draws on your usage independently ([Quick start](https://code.claude.com/docs/en/agent-view#quick-start)), and each row's one-line summary is a short Haiku-class request when a turn ends, and every few minutes during a long turn ([Row summaries](https://code.claude.com/docs/en/agent-view#row-summaries)). Cheap variant: in step 3, dispatch only the first task, then type `! npm test` as the second. A shell job runs the command in place of Claude, so no model is invoked, and its row clears itself a few minutes after the command ends ([Run a shell command](https://code.claude.com/docs/en/agent-view#run-a-shell-command)). Steps 4 to 8 then apply to the one Claude session: expect one worktree, one branch and one session to remove.

## The idea

[Agent view](https://code.claude.com/docs/en/agent-view), opened with `claude agents`, is one screen for your background sessions: full Claude Code conversations that run with no terminal attached. Every prompt you type there starts its own session, which a background service keeps running after you close the screen. Each row shows whether its session is working, needs your input, or is done ([Read session state](https://code.claude.com/docs/en/agent-view#read-session-state)).

In [lesson 1](../01-parallel-sessions.md) you made the worktrees yourself. Here Claude does: before a dispatched session edits a file, it moves into its own worktree under `.claude/worktrees/`. Claude Code tells it to commit on the worktree's branch and push that branch if the repository has a remote, unless the task, your `CLAUDE.md` or memory says you handle git yourself. It is told never to push to `main` or `master`, force-push or merge. Whatever the task, it ends with a report of what it did and where the work is ([How file edits are isolated](https://code.claude.com/docs/en/agent-view#how-file-edits-are-isolated)).

> [!WARNING]
> A background session acts while you aren't watching. Opened from your shell without `--permission-mode`, agent view starts each session the way a new `claude` session in that folder would, usually in auto mode ([Permission mode](https://code.claude.com/docs/en/agent-view#permission-mode), [Which mode a session starts in](https://code.claude.com/docs/en/permission-modes#which-mode-a-session-starts-in)), where Claude commits without asking and pushes its branch when the repository has a remote. Open agent view with a permission mode you chose, never with `--dangerously-skip-permissions`, and practice in a clone whose remote is a folder on your machine.

## Worked example

1. From the folder that holds your practice template copy, make a throwaway clone with a local remote, and check that its tests pass. Replace `<template copy>` with your copy's folder name:

   ```bash
   git clone --bare <template copy> av-origin.git
   git clone av-origin.git av-practice
   cd av-practice
   mkdir -p .practice
   printf '%s\n' .practice/ .claude/worktrees/ >> "$(git rev-parse --git-path info/exclude)"
   npm test
   ```

   `npm test` passes, and `origin` is now the folder `av-origin.git`, so a push stays on your machine. The exclude lines keep two folders out of `git status` without a commit: `.practice/`, where Your turn saves its files (as in [Beginner lesson 1](../../beginner/01-install-and-look-around.md#you-need)), and the worktrees Claude creates ([gitignore](https://git-scm.com/docs/gitignore), [Start Claude in a worktree](https://code.claude.com/docs/en/worktrees#start-claude-in-a-worktree)).
2. In the first terminal, open agent view with two dispatch defaults: Manual mode, in which only reads run without asking ([Available modes](https://code.claude.com/docs/en/permission-modes#available-modes)), and Sonnet ([Model aliases](https://code.claude.com/docs/en/model-config#model-aliases)):

   ```bash
   claude agents --permission-mode manual --model sonnet
   ```

   Accept the trust dialog for the new folder. The header names the model new sessions use ([Set the model](https://code.claude.com/docs/en/agent-view#set-the-model)), and every session you dispatch from this view starts with both defaults ([Dispatch defaults](https://code.claude.com/docs/en/agent-view#dispatch-defaults)). If you have no other background sessions, the list shows empty section headers, each with a description. If `claude agents` lists your subagents and exits instead, check that no settings file sets `disableAgentView` to `true` and that `CLAUDE_CODE_DISABLE_AGENT_VIEW` isn't set ([Turn off agent view](https://code.claude.com/docs/en/agent-view#turn-off-agent-view)).
3. Dispatch two tasks that touch different files. Type each one and press `Enter`; every prompt starts its own session:

   ```text
   Add a --json option to src/cli.js that prints the broken links as a JSON array instead of text lines. Add a test for it in a new file, test/cli.test.js, and run npm test.
   ```

   ```text
   Write docs/config.md describing each linkcheck.json option in src/config.js, with its default and an example. Don't change any code.
   ```

   Two rows appear under `Working`, each named from its prompt.
4. When a session needs your approval, for an edit or a command, its row moves under `Needs input`. Select it with `↑` or `↓` and press `Space`: the peek panel shows what it's waiting on ([Peek and reply](https://code.claude.com/docs/en/agent-view#peek-and-reply)). A reply typed there doesn't answer a permission prompt, so press `→` to attach. At v2.1.285, a background session waiting for your approval can show as done (fixed in v2.1.286), and `claude agents` sometimes doesn't show the permission prompt a session is waiting on (fixed in v2.1.287) ([CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)): if a row shows as done without a report, or its peek shows no prompt, attach with `→`.
5. Attached, the session fills the terminal, with a short recap of what happened while you were away. Read what Claude wants to do, and approve it if it fits the task, but not with `Yes, and switch to auto mode`, which a command's prompt can offer: it would switch this unwatched session to auto mode ([Switch permission modes](https://code.claude.com/docs/en/permission-modes#switch-permission-modes)). You can stay attached and approve its next requests, such as a `git commit` or `git push` it asks to run, then press `←` on an empty prompt: you're back in the table, and the session keeps running ([Attach to a session](https://code.claude.com/docs/en/agent-view#attach-to-a-session)). Do the same whenever a row needs you.
6. In the second terminal, in `av-practice`, look at your checkout while the sessions work:

   ```bash
   git status --short
   git worktree list
   ```

   `git status --short` prints nothing: the sessions edit elsewhere. Once a session has asked to edit, `git worktree list` shows a worktree for it under `.claude/worktrees/`, with its branch in brackets.
7. When each session's row is under `Completed`, peek at it: its result says what it did and where the work is, such as its branch (your wording will differ). A result that doesn't say what the session did and where the work is may still be waiting for your approval, as step 4 warns: attach with `→` and answer it first. In the second terminal, merge what you want to keep, then run the tests:

   ```bash
   git merge --no-edit <branch>
   npm test
   ```

   Run the merge once for each branch you keep, using the branch name from its session's result or from `git worktree list`. `npm test` passes; if you kept the `--json` branch, it runs more tests than in step 1.
8. Clean up from the second terminal. List this folder's sessions, each with its short `id`, then remove each one:

   ```bash
   claude agents --json --all --cwd "$PWD"
   claude rm <id>
   ```

   `claude rm` also removes the worktree Claude created for the session when that's safe. It keeps a worktree that holds uncommitted changes, or commits it can't confirm are saved elsewhere, and says why. Commits on the remote, or merged into the default branch you have checked out, count as saved ([What deleting a session removes](https://code.claude.com/docs/en/agent-view#what-deleting-a-session-removes)). Afterwards `git worktree list` shows only your checkout. Press `Esc` in agent view to return to your shell.

## Your turn

**Brief:** in a throwaway clone of your own repository, made as in step 1 with new folder names and your own test command, hand off two tasks you've been putting off that touch different files. Each worktree is a fresh checkout ([Set up the worktree environment](https://code.claude.com/docs/en/worktrees#set-up-the-worktree-environment)), so a task that runs your tests should say to install the dependencies in its worktree first, as lesson 1's test task did. While both sessions work, save the two `.practice/` files the criteria below name.

Then, in your second terminal, start a session in the clone yourself with `claude --permission-mode manual`: a session you move in keeps the mode it was in, and a plain `claude` usually starts in auto mode ([Permission mode](https://code.claude.com/docs/en/agent-view#permission-mode)). Ask it a question about the code that needs no edits, and move it into agent view with `/background`, which frees that terminal and returns you to your shell ([Send the session to the background](https://code.claude.com/docs/en/agent-view#send-the-session-to-the-background)). A session you move in keeps working in your checkout, with no worktree of its own. Supervise all three from agent view until each dispatched session's work is merged or discarded.

**Acceptance criteria:**

- Agent view is opened with a permission mode and a model you chose for the work.
- Two dispatched sessions each change files the other doesn't touch.
- While both work, once each has asked to edit, and before you start the session you move in, you save your checkout's state:

  ```bash
  git status --short > .practice/a-view-status.txt
  git worktree list > .practice/a-view-worktrees.txt
  ```

- That session is moved into agent view with `/background` (alias `/bg`) after your question ([Commands](https://code.claude.com/docs/en/commands)).
- Every `Needs input` row is answered: a question from the peek panel, a permission prompt by attaching.
- What you keep is merged into your branch, your tests pass, and every session you started is removed with `claude rm <id>`.

## Check

You are done when all of these are true:

- [ ] Your checkout stayed clean while the dispatched sessions worked, and each had a worktree of its own: `.practice/a-view-status.txt` is empty, and `.practice/a-view-worktrees.txt` lists a path under `.claude/worktrees/` for each of them. In your clone, `[ ! -s .practice/a-view-status.txt ] && grep /.claude/worktrees/ .practice/a-view-worktrees.txt` prints one line for each.
- [ ] `git log --oneline` on your branch shows the work you kept, and your tests pass.
- [ ] `claude agents --json --all --cwd "$PWD"` lists no session whose `kind` is `background`, and `git worktree list` shows nothing under `.claude/worktrees/`.
- [ ] Self-check (not tested): you answered every `Needs input` row from agent view, without switching to your shell, and you can say which requests the peek panel answered and which needed you to attach.

If the first item fails, save the files again on your next run, while both dispatched sessions work: a session that hasn't asked to edit has no worktree yet, a session you moved in edits your checkout in place, and a settings file that sets [`worktree.bgIsolation`](https://code.claude.com/docs/en/settings-reference#worktree-bgisolation) to `"none"` turns the worktrees off. If your branch lacks work you kept, or your tests fail after a merge, find the session behind it. A session leaves git to you when the task, your `CLAUDE.md` or memory says you handle it, and work left uncommitted in its worktree must be committed there before you can merge it: attach to that session and ask it to commit. For a branch that broke your tests, fix it yourself, or attach to that session before you remove it and tell it what failed; then merge the fix. If `claude rm` kept a session, read the reason it printed, such as uncommitted changes or unpushed commits, and follow [What deleting a session removes](https://code.claude.com/docs/en/agent-view#what-deleting-a-session-removes). Remove a worktree left without a session with `git worktree remove <path>` ([`.claude/worktrees/` is filling up](https://code.claude.com/docs/en/agent-view#claude%2Fworktrees%2F-is-filling-up)), running `git worktree unlock <path>` first if git says it's locked ([Clean up subagent and background-session worktrees](https://code.claude.com/docs/en/worktrees#clean-up-subagent-and-background-session-worktrees)).

## Watch out

- Deleting a session in agent view, with `Ctrl+X` twice, removes the worktree Claude created for it, uncommitted changes included; `claude rm` keeps a worktree that has them ([What deleting a session removes](https://code.claude.com/docs/en/agent-view#what-deleting-a-session-removes)). Commit or merge what you want to keep first.
- Background sessions use your usage the same as interactive ones, so several at once use it several times as fast ([Limitations](https://code.claude.com/docs/en/agent-view#limitations)).
- `/agents` inside a session is a different command from `claude agents`, despite the similar name ([Check on running work](https://code.claude.com/docs/en/agents#check-on-running-work)).

## Go further

- [Read session state from a script](https://code.claude.com/docs/en/agent-view#read-session-state-from-a-script): poll `claude agents --json --all` from a status bar or another program.
- [Copy the session with /fork](https://code.claude.com/docs/en/agent-view#copy-the-session-with-%2Ffork): send a copy of your conversation to the background and keep working where you are.
- [Message your other Claude Code sessions](https://code.claude.com/docs/en/cross-session-messaging): let the sessions you dispatch pass findings to each other.

---

<sub>Sources: [Manage multiple agents with agent view](https://code.claude.com/docs/en/agent-view) · [Run agents in parallel](https://code.claude.com/docs/en/agents) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees) · [All settings](https://code.claude.com/docs/en/settings-reference) · [Commands](https://code.claude.com/docs/en/commands) · [Model configuration](https://code.claude.com/docs/en/model-config) · [Claude Code CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) · [gitignore](https://git-scm.com/docs/gitignore)</sub>

<sub>Back to the [Advanced index](../README.md) · Topic: [Subagents and parallel work](../../topics/subagents-and-parallel-work.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-agent-view)</sub>
