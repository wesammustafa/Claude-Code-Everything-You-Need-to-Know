# GitHub Actions

<sub>**Advanced** · Lesson 5 of 7 · about 20 minutes, plus run time · Needs: [Script Claude Code with `claude -p`](04-headless.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-09</sub>

## Goal

By the end of this lesson you can run Claude Code unattended in a GitHub Actions workflow that reads its credential from a repository secret and stops within limits written in the file.

## You need

- The `claude -p` flags from [lesson 4](04-headless.md), such as `--max-turns` and `--allowedTools`.
- The [GitHub CLI](https://cli.github.com), signed in with `gh auth login`, which quick setup needs ([Quick setup](https://code.claude.com/docs/en/github-actions#quick-setup)).
- A new private copy of the practice template, just for this lesson. You own it, so you have full control of it ([Permission levels for a personal account repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository#owner-access-for-a-repository-owned-by-a-personal-account)), including the admin access that setup needs ([Setup](https://code.claude.com/docs/en/github-actions#setup)). Make it with:

  ```bash
  gh repo create claude-actions-practice --template wesammustafa/claude-code-practice --private --clone
  cd claude-actions-practice
  ```

  `--template` bases the new repository on the template, and `--clone` clones it ([gh repo create](https://cli.github.com/manual/gh_repo_create)). The check runs in this copy, with Node.js LTS, without `--dir`. At the end, you take the workflows, the secret and the App's access out of it.
- A credential. A Claude Console API key made for this lesson is recommended, because the teardown deletes it. On a Pro, Max, Team or Enterprise plan ([Manual setup](https://code.claude.com/docs/en/github-actions#manual-setup)), you can instead let quick setup create a subscription token ([Quick setup](https://code.claude.com/docs/en/github-actions#quick-setup)). If Claude Code on your machine already uses an API key, quick setup reuses that key instead, so the teardown would delete the key your own Claude Code uses; step 3 of the Worked example shows how to swap in the lesson key.
- Usage: light. Each run is short, and also uses GitHub Actions minutes (see Watch out).

## The idea

The [Claude Code GitHub Action](https://code.claude.com/docs/en/github-actions), `anthropics/claude-code-action` (Anthropic), runs Claude Code as a step in a workflow. With no `prompt` input, it waits for `@claude` in an issue or pull request and answers in a comment; with a `prompt`, it runs without waiting for a mention ([Interactive and automation modes](https://code.claude.com/docs/en/github-actions#interactive-and-automation-modes)), and its `display_report` input puts Claude's report on the run's summary page ([action.yml at v1.0.237](https://github.com/anthropics/claude-code-action/blob/v1.0.237/action.yml)).

The workflow names a repository secret that holds the credential ([Manual setup](https://code.claude.com/docs/en/github-actions#manual-setup)).

No one is at the keyboard, so the limits go in the file. `claude_args` passes Claude Code's CLI flags, such as `--max-turns` and `--allowedTools` ([Pass CLI arguments](https://code.claude.com/docs/en/github-actions#pass-cli-arguments)), and with a prompt written as text rather than a skill, Claude has no shell until you allow the commands it needs ([Run on a schedule](https://code.claude.com/docs/en/github-actions#run-on-a-schedule)). The job's `permissions` and `timeout-minutes` limit its GitHub token and its run time ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idpermissions)).

## Worked example

Connect the copy with quick setup, then ask Claude a question in an issue.

1. In the copy, start `claude`, run `/install-github-app` and follow the prompts for this repository: Claude Code installs the Claude GitHub App ([Quick setup](https://code.claude.com/docs/en/github-actions#quick-setup)). When GitHub asks which repositories the App can access, choose **Only select repositories** and pick this copy only ([Installing a GitHub App](https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party#installing-a-github-app)). If the App is already on your account, add this copy under its **Repository access** instead ([Modifying repository access](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps#modifying-repository-access)).
2. Claude Code then asks whether to continue with GitHub Actions setup. Continue, and select only the `@claude` workflow, `claude.yml`, not the review workflow. For the credential, paste your lesson key or create a subscription token, unless Claude Code reuses its own API key (see You need). Claude Code saves the credential as the secret `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`, pushes a branch with the workflow you selected and opens GitHub in your browser with a pull request ready to create ([Quick setup](https://code.claude.com/docs/en/github-actions#quick-setup)).
3. Create and merge that pull request, then update your clone and list the secrets:

   ```bash
   git pull
   gh secret list
   ```

   The list shows `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` ([gh secret list](https://cli.github.com/manual/gh_secret_list)). The merged `.github/workflows/claude.yml` is already set to use that secret, and `@claude` now works in the repository ([Quick setup](https://code.claude.com/docs/en/github-actions#quick-setup)). If quick setup reused the API key your own Claude Code uses, swap in your lesson key now: `gh secret set ANTHROPIC_API_KEY` asks you to paste it ([gh secret set](https://cli.github.com/manual/gh_secret_set)).
4. Open an issue that mentions `@claude`. In interactive mode, Claude answers `@claude` in the body or title of a newly opened issue ([Interactive and automation modes](https://code.claude.com/docs/en/github-actions#interactive-and-automation-modes)):

   ```bash
   gh issue create --title "What does links.js do?" --body "@claude In one paragraph, what does src/links.js do? Don't change any files."
   ```

   `gh issue create` prints the new issue's URL ([gh issue create](https://cli.github.com/manual/gh_issue_create)). `gh run list --limit 3` lists the run it started ([gh run list](https://cli.github.com/manual/gh_run_list)). When it finishes, `gh issue view <issue-url> --comments` shows Claude's answer as a comment ([gh issue view](https://cli.github.com/manual/gh_issue_view)). Your wording will differ, but it should describe how `src/links.js` finds Markdown links.

## Your turn

**Brief:** add `.github/workflows/linkcheck-report.yml`, a workflow you start by hand, in which Claude runs the template's link checker on `samples/` and explains each broken link on the run's summary page, without changing any files. The docs' [Run on a schedule](https://code.claude.com/docs/en/github-actions#run-on-a-schedule) example is a starting point. It sets a model with `--model`: pick one as in [Intermediate lesson 3](../intermediate/03-model-and-effort.md), or leave that line out to use Claude Code's default model ([Pass CLI arguments](https://code.claude.com/docs/en/github-actions#pass-cli-arguments)).

**Acceptance criteria:**

- It starts only by hand: `on: workflow_dispatch`, and no other trigger.
- It uses `anthropics/claude-code-action` pinned to a release tag or a full commit SHA, not `@v1` (Watch out says why). Release v1.0.237 installs Claude Code v2.1.285, the version this page was checked against ([run.ts at v1.0.237](https://github.com/anthropics/claude-code-action/blob/v1.0.237/src/entrypoints/run.ts)).
- It has a `prompt`, so it runs in automation mode.
- Its credential comes from the secret quick setup saved, through the matching input, `anthropic_api_key` or `claude_code_oauth_token` ([Manual setup](https://code.claude.com/docs/en/github-actions#manual-setup)). No credential is written in the file.
- It has a read-only job token: no write access in `permissions` except `id-token: write`. The job's `permissions` grant `contents: read`, plus `id-token: write` if you keep it from the docs' examples, where it serves the action's default GitHub App authentication ([Respond to @claude mentions](https://code.claude.com/docs/en/github-actions#respond-to-@claude-mentions)). `github_token` is set to the job's own `GITHUB_TOKEN`, so Claude acts with that token instead of the App's ([Action parameters](https://code.claude.com/docs/en/github-actions#action-parameters)).
- `claude_args` sets `--max-turns` to 10 or fewer, and an `--allowedTools` rule for the link-check command alone, never all of Bash ([Configure permissions](https://code.claude.com/docs/en/permissions#wildcard-patterns)). Write the turn limit as two words, `--max-turns <n>`, as the docs' [Pass CLI arguments](https://code.claude.com/docs/en/github-actions#pass-cli-arguments) example does: the action reads a flag's value from the word after it ([parse-sdk-options.ts at v1.0.237](https://github.com/anthropics/claude-code-action/blob/v1.0.237/base-action/src/parse-sdk-options.ts)).
- The job has a `timeout-minutes` of 30 or fewer ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes)).
- It checks out the repository and sets up Node.js before the action runs, as the template's `.github/workflows/progress.yml` does, so the link checker can run.
- `display_report` is `true`, so Claude's report, with its answer, appears on the run's summary page ([action.yml at v1.0.237](https://github.com/anthropics/claude-code-action/blob/v1.0.237/action.yml), [Adding a job summary](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#adding-a-job-summary)). The action says to turn it on only when its input is trusted, as here: you start the run, and the prompt and files are your own. `show_full_output` stays off, and you don't turn on GitHub Actions debug mode (an `ACTIONS_STEP_DEBUG` secret set to `true`), which turns full output on: full output can print secrets into the log ([security notes](https://github.com/anthropics/claude-code-action/blob/v1.0.237/docs/security.md)). Without it, the log hides Claude's messages and tool calls and shows a summary of the result, with a line that suggests turning full output on ([run-claude-sdk.ts at v1.0.237](https://github.com/anthropics/claude-code-action/blob/v1.0.237/base-action/src/run-claude-sdk.ts)).

Then run it, save the record and tear down:

1. Commit the workflow and push it to `main`. A manual run starts only when the workflow file is on the default branch ([`workflow_dispatch`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)).
2. Start it, find its id, follow it to the end and open it in your browser ([gh workflow run](https://cli.github.com/manual/gh_workflow_run), [gh run watch](https://cli.github.com/manual/gh_run_watch), [gh run view](https://cli.github.com/manual/gh_run_view)):

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
> Deleting a secret leaves the credential it held valid ([Uninstall](https://code.claude.com/docs/en/github-actions#uninstall)). The `CLAUDE_CODE_OAUTH_TOKEN` secret holds an OAuth token of the kind `claude setup-token` generates ([Action parameters](https://code.claude.com/docs/en/github-actions#action-parameters)). On 2026-10-09, a token from `claude setup-token` is valid for one year ([Authentication](https://code.claude.com/docs/en/authentication#generate-a-long-lived-token)), and deleting the secret doesn't revoke it.

5. Delete both workflows, then commit and push:

   ```bash
   git rm .github/workflows/claude.yml .github/workflows/linkcheck-report.yml
   git commit -m "Remove the Claude workflows"
   git push
   ```

6. Delete the secret: `gh secret delete ANTHROPIC_API_KEY`, or `gh secret delete CLAUDE_CODE_OAUTH_TOKEN` ([gh secret delete](https://cli.github.com/manual/gh_secret_delete)).
7. With an API key, delete the key the secret held on the Claude Console's [API keys page](https://platform.claude.com/settings/keys). If that is the key your own Claude Code uses, Claude Code on your machine needs a new key afterwards.
8. On GitHub, open **Settings** > **Applications** > **Installed GitHub Apps** and select **Configure** next to Claude. Then either remove this copy under **Repository access** and click **Save**, or, if this copy is the only repository the App can reach and nothing else of yours uses it, click **Uninstall** ([Modifying repository access](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps#modifying-repository-access), [Blocking access](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps#blocking-access)).

## Check

You are done when all of these are true:

- [ ] A committed workflow runs `anthropics/claude-code-action` pinned to a release tag or a full commit SHA, in automation mode, with its credential from a secret and none in the file.
- [ ] Its limits are in the file: `--max-turns` of 10 or fewer, an `--allowedTools` list without unrestricted Bash, a read-only job token (no write access in `permissions` except `id-token: write`) and a `timeout-minutes` of 30 or fewer.
- [ ] `.practice/a-5-runs.json` shows a completed, successful manual run on a commit that holds the workflow.
- [ ] Self-check (not tested): Claude answered your issue in a comment, and your run's summary page explains each broken link.

Run `npm run check -- a-5` in this copy.

If the first item fails on the `uses:` line, pin a release tag such as `@v1.0.237`, or that release's full commit SHA. If the second item fails, its hint names the limit to add or fix. If the saved run failed, `gh run view <run-id> --log-failed` shows why, such as a secret name that doesn't match the workflow, or reaching the turn limit, which exits with an error ([CLI reference](https://code.claude.com/docs/en/cli-reference#cli-flags)); push a fix, run the workflow again and save the record again.

The check reads the workflow from your history, so it still passes after the teardown. Once it passes, tear down as Your turn's steps 5 to 8 describe.

## Watch out

- Anyone with write access to the repository can start a run with `@claude`, and the issue or comment text is input to Claude, so it can carry hidden instructions ([Who can trigger runs](https://code.claude.com/docs/en/github-actions#who-can-trigger-runs), [the action's security notes](https://github.com/anthropics/claude-code-action/blob/v1.0.237/docs/security.md)). Keep this copy private and yours: only people with read access can see its run logs ([Using workflow run logs](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs)).
- Each run uses GitHub Actions minutes and tokens. In a private repository, the minutes come out of your account's included minutes ([GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). The tokens are billed to your Console account with an API key, or drawn from your plan with a subscription token. `--max-turns` and `timeout-minutes` limit how much work a run can do, which lowers both ([Manage costs](https://code.claude.com/docs/en/github-actions#manage-costs)).
- The `v1` tag in the docs' examples moves to each new release ([tags](https://github.com/anthropics/claude-code-action/tags)), and each release pins the Claude Code version it installs, so a workflow on `@v1` can run a newer Claude Code than you tested. GitHub says pinning to a full commit SHA is "currently the only way to use an action as an immutable release", and that a tag can be moved or deleted ([Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions)). A release tag such as `v1.0.237` is the lighter pin this lesson also accepts.

Listings checked against the listing bar on 2026-10-09.

## Go further

- [Run on a schedule](https://code.claude.com/docs/en/github-actions#run-on-a-schedule): the same automation mode on a cron trigger.
- [Set up for an organization](https://code.claude.com/docs/en/github-actions#set-up-for-an-organization): one App install and one organization secret for many repositories, or workload identity federation in place of a stored key.
- [The action's solutions guide](https://github.com/anthropics/claude-code-action/blob/v1.0.237/docs/solutions.md) (Anthropic): complete workflows for pull request reviews, scheduled maintenance and issue triage.

---

<sub>Sources: [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions) · [Authentication](https://code.claude.com/docs/en/authentication) · [CLI reference](https://code.claude.com/docs/en/cli-reference) · [Configure permissions](https://code.claude.com/docs/en/permissions) · claude-code-action at v1.0.237: [action.yml](https://github.com/anthropics/claude-code-action/blob/v1.0.237/action.yml), [run.ts](https://github.com/anthropics/claude-code-action/blob/v1.0.237/src/entrypoints/run.ts), [parse-sdk-options.ts](https://github.com/anthropics/claude-code-action/blob/v1.0.237/base-action/src/parse-sdk-options.ts), [run-claude-sdk.ts](https://github.com/anthropics/claude-code-action/blob/v1.0.237/base-action/src/run-claude-sdk.ts), [security](https://github.com/anthropics/claude-code-action/blob/v1.0.237/docs/security.md), and its [tags](https://github.com/anthropics/claude-code-action/tags) · GitHub: [Installing a GitHub App from a third party](https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party), [Permission levels for a personal account repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository), [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [Workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands), [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use), [Using workflow run logs](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs), [Reviewing and modifying installed GitHub Apps](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps), [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) · GitHub CLI manual: [gh repo create](https://cli.github.com/manual/gh_repo_create), [gh issue create](https://cli.github.com/manual/gh_issue_create), [gh issue view](https://cli.github.com/manual/gh_issue_view), [gh secret list](https://cli.github.com/manual/gh_secret_list), [gh secret set](https://cli.github.com/manual/gh_secret_set), [gh workflow run](https://cli.github.com/manual/gh_workflow_run), [gh run list](https://cli.github.com/manual/gh_run_list), [gh run watch](https://cli.github.com/manual/gh_run_watch), [gh run view](https://cli.github.com/manual/gh_run_view), [gh secret delete](https://cli.github.com/manual/gh_secret_delete)</sub>

<sub>← [Script Claude Code with `claude -p`](04-headless.md) · [Advanced index](README.md) · [Share your setup with a team](06-share-your-setup.md) → · Topic: [Automation](../topics/automation.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-5)</sub>
