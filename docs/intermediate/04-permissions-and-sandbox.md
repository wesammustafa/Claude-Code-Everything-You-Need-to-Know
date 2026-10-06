# Permissions, settings scopes and the sandbox

<sub>**Intermediate** · Lesson 4 of 8 · about 20 minutes · Needs: [Organize project memory and see what loaded](02-organize-memory.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-06</sub>

## Goal

By the end of this lesson you can put a permission rule in the settings file whose scope fits it, see which rules are in force, and turn on the sandbox so the shell commands Claude runs can't write outside your project, a temporary folder and any folders you've added.

## You need

- Your copy of the practice template, for the Worked example, with Node.js LTS: the check runs from it. One of your own repositories with a test command, for Your turn; or use the template copy for both.
- macOS, Linux or WSL 2. On Linux and WSL 2, the sandbox needs `bubblewrap` and `socat` ([Set up Linux and WSL2](https://code.claude.com/docs/en/sandboxing#set-up-linux-and-wsl2)); a Codespace on your template copy has both.
- Usage: light.

## The idea

Claude Code reads settings from four files, and the file a rule goes in decides who it affects ([Settings](https://code.claude.com/docs/en/settings#settings-files-and-who-they-affect)):

| File | Affects | Put here |
|---|---|---|
| `~/.claude/settings.json` | You, in every project | Your own preferences |
| `.claude/settings.json`, committed | Everyone in the project | Team rules: files Claude must never read, commands everyone runs |
| `.claude/settings.local.json`, kept out of git | You, in this project | Your own exceptions. "Yes, and don't ask again" on a Bash command saves here |
| Managed settings | Everyone your organization deploys them to | Policy your settings can't override, apart from a few security keys where the stricter value wins |

When the same key is set in more than one place, the higher level wins: managed, then the command line, then local, then shared project, then user ([Settings precedence](https://code.claude.com/docs/en/settings#settings-precedence)). Rule lists such as `permissions.allow` merge across the files instead. Among the rules, deny is checked first, then ask, then allow, and the first match decides ([Configure permissions](https://code.claude.com/docs/en/permissions#manage-permissions)).

Permission rules govern Claude's tools. The [sandbox](https://code.claude.com/docs/en/sandboxing) adds a boundary that the operating system enforces around the shell commands Claude runs: by default they can write only in the project, a per-user temporary folder and any folders you've added with `--add-dir` or `/add-dir`, and reach the network only through a proxy that checks each host against the hosts you allow. It's off until you turn it on. In its auto-allow mode, a command that runs inside it needs no permission prompt.

## Worked example

In your practice copy:

1. Start `claude` and run `/status`. Its `Setting sources` line lists the settings files this session loaded.
2. Save the team's rules as `.claude/settings.json`. These are the docs' rules for keeping Claude out of `.env` files ([Exclude sensitive files](https://code.claude.com/docs/en/settings-reference#exclude-sensitive-files)), plus the test command:

   ```json
   {
     "permissions": {
       "allow": ["Bash(npm test)"],
       "deny": ["Read(./.env)", "Read(./.env.*)"]
     }
   }
   ```

   Claude Code reloads a settings file when it changes ([When edits take effect](https://code.claude.com/docs/en/settings#when-edits-take-effect)). Run `/permissions`: it lists `Bash(npm test)` among the allow rules and the two `Read` rules among the deny rules.
3. Ask Claude to `Run npm test`. It runs without a permission prompt: the allow rule covers it.
4. Turn on the sandbox. Run `/sandbox` and, on the Mode tab, select auto-allow. Claude Code saves the setting to `.claude/settings.local.json`, your personal file ([Get started](https://code.claude.com/docs/en/sandboxing#get-started)).
5. Ask Claude to try a write outside the project:

   ```text
   Run this exact command and show me its output: touch ~/sandbox-probe
   ```

   It runs without a prompt and fails: `Operation not permitted` on macOS, `Read-only file system` on Linux and WSL 2 ([Confirm commands run inside the sandbox](https://code.claude.com/docs/en/sandboxing#confirm-commands-run-inside-the-sandbox)). If Claude offers to retry outside the sandbox, decline.

## Your turn

Set up the same split in your own repository.

1. Save this partial file as `.claude/settings.json`, and replace each `TODO` with a rule. Allow only the one command that runs your tests, such as `Bash(npm test)` or `Bash(pytest)`:

   ```json
   {
     "permissions": {
       "allow": ["TODO: the command that runs your tests"],
       "deny": ["TODO: reading .env", "TODO: reading .env.local and the other .env.* files"]
     }
   }
   ```

2. Commit it: these are rules for everyone who works in the repository.
3. In a session there, turn on the sandbox with `/sandbox` in auto-allow mode, and repeat the Worked example's step 5.
4. Run `git status`. `.claude/settings.local.json` isn't listed: Claude Code keeps it out of git when it creates it ([Keep personal settings out of a repository](https://code.claude.com/docs/en/settings#keep-personal-settings-out-of-a-repository)).

## Check

You are done when all of these are true:

- [ ] The committed `.claude/settings.json` denies reading `.env` and `.env.*` files and allows one test command: `git show HEAD:.claude/settings.json | jq .permissions` shows them.
- [ ] The sandbox is on, and your personal file stays out of git: `jq .sandbox .claude/settings.local.json` shows `"enabled": true`, and `git ls-files .claude/settings.local.json` prints nothing.
- [ ] Self-check (not tested): Claude's `touch ~/sandbox-probe` failed without asking you first.

Run `npm run check -- i-4 --dir <your repo>` from your practice copy, or `npm run check -- i-4` in the copy itself.

If the first item fails on a broad rule, replace it with the one command: `Bash(npm *)` would let Claude run any npm command without asking. If `/sandbox` shows only a Dependencies tab, install `bubblewrap` and `socat`, restart Claude Code and run `/sandbox` again.

## Watch out

- The sandbox wraps shell commands only. Claude's file and web tools run outside it and follow your permission rules; hooks and local MCP servers run outside it with your full access ([What runs outside the sandbox](https://code.claude.com/docs/en/sandboxing#what-runs-outside-the-sandbox)). If the sandbox can't start, Claude Code runs commands unsandboxed unless `sandbox.failIfUnavailable` is `true`.
- On its own, a `Read` deny rule covers Claude's file tools and the file commands Claude Code recognizes in Bash, such as `cat`, but not a script that opens files itself ([Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)). With the sandbox on, Claude Code also adds your `Read` deny paths to the sandbox's [`filesystem.denyRead`](https://code.claude.com/docs/en/settings-reference#sandbox-filesystem-denyread), so sandboxed commands and the processes they start can't read those files either.
- In a Codespace or another container, if sandboxed commands fail with `Can't mount proc on /newroot/proc`, see [Bubblewrap fails to start inside a container](https://code.claude.com/docs/en/sandboxing#bubblewrap-fails-to-start-inside-a-container).

## Go further

- [How we built Claude Code auto mode](https://www.anthropic.com/engineering/claude-code-auto-mode): Anthropic on what auto mode's classifier catches and what it misses.
- [Making Claude Code more secure and autonomous with sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing): why the sandbox has a filesystem boundary and a network boundary.
- [Security](https://code.claude.com/docs/en/security): how Claude Code's protections fit together.

---

<sub>Sources: [Settings files and precedence](https://code.claude.com/docs/en/settings) · [All settings](https://code.claude.com/docs/en/settings-reference) · [Configure permissions](https://code.claude.com/docs/en/permissions) · [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing)</sub>

<sub>← [Pick the model and effort](03-model-and-effort.md) · [Intermediate index](README.md) · [Enforce a rule with a hook](05-hooks.md) → · Topic: [Permissions and safety](../topics/permissions-and-safety.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-4)</sub>
