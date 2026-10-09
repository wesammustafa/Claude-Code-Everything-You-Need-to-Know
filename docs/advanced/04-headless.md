# Script Claude Code with `claude -p`

<sub>**Advanced** · Lesson 4 of 7 · about 20 minutes · Needs: [Run and save a dynamic workflow](03-dynamic-workflows.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-09</sub>

## Goal

By the end of this lesson you can write a script that runs Claude Code with no one at the keyboard, reads its JSON result and exit code, and limits it to the tools and turns the job needs.

## You need

- One of your own repositories with a test command, and your copy of the practice template with Node.js LTS: the check runs from the copy. To practice in the template copy instead, use it for both. Set up the repository's `.practice/` folder as [Beginner lesson 1](../beginner/01-install-and-look-around.md#you-need) describes, if you haven't yet.
- bash and `jq`, on macOS, Linux or WSL 2.
- Usage: light. Each `claude -p` run is one short session.

## The idea

`claude -p "<prompt>"` runs one prompt without the interactive interface, prints the answer and exits with 0, or non-zero when the run fails ([Run Claude Code programmatically](https://code.claude.com/docs/en/headless)). It reads stdin, so a script can pipe a diff in.

With [`--output-format json`](https://code.claude.com/docs/en/headless#get-structured-output), it prints one JSON object with `result`, `is_error`, `num_turns`, `session_id` and `permission_denials` ([`SDKResultMessage`](https://code.claude.com/docs/en/agent-sdk/typescript#sdkresultmessage)). `result` holds the answer, or the failure message when something fails inside the run ([Basic usage](https://code.claude.com/docs/en/headless#basic-usage)). `subtype` is `success`, or why the run stopped early, such as `error_max_turns`; such a run has no `result` ([Handle the result](https://code.claude.com/docs/en/agent-sdk/agent-loop#handle-the-result)). Check the exit code and `is_error` before you use `result`.

Nobody can answer a permission prompt, so pass a mode every time: a run where nothing sets one can start in auto mode ([Auto-approve tools](https://code.claude.com/docs/en/headless#auto-approve-tools)). Three flags set the limits: `--permission-mode dontAsk` denies every call that would otherwise prompt, `--allowedTools` names what may run anyway, and `--max-turns` caps the turns ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)).

## Worked example

In your repository:

1. Ask one question, and save the JSON:

   ```bash
   claude -p "In one sentence, what does this repository do?" --output-format json --permission-mode dontAsk > .practice/a-4-first.json
   echo "exit $?"
   jq '{is_error, subtype, num_turns, session_id}' .practice/a-4-first.json
   jq -r .result .practice/a-4-first.json
   ```

   It prints `exit 0`, then `"is_error": false` and `"subtype": "success"` with a turn count and a session ID, then one sentence about your repository (your wording will differ). Reading files in your working directory needs no approval, so `dontAsk` let Claude read what it needed ([dontAsk mode](https://code.claude.com/docs/en/permission-modes#allow-only-pre-approved-tools-with-dontask-mode)).
2. Ask for something that needs approval. `--setting-sources user` keeps your project's settings files out of the run ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)), so neither the allow rule nor the sandbox's auto-allow mode from [Intermediate lesson 4](../intermediate/04-permissions-and-sandbox.md) approves the test command ([Auto-allow mode](https://code.claude.com/docs/en/sandboxing#auto-allow-mode)). It also leaves out the project's deny rules, such as your `.env` rules from that lesson, so steps 2 to 4 pass them again with `--disallowedTools`, which takes deny rules ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)):

   ```bash
   claude -p "Run the test suite and say how many tests pass" --output-format json --permission-mode dontAsk --setting-sources user --disallowedTools "Read(./.env)" "Read(./.env.*)" > .practice/a-4-denied.json
   jq -c '.permission_denials[] | {tool_name, command: .tool_input.command}' .practice/a-4-denied.json
   jq -r .result .practice/a-4-denied.json
   ```

   Each line is a call that `dontAsk` denied ([`SDKPermissionDenial`](https://code.claude.com/docs/en/agent-sdk/typescript#sdkpermissiondenial)), such as `{"tool_name":"Bash","command":"npm test 2>&1 | tail -20"}`; Claude picks the command, so yours may differ. The result says Claude couldn't run the tests (your wording will differ).
3. Allow the command step 2 listed (here `npm test`), and cap the turns:

   ```bash
   claude -p "Run the test suite and say how many tests pass" --output-format json --permission-mode dontAsk --setting-sources user --disallowedTools "Read(./.env)" "Read(./.env.*)" --allowedTools "Bash(npm test *)" --max-turns 3 | jq '{subtype, num_turns, denied: (.permission_denials | length)}'
   ```

   It shows `"subtype": "success"` and `"denied": 0`: this time Claude ran the tests. The space before the `*` matters, and a trailing ` *` also matches the bare command ([Wildcard patterns](https://code.claude.com/docs/en/permissions#wildcard-patterns)). The rule also covers a pipeline such as `npm test 2>&1 | tail -20`: Claude Code checks each part of a pipeline on its own, and `tail` is one of the read-only commands that run without approval ([Compound commands](https://code.claude.com/docs/en/permissions#compound-commands), [Read-only commands](https://code.claude.com/docs/en/permissions#read-only-commands)).
4. Hit the cap. This task takes two steps in a row, and `--max-turns 1` allows one turn that calls tools. Keep `Read` and use the same Bash rule as in step 3:

   ```bash
   claude -p "Read the file that defines this project's test command, then run that command, then summarize any failures" --output-format json --permission-mode dontAsk --setting-sources user --disallowedTools "Read(./.env)" "Read(./.env.*)" --allowedTools "Read,Bash(npm test *)" --max-turns 1 > .practice/a-4-capped.json
   echo "exit $?"
   jq '{subtype, has_result: has("result")}' .practice/a-4-capped.json
   ```

   It prints a non-zero exit code, then `"subtype": "error_max_turns"` and `"has_result": false`: a run that stops at the cap has no `result`. `--max-turns` counts only the turns that call tools ([Turns and messages](https://code.claude.com/docs/en/agent-sdk/agent-loop#turns-and-messages)), so if the run finished, give it a task with more steps.

## Your turn

Write a review you can run before every commit: `scripts/review-staged.sh` sends your staged changes to Claude, prints Claude's review and saves the JSON result. The Advanced capstone reuses it.

Acceptance criteria:

- A bash script at `scripts/review-staged.sh`, committed and executable.
- It pipes `git diff --cached`, the staged changes ([git diff](https://git-scm.com/docs/git-diff)), into one `claude -p` call. Claude needs no Bash to read the diff, because it arrives on stdin ([Add Claude to a build script](https://code.claude.com/docs/en/headless#add-claude-to-a-build-script)).
- That call puts the prompt right after `-p`, as the [Pipe data through Claude](https://code.claude.com/docs/en/headless#pipe-data-through-claude) and [Add Claude to a build script](https://code.claude.com/docs/en/headless#add-claude-to-a-build-script) examples do, and passes `--output-format json`, `--permission-mode dontAsk`, `--allowedTools` naming only `Read`, `Grep` and `Glob`, and `--max-turns` with a number from 1 to 10. On macOS, Linux and WSL, Glob and Grep are absent by default, and naming either one in `--allowedTools` brings both back ([Glob tool behavior](https://code.claude.com/docs/en/tools-reference#glob-tool-behavior)).
- It calls `claude` by name, not by a path or through `npx`, and doesn't change `PATH`: that is how the check swaps in a stand-in for it.
- It saves the JSON to the path in its first argument, or to `.practice/a-4-result.json` when it gets none, creating the folder if it's missing.
- It prints the `result` text, and exits non-zero when `claude` does or when `is_error` is `true`.
- With nothing staged, it says so and exits non-zero without calling Claude. `git diff --cached --quiet` exits with 0 when nothing is staged ([git diff](https://git-scm.com/docs/git-diff)).

Commit the script. Then stage a small change, such as a one-line fix, and run `scripts/review-staged.sh` once: it saves `.practice/a-4-result.json`. Read the review before you commit that change.

## Check

You are done when all of these are true:

- [ ] `scripts/review-staged.sh` is committed and executable.
- [ ] Its `claude -p` call has the prompt right after `-p`, asks for JSON, runs in `dontAsk` mode, pre-approves only `Read`, `Grep` and `Glob`, and caps turns at 10 or fewer.
- [ ] It pipes the staged diff in, saves the JSON where its argument says, prints the result, exits non-zero when the run fails, and doesn't call Claude when nothing is staged.
- [ ] `.practice/a-4-result.json` holds a run that succeeded within your cap.
- [ ] Self-check (not tested): you saw a run stop at `--max-turns`, in step 4 of the Worked example.

Run `npm run check -- a-4 --dir <your repo>` from your practice copy, or `npm run check -- a-4` in the copy itself. The check runs your committed script with a stand-in for `claude`, so it uses none of your usage.

If the first item fails, run `chmod +x scripts/review-staged.sh`, then `git add` it and commit again. If the second item fails, read its hint: it names the flag it didn't find, or says your script calls `claude` by a path or through `npx`, or changes `PATH`. Compare your `claude -p` line with the criteria in Your turn, starting with where the prompt sits. If the third item fails, run the script by hand with nothing staged and again with a staged change, and run `echo $?` after each; the check runs the committed script, so commit each fix before you run the check again. If the fourth item fails, stage a change and run the script again: a run that stopped at your cap doesn't count, so raise the cap or narrow the prompt.

## Watch out

- A `-p` run shows no trust dialog: it runs the hooks in a project's `.claude/settings.json` and connects the servers in its `.mcp.json`, even in a folder you've never trusted ([Start faster with bare mode](https://code.claude.com/docs/en/headless#start-faster-with-bare-mode)). Before you script Claude Code in a repository you didn't write, pass `--setting-sources user`, so Claude Code reads neither the project's settings files nor its `.mcp.json` ([What runs before you trust a folder](https://code.claude.com/docs/en/permissions#what-runs-before-you-trust-a-folder)).
- When `ANTHROPIC_API_KEY` is set, a `-p` run always uses that key instead of your plan ([Authentication precedence](https://code.claude.com/docs/en/authentication#authentication-precedence)). The JSON's `total_cost_usd` is a client-side estimate, not your bill ([Track cost and usage](https://code.claude.com/docs/en/agent-sdk/cost-tracking#estimates-not-billing)).
- In a folder you've never trusted, a `-p` run ignores the `permissions.allow` rules in the project's `.claude/settings.json` and prints a `this workspace has not been trusted` warning on stderr; trusting a parent folder doesn't count ([Project allow rules and workspace trust](https://code.claude.com/docs/en/permissions#project-allow-rules-and-workspace-trust), [Error reference](https://code.claude.com/docs/en/errors#workspace-has-not-been-trusted)). Pass the rules a script needs on its command line, with `--allowedTools`.

## Go further

- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless): structured output with `--json-schema`, streaming JSON, and continuing a run with `--resume` and its `session_id`.
- [Approve the plan before it runs](https://code.claude.com/docs/en/workflows#approve-the-plan-before-it-runs): start the workflow you saved in the previous lesson from a script, with `Workflow(<name>)` in your allow rules.
- [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview): the same agent loop from Python or TypeScript.

---

<sub>Sources: [Run Claude Code programmatically](https://code.claude.com/docs/en/headless) · [CLI reference](https://code.claude.com/docs/en/cli-reference) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Configure permissions](https://code.claude.com/docs/en/permissions) · [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing) · [How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) · [Agent SDK reference - TypeScript](https://code.claude.com/docs/en/agent-sdk/typescript) · [Track cost and usage](https://code.claude.com/docs/en/agent-sdk/cost-tracking) · [Authentication](https://code.claude.com/docs/en/authentication) · [Tools reference](https://code.claude.com/docs/en/tools-reference) · [Error reference](https://code.claude.com/docs/en/errors) · [git diff](https://git-scm.com/docs/git-diff)</sub>

<sub>← [Run and save a dynamic workflow](03-dynamic-workflows.md) · [Advanced index](README.md) · [GitHub Actions](05-github-actions.md) → · Topic: [Automation](../topics/automation.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-4)</sub>
