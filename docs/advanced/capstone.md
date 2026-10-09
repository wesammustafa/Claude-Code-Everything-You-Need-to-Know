# Advanced capstone: add CI review your team can share

<sub>**Advanced** · Capstone · 30 to 60 minutes, plus run time · Needs: the seven [Advanced lessons](README.md), or their skills · Verified against Claude Code v2.1.285 (stable) on 2026-10-09</sub>

This task puts the whole Advanced level together, in a new copy of the practice template that you tear down at the end. It has no worked example: the brief says what the team needs, and you choose how to build it. The [Advanced Exit](README.md#by-the-end-of-this-level-you-can) is the list of what you can do by the end of this level. The check reads what you commit and two files you save under `.practice/`, and you tick the rest of the Exit yourself under [What the check can't see](#what-the-check-cant-see).

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

The team wants Claude to review every pull request in CI, the same way on everyone's machine, with nothing it runs left unbounded. The brief is in `capstone/advanced-brief.md` in your copy.

Build each part the way its lesson taught:

1. **Two sessions at once** ([lesson 1](01-parallel-sessions.md)). Ignore `.claude/worktrees/` in the committed `.gitignore`, and push `main`: new worktrees branch from the remote's default branch ([Choose the base branch](https://code.claude.com/docs/en/worktrees#choose-the-base-branch)). Then, in two terminals at the same time, start `claude --worktree <name>` twice, with a different name each time ([Reuse a worktree name](https://code.claude.com/docs/en/worktrees#reuse-a-worktree-name)): one session builds part 2, the other part 3, and each commits on its own branch. Once both have committed, and while both worktrees exist, save their state from the main checkout:

   ```bash
   mkdir -p .practice && git worktree list --porcelain > .practice/a-capstone-worktrees.txt
   ```

   Then merge both branches into `main` with `git merge`, not `git merge --squash`, and remove both worktrees.
2. **A review script** ([lesson 4](04-headless.md)): `scripts/review-staged.sh`, to lesson 4's criteria. It pipes the staged diff into one `claude -p` call with JSON output and `dontAsk` mode ([dontAsk mode](https://code.claude.com/docs/en/permission-modes#allow-only-pre-approved-tools-with-dontask-mode)), pre-approves only `Read`, `Grep` and `Glob`, and caps turns at 10 or fewer ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)). After the merges, stage a one-line change in the main checkout, run the script once, read the review and commit the change:

   ```bash
   mkdir -p .practice && scripts/review-staged.sh .practice/a-capstone-run.json
   ```

   The saved JSON's `total_cost_usd` estimates what one review spends. As with lesson 7's slice, it's a client-side estimate, not your bill ([Track cost and usage](https://code.claude.com/docs/en/agent-sdk/cost-tracking#estimates-not-billing)).
3. **The team's plugin** ([lesson 6](06-share-your-setup.md)): a marketplace in `team-marketplace/` that lists one plugin by a relative path, with the plugin in its own folder under `team-marketplace/`, as in lesson 6's example kit, and at least one skill or agent in the plugin. The committed `.claude/settings.json` registers the marketplace by a relative path and turns the plugin on ([Require plugins per repository](https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository)). Both validations pass: `claude plugin validate` on the marketplace, and on the plugin directory with `--strict` ([plugin validate](https://code.claude.com/docs/en/plugins/cli-reference#plugin-validate)). The kit is a good start; its [`settings.snippet.json`](../../examples/advanced/06-share-your-setup/settings.snippet.json) also denies reading `.env`, which this copy has no rule for yet. Test the plugin only after the merges: a relative path resolves against the repository's main checkout, even from a worktree ([Require plugins per repository](https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository)), so the part-3 session can't load it yet.
4. **A saved dynamic workflow** ([lessons 2](02-orchestration-patterns.md) and [3](03-dynamic-workflows.md)): from a session in the main checkout, after the merges, ask for a workflow that reviews each file under `src/` and has a second agent check each finding. While it runs, `/workflows` shows each agent's token usage ([Cost](https://code.claude.com/docs/en/workflows#cost)). Save it to the project: a project save writes to the closest `.claude/workflows/` folder that already exists between the session's working directory and the repository root, or, if none exists yet, to `.claude/workflows/` at the repository root ([Save the workflow for reuse](https://code.claude.com/docs/en/workflows#save-the-workflow-for-reuse)). Commit it.
5. **CI review with limits** ([lessons 5](05-github-actions.md) and [7](07-bounded-runs.md)): `.github/workflows/claude-review.yml` runs on `pull_request` ([Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)) and uses `anthropics/claude-code-action` (Anthropic) with a `prompt` that asks for a review of the pull request's changes ([Action parameters](https://code.claude.com/docs/en/github-actions#action-parameters)). Hold it to lesson 5's limits:
   - the action pinned to a release tag or a full commit SHA ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsuses));
   - the credential from a repository secret, through the matching input, `anthropic_api_key` or `claude_code_oauth_token` ([Manual setup](https://code.claude.com/docs/en/github-actions#manual-setup));
   - a read-only job token: no write access in `permissions` except `id-token: write` ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions)), and `github_token` set to the job's own `GITHUB_TOKEN`, so Claude acts with that token instead of the Claude GitHub App's ([Action parameters](https://code.claude.com/docs/en/github-actions#action-parameters));
   - in `claude_args`, `--max-turns` of 10 or fewer and an `--allowedTools` list without unrestricted Bash;
   - a `timeout-minutes` of 30 or fewer ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes)).

   With a plain-text prompt, Claude has no shell until you allow the commands it needs ([Run on a schedule](https://code.claude.com/docs/en/github-actions#run-on-a-schedule)). To let it see the change, check out the full history, as the template's `.github/workflows/progress.yml` does, and allow `git diff` with `Bash(git diff *)`, a rule that matches only `git diff` commands ([Wildcard patterns](https://code.claude.com/docs/en/permissions#wildcard-patterns)). As lesson 7's slice prompt did for `npm test`, ask in the `prompt` for `git diff` as a command on its own: a rule must match each command in a chain ([Compound commands](https://code.claude.com/docs/en/permissions#compound-commands)).

   Set `display_report: true`, as lesson 5 does, so Claude's review appears on the run's summary page ([action.yml at v1.0.237](https://github.com/anthropics/claude-code-action/blob/v1.0.237/action.yml), [Adding a job summary](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#adding-a-job-summary)). The action says to turn it on only when its input is trusted, as here: the pull requests are your own, in a private copy.

   Add the credential as a repository secret, as the second step of the docs' [Manual setup](https://code.claude.com/docs/en/github-actions#manual-setup) does: run `gh secret set ANTHROPIC_API_KEY`, or `gh secret set CLAUDE_CODE_OAUTH_TOKEN`, and paste the value when it asks ([gh secret set](https://cli.github.com/manual/gh_secret_set)). Never commit the credential; keep it in the repository secret ([Protect your credentials](https://code.claude.com/docs/en/github-actions#protect-your-credentials)). Skip Manual setup's other steps: the action authenticates as the Claude GitHub App only when `github_token` is omitted ([Action parameters](https://code.claude.com/docs/en/github-actions#action-parameters)), and your review workflow replaces its `claude.yml`.

   Commit the workflow to `main` and push. Then push a one-line change on a new branch and open a pull request. Read Claude's review on the run's summary page, as in lesson 5, and merge the pull request yourself.

Finish on `main`, with the merged pull request pulled, everything committed and `npm test` passing.

Listings checked against the listing bar on 2026-10-09.

## Check

You are done when all of these are true:

- [ ] A committed `.gitignore` ignores `.claude/worktrees/` and not the rest of `.claude/`.
- [ ] `.practice/a-capstone-worktrees.txt` lists two worktrees under `.claude/worktrees/` whose commits split from each other, and both are merged into your branch.
- [ ] A committed script in `.claude/workflows/` has a literal `export const meta`, with a `name` and a `description`, as its first statement, and starts subagents with `agent()`.
- [ ] `scripts/review-staged.sh` is committed and executable.
- [ ] Its `claude -p` call asks for JSON, runs in `dontAsk` mode, pre-approves only `Read`, `Grep` and `Glob`, caps turns at 10 or fewer, and has the prompt right after `-p`.
- [ ] It pipes the staged diff in, saves the JSON where its argument says, prints the result, exits non-zero when the run fails, and doesn't call Claude when nothing is staged.
- [ ] `.practice/a-capstone-run.json` holds a run that succeeded within your cap.
- [ ] A committed workflow runs `anthropics/claude-code-action` on `pull_request`, pinned to a release tag or a full commit SHA, in automation mode, with its credential from a secret and none in the file, a read-only job token (no write access in `permissions` except `id-token: write`, and `github_token` set to the job's own token), `--max-turns` of 10 or fewer, an `--allowedTools` list without unrestricted Bash and a `timeout-minutes` of 30 or fewer.
- [ ] No Claude API key or token is committed, at `HEAD` or in the commit the check reads your workflow from.
- [ ] A committed team marketplace lists a plugin by a relative path, and the entry's name matches the `name` in the plugin's `plugin.json`.
- [ ] The committed `.claude/settings.json` registers that marketplace by a relative path and turns the plugin on.
- [ ] `npm test` passes, and `git status --porcelain` prints nothing.

Run `npm run check -- a-capstone` in this copy. Each item that fails prints what to fix. The check runs your script with a stand-in for `claude`, so it uses none of your usage, and it reads the workflow from your history, so it passes before and after the teardown.

## What the check can't see

The check doesn't look at these parts of the Advanced Exit. Tick them yourself, honestly:

- [ ] I ran both worktree sessions at the same time, and neither saw the other's uncommitted edits.
- [ ] I can take the per-file review, with a second agent checking each finding, through lesson 2's questions and say why they end at a dynamic workflow, not subagents in one conversation.
- [ ] I can say when an unattended run needs the sandbox from [lesson 7](07-bounded-runs.md), and whether my review script and CI workflow need it.
- [ ] I saw the CI run on my pull request and read Claude's review on its summary page before I merged.
- [ ] A new session in the main checkout, after the merges, loaded my team plugin with no install command.
- [ ] Before I turned CI on, I used the local run's `total_cost_usd`, as lesson 7 used its slice, to estimate what one review in CI spends, and saw in `/workflows` how many tokens the per-file review used.

When every box on this page is ticked, you've shown the Advanced Exit and finished the last of the guide's three levels. One step remains: the teardown below.

If this level helped, a star helps other developers find the guide.

## Tear down

When the check passes, tear down: this is required.

> [!WARNING]
> Until you tear down, a live credential sits in the copy's secrets. Deleting a secret leaves the credential it held valid ([Uninstall](https://code.claude.com/docs/en/github-actions#uninstall)). On 2026-10-09, a token from `claude setup-token` is valid for one year ([Authentication](https://code.claude.com/docs/en/authentication#generate-a-long-lived-token)), and deleting the secret doesn't revoke it.

1. Delete the workflow with `git rm .github/workflows/claude-review.yml`, then commit and push. With the workflow gone, the Claude Code GitHub Action no longer runs ([Uninstall](https://code.claude.com/docs/en/github-actions#uninstall)).
2. Delete the secret: `gh secret delete ANTHROPIC_API_KEY`, or `gh secret delete CLAUDE_CODE_OAUTH_TOKEN` ([gh secret delete](https://cli.github.com/manual/gh_secret_delete)). `gh secret list` no longer shows it ([gh secret list](https://cli.github.com/manual/gh_secret_list)).
3. With an API key, delete the key on the Claude Console's [API keys page](https://platform.claude.com/settings/keys).

Run `npm run check -- a-capstone` once more: it still passes.

---

<sub>Sources: [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees) · [Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows) · [Track cost and usage](https://code.claude.com/docs/en/agent-sdk/cost-tracking) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [CLI reference](https://code.claude.com/docs/en/cli-reference) · [Model configuration](https://code.claude.com/docs/en/model-config) · [Configure permissions](https://code.claude.com/docs/en/permissions) · [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference) · [Manage Claude Code plugins for your organization](https://code.claude.com/docs/en/plugins/org) · [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions) · [Authentication](https://code.claude.com/docs/en/authentication) · claude-code-action at v1.0.237: [action.yml](https://github.com/anthropics/claude-code-action/blob/v1.0.237/action.yml) · GitHub: [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [Workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands) · GitHub CLI manual: [gh repo create](https://cli.github.com/manual/gh_repo_create), [gh secret set](https://cli.github.com/manual/gh_secret_set), [gh secret delete](https://cli.github.com/manual/gh_secret_delete), [gh secret list](https://cli.github.com/manual/gh_secret_list) · the [Advanced lessons](README.md), which cite the official pages for each step.</sub>

<sub>← [Put bounds on autonomous runs](07-bounded-runs.md) · [Advanced index](README.md) · [Beyond this guide](beyond-this-guide.md) → · [Stuck on this capstone?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-capstone)</sub>
