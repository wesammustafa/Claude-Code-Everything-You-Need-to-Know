# Parallel sessions with worktrees

<sub>**Advanced** · Lesson 1 of 7 · about 20 minutes · Needs: [Advanced index](README.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-09</sub>

## Goal

By the end of this lesson you can run two Claude Code sessions at once, each in its own git worktree, and merge their work into one branch.

## You need

- One of your own repositories with a test command and no uncommitted changes, checked out on its default branch and up to date with a remote you can push to (Watch out says why), and your copy of the practice template with Node.js LTS and the Advanced checks ([Practice](README.md#practice)): the check runs from the copy. Set up the repository's `.practice/` folder as [Beginner lesson 1](../beginner/01-install-and-look-around.md#you-need) describes, if you haven't yet.
- If you haven't run `claude` in that repository before, run it there once and accept the trust dialog: until then `claude --worktree` exits with an error ([Start Claude in a worktree](https://code.claude.com/docs/en/worktrees#start-claude-in-a-worktree)).
- macOS, Linux or WSL 2, and three terminals open at the repository's root: two for the sessions, one for git.
- Usage: moderate. Two sessions work at the same time.

## The idea

A [git worktree](https://git-scm.com/docs/git-worktree) is a second working folder, on its own branch, that shares the repository's history. `claude --worktree <name>` (or `-w <name>`) creates one under `.claude/worktrees/<name>/` on a new branch, `worktree-<name>`, and starts the session in it ([Start Claude in a worktree](https://code.claude.com/docs/en/worktrees#start-claude-in-a-worktree)). Each session edits its own copy of the files. Claude Code also stops a worktree session's file-editing tools from changing your main checkout, and its commands from running there or pointing git at it ([How Claude Code enforces isolation](https://code.claude.com/docs/en/worktrees#how-claude-code-enforces-isolation)).

Commits and branches are shared. Uncommitted edits, installed dependencies and gitignored files such as `.env` are not: each worktree is a fresh checkout. A `.worktreeinclude` file at the repository root copies the gitignored files it lists into each new worktree ([Copy gitignored files into worktrees](https://code.claude.com/docs/en/worktrees#copy-gitignored-files-into-worktrees)); list only what the project needs, since every worktree gets its own copy of each secret.

The work comes back through git: each session commits on its branch, you merge the branches from your main checkout, then remove the worktrees.

## Worked example

1. In your main checkout, ignore the folder the worktrees live in, then commit and push the rule. Without it, worktree contents show up as untracked files in your main checkout. The push puts it on the remote's default branch, where new worktrees start (Watch out says more):

   ```bash
   printf '\n.claude/worktrees/\n' >> .gitignore
   git add .gitignore && git commit -m "Ignore Claude Code worktrees"
   git push
   ```

   The leading `\n` puts the rule on a line of its own, even if your `.gitignore` doesn't end with a newline. Afterwards `git status --short` prints nothing, and `git log -1 --oneline` shows the commit.
2. In terminal 1, start a session in a new worktree and give it a docs task:

   ```bash
   claude --worktree docs-pass
   ```

   ```text
   Tidy the wording of the README's first section, then wait for me before you commit.
   ```

   Claude Code creates `.claude/worktrees/docs-pass/` on the branch `worktree-docs-pass`, and the session works there. Approve the edit when it asks. Asking it to wait holds the commit until step 4 even where no permission prompt would: a worktree session uses your main checkout's `.claude/settings.local.json` ([Settings files and precedence](https://code.claude.com/docs/en/settings#where-claude-code-keeps-the-local-file-in-a-git-repository)), so with the sandbox's auto-allow mode from [Intermediate lesson 4](../intermediate/04-permissions-and-sandbox.md) on there, sandboxed commands such as `git commit` run without asking ([Sandbox modes](https://code.claude.com/docs/en/sandboxing#sandbox-modes)).
3. In terminal 2, start a second session with the short flag and give it a test task:

   ```bash
   claude -w test-pass
   ```

   ```text
   This worktree is a fresh checkout: install the dependencies, then add one missing test for a small exported function and run the tests. Wait for me before you commit.
   ```

   Claude Code creates `.claude/worktrees/test-pass/` on the branch `worktree-test-pass`; the session installs the dependencies there before it adds the test. Approve its steps the same way.
4. In terminal 3, in your main checkout, look at all three checkouts while both sessions wait for you:

   ```bash
   git worktree list
   git status --short
   git -C .claude/worktrees/docs-pass status --short
   git -C .claude/worktrees/test-pass status --short
   ```

   `git worktree list` shows your main checkout first, then `.claude/worktrees/docs-pass` on `[worktree-docs-pass]` and `.claude/worktrees/test-pass` on `[worktree-test-pass]`; git may mark each one `locked` while its session runs. `git status --short` doesn't list either session's edits: they happen in other folders. Each `git -C` command lists only the changes of the session in that folder, such as the README in `docs-pass`, and never the other session's. Now tell each session to commit: `git log --oneline --graph --all` then shows a new commit on each branch.
5. Still in your main checkout, merge both branches, then run your tests:

   ```bash
   git merge worktree-docs-pass
   git merge worktree-test-pass
   ```

   [`git merge`](https://git-scm.com/docs/git-merge) brings each branch's commits into yours. The first merge just moves your branch forward (a fast-forward): `worktree-docs-pass` started from the commit you pushed in step 1, so your branch has no commits it lacks. The second makes a merge commit, because your branch now has a commit `worktree-test-pass` lacks, and opens your editor for its message: save and close it. Run this step yourself: while a session is isolated in its worktree, Claude Code blocks its git commands that reach into the main checkout. If both tasks changed the same lines, git stops with a conflict: resolve it, or start `claude` in the main checkout and ask it to.
6. In each session, run `/exit`. The worktree's branch has a new commit, so Claude Code asks whether to keep or remove the worktree: choose remove ([Clean up worktrees](https://code.claude.com/docs/en/worktrees#clean-up-worktrees)). `git worktree list` no longer shows either worktree.

> [!CAUTION]
> Removing a worktree deletes its folder and its branch, along with any work in them you haven't merged. Merge first, or choose keep.

## Your turn

Pick two small changes in your repository that touch different files, such as a fix in one module and a missing test for another. Make each one in its own worktree session, with both sessions running at the same time, and bring both into your branch.

If the work they should build on isn't on the remote's default branch yet (see Watch out), get it there first, or add `"worktree": {"baseRef": "head"}` to `.claude/settings.local.json`, your personal settings file from [Intermediate lesson 4](../intermediate/04-permissions-and-sandbox.md), so new worktrees start from your local `HEAD` ([`worktree.baseRef`](https://code.claude.com/docs/en/settings-reference#worktree-baseref)).

Acceptance criteria:

- A committed `.gitignore` ignores `.claude/worktrees/`, and doesn't ignore the rest of `.claude/`.
- Each change is made in its own session, started with `claude --worktree <name>`, and committed on that worktree's branch.
- `.practice/a-1-worktrees.txt` holds the output of `git worktree list --porcelain`, saved from the main checkout while both worktrees existed and both had committed:

  ```bash
  git worktree list --porcelain > .practice/a-1-worktrees.txt
  ```

- Both branches are merged into your branch with `git merge`, not [`git merge --squash`](https://git-scm.com/docs/git-merge#Documentation/git-merge.txt---squash).
- Your tests pass after both merges (not checked).
- Both worktrees are removed, and any branch you kept is deleted only after it's merged.
- Optional, not checked: if your project needs a gitignored file to run, such as a local config, list it in a `.worktreeinclude` file at your repository root.

## Check

You are done when all of these are true:

- [ ] A committed `.gitignore` ignores `.claude/worktrees/`, and not the rest of `.claude/`.
- [ ] `.practice/a-1-worktrees.txt` lists two worktrees under `.claude/worktrees/` whose commits split from each other, and both are merged into your branch.
- [ ] Neither of those worktrees still exists: `git worktree list` doesn't show them.
- [ ] Self-check (not tested): while both sessions worked, neither saw the other's uncommitted edits.

Run `npm run check -- a-1 --dir <your repo>` from your practice copy.

If the first item fails, run `git -c core.excludesFile=/dev/null check-ignore -v .claude/worktrees/x` in your repository (the `-c` part swaps your global excludes file, [`core.excludesFile`](https://git-scm.com/docs/gitignore), for an empty one, as the check does): it should name your `.gitignore` and the line that matches ([git-check-ignore](https://git-scm.com/docs/git-check-ignore#Documentation/git-check-ignore.txt---verbose)). A rule only in `.git/info/exclude` or your global excludes file isn't committed, and a broad rule such as `.claude/` would also hide the settings and skills you commit for your team. If the second item fails, read the hint the check prints: save the file after both sessions commit and before you remove either worktree, and merge each branch with `git merge`. If the third item fails, run `git worktree remove <path>` from your main checkout on each path the check names, with `git worktree unlock <path>` first if git says it's locked. That leaves the worktree's branch: delete it once it's merged, with `git merge-base --is-ancestor worktree-<name> HEAD && git branch -D worktree-<name>`. The first command succeeds only when the branch is part of `HEAD` ([git-merge-base](https://git-scm.com/docs/git-merge-base#Documentation/git-merge-base.txt---is-ancestor)), and `-D` deletes it without git's own merged test, which checks the branch's upstream, when it has one, rather than `HEAD` ([git-branch](https://git-scm.com/docs/git-branch#Documentation/git-branch.txt--D)).

## Watch out

- In most repositories on macOS, Linux and WSL 2, choosing "Yes, and don't ask again" for a Bash command in a worktree session saves the rule to your main checkout's `.claude/settings.local.json`. It then applies in the main checkout and in every worktree of the repository, and it stays after the worktree is removed ([What worktrees share with the main checkout](https://code.claude.com/docs/en/worktrees#what-worktrees-share-with-the-main-checkout)). Approve only commands you'd allow everywhere.
- Running several sessions at once multiplies token usage ([Run agents in parallel](https://code.claude.com/docs/en/agents)). Give each session one small task, and exit it once its branch is merged.
- A new worktree branches from the remote's default branch, not from your local `HEAD` ([Choose the base branch](https://code.claude.com/docs/en/worktrees#choose-the-base-branch)). Commits that aren't on that branch yet, such as unpushed commits or your feature branch's work, aren't in it, and merging its branch into a branch that's behind the remote's default branch brings in the commits that branch lacks. With no remote, a new worktree starts from your local `HEAD` instead.

## Go further

- [Isolate subagents with worktrees](https://code.claude.com/docs/en/worktrees#isolate-subagents-with-worktrees): `isolation: worktree` in a subagent's frontmatter gives each run a checkout of its own.
- [Message your other Claude Code sessions](https://code.claude.com/docs/en/cross-session-messaging): let the sessions in your worktrees pass findings to each other.
- [Run multiple Claude sessions](https://code.claude.com/docs/en/best-practices#run-multiple-claude-sessions): the Writer/Reviewer pattern, where a fresh session reviews what another one wrote.

---

<sub>Sources: [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees) · [All settings](https://code.claude.com/docs/en/settings-reference) · [Settings files and precedence](https://code.claude.com/docs/en/settings) · [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing) · [Run agents in parallel](https://code.claude.com/docs/en/agents) · [git-worktree](https://git-scm.com/docs/git-worktree) · [git-merge](https://git-scm.com/docs/git-merge) · [git-check-ignore](https://git-scm.com/docs/git-check-ignore) · [gitignore](https://git-scm.com/docs/gitignore) · [git-merge-base](https://git-scm.com/docs/git-merge-base) · [git-branch](https://git-scm.com/docs/git-branch)</sub>

<sub>← [Advanced index](README.md) · [Choose an orchestration pattern](02-orchestration-patterns.md) → · Topic: [Subagents and parallel work](../topics/subagents-and-parallel-work.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-1)</sub>
