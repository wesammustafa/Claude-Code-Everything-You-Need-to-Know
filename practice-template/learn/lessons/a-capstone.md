---
lesson: a-capstone
title: "Advanced capstone: add CI review your team can share"
source: docs/advanced/capstone.md
source-commit: 676831f
stamp: "Verified against Claude Code v2.1.308 (stable) on 2026-10-25"
page: https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/blob/main/docs/advanced/capstone.md
stuck: https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-capstone
badge: Advanced
folder: new copy
needs: [jq gh]
---

## intro
- minutes: "60 to 90 minutes, plus run time"
- why: "one review for every pull request, the same on laptops and in CI, with nothing left unbounded"
- can: "add CI review your team can share"
- payoff: "add CI review your team can share"
- need: "Node.js LTS, git, `jq`, and the GitHub CLI signed in with `gh auth login`."

## steps

### T1 | The task step 1 of 5 | Two parts at once
- tier: challenge
- skill: worktree
- where: terminal
- beat: do
- skill: push
- verify: check 0
- watching: git show HEAD:.gitignore
- goal: "Keep those working copies out of git."
- hint: "New worktrees branch from the remote's default branch, so push `main` first"
- beat: do
- where: claude-2
- verify: self
- done-label: both sessions are building
- goal: "Parts 2 and 3 don't depend on each other, so build them at the same time, in two Claude Code sessions that can't touch each other's files"
- hint: "In a folder you haven't trusted, `claude --worktree` exits with an error"
- bottom: "claude --worktree"
- beat: do
- where: shell
- skill: merge
- verify: check 1
- watching: .practice/a-capstone-worktrees.txt
- note: "Once both sessions have committed, and while both working copies exist, save their state from the main checkout"
- note: "land both changes on `main`, by merge, rebase or squash"
- bottom: "mkdir -p .practice && git worktree list --porcelain > .practice/a-capstone-worktrees.txt"

### T2 | The task step 2 of 5 | One review, everywhere
- tier: challenge
- skill: headless-script
- where: terminal
- beat: do
- verify: check 3
- watching: scripts/review-staged.sh
- say: Write the review skill, then the script that runs it.
- hint: "Write the team's review once, as a skill committed in `.claude/skills/<name>/SKILL.md`, and run it in both places."
- hint: "Pick a name of your own, such as `team-review`: `/review` is already an alias of the bundled `/code-review`"
- hint: "Write the skill's instructions so they work in both places."
- beat: do
- verify: check 4 5
- watching: scripts/review-staged.sh
- hint: "it pipes the staged diff into one `claude -p` call whose prompt runs your skill"
- hint: "pre-approves only `Read`, `Grep` and `Glob`, restricts the tools to those three, turns hooks off and uses no MCP server, and caps turns at 10 or fewer"
- beat: do
- verify: match scripts/review-staged.sh --max-budget-usd +[0-9.]+
- say: The review script also caps its spend.
- hint: "As in lesson 7, it also caps spend with `--max-budget-usd`, written as a number in the script."
- hint: "Claude Code checks that cap against its client-side cost estimate, and spend can pass it, so leave headroom"
- beat: do
- skill: headless-run
- verify: check 6 13
- watching: .practice/a-capstone-run.json
- say: Run the review script once.
- hint: "After the merges, stage a one-line change in the main checkout, run the script once, read the review and commit the change"
- hint: "The saved JSON's `total_cost_usd` estimates what one review spent, and it must come in under your cap."
- bottom: "mkdir -p .practice && scripts/review-staged.sh .practice/a-capstone-run.json"

### T3 | The task step 3 of 5 | Our plugin, for everyone
- tier: challenge
- skill: team-marketplace
- where: editor
- beat: do
- verify: check 9
- watching: git ls-files team-marketplace
- hint: "a marketplace in `team-marketplace/` that lists one plugin by a relative path"
- hint: "at least one skill or agent in the plugin"
- hint: "The kit is a good start"
- beat: do
- skill: share-settings
- verify: check 10
- watching: git show HEAD:.claude/settings.json
- hint: "The committed `.claude/settings.json` registers the marketplace by a relative path and turns the plugin on"
- hint: "its [`settings.snippet.json`](../../examples/advanced/06-share-your-setup/settings.snippet.json) also denies reading `.env`, which this copy has no rule for yet."
- beat: do
- where: terminal
- skill: validate-plugin
- verify: self
- done-label: both pass
- goal: "Both validations pass: `claude plugin validate` on the marketplace, and on the plugin directory with `--strict`"
- hint: "Test the plugin only after the merges."

### T4 | The task step 4 of 5 | A sweep before a release
- tier: challenge
- skill: save-workflow
- where: claude
- beat: do
- skill: run-workflow
- verify: self
- done-label: it ran
- wait: long
- say: Once the merges are in, start the sweep.
- goal: "from a session in the main checkout, after the merges, ask for a workflow that reviews each file under `src/` and has a second agent check each finding."
- note: "While it runs, `/workflows` shows each agent's token usage"
- hint: "ask for a workflow that reviews each file under `src/` and has a second agent check each finding."
- beat: do
- verify: match .claude/workflows/*.js ^export const meta fresh
- goal: "Save it to the project and commit it"
- bottom: "/workflows"
- beat: do
- where: shell
- verify: check 2
- watching: git ls-files .claude/workflows
- hint: "Save it to the project and commit it"

### T5 | The task step 5 of 5 | CI review with limits
- tier: challenge
- skill: ci-workflow
- where: editor
- beat: do
- verify: match .github/workflows/claude-review.yml anthropics/claude-code-action@
- say: Write the CI review workflow, then commit it.
- hint: "`.github/workflows/claude-review.yml` runs on `pull_request`"
- hint: "Hold it to lesson 5's limits, and one more"
- hint: "a `concurrency` group for the pull request with `cancel-in-progress: true`, so a new push cancels the review still running for an older one"
- hint: "uses `anthropics/claude-code-action` (Anthropic) with your skill, `/<name>`, as its `prompt`"
- beat: do
- verify: check 15
- watching: git log
- beat: ask
- where: terminal
- ask: Which credential do you use for CI?
- option: "a Claude Console API key made for the capstone"
- option: "a token from `claude setup-token`"
- beat: do
- where: terminal
- skill: gh-secret
- verify: self
- done-label: the secret is set
- goal: "Add the credential as a repository secret"
- note: "Never commit the credential; keep it in the repository secret"
- hint: "run `gh secret set ANTHROPIC_API_KEY`, or `gh secret set CLAUDE_CODE_OAUTH_TOKEN`, and paste the value when it asks"
- beat: do
- where: browser
- skill: push
- verify: self
- done-label: I merged it
- wait: long
- goal: "Then push a one-line change on a new branch and open a pull request."
- note: "`display_report` writes Claude's review to the job summary, which GitHub shows on the run's summary page"
- run: "gh run view <run-id> --web"
- say: Read the review, and merge the pull request yourself.
- hint: "find the run's id with `gh run list --workflow claude-review.yml --limit 1`"
- beat: do
- where: shell
- skill: save-version
- verify: check 16 fresh since T5
- evidence: .practice/a-capstone-ci.json
- note: "Once the review run has finished, and before you tear down, save its record for the check"
- hint: "Finish on `main`, with the merged pull request pulled, everything committed and `npm test` passing."
- bottom: "gh run list --workflow claude-review.yml --json databaseId,status,conclusion,event,url,workflowName > .practice/a-capstone-ci.json"

### C | Check | Check
- tier: challenge
- skill: check
- where: terminal
- beat: do
- verify: check all
- hint: "Finish on `main`, with the merged pull request pulled, everything committed and `npm test` passing."
- hint: "It checks each box's parts one by one, and each part that fails prints what to fix."
- bottom: "npm run check -- a-capstone"
- beat: self
- skill: pick-pattern
- done-label: yes, I can
- note: "The check doesn't look at these parts of the Advanced Exit. Tick them yourself, honestly"
- self: "I can say which review I'd run on every pull request (Code Review, `/code-review` or my CI workflow) and which I'd keep for a sweep before a release (my saved workflow), and why, by what each costs and how deep it goes"
- beat: self
- skill: limit-run
- done-label: yes, I can
- self: "I can say when an unattended run needs the sandbox from [lesson 7](07-bounded-runs.md), and whether my review script and CI workflow need it."
- beat: self
- skill: review-diff
- done-label: yes, I did
- self: "Before I merged, I acted on at least one point in Claude's review on the run's summary page, or dismissed it with a reason."
- beat: self
- skill: check-cost
- done-label: yes, I did
- self: "Before I turned CI on, I multiplied the local run's `total_cost_usd` by the pull requests my team opens in a week, to estimate what CI review spends, and I know a new push cancels the review still running."
- after: "When every box on this page is ticked, you've shown the Advanced Exit and finished the last of the guide's three levels. One step remains: the teardown below."

### D1 | Tear down step 1 of 3 | Delete the review workflow
- tier: challenge
- skill: teardown
- where: terminal
- beat: do
- verify: probe removed .github/workflows/claude-review.yml
- goal: "Delete the workflow with `git rm .github/workflows/claude-review.yml`, then commit and push."
- hint: "With the workflow gone, the Claude Code GitHub Action no longer runs"
- bottom: "git rm .github/workflows/claude-review.yml"

### D2 | Tear down step 2 of 3 | Remove the copy's secret
- tier: challenge
- skill: gh-secret
- where: terminal
- beat: do
- verify: self
- done-label: it's deleted
- goal: "Delete the secret"
- hint: "`gh secret list` no longer shows it"
- bottom: "gh secret delete ANTHROPIC_API_KEY"
- bottom: "gh secret delete CLAUDE_CODE_OAUTH_TOKEN"
- beat: do
- verify: self
- done-label: it's gone from the list
- goal: "`gh secret list` no longer shows it"
- hint: "Deleting a secret leaves the credential it held valid"

### D3 | Tear down step 3 of 3 | The credential itself
- tier: challenge
- skill: teardown
- where: terminal
- beat: do
- verify: none
- note: "Until you tear down, a live credential sits in the copy's secrets. Deleting a secret leaves the credential it held valid"
- say: The next beat is for the credential you picked in step 5.
- hint: "When the check passes, tear down: this is required."
- beat: do
- when: T5.2=a Claude Console API key made for the capstone
- where: browser
- verify: self
- done-label: the key is deleted
- goal: "With an API key, delete the key on the Claude Console's [API keys page](https://platform.claude.com/settings/keys)."
- hint: "a Claude Console API key made for the capstone, recommended because the teardown deletes it"
- beat: do
- when: T5.2=a token from `claude setup-token`
- verify: none
- note: "With a token from `claude setup-token`, nothing in this teardown revokes it, so it stays valid until it expires"
- hint: "On 2026-10-24, a token from `claude setup-token` is valid for one year ([Authentication](https://code.claude.com/docs/en/authentication#generate-a-long-lived-token)), and deleting the secret doesn't revoke it."
- beat: do
- verify: check 8
- watching: git log
- hint: "Run `npm run check -- a-capstone` once more: it still passes."
- hint: "it reads the workflow from your history, so it passes before and after the teardown."
- bottom: "npm run check -- a-capstone"

## ladder

### a committed `.gitignore` keeps the worktrees `.practice/a-capstone-worktrees.txt` lists inside the repository out of git, and not the rest of `.claude/`
- narrow "from being ignored": Does a line that starts with ! in the ignore file keep the worktrees' folder from being ignored?
- narrow "Only `.git/info/exclude` ignores": Is the rule only in the local exclude file, which git never commits?
- narrow "but that rule isn't committed": Is the ignore file's change committed yet?
- narrow "No committed `.gitignore` ignores": Does the committed ignore file have a line for the worktrees' folder?
- narrow "also ignores `.claude/settings.json`": Does your rule cover all of .claude, and not only the worktrees' folder?
- hint: "Keep those working copies out of git."

### `.practice/a-capstone-worktrees.txt` lists two worktrees of this repository whose commits split from each other, and both changes are in your branch
- narrow "While both worktree sessions exist": Did you save the listing from the main checkout while both worktrees existed?
- narrow "isn't a listing from": Does the saved file hold what the porcelain listing printed, unchanged?
- narrow "besides the main checkout": Did each session get a worktree of its own before you saved the listing?
- narrow "Save the listing from this repository's main checkout": Was the listing saved in this copy, while its worktrees still existed?
- narrow "point at one commit": Had both sessions committed before you saved the listing?
- narrow "in your current branch": Is each session's change on main yet?
- hint: "Once both sessions have committed, and while both working copies exist, save their state from the main checkout"
- bottom: "mkdir -p .practice && git worktree list --porcelain > .practice/a-capstone-worktrees.txt"

### a committed script in `.claude/workflows/` has a literal `export const meta`, with a `name` and a `description`, as its first statement, and calls `agent()` at least twice
- narrow "doesn't start with `export const meta`": Is the meta block the script's first statement?
- narrow "holds anything but literal values": Does the meta block hold only written-out values, with nothing computed?
- narrow "needs a non-empty": Does the meta block have both a name and a description?
- narrow "doesn't compile": Does the saved script still parse after your last edit?
- narrow "never calls `agent()`": Does the saved workflow start any subagent?
- narrow "calls `agent()` only once": Does a second agent check each finding?
- narrow "but the check reads only `.js` files directly in that folder": Is the script a .js file directly in the workflows folder, not in a subfolder?
- narrow "isn't committed. Run `git add": Is the saved script committed?
- narrow "ignores it. Run `git add -f": Does an ignore rule keep git from seeing the saved script?
- narrow "There is no workflow script in": Did you save the run to the project, not to your own folder?
- hint: "Save it to the project and commit it"

### `scripts/review-staged.sh` is committed and executable
- narrow "There is no `scripts/review-staged.sh`": Is the script at that path, under scripts in the main checkout?
- narrow "isn't committed": Is the script committed, now that both branches are merged?
- narrow "isn't executable": Is the script committed with its executable bit set?
- narrow "is committed as": Is the committed path the script file itself, not a link?
- hint: "Then write `scripts/review-staged.sh` to lesson 4's criteria"

### its `claude -p` call asks for JSON in `dontAsk` mode, allows only `Read`, `Grep` and `Glob`, with no hook or MCP server, caps turns at 10 or fewer, and has the prompt right after `-p`
- narrow "not from Windows itself": Are you running the check from macOS, Linux or WSL 2?
- narrow "first: the check runs the committed script": Is the script committed?
- narrow "has Windows line ends": Was the script saved with Windows line ends?
- narrow "which the stand-in can't replace": Does the script call claude by a path, through another runner, or change PATH?
- narrow "with bash, which it couldn't find": Is bash installed where you run the check?
- narrow "couldn't run": Can the committed script run at all on this machine?
- narrow "without `-p` (or `--print`)": Does the call have the print flag?
- narrow "never ran `claude -p`, so the check couldn't see its flags": Does the script reach its claude call when a change is staged?
- narrow "Nothing follows `-p`": Is anything written after the print flag?
- narrow "comes right after `-p`": Is the prompt the very next word after the print flag?
- narrow "The prompt after `-p` is empty": Does the prompt say what to do with the diff?
- narrow "It doesn't ask for JSON": Does the call ask for JSON output?
- narrow "has no format after it": Does a format follow the output format flag?
- narrow "It asks for `--output-format": Is the output format json, and not another one?
- narrow "It sets no permission mode": Does the call set a permission mode?
- narrow "has no mode after it": Does a mode follow the permission mode flag?
- narrow "as Claude Code spells it": Is the mode spelled with a capital A?
- narrow "mode: use `--permission-mode dontAsk`": Is the mode the one that denies whatever would ask?
- narrow "Drop `--dangerously-skip-permissions`": Does the call also skip every permission check?
- narrow "It pre-approves no tools": Does the call pre-approve the three tools that only read?
- narrow "lists no tool: write": Is the tool list empty?
- narrow "as Claude Code spells the tool": Is each tool name spelled with a capital first letter?
- narrow "isn't a read-only tool": Did a word of the prompt end up in the tool list?
- narrow "not `Read`, `Grep` or `Glob`": Does the tool list name a tool that can do more than read?
- narrow "It sets no turn cap": Does the call cap its turns?
- narrow "has no number after it": Does a number follow the turn cap flag?
- narrow "isn't a whole number": Is the turn cap a whole number?
- narrow "use a number from 1 to": Is the turn cap between 1 and 10?
- narrow "It doesn't restrict the tools": Does the call restrict the tools to the three that only read?
- narrow "`--tools` keeps": Does the tools list keep a tool that can do more than read?
- narrow "`--tools` leaves out": Does the tools list miss one of the three read tools?
- narrow "`--tools` has no tools after it": Does a tool list follow the tools flag?
- narrow "It doesn't turn hooks off": Does the call turn the project's hooks off?
- narrow "`--settings` has nothing after it": Does the settings JSON follow its flag?
- narrow "which isn't inline JSON": Is the settings value written-out JSON, not a file name?
- narrow "doesn't set `"disableAllHooks": true`": Does the settings JSON turn hooks off?
- narrow "It doesn't keep the project's MCP servers out": Does the call keep the project's MCP servers out?
- hint: "it pipes the staged diff into one `claude -p` call whose prompt runs your skill, with JSON output and `dontAsk` mode"
- hint: "pre-approves only `Read`, `Grep` and `Glob`, restricts the tools to those three, turns hooks off and uses no MCP server, and caps turns at 10 or fewer"

### it pipes the staged diff in, saves the JSON where its argument says, prints the result, exits non-zero when the run fails, and doesn't call Claude when nothing is staged
- narrow "not from Windows itself": Are you running the check from macOS, Linux or WSL 2?
- narrow "first: the check runs the committed script": Is the script committed?
- narrow "has Windows line ends": Was the script saved with Windows line ends?
- narrow "which the stand-in can't replace": Does the script call claude by a path, through another runner, or change PATH?
- narrow "with bash, which it couldn't find": Is bash installed where you run the check?
- narrow "couldn't run `": Can the committed script run at all on this machine?
- narrow "The script needs `jq`": Is jq installed on this machine?
- narrow "With a staged change, `": Does the script stop on its own once the review is printed?
- narrow "the script never ran `claude -p`": Does the script reach its claude call when a change is staged?
- narrow "times. Run it once": Does the script call claude more than once?
- narrow "It also ran `claude` without `-p`": Does the script start a second claude without the print flag?
- narrow "It puts the diff in the prompt": Is the diff piped in, rather than pasted into the prompt?
- narrow "doesn't hold the staged change": Does the script pipe in the staged diff, not the unstaged one?
- narrow "also holds a change that isn't staged": Does the diff it pipes in hold only what is staged?
- narrow "Exit 0 when the review succeeds": Does the script exit 0 after a review that succeeded?
- narrow "It didn't print the review": Does the script print the review's text?
- narrow "though its first argument named another path": Does the script save to the path its first argument names?
- narrow "It didn't save the JSON to the path in its first argument": Does the script save the JSON at all?
- narrow "isn't the JSON `claude -p` printed": Does the script save the JSON unchanged?
- narrow "Run without an argument in a fresh copy": Does the script make the folder before it saves there?
- narrow "Run without an argument, it": What does the script do when it gets no argument?
- narrow "prints no JSON": Does the script exit non-zero when claude does?
- narrow "exits 0, it exited 0": Does the script exit non-zero when the JSON says the run failed?
- narrow "With nothing staged, it still ran": Does the script test for a staged change before it calls claude?
- narrow "With nothing staged, it exited 0": Does the script exit non-zero when nothing is staged?
- narrow "With nothing staged, it printed nothing": Does the script say that nothing is staged?
- hint: "it pipes the staged diff into one `claude -p` call whose prompt runs your skill, with JSON output and `dontAsk` mode"

### `.practice/a-capstone-run.json` holds a run that succeeded within your cap
- narrow "yet:": Did you run the script with that path as its argument?
- narrow "isn't JSON": Is the saved file the JSON the run printed, unchanged?
- narrow "isn't the result of a": Does the saved file hold the final result of a JSON run?
- narrow "stand-in reply": Did your script write to that path while the check ran it?
- narrow "stopped early": Did the run end before its review was done?
- narrow "Fix what it says": What does the saved run say went wrong?
- narrow "holds no review in": Does the saved run hold the review's text?
- narrow "has no `session_id`": Is the saved file the whole JSON the run printed?
- narrow "has no turn count": Is the saved file the whole JSON the run printed?
- narrow "more than `--max-turns": Did the run use the cap the committed script sets?
- hint: "The saved JSON's `total_cost_usd` estimates what one review spent, and it must come in under your cap."
- bottom: "mkdir -p .practice && scripts/review-staged.sh .practice/a-capstone-run.json"

### a committed workflow runs `anthropics/claude-code-action` on `pull_request`, pinned to a release or a commit SHA, in automation mode, with its credential from a secret and none in the file, a read-only job token, `--max-turns` of at most 10, an `--allowedTools` list without unrestricted `Bash` and `timeout-minutes` of at most 30
- narrow "but that change isn't committed. Commit it, and push": Is your latest change to the workflow committed?
- narrow "isn't committed. Run `git add": Is the review workflow committed?
- narrow "runs Claude with a `prompt`, but": Does the workflow start on pull requests?
- narrow "You need a second workflow": Is there a workflow with a prompt, beside the one that waits for a mention?
- narrow "There is no committed workflow that runs": Is the review workflow committed under .github/workflows?
- narrow "Treat it as leaked": Is a credential written in the workflow file itself?
- narrow "without a version": Does the action's line name a version after the @?
- narrow "is a short commit SHA": Is the pinned SHA the full 40 characters?
- narrow "can move to a new release": Is the action pinned to a full release tag or a full SHA, not a major version?
- narrow "so Claude waits for `@claude`": Does the action's step have a prompt?
- narrow "is empty. Write what Claude should do there": Does the prompt say what to review?
- narrow "passes no credential": Does the step read a credential from a secret?
- narrow "isn't read from a secret": Does the credential input read a repository secret?
- narrow "Remove `pull_request_target`": Does the workflow also start on a pull request target event?
- narrow "so nothing limits the run": Does the step pass any arguments to Claude Code?
- narrow "An unquoted `#`": Is there a comment inside the arguments?
- narrow "reads a flag's value from the word after it": Is the turn limit written with a space, not an equals sign?
- narrow "sets no turn limit": Do the arguments cap the turns?
- narrow "`--max-turns` has no number after it": Does a number follow the turn cap?
- narrow "isn't a whole number: use": Is the turn cap a whole number?
- narrow "is above 10:": Is the turn cap 10 or fewer?
- narrow "is below 1: use a number from 1 to 10": Is the turn cap at least 1?
- narrow "pre-approves no tool: add": Do the arguments pre-approve the one command Claude needs?
- narrow "lists no tool: name only": Is the tool list empty?
- narrow "as separate words": Are the tool rules in quotes?
- narrow "which lets Claude run any command": Does the tool list allow every shell command?
- narrow "sets no `timeout-minutes`": Does the job set a time limit?
- narrow "isn't a whole number: write": Is the job's time limit a whole number?
- narrow "is above 30:": Is the job's time limit 30 minutes or fewer?
- narrow "is below 1: use a number from 1 to 30": Is the job's time limit at least 1?
- narrow "sets `permissions`, so the job token": Does the workflow or the job set permissions?
- narrow "`permissions: write-all`": Does the workflow give the job token every write permission?
- narrow "write access, and this job only reads": Does a permission line say write where read is enough?
- narrow "passes no `github_token`": Does the step pass the job's own token?
- narrow "isn't this job's own token": Is the token input the job's own token?
- hint: "Hold it to lesson 5's limits"
- hint: "a read-only job token: no write access in `permissions` except `id-token: write`"

### no Claude API key or token is committed, at `HEAD` or in the commit the workflow item reads
- narrow "looks like a Claude API key or token": Did a credential get into a committed file, in this commit or the one with the workflow?
- hint: "Never commit the credential; keep it in the repository secret"

### a committed team marketplace lists a plugin by a relative path, and the entry's name matches the `name` in the plugin's `plugin.json`
- narrow "marketplace.json` isn't valid JSON": Is a comma or a bracket missing, or one too many, in the marketplace file?
- narrow "isn't a JSON object with": Is the marketplace file one object, with a name, an owner and a plugins list?
- narrow "Pick a name of your own": Does the marketplace have a name of your own, not a reserved one?
- narrow "needs an `owner` with a `name`": Does the marketplace name an owner?
- narrow "lists no plugins": Does the marketplace list your plugin?
- narrow "isn't an object with a `name` and a `source`": Is each plugin entry an object with a name and a source?
- narrow "needs a `name` made of letters": Does each plugin entry have a plain name?
- narrow "fetches its plugin from": Is the plugin listed by a relative path, not fetched from elsewhere?
- narrow "has no `source`": Does the entry say where its plugin is?
- narrow "with a backslash": Is the entry's path written with forward slashes?
- narrow "must start with `./`": Does the entry's path start with a dot and a slash?
- narrow "leaves the marketplace folder": Is the plugin inside the marketplace folder?
- narrow "isn't committed. Run `git add": Is the marketplace folder, with its plugin, committed?
- narrow "isn't committed, and line": Does an ignore rule keep git from seeing the marketplace or its plugin?
- narrow "which has no `.claude-plugin/plugin.json`": Does the plugin folder hold its plugin.json?
- narrow "where no plugin is committed": Does the entry's path point at the plugin's folder?
- narrow "plugin.json` isn't valid JSON": Is a comma or a bracket missing, or one too many, in plugin.json?
- narrow "has no `name`. Set": Does plugin.json name the plugin?
- narrow "names the plugin": Do the entry and plugin.json use one name?
- narrow "commits no component": Is a skill or an agent committed in the plugin?
- narrow "isn't a marketplace until it's named": Is the marketplace file in a folder named .claude-plugin?
- narrow "There is no committed `.claude-plugin/marketplace.json`": Is there a marketplace file in team-marketplace?
- hint: "a marketplace in `team-marketplace/` that lists one plugin by a relative path"
- hint: "at least one skill or agent in the plugin"

### the committed `.claude/settings.json` registers that marketplace by a relative path and turns the plugin on
- narrow "No committed marketplace passes": Does the marketplace item above pass yet?
- narrow "`.claude/settings.json` isn't committed": Is the shared settings file committed?
- narrow "There is no committed `.claude/settings.json`": Is there a shared settings file at .claude/settings.json?
- narrow "isn't valid JSON": Is a comma or a bracket missing, or one too many, in the settings file?
- narrow "isn't a JSON object.": Is the settings file one object?
- narrow "registers no marketplace. Add": Does the settings file register the marketplace?
- narrow "sets both": Does the settings file register marketplaces under two spellings?
- narrow "under the key": Is the marketplace registered under its own name?
- narrow "registers no marketplace named": Is your marketplace's name among those the settings file registers?
- narrow "has no `source` object": Does the registration say where the marketplace is?
- narrow "registers the marketplace from": Is the marketplace registered as a folder in this repository?
- narrow "has no `path`": Does the registration give the folder's path?
- narrow "a path on your machine": Is the path written from the repository, not from your machine?
- narrow "writes its `path` with a backslash": Is the path written with forward slashes?
- narrow "leaves the repository": Does the path stay inside the repository?
- narrow "but the marketplace is in": Does the path point at the marketplace's folder?
- narrow "off. Set it to `true`": Does the shared file turn the plugin off?
- narrow "Use the JSON boolean": Is the plugin's value true, without quotes?
- narrow "the part after `@` must be": Does the name after the @ match the marketplace's name?
- narrow "turns none of its plugins on": Does the shared file turn your plugin on?
- narrow "but that change isn't committed": Is your latest change to the settings file committed?
- hint: "The committed `.claude/settings.json` registers the marketplace by a relative path and turns the plugin on"

### the tests pass
- narrow "`npm test` fails": What is the first failure the tests print?
- narrow "has no `npm test` script": Is the check reading your new copy?
- narrow "not an exit code": What does the saved test result file hold now?
- narrow "says the tests exited with": Do the tests pass when you run them now?
- hint: "Finish on `main`, with the merged pull request pulled, everything committed and `npm test` passing."

### nothing is left uncommitted
- narrow "These changes are uncommitted": Which files does the check list, and do they belong in a commit?
- hint: "Finish on `main`, with the merged pull request pulled, everything committed and `npm test` passing."

### the review script's `claude -p` call caps spend with `--max-budget-usd`, and `.practice/a-capstone-run.json` cost less than that cap
- narrow "can't read a spend cap without a committed": Is the review script committed?
- narrow "found no `claude -p` call": Does the committed script hold its claude call?
- narrow "sets no spend cap": Does the call cap spend?
- narrow "has no amount after it": Does an amount follow the spend cap flag?
- narrow "gets its amount from a variable": Is the cap written as a number in the script?
- narrow "isn't an amount above 0": Is the cap a plain number above 0, with no dollar sign?
- narrow "can't read a cost from": Is the saved run there, and is it JSON?
- narrow "stopped at your spend cap": Is the cap above what one review costs?
- narrow "has no cost estimate": Does the saved run hold its cost estimate?
- narrow "isn't above it": Is the cap above what the saved run cost, with room to spare?
- hint: "As in lesson 7, it also caps spend with `--max-budget-usd`, written as a number in the script."
- hint: "Claude Code checks that cap against its client-side cost estimate, and spend can pass it, so leave headroom"

### the review script's `claude -p` prompt and the CI workflow's `prompt` both run one skill committed in `.claude/skills/`
- narrow "without a committed `scripts/review-staged.sh`": Is the review script committed?
- narrow "found no `claude -p` call": Does the committed script hold its claude call?
- narrow "without a committed review workflow": Is the review workflow committed?
- narrow "doesn't run a skill, so its review lives only in the script": Does the script's prompt start with your skill's name?
- narrow "doesn't run a skill, so CI reviews differently": Does the workflow's prompt start with your skill's name?
- narrow "and CI runs": Do the script and CI run the same skill?
- narrow "is a plugin skill": Is the review a skill in the repository, not in the team plugin?
- narrow "names no skill committed at": Is the skill committed where its name says?
- hint: "Write the team's review once, as a skill committed in `.claude/skills/<name>/SKILL.md`, and run it in both places."
- hint: "Through these settings, the plugin reaches every teammate who trusts the repository, but not CI, where a fresh checkout was never trusted"

### the CI workflow sets a `concurrency` group with `cancel-in-progress: true`, so a new push cancels the review still running
- narrow "can't read a `concurrency` group without a committed review workflow": Is the review workflow committed?
- narrow "as a workflow file": Does the workflow file parse?
- narrow "sets no `concurrency`": Does the workflow set a concurrency group?
- narrow "doesn't cancel a review still running": Does the group cancel a review in progress?
- hint: "a `concurrency` group for the pull request with `cancel-in-progress: true`, so a new push cancels the review still running for an older one"

### `.practice/a-capstone-ci.json` shows a completed, successful `pull_request` run of the review workflow
- narrow "yet. Once the review run on your pull request finishes": Did you save the list of the review's runs after it finished?
- narrow "isn't JSON. Save the list": Is the saved file the list gh printed with --json, unchanged?
- narrow "lists no runs. Open a pull request": Has the review workflow run on a pull request yet?
- narrow "doesn't hold the fields the check reads": Did you save the list with the fields the command names?
- narrow "without a committed review workflow": Is the review workflow committed?
- narrow "lists no run of your review workflow": Did you save the runs of claude-review.yml, and not another workflow's?
- narrow "that a pull request started": Did a pull request start the run, and not a push or a manual start?
- narrow "has no GitHub run URL": Does each saved run keep its url?
- narrow "but this repository's `origin` is": Did you save the list in this copy?
- narrow "hasn't finished": Had the review run finished when you saved the list?
- narrow "cancels the review still running": Did a newer push cancel the run you saved?
- narrow "--log-failed": Did the review run fail?
- narrow "so the review runs again": Did the review run end without a result?
- hint: "Once the review run has finished, and before you tear down, save its record for the check"
- bottom: "gh run list --workflow claude-review.yml --json databaseId,status,conclusion,event,url,workflowName > .practice/a-capstone-ci.json"

## card
- skill: check
- show: "npm run check -- a-capstone"
- does: "It checks each box's parts one by one, and each part that fails prints what to fix."
- skill: worktree
- show: "mkdir -p .practice && git worktree list --porcelain > .practice/a-capstone-worktrees.txt"
- does: "save their state from the main checkout"
- skill: headless-script
- show: "mkdir -p .practice && scripts/review-staged.sh .practice/a-capstone-run.json"
- does: "The saved JSON's `total_cost_usd` estimates what one review spent, and it must come in under your cap."
- skill: teardown
- show: "git rm .github/workflows/claude-review.yml"
- does: "With the workflow gone, the Claude Code GitHub Action no longer runs"
