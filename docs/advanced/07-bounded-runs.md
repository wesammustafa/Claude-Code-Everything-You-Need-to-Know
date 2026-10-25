# Put bounds on autonomous runs

<sub>**Advanced** · Lesson 7 of 7 · about 20 minutes, plus run time · Needs: [Script Claude Code with `claude -p`](04-headless.md), [Share your setup with a team](06-share-your-setup.md) · Verified against Claude Code v2.1.292 (stable) on 2026-10-15</sub>

## Goal

By the end of this lesson you can bound an unattended `claude -p` run with least privilege, the sandbox, turn and spend limits, a review gate and a cost estimate.

## You need

- The repository you scripted in [lesson 4](04-headless.md) and shared in [lesson 6](06-share-your-setup.md), with a test command, and your copy of the practice template with Node.js LTS and the Advanced checks ([Practice](README.md#practice)): the check runs from the copy. Set up the repository's `.practice/` folder as [Beginner lesson 1](../beginner/01-install-and-look-around.md#you-need) describes, if you haven't yet.
- bash and `jq`, on macOS, Linux or WSL 2. On Linux and WSL 2, the sandbox needs `bubblewrap` and `socat` ([Set up Linux and WSL2](https://code.claude.com/docs/en/sandboxing#set-up-linux-and-wsl2)).
- Usage: moderate. Each run stops at its limits. Cheap variant: in Your turn, set the limits from your slice run, and run the script on one more slice instead of the whole task.

## The idea

A run nobody watches does whatever you allowed in advance, so allow little and cap the rest:

- **Least privilege.** `dontAsk` mode denies every call that would otherwise prompt ([dontAsk mode](https://code.claude.com/docs/en/permission-modes#allow-only-pre-approved-tools-with-dontask-mode)), so allow only the folders the task edits and the one command it runs. That is the docs' setup for an exact allowlist; when you can't list a job's commands in advance, auto mode has a classifier review each call instead ([Common setups](https://code.claude.com/docs/en/permission-modes#common-setups), [Tool calls denied in `claude -p` and Agent SDK runs](https://code.claude.com/docs/en/permission-modes#which-mode-a-non-interactive-run-starts-in)).
- **The sandbox.** The operating system limits what an allowed command can write and reach ([Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing)). Make it strict, and required for the run to start.
- **Limits.** `--max-turns` caps agentic turns, and `--max-budget-usd` caps estimated spend ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)).
- **A review gate.** Deny `git commit` and `git push`: deny rules hold in every mode ([Available modes](https://code.claude.com/docs/en/permission-modes#available-modes)), though a mod you installed can approve a call they refuse on a machine with neither managed settings nor a Team or Enterprise login ([Precedence among rules, hooks, and mods](https://code.claude.com/docs/en/permissions#precedence-among-rules-hooks-and-mods)). `dontAsk` refuses the forms a rule misses, such as `git -C . push`, while nothing allows them ([What a Bash rule doesn't match](https://code.claude.com/docs/en/permissions#bash-rule-limits)). You read the diff and commit what you accept.
- **A cost estimate.** Run one slice first, and set the spend limit from what it cost.

## Worked example

Work in your repository. The folders `src/` and `test/` and the command `npm test` stand for your own: swap yours in everywhere below.

1. Save the bounds as `.claude/bounded-run.json`:

   ```json
   {
     "permissions": {
       "allow": ["Edit(./src/**)", "Edit(./test/**)", "Bash(npm test *)"],
       "deny": ["Agent", "Read(./.env)", "Read(./.env.*)", "Bash(git commit *)", "Bash(git push *)"]
     },
     "sandbox": {
       "enabled": true,
       "failIfUnavailable": true,
       "allowUnsandboxedCommands": false,
       "autoAllowBashIfSandboxed": false
     }
   }
   ```

   - `allow`: edits in two folders, and `npm test` with any arguments. `Edit` rules cover every built-in tool that edits files, and a `./` path starts from the folder the run starts in ([Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)).
   - `deny`: `.env` files; `git commit` and `git push`, where the trailing ` *` also matches the bare command ([Wildcard patterns](https://code.claude.com/docs/en/permissions#wildcard-patterns)); and the `Agent` tool, so Claude can't hand work to a subagent ([Built-in subagents](https://code.claude.com/docs/en/sub-agents#built-in-subagents)), which could run in a permission mode of its own ([Permission modes](https://code.claude.com/docs/en/sub-agents#permission-modes)).
   - `sandbox`: on; exit at startup if it can't start ([`sandbox.failIfUnavailable`](https://code.claude.com/docs/en/settings-reference#sandbox-failifunavailable)); never retry a command outside it ([Strict sandbox mode](https://code.claude.com/docs/en/sandboxing#turn-off-the-retry-with-strict-sandbox-mode)); and send sandboxed commands through your rules and mode instead of approving them all ([`sandbox.autoAllowBashIfSandboxed`](https://code.claude.com/docs/en/settings-reference#sandbox-autoallowbashifsandboxed)).

   Claude's file tools can't change this file during the run: in `dontAsk` mode, writes to the protected `.claude/` folder are denied, and allow rules don't change that ([Protected paths](https://code.claude.com/docs/en/permission-modes#protected-paths)).
2. Save the runner as `scripts/bounded-run.sh`:

   ```bash
   #!/bin/bash
   # Runs one unattended task inside the bounds in .claude/bounded-run.json.
   set -u
   if [ $# -ne 2 ]; then
     echo 'Usage: scripts/bounded-run.sh "<task>" <result.json>' >&2
     exit 2
   fi
   before=$(git rev-parse --short HEAD)
   claude -p "$1" \
     --setting-sources project \
     --settings .claude/bounded-run.json \
     --permission-mode dontAsk \
     --model sonnet \
     --max-turns 15 \
     --max-budget-usd 2 \
     --output-format json > "$2"
   status=$?
   jq '{subtype, num_turns, total_cost_usd, denied: [.permission_denials[]? | .tool_input.command // .tool_name]}' "$2"
   echo "HEAD before: $before, after: $(git rev-parse --short HEAD)"
   git status --short
   exit "$status"
   ```

   - `--setting-sources project`: leaves your user and local settings files out of the run ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)), so an allow rule you saved with "Yes, and don't ask again", which goes to `.claude/settings.local.json`, doesn't join the bounds ([Permission system](https://code.claude.com/docs/en/permissions#permission-system)).
   - `--settings`: the bounds file, which Claude Code applies above the project's own settings ([Change a setting for one session](https://code.claude.com/docs/en/settings#change-a-setting-for-one-session)). The allow rules go there because a `-p` run ignores the allow rules in a never-trusted folder's `.claude/settings.json` ([What runs before you trust a folder](https://code.claude.com/docs/en/permissions#what-runs-before-you-trust-a-folder)).
   - `allowUnsandboxedCommands: false` in that file: because it comes from `--settings`, a project's `true` can't turn the unsandboxed retry back on, and Claude Code then also ignores the repository's settings that loosen the sandbox ([Strict sandbox mode](https://code.claude.com/docs/en/sandboxing#turn-off-the-retry-with-strict-sandbox-mode)).
   - `--max-turns` and `--max-budget-usd`: configuration, so set your own.
3. Make it executable and commit both files, so everyone who runs it gets the same bounds:

   ```bash
   chmod +x scripts/bounded-run.sh
   git add scripts/bounded-run.sh .claude/bounded-run.json
   git commit -m "Add a bounded runner for unattended tasks"
   ```

   If git reports a path as ignored, `git check-ignore -v <path>` shows the rule that matches it; add the path with `git add -f`.
4. Estimate the cost on a slice, one small part of a bigger task:

   ```bash
   scripts/bounded-run.sh "Use your Edit tool to add a test for one untested function in src/<file>. Then run npm test as a command on its own, and then commit the test." .practice/a-7-slice.json
   ```

   The summary shows `"subtype": "success"`, the turns used, `total_cost_usd`, and under `denied` each call your bounds refused, such as the `git commit`; your list will differ. HEAD is the same before and after, and `git status` lists the new test, uncommitted. Your output will differ. `total_cost_usd` is a client-side estimate, not your bill ([Track cost and usage](https://code.claude.com/docs/en/agent-sdk/cost-tracking#estimates-not-billing)); on a Claude plan, `/usage` in a session shows your plan's usage limits ([Commands](https://code.claude.com/docs/en/commands#all-commands)). To bound the whole task, scale the slice's figure up and set the spend limit above it, with room to spare. A run that reaches the limit stops with `"subtype": "error_max_budget_usd"` and a non-zero exit code ([Handle the result](https://code.claude.com/docs/en/agent-sdk/agent-loop#handle-the-result)), and its `total_cost_usd` can be above the limit, because it includes the response that crossed it ([Track costs on failed conversations](https://code.claude.com/docs/en/agent-sdk/cost-tracking#track-costs-on-failed-conversations)).
5. Be the review gate. Read every change with `git status` and `git diff`, the bounds file included, and look for changes outside the task: a test weakened or deleted so the suite passes, an edited config or bounds file, a moved HEAD. Run `npm test` yourself, and commit only what you accept. For a second opinion, start `claude` and have a subagent review the diff in a fresh context and report gaps ([Add an adversarial review step](https://code.claude.com/docs/en/best-practices#add-an-adversarial-review-step)).

## Your turn

Hand a real task to a run you'd trust overnight, and catch what it shouldn't have done. Bound a real task from your backlog that is bigger than one slice, such as tests for every untested function in one folder, or a mechanical migration across one folder.

Acceptance criteria:

- `scripts/bounded-run.sh "<task>" <result.json>` runs it: one `claude -p` call in `dontAsk` mode, with JSON output saved to the result path, and the bounds from a committed file passed with `--settings`.
- Each allow rule names one folder or one command: no bare `Bash` or `Edit`, and no rule for the whole project or a whole program, such as `Bash(npm *)`. Your committed `.claude/settings.json` counts too: in a folder you've trusted, its allow rules join the bounds file's ([Lists merge instead of overriding](https://code.claude.com/docs/en/settings#lists-merge-instead-of-overriding)). So do the `allowed-tools` of the repository's skills, in a run that invokes one ([Pre-approve tools for a skill](https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill)).
- Deny rules stop `git commit` and `git push`, each with the trailing ` *`: `Bash(git push)` matches only the bare command.
- The sandbox is on and strict, sends sandboxed commands through your rules, and the run refuses to start without it.
- There's a turn limit, and a spend limit above what your slice cost, scaled to the task.
- The script is executable, and the script and the bounds file are committed.
- You run it, review the diff for changes outside the task, and run the tests yourself before you commit any of it.

## Check

You are done when all of these are true:

- [ ] `scripts/bounded-run.sh` is committed and executable, takes a task and a result path (`scripts/bounded-run.sh "<task>" <result.json>`), and starts `claude -p` in `dontAsk` mode with JSON output and a committed `--settings` file.
- [ ] It sets a turn limit and a spend limit.
- [ ] Every allow rule names one command or one folder, and the deny rules stop `git commit` and `git push`.
- [ ] The settings file turns the sandbox on in strict mode without auto-allow, and makes the run refuse to start without it.
- [ ] `.practice/a-7-slice.json` holds a slice run whose cost is under your spend limit.
- [ ] Self-check (not tested): in the run's diff you looked for changes outside the task, such as a weakened or deleted test, an edited config or an unexpected commit, and you can name one you rejected or would have.

Run `npm run check -- a-7 --dir <your repo>` from your practice copy, or `npm run check -- a-7` in the copy itself. The check uses none of your usage.

If the first item fails, make sure the committed script is executable (`git ls-files -s scripts/bounded-run.sh` starts with `100755`): the check reads the committed script, so commit each fix. If an allow rule fails, narrow it to the one folder or command the task needs. If the sandbox item names a key, add it to the settings file: without `failIfUnavailable`, a run whose sandbox can't start runs unsandboxed ([`sandbox.enabled`](https://code.claude.com/docs/en/settings-reference#sandbox-enabled)). If the slice item fails, make sure your script sends only `claude`'s JSON output (stdout) to the result path, then run step 4 again; a slice that ended in `error_max_budget_usd` means your spend limit is below one slice, so raise it.

## Watch out

- Your bounds don't cover everything the run loads. Hooks and local MCP servers run outside the sandbox with your full access ([What runs outside the sandbox](https://code.claude.com/docs/en/sandboxing#what-runs-outside-the-sandbox)). As [lesson 4](04-headless.md#watch-out) warned, a `-p` run uses a repository's hooks and `.mcp.json` servers without asking, and it applies the `allowed-tools` of the repository's skills too ([What runs before you trust a folder](https://code.claude.com/docs/en/permissions#what-runs-before-you-trust-a-folder)). Read those hooks, servers and skills before a bounded run, or add `"disableAllHooks": true` to the bounds file to turn hooks off for it.
- A deny rule matches the command Claude writes, not what a program does ([What a Bash rule doesn't match](https://code.claude.com/docs/en/permissions#bash-rule-limits)). The allowed `npm test` runs test files the run can edit. In the sandbox, that code can write anywhere in your working directory but protected paths, even make a commit ([Protected paths](https://code.claude.com/docs/en/sandboxing#protected-paths)). That's why the script prints HEAD before and after, and why your review covers every changed file.
- A dynamic workflow starts in this run only if an allow rule names `Workflow` or `Workflow(<name>)`, or a `PreToolUse` hook approves it ([Approve the plan before it runs](https://code.claude.com/docs/en/workflows#approve-the-plan-before-it-runs)); if you let one start, its agents' spend counts toward `--max-budget-usd`, as a subagent's does ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)).

## Go further

- [Choose a sandbox environment](https://code.claude.com/docs/en/sandbox-environments): containers and VMs for runs the Bash sandbox can't cover.
- [How we contain Claude across products](https://www.anthropic.com/engineering/how-we-contain-claude): Anthropic's engineering post on capping how much damage an agent can do, in Claude Code and its other products.
- [Give Claude a way to verify its work](https://code.claude.com/docs/en/best-practices#give-claude-a-way-to-verify-its-work): gate an unattended run's stop on a check it must pass, with a `/goal` condition or a Stop hook.

---

<sub>Sources: [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Configure permissions](https://code.claude.com/docs/en/permissions) · [Extend Claude with skills](https://code.claude.com/docs/en/skills) · [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing) · [All settings](https://code.claude.com/docs/en/settings-reference) · [Settings files and precedence](https://code.claude.com/docs/en/settings) · [CLI reference](https://code.claude.com/docs/en/cli-reference) · [Create custom subagents](https://code.claude.com/docs/en/sub-agents) · [How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) · [Track cost and usage](https://code.claude.com/docs/en/agent-sdk/cost-tracking) · [Commands](https://code.claude.com/docs/en/commands) · [Best practices](https://code.claude.com/docs/en/best-practices) · [Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows)</sub>

<sub>← [Share your setup with a team](06-share-your-setup.md) · [Advanced index](README.md) · [Advanced capstone](capstone.md) → · Topic: [Permissions and safety](../topics/permissions-and-safety.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-7)</sub>
