# Advanced capstone: add CI review your team can share

<sub>**Advanced** · Capstone · 60 to 90 minutes, plus run time · Needs: the seven [Advanced lessons](README.md), or their skills · Verified against Claude Code v2.1.308 (stable) on 2026-10-25</sub>

This task puts the whole Advanced level together, in a new copy of the practice template that you tear down at the end. It has no worked example: the brief says what the team needs, and you choose how to build it. The check reads what you commit and three files you save under `.practice/`, and you tick the rest of the [Advanced Exit](README.md#by-the-end-of-this-level-you-can) yourself under [What the check can't see](#what-the-check-cant-see).

## You need

- Node.js LTS, git, `jq`, and the GitHub CLI signed in with `gh auth login`.
- A new private copy of the practice template, made for this capstone and torn down after it. Make it with:

  ```bash
  gh repo create claude-capstone --template wesammustafa/claude-code-practice --private --clone
  cd claude-capstone
  ```

  `--template` bases the new repository on the template, and `--clone` clones it ([gh repo create](https://cli.github.com/manual/gh_repo_create)). The check runs in this copy, without `--dir`.
- In the copy, start `claude` once, accept the trust dialog and exit. In a folder you haven't trusted, `claude --worktree` exits with an error ([Start Claude in a worktree](https://code.claude.com/docs/en/worktrees#start-claude-in-a-worktree)).
- A credential for CI: a Claude Console API key made for the capstone, recommended because the teardown deletes it, or, on a Pro, Max, Team or Enterprise plan, a token from `claude setup-token` ([Manual setup](https://code.claude.com/docs/en/github-actions#manual-setup)).
- On Pro, dynamic workflows turned on from the **Dynamic workflows** row in `/config` ([Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows)).
- macOS, Linux or WSL 2: the review script is bash.
- Usage: heavy. Two sessions at once, a dynamic workflow, a scripted run and a CI run. Each CI run uses your GitHub Actions minutes, and tokens, which an API key bills to your Console account and a subscription token draws from your plan ([Manage costs](https://code.claude.com/docs/en/github-actions#manage-costs)). Cheap variant: start every session with `--model sonnet` ([Model aliases](https://code.claude.com/docs/en/model-config#model-aliases)), put `--model sonnet` in the script and in `claude_args` ([Pass CLI arguments](https://code.claude.com/docs/en/github-actions#pass-cli-arguments)), and have the dynamic workflow in part 4 review only two of the files in `src/`.

## The task

The team wants one review for every pull request, the same on laptops and in CI, with nothing left unbounded. The brief is in `capstone/advanced-brief.md` in your copy. Each part below is a problem the team has; the lesson it names shows one way to solve it.

1. **Two parts at once** ([lesson 1](01-parallel-sessions.md)). Parts 2 and 3 don't depend on each other, so build them at the same time, in two Claude Code sessions that can't touch each other's files, and land both changes on `main`, by merge, rebase or squash. Keep those working copies out of git. New worktrees branch from the remote's default branch, so push `main` first ([Choose the base branch](https://code.claude.com/docs/en/worktrees#choose-the-base-branch)). Once both sessions have committed, and while both working copies exist, save their state from the main checkout:

   ```bash
   mkdir -p .practice && git worktree list --porcelain > .practice/a-capstone-worktrees.txt
   ```

2. **One review, everywhere** ([lessons 4](04-headless.md) and [7](07-bounded-runs.md)). Write the team's review once, as a skill committed in `.claude/skills/<name>/SKILL.md`, and run it in both places. Pick a name of your own, such as `team-review`: `/review` is already an alias of the bundled `/code-review` ([Commands](https://code.claude.com/docs/en/commands#all-commands)). A `claude -p` run expands `/<name>` in its prompt ([Create a commit](https://code.claude.com/docs/en/headless#create-a-commit)), and part 5's workflow runs it as its `prompt`. Locally the staged diff arrives on stdin; in CI, Claude reads the change with `git diff` (part 5). Write the skill's instructions so they work in both places.

   Then write `scripts/review-staged.sh` to lesson 4's criteria: it pipes the staged diff into one `claude -p` call whose prompt runs your skill, with JSON output and `dontAsk` mode ([dontAsk mode](https://code.claude.com/docs/en/permission-modes#allow-only-pre-approved-tools-with-dontask-mode)), pre-approves only `Read`, `Grep` and `Glob`, restricts the tools to those three, turns hooks off and uses no MCP server, and caps turns at 10 or fewer ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)). As in lesson 7, it also caps spend with `--max-budget-usd`, written as a number in the script. Claude Code checks that cap against its client-side cost estimate, and spend can pass it, so leave headroom ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)). After the merges, stage a one-line change in the main checkout, run the script once, read the review and commit the change:

   ```bash
   mkdir -p .practice && scripts/review-staged.sh .practice/a-capstone-run.json
   ```

   The saved JSON's `total_cost_usd` estimates what one review spent, and it must come in under your cap. As with lesson 7's slice, it's a client-side estimate, not your bill ([Track cost and usage](https://code.claude.com/docs/en/agent-sdk/cost-tracking#estimates-not-billing)).
3. **Our plugin, for everyone** ([lesson 6](06-share-your-setup.md)): a marketplace in `team-marketplace/` that lists one plugin by a relative path, with the plugin in its own folder under `team-marketplace/`, as in lesson 6's example kit, and at least one skill or agent in the plugin. The committed `.claude/settings.json` registers the marketplace by a relative path and turns the plugin on ([Require plugins per repository](https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository)). Both validations pass: `claude plugin validate` on the marketplace, and on the plugin directory with `--strict` ([plugin validate](https://code.claude.com/docs/en/plugins/cli-reference#plugin-validate)). The kit is a good start; its [`settings.snippet.json`](../../examples/advanced/06-share-your-setup/settings.snippet.json) also denies reading `.env`, which this copy has no rule for yet. Through these settings, the plugin reaches every teammate who trusts the repository, but not CI, where a fresh checkout was never trusted ([When each surface applies the plugin keys](https://code.claude.com/docs/en/plugins/org#when-each-surface-applies-the-plugin-keys)): that is why part 2's review lives in `.claude/skills/`. Test the plugin only after the merges.
4. **A sweep before a release** ([lessons 2](02-orchestration-patterns.md) and [3](03-dynamic-workflows.md)): from a session in the main checkout, after the merges, ask for a workflow that reviews each file under `src/` and has a second agent check each finding. While it runs, `/workflows` shows each agent's token usage ([Cost](https://code.claude.com/docs/en/workflows#cost)). Save it to the project and commit it ([Save the workflow for reuse](https://code.claude.com/docs/en/workflows#save-the-workflow-for-reuse)).
5. **CI review with limits** ([lessons 5](05-github-actions.md) and [7](07-bounded-runs.md)): `.github/workflows/claude-review.yml` runs on `pull_request` ([Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)) and uses `anthropics/claude-code-action` (Anthropic) with your skill, `/<name>`, as its `prompt`: for a skill in `.claude/skills/`, `actions/checkout` must run before the action ([Run a skill](https://code.claude.com/docs/en/github-actions#run-a-skill)). On a pull request, the action restores `.claude/` from the base branch before Claude starts, so a change to your skill reaches CI only once it's merged ([security notes](https://github.com/anthropics/claude-code-action/blob/v1.0.258/docs/security.md)). Hold it to lesson 5's limits, and one more:
   - the action pinned to a release tag or a full commit SHA ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsuses));
   - the credential from a repository secret, through the matching input, `anthropic_api_key` or `claude_code_oauth_token` ([Manual setup](https://code.claude.com/docs/en/github-actions#manual-setup));
   - a read-only job token: no write access in `permissions` except `id-token: write` ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions)), and `github_token` set to the job's own `GITHUB_TOKEN`, so Claude acts with that token instead of the Claude GitHub App's ([Action parameters](https://code.claude.com/docs/en/github-actions#action-parameters));
   - in `claude_args`, `--max-turns` of 10 or fewer and an `--allowedTools` list without unrestricted Bash;
   - a `timeout-minutes` of 30 or fewer ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes));
   - a `concurrency` group for the pull request with `cancel-in-progress: true`, so a new push cancels the review still running for an older one ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency)), as the docs' cost advice suggests ([Manage costs](https://code.claude.com/docs/en/github-actions#manage-costs)).

   To let Claude see the change, check out the full history, as the template's `.github/workflows/progress.yml` does, and allow `git diff` with `Bash(git diff *)`, a rule that matches only `git diff` commands ([Wildcard patterns](https://code.claude.com/docs/en/permissions#wildcard-patterns)). Have the skill ask for `git diff` as a command on its own, as lesson 7's slice prompt did for `npm test`: a rule must match each command in a chain ([Compound commands](https://code.claude.com/docs/en/permissions#compound-commands)).

   Set `display_report: true`, as lesson 5 does, so Claude's review appears on the run's summary page ([action.yml at v1.0.258](https://github.com/anthropics/claude-code-action/blob/v1.0.258/action.yml)). Turn it on only for trusted input, as here: the pull requests are your own, in a private copy. On a public repository, GitHub withholds secrets from runs that fork pull requests trigger, so a review like this runs only on pull requests from branches in the repository ([Run a skill](https://code.claude.com/docs/en/github-actions#run-a-skill), [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)).

   Add the credential as a repository secret: run `gh secret set ANTHROPIC_API_KEY`, or `gh secret set CLAUDE_CODE_OAUTH_TOKEN`, and paste the value when it asks ([gh secret set](https://cli.github.com/manual/gh_secret_set)). Never commit the credential; keep it in the repository secret ([Protect your credentials](https://code.claude.com/docs/en/github-actions#protect-your-credentials)). The copy needs no Claude GitHub App: the action authenticates as the App only when `github_token` is omitted ([Action parameters](https://code.claude.com/docs/en/github-actions#action-parameters)).

   Commit the workflow to `main` and push. Then push a one-line change on a new branch and open a pull request. `display_report` writes Claude's review to the job summary, which GitHub shows on the run's summary page ([Adding a job summary](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#adding-a-job-summary)): find the run's id with `gh run list --workflow claude-review.yml --limit 1`, then open it with `gh run view <run-id> --web`, as in lesson 5 ([gh run view](https://cli.github.com/manual/gh_run_view)). Read the review, and merge the pull request yourself. Once the review run has finished, and before you tear down, save its record for the check ([gh run list](https://cli.github.com/manual/gh_run_list)):

   ```bash
   gh run list --workflow claude-review.yml --json databaseId,status,conclusion,event,url,workflowName > .practice/a-capstone-ci.json
   ```

Finish on `main`, with the merged pull request pulled, everything committed and `npm test` passing.

Listings checked against the listing bar on 2026-10-24.

## Check

You are done when all of these are true:

- [ ] Lesson 1: `.practice/a-capstone-worktrees.txt` lists two worktrees of this repository whose commits split from each other, and both changes are in your branch; a committed `.gitignore` keeps any of them inside the repository out of git, and not the rest of `.claude/`.
- [ ] Lessons 2 and 3: a committed script in `.claude/workflows/` has a literal `export const meta`, with a `name` and a `description`, as its first statement, and calls `agent()` at least twice.
- [ ] Lesson 4: `scripts/review-staged.sh` is committed, executable and meets lesson 4's criteria: one `claude -p` call, with the prompt right after `-p`, JSON output, `dontAsk` mode, only `Read`, `Grep` and `Glob`, pre-approved and as its only tools, hooks off, no MCP server, and 10 turns or fewer; the staged diff piped in; the JSON saved where its argument says and the result printed; a non-zero exit when the run fails; and no call to Claude when nothing is staged.
- [ ] Lesson 5: a committed workflow runs `anthropics/claude-code-action` on `pull_request`, pinned to a release tag or a full commit SHA, in automation mode, with its credential from a secret and none in the file, a read-only job token (no write access in `permissions` except `id-token: write`, and `github_token` set to the job's own token), `--max-turns` of 10 or fewer, an `--allowedTools` list without unrestricted Bash, a `timeout-minutes` of 30 or fewer and a `concurrency` group with `cancel-in-progress: true`; and no Claude API key or token is committed, at `HEAD` or in the commit the check reads that workflow from; and `.practice/a-capstone-ci.json` shows a completed, successful `pull_request` run of it.
- [ ] Lesson 6: a committed team marketplace lists a plugin by a relative path, under the `name` in the plugin's `plugin.json`, and the committed `.claude/settings.json` registers that marketplace by a relative path and turns the plugin on.
- [ ] Lesson 7: the review script's `claude -p` call caps spend with `--max-budget-usd`, and `.practice/a-capstone-run.json` holds a real run that succeeded within your turn cap and cost less than your spend cap.
- [ ] One review: the review script's `claude -p` prompt and the CI workflow's `prompt` both run one skill committed in `.claude/skills/`.
- [ ] `npm test` passes, and `git status --porcelain` prints nothing.

Run `npm run check -- a-capstone` in this copy. It checks each box's parts one by one, and each part that fails prints what to fix. The check runs your script with a stand-in for `claude`, so it uses none of your usage, and it reads the workflow from your history, so it passes before and after the teardown.

## What the check can't see

The check doesn't look at these parts of the Advanced Exit. Tick them yourself, honestly:

- [ ] I can say which review I'd run on every pull request (Code Review, `/code-review` or my CI workflow) and which I'd keep for a sweep before a release (my saved workflow), and why, by what each costs and how deep it goes ([Compare ways to get a review](https://code.claude.com/docs/en/code-review#compare-ways-to-get-a-review)).
- [ ] I can say when an unattended run needs the sandbox from [lesson 7](07-bounded-runs.md), and whether my review script and CI workflow need it.
- [ ] Before I merged, I acted on at least one point in Claude's review on the run's summary page, or dismissed it with a reason.
- [ ] Before I turned CI on, I multiplied the local run's `total_cost_usd` by the pull requests my team opens in a week, to estimate what CI review spends, and I know a new push cancels the review still running.

When every box on this page is ticked, you've shown the Advanced Exit and finished the last of the guide's three levels. One step remains: the teardown below.

If this level helped, a star helps other developers find the guide.

## Tear down

When the check passes, tear down: this is required.

> [!WARNING]
> Until you tear down, a live credential sits in the copy's secrets. Deleting a secret leaves the credential it held valid ([Uninstall](https://code.claude.com/docs/en/github-actions#uninstall)). On 2026-10-24, a token from `claude setup-token` is valid for one year ([Authentication](https://code.claude.com/docs/en/authentication#generate-a-long-lived-token)), and deleting the secret doesn't revoke it.

1. Delete the workflow with `git rm .github/workflows/claude-review.yml`, then commit and push. With the workflow gone, the Claude Code GitHub Action no longer runs ([Uninstall](https://code.claude.com/docs/en/github-actions#uninstall)).
2. Delete the secret: `gh secret delete ANTHROPIC_API_KEY`, or `gh secret delete CLAUDE_CODE_OAUTH_TOKEN` ([gh secret delete](https://cli.github.com/manual/gh_secret_delete)). `gh secret list` no longer shows it ([gh secret list](https://cli.github.com/manual/gh_secret_list)).
3. With an API key, delete the key on the Claude Console's [API keys page](https://platform.claude.com/settings/keys). With a token from `claude setup-token`, nothing in this teardown revokes it, so it stays valid until it expires ([Uninstall](https://code.claude.com/docs/en/github-actions#uninstall)): that's why this capstone recommends an API key.

Run `npm run check -- a-capstone` once more: it still passes.

---

<sub>Sources: [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees) · [Commands](https://code.claude.com/docs/en/commands) · [Run Claude Code programmatically](https://code.claude.com/docs/en/headless) · [Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows) · [Track cost and usage](https://code.claude.com/docs/en/agent-sdk/cost-tracking) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [CLI reference](https://code.claude.com/docs/en/cli-reference) · [Model configuration](https://code.claude.com/docs/en/model-config) · [Configure permissions](https://code.claude.com/docs/en/permissions) · [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference) · [Manage Claude Code plugins for your organization](https://code.claude.com/docs/en/plugins/org) · [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions) · [Code Review](https://code.claude.com/docs/en/code-review) · [Authentication](https://code.claude.com/docs/en/authentication) · claude-code-action at v1.0.258: [action.yml](https://github.com/anthropics/claude-code-action/blob/v1.0.258/action.yml), [security](https://github.com/anthropics/claude-code-action/blob/v1.0.258/docs/security.md) · GitHub: [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [Workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands) · GitHub CLI manual: [gh repo create](https://cli.github.com/manual/gh_repo_create), [gh run list](https://cli.github.com/manual/gh_run_list), [gh run view](https://cli.github.com/manual/gh_run_view), [gh secret set](https://cli.github.com/manual/gh_secret_set), [gh secret delete](https://cli.github.com/manual/gh_secret_delete), [gh secret list](https://cli.github.com/manual/gh_secret_list) · the [Advanced lessons](README.md), which cite the official pages for each step.</sub>

<sub>← [Put bounds on autonomous runs](07-bounded-runs.md) · [Advanced index](README.md) · [Beyond this guide](beyond-this-guide.md) → · [Stuck on this capstone?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-capstone)</sub>
