---
lesson: i-capstone
stamp: "Verified against Claude Code v2.1.308 (stable) on 2026-10-25"
badge: Intermediate
needs: [jq python3]
---

## intro
- minutes: "30 to 60 minutes"
- why: "A teammate starts Monday with only what's in git: commit a setup that works like the team's."
- can: "get a repository ready for a new teammate"
- can: "choose the mechanism for each need"
- can: "pick the model and effort for each job"
- payoff: "get a repository ready for a new teammate"
- need: "`jq` and `python3` for hook scripts, and Chrome for the MCP server."

## steps

### T1 | The task step 1 of 8 | Team boundaries
- tier: challenge
- skill: edit-settings
- where: editor
- beat: do
- where: terminal
- skill: set-aside
- verify: check 10
- watching: git status --porcelain
- say: First, start from a clean copy.
- goal: "Your copy of the practice template, with no uncommitted changes"
- hint: "If `git status --porcelain` lists files, commit them or set them aside with `git stash push --include-untracked`."
- beat: do
- verify: match .claude/settings.json Read\((\./|/|\*\*/)?\.env\)
- goal: "**Team boundaries.** Claude must never read `.env` files."
- say: Done when a deny rule covers the .env file itself.
- hint: "The committed `.claude/settings.json` denies reading `.env` files, allows a narrow test command, and asks before a command such as `git push`."
- beat: do
- verify: match .claude/settings.json Read\((\./|/|\*\*/)?\.env\.\*\)
- say: Done when a second deny rule covers the files whose names start with .env and a dot.
- hint: "Claude must never read `.env` files."
- beat: do
- verify: match .claude/settings.json Bash\(npm test\)
- say: Done when an allow rule lets the tests run.
- hint: "It may run `npm test` without asking"
- beat: do
- verify: match .claude/settings.json Bash\(git push
- say: Done when a rule makes a person approve a push.
- hint: "a person approves a `git push` before it runs, even in auto mode."
- beat: do
- skill: sandbox
- verify: json .claude/settings.json sandbox.enabled=true
- say: Done when the sandbox is on for everyone.
- hint: "Shell commands run in the sandbox for everyone: `/sandbox` saves to your local file, which teammates don't get."

### T2 | The task step 2 of 8 | Keep samples/ as it is
- tier: challenge
- skill: write-hook
- where: editor
- beat: do
- verify: self
- done-label: it's protected
- goal: "**`samples/` must not change.** The tests depend on the exact files there, including the link that's broken on purpose, and last week a session edited one."
- note: "Make sure Claude's file-editing tools can't change them, while Claude can still edit everything else."
- note: "If your protection runs a script, it must block the edit when the script can't run."
- hint: "pick the mechanism from what the level taught"

### T3 | The task step 3 of 8 | Memory that stays short
- tier: challenge
- skill: write-rule
- where: editor
- beat: do
- skill: memory
- verify: match CLAUDE.md (^|\s)@\S+
- goal: "**Memory that stays short.** Claude should know the npm scripts without anyone pasting them"
- say: Done when CLAUDE.md brings in the npm scripts.
- hint: "A committed `CLAUDE.md` imports a file with `@path`, and the file exists."
- beat: do
- verify: self
- done-label: it's saved
- say: The same need asks for one more thing.
- goal: "the testing conventions should load only when Claude works on the files under `test/`."
- hint: "A committed rule in `.claude/rules/` is scoped with `paths:`, and every scoped rule matches a file in the repository."

### T4 | The task step 4 of 8 | A job we repeat
- tier: challenge
- skill: write-skill
- where: editor
- beat: do
- verify: self
- done-label: it's saved
- goal: "**A job we repeat.** We keep asking Claude to run the link checker on a folder and explain each broken link."
- note: "Anyone should be able to start it by name, and Claude should pick it up on its own when someone asks to check links."
- hint: "A committed project skill runs the link checker by name and can load on its own."

### T5 | The task step 5 of 8 | A second opinion
- tier: challenge
- skill: write-subagent
- where: editor
- beat: do
- verify: self
- done-label: it's saved
- goal: "**A second opinion that can't change anything.** Before we commit, we want each change reviewed by something that can only read the code."
- hint: "A committed reviewer subagent has only tools that read code"

### T6 | The task step 6 of 8 | A pinned browser server
- tier: challenge
- skill: share-mcp
- where: editor
- beat: do
- verify: match .mcp.json chrome-devtools-mcp@\d+\.\d+\.\d+
- goal: "**The docs in a browser.** Claude should open the docs in a browser through Chrome DevTools MCP, which we reviewed at one version."
- say: Done when the server runs at an exact version.
- hint: "The committed `.mcp.json` runs chrome-devtools-mcp at an exact version, with usage statistics, CrUX lookups and update checks off."
- beat: do
- verify: match .mcp.json no-usage-statistics|usage-statistics=false
- say: Done when usage statistics are off.
- hint: "usage statistics, CrUX lookups and update checks stay off."
- beat: do
- verify: match .mcp.json no-performance-crux|performance-crux=false
- say: Done when CrUX lookups are off.
- hint: "usage statistics, CrUX lookups and update checks stay off."
- beat: do
- verify: match .mcp.json CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS
- say: Done when update checks are off.
- hint: "usage statistics, CrUX lookups and update checks stay off."

### T7 | The task step 7 of 8 | The setup plugin
- tier: challenge
- skill: install-plugin
- where: editor
- beat: do
- verify: json .claude/settings.json enabledPlugins.claude-code-setup@claude-plugins-official=true
- goal: "**One official plugin.** Everyone in the repository should get `claude-code-setup` from the official marketplace."
- say: Done when the shared settings file turns the plugin on.
- hint: "The committed `.claude/settings.json` turns on a plugin from one of Anthropic's marketplaces."
- beat: do
- where: terminal
- verify: self
- done-label: installed
- say: Then install it, as a teammate does.
- bottom: "claude plugin install claude-code-setup@claude-plugins-official --scope project"

### T8 | The task step 8 of 8 | Fix the bug with your setup
- tier: challenge
- skill: run-skill
- where: claude
- beat: do
- verify: self
- done-label: I reproduced it
- goal: "Reproduce the malformed-percent bug in `capstone/intermediate-bug.md` with your link-check workflow"
- hint: "a link such as `[broken](bad%.md)` crashes the checker instead of producing its normal broken-link report."
- beat: do
- verify: self
- done-label: I saw red and green
- goal: "Fix it with Claude while your protection keeps `samples/` unchanged"
- note: "tell Claude not to commit until your reviewer has reviewed the fix"
- note: "Add a regression test that fails before the repair and passes after it."
- hint: "Malformed percent escapes are broken links; valid percent-encoded paths must still resolve."
- hint: "If your copy runs lesson 5's test gate, expect it to send Claude back to work when Claude stops while that test fails."
- beat: do
- skill: save-file
- where: editor
- verify: json .practice/i-capstone-hook.json hooks.SubagentStart.0.hooks.0.command fresh
- say: Save this as .practice/i-capstone-hook.json.
- code: point 2
```json
{"hooks":{"SubagentStart":[{"hooks":[{
  "type":"command","command":"jq -r '.agent_type' >> \"$CLAUDE_PROJECT_DIR/.practice/i-capstone-agents.txt\""
}]}]}}
```
- say: Done when the file holds the SubagentStart hook.
- hint: "a session started with `claude --settings .practice/i-capstone-hook.json`"
- beat: do
- skill: delegate
- verify: check 12 fresh
- watching: .practice/i-capstone-agents.txt
- evidence: .practice/i-capstone-agents.txt
- goal: "Before you commit, have your reviewer review the fix"
- hint: "Before you commit, have your reviewer review the fix in a session started with `claude --settings .practice/i-capstone-hook.json`"
- beat: do
- where: shell
- skill: commit
- verify: check 11
- watching: git show HEAD:src
- goal: "Then commit the source fix and its regression test together."
- hint: "The committed CLI reports malformed percent escapes as broken links, continues checking later links and still resolves valid encoded paths."

### C | Check | Check
- tier: challenge
- skill: check
- where: claude
- beat: do
- where: terminal
- skill: start
- verify: self
- done-label: it's running
- goal: "Then try each part in a session"
- say: Start Claude Code in your practice copy, or keep the session from step 8 open.
- beat: self
- skill: match-skill
- done-label: yes, I did
- note: "The check doesn't look at these parts of the Intermediate Exit. Tick them yourself, honestly"
- self: "I ran my skill by name, and Claude loaded it on its own when I asked it to check links."
- beat: do
- where: claude
- skill: probe-guard
- verify: self
- done-label: I saw it blocked
- say: Ask for the Edit tool by name, and say it's a test.
- run: "Use your Edit tool, not a shell command, to add a blank line at the end of samples/guide.md. I'm testing whether my protection blocks it."
- hint: "If the edit goes through, restore the file with `git restore samples/` and fix your protection."
- beat: self
- skill: probe-guard
- done-label: yes, I saw it
- self: "I saw my protection stop an Edit in `samples/` during a session."
- beat: do
- where: shell
- skill: probe-guard
- verify: git-clean samples/
- watching: git status samples
- say: Make sure nothing in samples/ changed.
- hint: "The tests depend on the exact files there"
- beat: self
- skill: use-mcp
- done-label: yes, I did
- self: "I approved the MCP server in a session and used one of its tools."
- beat: self
- skill: delegate
- done-label: yes, before
- self: "My reviewer reviewed the fix before I committed it."
- beat: self
- skill: set-model
- done-label: yes, I can
- goal: "Then try each part in a session, and pick the model and effort for each job as [lesson 3](03-model-and-effort.md) showed."
- self: "I can pick a model and an effort level for a task, and say why."
- beat: do
- where: shell
- skill: commit
- verify: check 10
- watching: git status --porcelain
- goal: "Commit everything, and make sure `npm test` still passes."
- hint: "commit all of it"
- beat: do
- where: shell
- verify: check all
- run: "npm run check -- i-capstone"
- hint: "Each item that fails prints what to fix."
- beat: self
- skill: install-plugin
- done-label: yes, I did
- self: "I installed the plugin with `claude plugin install claude-code-setup@claude-plugins-official --scope project`, as a teammate does after pulling the settings."
- beat: self
- skill: debug-load
- done-label: yes, I can
- self: "When Claude didn't follow an instruction, I can find out whether its file loaded."
- after: "When every box on this page is ticked, you're ready for the [Advanced level](../advanced/README.md)."

## ladder

### a committed project skill that runs the link checker by name and can load on its own
- back: T4 Review the skill here.
- narrow "Commit a skill in": Is the skill committed, does its body run the link checker on a folder, does its description say what it does and when to use it, and is the line that stops it loading on its own gone?
- hint: "A committed project skill runs the link checker by name and can load on its own."
- hint: "Anyone should be able to start it by name, and Claude should pick it up on its own when someone asks to check links."

### Claude's file-editing tools can't change `samples/` but can edit the rest: a committed `Edit` deny rule, or a fail-closed `PreToolUse` hook
- back: T2 Review the sample protection here.
- narrow "Keep Claude out of samples/": Is your protection committed: a deny rule for edits to the folder, or an executable hook the settings run before Edit and Write?
- narrow "A hook needs `jq`": Is jq installed on this machine?
- narrow "No Edit|Write hook exits with 2": Does your committed script exit with 2 for a path inside samples/?
- narrow "also blocks `src/cli.js` or `src/samples.js`": Does your script match more than the samples/ folder, such as any path that holds the word?
- narrow "to the hook that protects samples/": Does the hook entry carry the line that blocks the edit when the script can't run?
- hint: "Claude's file-editing tools can't change `samples/`: a committed `Edit` deny rule covers the folder, or a committed, executable `PreToolUse` hook for Edit and Write blocks it, allows the rest and has `"onFailure": "block"`."
- hint: "The tests depend on the exact files there"

### a committed reviewer subagent with only tools that read code
- back: T5 Review the reviewer here.
- narrow "Commit a reviewer in": Is the reviewer committed, does its name or description say it reviews, and does its tools line list only tools that read code?
- hint: "A committed reviewer subagent has only tools that read code"

### the committed `.mcp.json` runs chrome-devtools-mcp at an exact version, with usage statistics, CrUX lookups and update checks off
- back: T6 Review the browser server here.
- narrow ".mcp.json is not committed": Does git status still list the server file as new or changed?
- narrow "There is no .mcp.json": Is the server file saved at the root of your practice copy?
- narrow "is not valid JSON": Is a comma or a bracket missing, or one too many, in the server file?
- narrow "No server in .mcp.json runs": Does a server in the file name the chrome-devtools-mcp package in its arguments?
- narrow "isn't pinned": Does the package name end in an exact version, three numbers with dots?
- narrow "Usage statistics are still on": Do the arguments turn usage statistics off?
- narrow "Performance traces can still send URLs": Do the arguments turn CrUX lookups off?
- narrow "Update checks are still on": Does the server's environment turn update checks off?
- hint: "The committed `.mcp.json` runs chrome-devtools-mcp at an exact version, with usage statistics, CrUX lookups and update checks off."

### the committed `.claude/settings.json` enables a plugin from one of Anthropic's marketplaces
- back: T7 Review the plugin setup here.
- narrow "There is no committed .claude/settings.json that parses": Is the shared settings file committed, and does it still parse after your last edit?
- narrow "turns on no plugin from Anthropic's marketplaces": Does the plugin's name end with the official marketplace's name, after the @?
- hint: "The committed `.claude/settings.json` turns on a plugin from one of Anthropic's marketplaces."

### the committed `.claude/settings.json` denies reading `.env` files and allows a narrow test command
- back: T1 Review the team rules here.
- narrow "is not committed. Run": Does git status still list the shared settings file as new or changed?
- narrow "There is no .claude/settings.json": Is the file saved at that path in your practice copy?
- narrow "is not valid JSON": Is a comma or a bracket missing, or one too many, around the rules?
- narrow "Replace each TODO": Did you commit the file again after you replaced every TODO?
- narrow "Add `Read(./.env)` to": Does one deny rule name the .env file itself, with nothing after it?
- narrow "Add `Read(./.env.*)` to": Does a second deny rule cover the files whose names start with .env and a dot?
- narrow "lets every command or every use of a tool through": Does an allow rule let in a whole program or tool, rather than the one test command?
- narrow "Add an allow rule": Is there an allow rule for the command that runs the tests?
- hint: "The committed `.claude/settings.json` denies reading `.env` files, allows a narrow test command, and asks before a command such as `git push`."

### the committed `.claude/settings.json` turns the sandbox on, and `.claude/settings.local.json` stays out of git
- back: T1 Review the shared sandbox choice.
- narrow "is committed, but it holds your own settings": Did your personal settings file get committed along with the shared one?
- narrow "doesn't turn the sandbox on": Is the sandbox on in the shared file, the one teammates get, and is that change committed?
- hint: "Shell commands run in the sandbox for everyone: `/sandbox` saves to your local file, which teammates don't get."

### a committed CLAUDE.md imports a file with `@path`, and the file exists
- back: T3 Review the memory import here.
- narrow "There is no committed CLAUDE.md": Is CLAUDE.md committed at the root of your practice copy?
- narrow "has no @path import outside backticks": Is the import on a line of its own text, not inside backticks or a code block?
- narrow "An import path runs until the first space": Does a period or a comma follow the import path with no space between?
- hint: "A committed `CLAUDE.md` imports a file with `@path`, and the file exists."

### a committed rule in `.claude/rules/` is scoped with `paths:`, and every scoped rule matches a file in the repository
- back: T3 Review the testing rule here.
- narrow "No committed file in .claude/rules/ has": Is the rule committed, with its scope in the front matter at the top of the file?
- narrow "which matches no file in the repository": Does the rule's pattern match the test files as git lists them?
- hint: "A committed rule in `.claude/rules/` is scoped with `paths:`, and every scoped rule matches a file in the repository."

### the tests pass
- back: T8 Review the repair and its tests.
- narrow "`npm test` fails": What is the first failure the tests print?
- narrow "has no `npm test` script": Is the check reading your practice copy?
- narrow "not an exit code": What does the saved test result file hold now?
- narrow "says the tests exited with": Do the tests pass when you run them now?
- bottom: "npm test"

### nothing is left uncommitted
- narrow "These changes are uncommitted": Which files does the check list, and do they belong in a commit?
- hint: "commit all of it"
- bottom: "git status --porcelain"

### the committed CLI reports malformed percent escapes as broken links and still resolves valid encoded paths
- narrow "Commit the CLI source": Is the source repair committed in the practice copy?
- narrow "could not run": Does the committed CLI finish promptly when you reproduce the bug?
- narrow "mishandles malformed percent": Does the repair report malformed targets and continue scanning, while valid encoded paths still resolve?
- hint: "Malformed percent escapes are broken links; valid percent-encoded paths must still resolve."

### `.practice/i-capstone-agents.txt` shows Claude delegating to the committed reviewer
- narrow "There is no delegation log": Did you start the review session with the capstone's hook file, in your practice copy?
- narrow "The log names no committed reviewer": Did Claude hand the review to your committed reviewer, by its name, in that session?
- hint: "Before you commit, have your reviewer review the fix in a session started with `claude --settings .practice/i-capstone-hook.json`"

### the committed `.claude/settings.json` asks before a command the team approves each time, such as `git push`
- narrow "as valid JSON, with the ask rule": Is the shared settings file committed, and does it still parse?
- narrow "Replace the TODO in `permissions.ask`": Did you commit the file again after you replaced the ask rule's TODO?
- narrow "Add an ask rule to `permissions.ask`": Is the push rule under ask, rather than under deny or missing?
- hint: "a person approves a `git push` before it runs, even in auto mode."
- back: T1 Review the team rules here.

## card
- skill: check
- show: "npm run check -- i-capstone"
- does: "Each item that fails prints what to fix."
- skill: check
- show: "git status --porcelain"
- does: "`npm test` passes, and `git status --porcelain` prints nothing."
- skill: check
- show: "git stash push --include-untracked"
- does: "If `git status --porcelain` lists files, commit them or set them aside with `git stash push --include-untracked`."
- skill: check
- show: "npm test"
- does: "make sure `npm test` still passes"
- skill: run-skill
- show: "claude --settings .practice/i-capstone-hook.json"
- does: "lesson 6's delegation log with its own log file"
