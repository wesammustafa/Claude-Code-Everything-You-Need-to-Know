# Hooks for Intermediate lesson 5

Three teaching hooks for the Intermediate lesson "Enforce a rule with a hook", and the settings that register them. Each script's header says what it does, when it runs, its side effects, platforms, how to remove it and its test line.

| Script | Event and matcher | What it does |
|---|---|---|
| `dot-claude/hooks/protect-files.sh` | `PreToolUse`, `Edit\|Write` | Blocks edits to `.env`, `package-lock.json` and `.git/`, with exit code 2. The [hooks guide](https://code.claude.com/docs/en/hooks-guide#block-edits-to-protected-files)'s script, unchanged |
| `dot-claude/hooks/format-after-edit.sh` | `PostToolUse`, `Edit\|Write` | Removes trailing spaces and tabs and leaves one final newline in the source file Claude just changed. Only common source-code extensions, such as `.js`, `.py` and `.sh`: Markdown, patches and data files stay as they are |
| `dot-claude/hooks/desktop-notify.sh` | `Notification`, every type | Shows a desktop notification for every Claude Code notification, such as a permission prompt that has waited |

## Use them

From your project's root:

```bash
mkdir -p .claude/hooks
cp <path-to-this-folder>/dot-claude/hooks/protect-files.sh <path-to-this-folder>/dot-claude/hooks/format-after-edit.sh .claude/hooks/
chmod +x .claude/hooks/*.sh
```

Then merge `settings.snippet.json` into your project's `.claude/settings.json`. If the file already has a `hooks` or `permissions` key, add these entries beside the existing ones instead of replacing them.

`desktop-notify.sh` is about you, not the project, so it goes in your user settings, where the [hooks guide](https://code.claude.com/docs/en/hooks-guide#get-notified-when-claude-needs-input) registers its notification examples. Copy it to `~/.claude/hooks/`, make it executable, and add this to `~/.claude/settings.json`, beside any keys already there. It uses shell form, so the shell expands `~`:

```json
"hooks": {
  "Notification": [
    { "matcher": "", "hooks": [ { "type": "command", "command": "~/.claude/hooks/desktop-notify.sh" } ] }
  ]
}
```

`settings.snippet.json`:
- **What:** registers `protect-files.sh` and `format-after-edit.sh` in [exec form](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form), so the `${CLAUDE_PROJECT_DIR}` path needs no quoting, and adds a `Read(.env)` deny rule, which also stops Claude's Edit and Write tools from changing a `.env` file ([Configure permissions](https://code.claude.com/docs/en/permissions#read-and-edit)).
- **When:** Claude Code reads it when a session starts in the project, and reloads it when the file changes ([Settings](https://code.claude.com/docs/en/settings#when-edits-take-effect)).
- **Side effects:** none of its own; the scripts' headers list theirs.
- **Platforms:** macOS, Linux and WSL2. The scripts need bash and jq, and `format-after-edit.sh` also needs python3.
- **Remove:** delete the entries from `.claude/settings.json`.

Hooks in a repository's `.claude/settings.json` run with your user's rights: in an interactive session once you trust the folder, and in a `claude -p` run without asking ([Hooks reference](https://code.claude.com/docs/en/hooks#workspace-trust)). Read every script before you register it.

Smoke test, without Claude: `bash test.sh`.

Tested in Claude Code v2.1.285 (stable) on macOS, 2026-10-06

Sources: [Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide), [Hooks reference](https://code.claude.com/docs/en/hooks), [Configure permissions](https://code.claude.com/docs/en/permissions), [Settings](https://code.claude.com/docs/en/settings)
