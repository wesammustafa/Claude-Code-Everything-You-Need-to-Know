# GitHub Actions

<sub>**Advanced** · Lesson 5 of 7 · about 20 minutes, plus run time · Needs: [Script Claude Code with `claude -p`](04-headless.md) · Verified against Claude Code v2.1.292 (stable) on 2026-10-15</sub>

## Goal

By the end of this lesson you can run Claude Code unattended in a GitHub Actions workflow that reads its credential from a repository secret and stops within limits written in the file.

## You need

- The `claude -p` flags from [lesson 4](04-headless.md), such as `--max-turns` and `--allowedTools`.
- The [GitHub CLI](https://cli.github.com), signed in with `gh auth login`.
- A new private copy of the practice template, just for this lesson, which you own. Make it with:

  ```bash
  gh repo create claude-actions-practice --template wesammustafa/claude-code-practice --private --clone
  cd claude-actions-practice
  ```

  `--template` bases the new repository on the template, and `--clone` clones it ([gh repo create](https://cli.github.com/manual/gh_repo_create)). The check runs in this copy, with Node.js LTS, without `--dir`. At the end, you take the workflows and the secret out of it.
- A credential: a Claude Console API key made for this lesson, recommended because the teardown deletes it, or, on a Pro, Max, Team or Enterprise plan, a token from `claude setup-token` ([Manual setup](https://code.claude.com/docs/en/github-actions#manual-setup)).
- Usage: light. Each run is short, and also uses GitHub Actions minutes (see Watch out).

## The idea

The [Claude Code GitHub Action](https://code.claude.com/docs/en/github-actions), `anthropics/claude-code-action` (Anthropic), runs Claude Code as a step in a workflow. With no `prompt` input, it waits for `@claude` in an issue or pull request; with a `prompt`, it runs without waiting for a mention ([Interactive and automation modes](https://code.claude.com/docs/en/github-actions#interactive-and-automation-modes)). Its `display_report` input puts Claude's report on the run's summary page ([action.yml at v1.0.258](https://github.com/anthropics/claude-code-action/blob/v1.0.258/action.yml)).

The workflow names a repository secret that holds the credential ([Manual setup](https://code.claude.com/docs/en/github-actions#manual-setup)). With `github_token` set to the job's own token, the action uses that token instead of the Claude GitHub App ([Action parameters](https://code.claude.com/docs/en/github-actions#action-parameters)), so the job's `permissions` limit what it can do on GitHub ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idpermissions)).

No one is at the keyboard, so the limits go in the file. `claude_args` passes Claude Code's CLI flags, such as `--max-turns` and `--allowedTools` ([Pass CLI arguments](https://code.claude.com/docs/en/github-actions#pass-cli-arguments)), and with a prompt written as text rather than a skill, Claude has no shell until you allow the commands it needs ([Run on a schedule](https://code.claude.com/docs/en/github-actions#run-on-a-schedule)). The job's `timeout-minutes` limits its run time ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes)).

## Worked example

Ask Claude a question from a workflow you start by hand. You set it up yourself, with a workflow file and a secret; the job's own token stands in for the Claude GitHub App, which this lesson doesn't install.

1. In the copy, save this workflow as `.github/workflows/ask-claude.yml`, then commit it and push it to `main`. A manual run starts only when the workflow file is on the default branch ([`workflow_dispatch`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)):

   ```yaml
   name: Ask Claude
   on: workflow_dispatch
   jobs:
     ask:
       runs-on: ubuntu-latest
       timeout-minutes: 10
       permissions:
         contents: read
       steps:
         - uses: actions/checkout@v7
         - uses: anthropics/claude-code-action@v1.0.258
           with:
             anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
             github_token: ${{ github.token }}
             prompt: "In one paragraph, what does src/links.js do? Don't change any files."
             claude_args: "--max-turns 3"
             display_report: true
   ```

   With a subscription token, replace the `anthropic_api_key` line with `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` ([Manual setup](https://code.claude.com/docs/en/github-actions#manual-setup)). Release v1.0.258 installs Claude Code v2.1.308 ([run.ts at v1.0.258](https://github.com/anthropics/claude-code-action/blob/v1.0.258/src/entrypoints/run.ts)); its full commit SHA is `6b6870e649b5ff408753befeaee5fc7989d4e6a9`.
2. Save the credential as the repository secret the workflow names. With no value on the command line, `gh secret set` asks you to paste it ([gh secret set](https://cli.github.com/manual/gh_secret_set)):

   ```bash
   gh secret set ANTHROPIC_API_KEY
   gh secret list
   ```

   With a subscription token, run `gh secret set CLAUDE_CODE_OAUTH_TOKEN` instead. `gh secret list` then shows the secret's name ([gh secret list](https://cli.github.com/manual/gh_secret_list)). For a secret that several repositories will share, the docs recommend an API key, because a subscription token is tied to the subscription of the person who created it ([Set up for an organization](https://code.claude.com/docs/en/github-actions#set-up-for-an-organization)).
3. Start the workflow, find its run, and follow it to the end ([gh workflow run](https://cli.github.com/manual/gh_workflow_run), [gh run list](https://cli.github.com/manual/gh_run_list), [gh run watch](https://cli.github.com/manual/gh_run_watch)):

   ```bash
   gh workflow run ask-claude.yml
   gh run list --workflow ask-claude.yml --limit 1
   gh run watch <run-id> --exit-status
   ```

4. Open the run in your browser with `gh run view <run-id> --web` ([gh run view](https://cli.github.com/manual/gh_run_view)). Its summary page holds Claude's report, with the answer. Your wording will differ, but it should describe how `src/links.js` finds Markdown links.

Both of the docs' setup paths install the Claude GitHub App ([Setup](https://code.claude.com/docs/en/github-actions#setup)). Its permission set is all or nothing, and includes write access to the repository's contents, issues, pull requests and workflows ([GitHub App permissions](https://code.claude.com/docs/en/github-actions#github-app-permissions)), so install it only when you want `@claude`, with `/install-github-app`, or another Claude feature that needs it, such as Code Review.

## Your turn

**Brief:** run Claude in CI with every limit written in the file, then leave no credential in the copy. Add `.github/workflows/linkcheck-report.yml`, a workflow you start by hand, in which Claude runs the template's link checker on `samples/` and explains each broken link on the run's summary page, without changing any files. The docs' [Run on a schedule](https://code.claude.com/docs/en/github-actions#run-on-a-schedule) example is a starting point. It sets a model with `--model`: pick one as in [Intermediate lesson 3](../intermediate/03-model-and-effort.md), or leave that line out to use Claude Code's default model ([Pass CLI arguments](https://code.claude.com/docs/en/github-actions#pass-cli-arguments)).

**Acceptance criteria:**

- It starts only by hand: `on: workflow_dispatch`, and no other trigger.
- It uses `anthropics/claude-code-action` pinned to a release tag, such as `@v1.0.258`, or a full commit SHA, not `@v1` (Watch out says why).
- It has a `prompt`, so it runs in automation mode.
- Its credential comes from the secret you saved, through the matching input, `anthropic_api_key` or `claude_code_oauth_token`. No credential is written in the file.
- It has a read-only job token: the job's `permissions` grant `contents: read` and no write access, and `github_token` is set to the job's own token, as in the Worked example.
- `claude_args` sets `--max-turns` to 10 or fewer, written as two words, `--max-turns <n>`, as the docs' [Pass CLI arguments](https://code.claude.com/docs/en/github-actions#pass-cli-arguments) example does, and an `--allowedTools` rule for the link-check command alone, never all of Bash ([Configure permissions](https://code.claude.com/docs/en/permissions#wildcard-patterns)).
- The job has a `timeout-minutes` of 30 or fewer ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes)).
- It checks out the repository and sets up Node.js before the action runs, as the template's `.github/workflows/progress.yml` does, so the link checker can run.
- `display_report` is `true`, so Claude's report appears on the run's summary page. Turn it on only for trusted input, as here: you start the run, and the prompt and files are yours ([action.yml at v1.0.258](https://github.com/anthropics/claude-code-action/blob/v1.0.258/action.yml)). Keep `show_full_output` off and don't turn on GitHub Actions debug mode: both print Claude's full output, which can include secrets, into the log ([security notes](https://github.com/anthropics/claude-code-action/blob/v1.0.258/docs/security.md)).

Then run it, save the record and tear down:

1. Commit the workflow and push it to `main`.
2. Start it, find its id, follow it to the end and open it in your browser:

   ```bash
   gh workflow run linkcheck-report.yml
   gh run list --workflow linkcheck-report.yml --limit 1
   gh run watch <run-id> --exit-status
   gh run view <run-id> --web
   ```

   The run's summary page holds Claude's report, with its explanation of each broken link. Your wording will differ.
3. Save the run record for the check, with the fields it reads ([gh run list](https://cli.github.com/manual/gh_run_list)):

   ```bash
   mkdir -p .practice
   gh run list --workflow linkcheck-report.yml --json databaseId,status,conclusion,event,headSha,url,workflowName > .practice/a-5-runs.json
   ```

4. Run `npm run check -- a-5` (the Check below). When it passes, tear down: this is required. Don't tear down first: fixing a failed run needs the secret, which the teardown deletes.

> [!WARNING]
> Deleting a secret leaves the credential it held valid ([Uninstall](https://code.claude.com/docs/en/github-actions#uninstall)). The `CLAUDE_CODE_OAUTH_TOKEN` secret holds an OAuth token of the kind `claude setup-token` generates ([Action parameters](https://code.claude.com/docs/en/github-actions#action-parameters)). On 2026-10-24, a token from `claude setup-token` is valid for one year ([Authentication](https://code.claude.com/docs/en/authentication#generate-a-long-lived-token)), and deleting the secret doesn't revoke it.

5. Delete both workflows, then commit and push:

   ```bash
   git rm .github/workflows/ask-claude.yml .github/workflows/linkcheck-report.yml
   git commit -m "Remove the Claude workflows"
   git push
   ```

6. Delete the secret: `gh secret delete ANTHROPIC_API_KEY`, or `gh secret delete CLAUDE_CODE_OAUTH_TOKEN` ([gh secret delete](https://cli.github.com/manual/gh_secret_delete)).
7. With an API key, delete the key the secret held on the Claude Console's [API keys page](https://platform.claude.com/settings/keys). With a subscription token, nothing in this teardown revokes it, so it stays valid until it expires ([Uninstall](https://code.claude.com/docs/en/github-actions#uninstall)): that's why this lesson recommends an API key.

If you installed the Claude GitHub App for this copy, also remove the copy from the App's repository access on GitHub ([Modifying repository access](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps#modifying-repository-access)).

## Check

You are done when all of these are true:

- [ ] A committed workflow runs `anthropics/claude-code-action` pinned to a release tag or a full commit SHA, in automation mode, with its credential from a secret and none in the file.
- [ ] Its limits are in the file: `--max-turns` of 10 or fewer, an `--allowedTools` list without unrestricted Bash, a read-only job token (no write access in `permissions`) and a `timeout-minutes` of 30 or fewer.
- [ ] `.practice/a-5-runs.json` shows a completed, successful manual run on a commit that holds the workflow.
- [ ] Self-check (not tested): you can say who can start a Claude run in this copy, and which text from an issue or comment would reach Claude as input if you added an `@claude` workflow (see Watch out).

Run `npm run check -- a-5` in this copy.

If the first or second item fails, its hint names the line or the limit to fix. If the saved run failed, `gh run view <run-id> --log-failed` shows why, such as a secret name that doesn't match the workflow; push a fix, run the workflow again and save the record again.

The check reads the workflow from your history, so it still passes after the teardown. Once it passes, tear down as Your turn's steps 5 to 7 describe.

## Watch out

- Anyone with write access to the repository can start a run with `@claude`, and the issue or comment text is input to Claude, so it can carry hidden instructions ([Who can trigger runs](https://code.claude.com/docs/en/github-actions#who-can-trigger-runs), [the action's security notes](https://github.com/anthropics/claude-code-action/blob/v1.0.258/docs/security.md)). Keep this copy private and yours: only people with read access can see its run logs ([Using workflow run logs](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs)).
- Each run uses GitHub Actions minutes and tokens. In a private repository, the minutes come out of your account's included minutes ([GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). The template's Progress workflow also runs on each push to this copy, so every push uses some of those minutes too. The tokens are billed to your Console account with an API key, or drawn from your plan with a subscription token. `--max-turns` and `timeout-minutes` limit how much work a run can do, which lowers both ([Manage costs](https://code.claude.com/docs/en/github-actions#manage-costs)).
- The `v1` tag in the docs' examples moves to each new release ([tags](https://github.com/anthropics/claude-code-action/tags)), and each release pins the Claude Code version it installs, so a workflow on `@v1` can run a newer Claude Code than you tested. GitHub calls a workflow dependency lockfile the strongest protection, offers pinning to a full-length commit SHA for repositories that cannot adopt one, and warns that a tag can be moved or deleted if a bad actor gains access to the action's repository ([Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions)). A release tag such as `v1.0.258` is the lighter pin this lesson also accepts.

Listings checked against the listing bar on 2026-10-24.

## Go further

- [Code Review](https://code.claude.com/docs/en/code-review): Anthropic's managed review of your pull requests, for Team and Enterprise plans, with no workflow to maintain.
- [Set up for an organization](https://code.claude.com/docs/en/github-actions#set-up-for-an-organization): one App install and one organization secret for many repositories, or workload identity federation in place of a stored key.
- [The action's solutions guide](https://github.com/anthropics/claude-code-action/blob/v1.0.258/docs/solutions.md) (Anthropic): complete workflows for pull request reviews, scheduled maintenance and issue triage.

---

<sub>Sources: [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions) · [Authentication](https://code.claude.com/docs/en/authentication) · [Configure permissions](https://code.claude.com/docs/en/permissions) · claude-code-action at v1.0.258: [action.yml](https://github.com/anthropics/claude-code-action/blob/v1.0.258/action.yml), [run.ts](https://github.com/anthropics/claude-code-action/blob/v1.0.258/src/entrypoints/run.ts), [security](https://github.com/anthropics/claude-code-action/blob/v1.0.258/docs/security.md), and its [tags](https://github.com/anthropics/claude-code-action/tags) · GitHub: [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use), [Using workflow run logs](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs), [Reviewing and modifying installed GitHub Apps](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps), [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) · GitHub CLI manual: [gh repo create](https://cli.github.com/manual/gh_repo_create), [gh secret set](https://cli.github.com/manual/gh_secret_set), [gh secret list](https://cli.github.com/manual/gh_secret_list), [gh workflow run](https://cli.github.com/manual/gh_workflow_run), [gh run list](https://cli.github.com/manual/gh_run_list), [gh run watch](https://cli.github.com/manual/gh_run_watch), [gh run view](https://cli.github.com/manual/gh_run_view), [gh secret delete](https://cli.github.com/manual/gh_secret_delete)</sub>

<sub>← [Script Claude Code with `claude -p`](04-headless.md) · [Advanced index](README.md) · [Share your setup with a team](06-share-your-setup.md) → · Topic: [Automation](../topics/automation.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-5)</sub>
