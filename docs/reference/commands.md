# Slash Commands — Cheatsheet

*[← Back to README](../../README.md#claude-commands)*

The most useful built-in slash commands, plus the file-format spec for custom commands (skills). This is a curated cheatsheet — for the canonical, always-current list see the [official commands reference](https://code.claude.com/docs/en/commands). For workflows and recipes built around slash commands, see [`docs/skills.md`](../skills.md).

---

## Common built-in slash commands

| Command | Purpose |
|---|---|
| `/add-dir` | Add additional working directories |
| `/cd` | Change the session's working directory |
| `/clear` | Clear conversation history |
| `/code-review [level]` | Review the current diff (`low`–`max`, or `ultra` for a multi-agent cloud review); `--fix` applies findings, `--comment` posts them to the PR. `/ultrareview` is an alias for the ultra tier |
| `/compact [instructions]` | Compact conversation with optional focus instructions |
| `/config` | View or modify configuration (`/config key=value` sets directly) |
| `/debug` | Troubleshoot current session and configuration |
| `/desktop` *(alias `/app`)* | Hand the current CLI session to the desktop app (macOS/Windows) |
| `/doctor` | Check the health of your Claude Code installation |
| `/effort` | Set reasoning effort (`low` / `medium` / `high` / `xhigh` / `max` / `ultracode`); no args opens an interactive slider; `/effort auto` resets to the model default. See [Effort levels](effort-levels.md) |
| `/fast` | Toggle Fast Mode — Opus 4.8 at 2× price for up to 2.5× output speed |
| `/goal` | Set a standing goal for the session |
| `/help` | Get usage help |
| `/hooks` | Interactive menu for hook configuration |
| `/init` | Initialize project with a `CLAUDE.md` guide |
| `/login` / `/logout` | Sign in / out of your Anthropic account (also: `claude auth login\|status\|logout` from the shell) |
| `/loop` | Run a prompt or skill on a recurring interval (local scheduling) |
| `/mcp` | Manage MCP server connections and OAuth authentication |
| `/memory` | Manage memory files (`CLAUDE.md` and auto memory) |
| `/model` | Switch models — your selection persists as the default for new sessions since v2.1.153 (press `s` for session-only) |
| `/permissions` | View or update [permissions](https://code.claude.com/docs/en/iam) |
| `/plugin` | Manage plugins and plugin marketplaces (`/plugin list`, `/plugin marketplace add …`) |
| `/pr_comments` | View pull request comments |
| `/reload-skills` | Reload skill files without restarting the session |
| `/rename` | Auto-generate descriptive session names |
| `/review` | Request code review |
| `/rewind` | Rewind the session — can resume from before a `/clear` (v2.1.191+) |
| `/schedule` *(alias `/routines`)* | Manage scheduled cloud agents on Anthropic-managed infrastructure |
| `/scroll-speed` | Adjust terminal scroll speed |
| `/simplify` | Cleanup-only review — reuse, simplification, efficiency (no bug hunting) |
| `/status` | View account and system statuses |
| `/teleport` *(alias `/tp`)* | Send current session to claude.ai/code for web access |
| `/terminal-setup` | Configure terminal key bindings (iTerm2/VSCode) |
| `/usage` | Show token and plan usage (merged `/cost` + `/stats` in v2.1.118) |
| `/usage-credits` | Manage usage credits (renamed from `/extra-usage` in v2.1.144) |
| `/vim` | Enter vim mode for alternating insert and command modes |
| `/workflows` | Watch dynamic multi-agent workflow runs |

> 💡 **Day 1 essentials:** start with `/init`, `/help`, `/clear`, `/usage`, and `/model`.
>
> ℹ️ The `/agents` setup wizard was removed in v2.1.198 — define subagents by editing `.claude/agents/` directly, or ask Claude to write one.

---

## Custom slash commands (skills)

Custom slash commands let you define frequently-used prompts as markdown files that Claude Code can execute. They're scoped (project-specific or personal), support namespacing through directories, and are now officially the same system as Agent Skills — `.claude/commands/optimize.md` and `.claude/skills/optimize/SKILL.md` both create `/optimize`.

**Quick demo:**

```bash
mkdir -p .claude/commands
echo "Analyze this code for performance issues and suggest optimizations:" \
  > .claude/commands/optimize.md
```

**Realistic example** — `.claude/commands/pull-request.md`:

```markdown
# Create Pull Request Command

Create a new branch, commit changes, and submit a pull request.

## Behavior
- Creates a new branch based on current changes
- Formats modified files using Biome
- Analyzes changes and automatically splits into logical commits when appropriate
- Each commit focuses on a single logical change or feature
- Creates descriptive commit messages for each logical unit
- Pushes branch to remote
- Creates pull request with proper summary and test plan

## Guidelines for Automatic Commit Splitting
- Split commits by feature, component, or concern
- Keep related file changes together in the same commit
- Separate refactoring from feature additions
- Ensure each commit can be understood independently
- Multiple unrelated changes should be split into separate commits
```

> 💡 **Next level:** for workflows, recipes, and best practices, see [`docs/skills.md`](../skills.md).

---

[← Back to README](../../README.md#claude-commands) · [Skills guide](../skills.md) · [FAQ](faq.md)
