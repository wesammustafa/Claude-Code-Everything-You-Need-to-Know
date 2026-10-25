# Permissions, settings scopes and the sandbox

<sub>**Intermediate** · Lesson 4 of 8 · about 20 minutes · Needs: [Organize project memory and see what loaded](02-organize-memory.md) · Verified against Claude Code v2.1.308 (stable) on 2026-10-25</sub>

## Goal

By the end of this lesson you can choose a narrow permission rule, put it in the right settings scope, and verify the sandbox's boundary.

## You need

- Your practice copy with Node.js LTS for the Worked example and the check.
- One of your own repositories with a test command for Your turn; or use the practice copy for both. Keep your home directory outside the project's writable folders for the sandbox probe.
- macOS, Linux or WSL 2. On Linux and WSL 2, the sandbox needs `bubblewrap` and `socat` ([Set up Linux and WSL2](https://code.claude.com/docs/en/sandboxing#set-up-linux-and-wsl2)); a Codespace on your template copy has both.
- Usage: light.

## The idea

The file a rule goes in decides who it affects ([Settings](https://code.claude.com/docs/en/settings#settings-files-and-who-they-affect)):

| File | Affects | Put here |
|---|---|---|
| `~/.claude/settings.json` | You, in every project | Personal defaults |
| `.claude/settings.json`, committed | Everyone in the project | Team rules |
| `.claude/settings.local.json`, kept out of git | You, in this project | Personal choices |
| Managed settings | Your organization | Organization policy |

When the same key is set in more than one place, the higher level wins: managed, then the command line, then local, then shared project, then user ([Settings precedence](https://code.claude.com/docs/en/settings#settings-precedence)). Rule lists such as `permissions.allow` merge across the files instead. Among the rules, deny is checked first, then ask, then allow, and the first match decides ([Configure permissions](https://code.claude.com/docs/en/permissions#manage-permissions)). In auto mode, an action that matches one of your rules resolves before the classifier sees it, apart from a few exceptions such as writes to protected paths: deny blocks it, ask prompts you, allow lets it run. Auto mode drops broad allow rules, such as package-manager run commands, and keeps narrow ones like `Bash(npm test)` ([How auto mode evaluates actions](https://code.claude.com/docs/en/permission-modes#how-auto-mode-evaluates-actions)).

By default, the [sandbox](https://code.claude.com/docs/en/sandboxing) restricts shell writes to the project, a per-user temporary folder and added directories, using an operating-system boundary.

## Worked example

In your practice copy:

1. Open a terminal in your practice copy and start a Manual session with `claude --permission-mode default`. Check that the footer says `manual mode on`. Manual is the deliberate exercise here: auto mode can approve a test run without a prompt, so the missing prompt alone would not demonstrate an allow rule ([Choose a permission mode](https://code.claude.com/docs/en/permission-modes#available-modes)). Then run `/status`. Its `Setting sources` line lists the settings files this session loaded. Open `/sandbox`; keep the sandbox off for the rule comparison, then close the panel.
2. Save the team's rules as `.claude/settings.json`. Merge this block with any settings already there, rather than replacing unrelated keys. These are the docs' rules for keeping Claude out of `.env` files ([Exclude sensitive files](https://code.claude.com/docs/en/settings-reference#exclude-sensitive-files)), plus the exact test command and an ask rule for pushes:

   ```json
   {
     "permissions": {
       "allow": ["Bash(npm test)"],
       "ask": ["Bash(git push *)"],
       "deny": ["Read(./.env)", "Read(./.env.*)"]
     }
   }
   ```

   Auto mode on its own lets Claude read `.env` ([What the classifier blocks by default](https://code.claude.com/docs/en/permission-modes#what-the-classifier-blocks-by-default)): the deny rules are what stop it. The ask rule makes Claude Code prompt before a push, even in auto mode ([Add a human checkpoint](https://code.claude.com/docs/en/auto-mode-config#add-a-human-checkpoint)). Claude Code reloads permission rules when the file changes ([When edits take effect](https://code.claude.com/docs/en/settings#when-edits-take-effect)). Run `/permissions`: it lists every rule and the settings file it comes from.

   The practice copy has no `.env`, so make a dummy one with a fake value, and ask Claude to read it:

   ```bash
   echo "DEMO_TOKEN=not-a-real-secret" > .env
   ```

   ```text
   Read .env and tell me what it holds.
   ```

   The deny rule blocks the read: deny rules prevent Claude Code from using the tool on that path. Delete the dummy file afterwards: `rm .env`.
3. Ask Claude to `Run npm test`. Read the test result. In Manual mode, with the sandbox off and no matching ask or deny rule, this exact command runs without a permission prompt because the allow rule covers it. If it asks, inspect the command and rule sources instead of approving a broader grant.
4. Turn on the sandbox. Run `/sandbox` and, on the Mode tab, select auto-allow. Claude Code saves the setting to `.claude/settings.local.json`, your personal file ([Get started](https://code.claude.com/docs/en/sandboxing#get-started)). Permission approval and that boundary answer different questions: may this command run, and what can it reach? If `/sandbox` shows only a Dependencies tab, install `bubblewrap` and `socat`, restart Claude Code and run `/sandbox` again.
5. Ask Claude to try a write outside the project:

   ```text
   Run this exact command and show me its output: touch ~/sandbox-probe
   ```

   Read the tool's output: `Operation not permitted` on macOS, or `Read-only file system` on Linux and WSL 2 ([Confirm commands run inside the sandbox](https://code.claude.com/docs/en/sandboxing#confirm-commands-run-inside-the-sandbox)). If Claude offers to retry outside the sandbox, decline. The rejected write is the useful evidence, not whether a permission prompt appeared. If the `touch` succeeds, delete `~/sandbox-probe` and run `/sandbox` to check that the sandbox is on.

## Your turn

Audit a proposed team setup in your own repository. A teammate suggests `Bash(npm *)` so tests run without prompts, wants your personal sandbox choice committed too, and asks Claude in the conversation not to push without asking. Keep `.env` from Claude for everyone, keep tests prompt-free, and make pushes ask first.

1. Choose the exact command from your repository's test script. Share that narrow rule, an ask rule for pushes and the `.env` denies; keep your personal sandbox choice local. `Bash(npm *)` would also approve unrelated npm commands. A request made in the conversation can be lost when compaction drops the message; an ask rule always prompts for a matching command, even in auto mode ([Add a human checkpoint](https://code.claude.com/docs/en/auto-mode-config#add-a-human-checkpoint)). Finish this partial block in `.claude/settings.json`, preserving existing settings. Use the Worked example's deny rules for both the base file and the `.env.*` family:

   ```json
   {
     "permissions": {
       "allow": ["TODO: the command that runs your tests"],
       "ask": ["TODO: a command the team approves each time"],
       "deny": ["TODO: reading .env", "TODO: reading .env.local and the other .env.* files"]
     }
   }
   ```

   Replace every `TODO` before saving the final file. Allow only the one command that runs your tests, such as `Bash(npm test)` or `Bash(pytest)`, and ask before pushes with `Bash(git push *)`.
2. Review and commit the team's rules. Use your repository's terminal. Check that the commit contains the narrow test rule, the ask rule and both deny rules, while preserving the earlier lessons' settings.
3. In a Claude Code session in your repository, turn on the sandbox with `/sandbox` in auto-allow mode. The Config tab shows the resolved sandbox settings ([Get started](https://code.claude.com/docs/en/sandboxing#get-started)). Your local file outranks the shared one, so a local `"enabled": false` overrides a shared `true` ([Settings precedence](https://code.claude.com/docs/en/settings#settings-precedence)): `jq .sandbox .claude/settings.local.json` shows what yours holds. Ask Claude to `Run this exact command and show me its output: touch ~/sandbox-probe`, and inspect the actual failure. If Claude offers to retry outside the sandbox, decline.
4. Run [`git status --short`](https://git-scm.com/docs/git-status) and [`git ls-files .claude/settings.local.json`](https://git-scm.com/docs/git-ls-files) in your repository's terminal. Your personal file should appear in neither output. Claude Code keeps it out of git when it creates it; if you created it by hand, add it to `.gitignore` yourself ([Keep personal settings out of a repository](https://code.claude.com/docs/en/settings#keep-personal-settings-out-of-a-repository)). Leave Manual mode when the exercise is finished: press `Shift+Tab` until the footer shows `auto mode on`, if auto mode is available ([Switch permission modes](https://code.claude.com/docs/en/permission-modes#switch-permission-modes)).

## Check

You are done when all of these are true:

- [ ] The committed `.claude/settings.json` denies reading `.env` and `.env.*` files and allows one test command: `git show HEAD:.claude/settings.json | jq .permissions` shows them.
- [ ] It asks before a command the team approves each time, such as `Bash(git push *)`, in `permissions.ask`.
- [ ] The sandbox is on, and your personal file stays out of git: `jq .sandbox .claude/settings.local.json` shows `"enabled": true`, and `git ls-files .claude/settings.local.json` prints nothing.
- [ ] Self-check (not tested): you inspected the active rules and sandbox configuration, and Claude's attempted write outside the project failed without an unsandboxed retry.

Run `npm run check -- i-4 --dir <your repo>` from your practice copy, or `npm run check -- i-4` in the copy itself.

If the rules item fails, review Your turn step 1, then commit the corrected settings. If the ask item fails, add the rule to `permissions.ask`, not `deny`: a deny rule would block the push you want. If the sandbox item fails, revisit Your turn step 3 in the repository the check reads; a local disable wins over a shared enable.

## Watch out

- The sandbox wraps shell commands only. Claude's file and web tools follow permission rules; hooks and local MCP servers run outside it with your full access ([What runs outside the sandbox](https://code.claude.com/docs/en/sandboxing#what-runs-outside-the-sandbox)). If the sandbox can't start, Claude Code runs commands unsandboxed unless `sandbox.failIfUnavailable` is `true`.
- A `Read` deny rule doesn't stop an arbitrary script from opening files itself ([Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)). With the sandbox on, Claude Code also adds your `Read` deny paths to the sandbox's [`filesystem.denyRead`](https://code.claude.com/docs/en/settings-reference#sandbox-filesystem-denyread).

## Go further

- [How we built Claude Code auto mode](https://www.anthropic.com/engineering/claude-code-auto-mode): Anthropic on what auto mode's classifier catches and what it misses.
- [Making Claude Code more secure and autonomous with sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing): why the sandbox has a filesystem boundary and a network boundary.
- [Security](https://code.claude.com/docs/en/security): how Claude Code's protections fit together.

---

<sub>Sources: [Settings files and precedence](https://code.claude.com/docs/en/settings) · [All settings](https://code.claude.com/docs/en/settings-reference) · [Configure permissions](https://code.claude.com/docs/en/permissions) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Configure auto mode](https://code.claude.com/docs/en/auto-mode-config) · [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing) · [git status](https://git-scm.com/docs/git-status) · [git ls-files](https://git-scm.com/docs/git-ls-files)</sub>

<sub>← [Pick the model and effort](03-model-and-effort.md) · [Intermediate index](README.md) · [Enforce a rule with a hook](05-hooks.md) → · Topic: [Permissions and safety](../topics/permissions-and-safety.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-4)</sub>
