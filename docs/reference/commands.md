# Slash Commands — Complete Reference

*[← Back to README](../../README.md#claude-commands)*

Every built-in slash command shipped with Claude Code, plus the file-format spec for custom commands (skills). For workflows and recipes built around slash commands, see [`docs/skills.md`](../skills.md).

---

## Built-in slash commands

| Command | Purpose |
|---|---|
| `/add-dir` | Add additional working directories |
| `/agents` | Manage custom AI subagents for specialized tasks |
| `/auth login` | Authenticate with your Anthropic account |
| `/auth status` | Check authentication status |
| `/auth logout` | Sign out from your account |
| `/bug` | Report bugs (sends conversation to Anthropic) |
| `/clear` | Clear conversation history |
| `/compact [instructions]` | Compact conversation with optional focus instructions |
| `/config` | View or modify configuration |
| `/cost` | Show token usage statistics |
| `/debug` | Troubleshoot current session and configuration |
| `/doctor` | Check the health of your Claude Code installation |
| `/effort` | Set reasoning effort (`low` / `medium` / `high` / `xhigh` / `max`); no args opens an interactive slider; `/effort auto` resets to model default. See [Effort levels](effort-levels.md). |
| `/fast` | Toggle Fast Mode for 2.5× faster Opus 4.6 responses (6× pricing) |
| `/help` | Get usage help |
| `/hooks` | Interactive menu for hook configuration |
| `/init` | Initialize project with `CLAUDE.md` guide |
| `/login` | Switch Anthropic accounts (legacy — use `/auth login`) |
| `/logout` | Sign out (legacy — use `/auth logout`) |
| `/mcp` | Manage MCP server connections and OAuth authentication |
| `/memory` | Edit `CLAUDE.md` memory files |
| `/model` | Select or change the AI model (Opus 4.7, Sonnet 4.6, Haiku 4.5; previous-gen 4.6/4.5 still available) |
| `/permissions` | View or update [permissions](https://docs.anthropic.com/en/docs/claude-code/iam#configuring-permissions) |
| `/pr_comments` | View pull request comments |
| `/rename` | Auto-generate descriptive session names |
| `/review` | Request code review |
| `/status` | View account and system statuses |
| `/teleport` | Send current session to claude.ai/code for web access |
| `/terminal-setup` | Install Shift+Enter key binding for newlines (built-in since 2026; this command remains for iTerm2/VSCode custom bindings) |
| `/vim` | Enter vim mode for alternating insert and command modes |

> 💡 **Day 1 essentials:** start with `/init`, `/help`, `/clear`, `/cost`, and `/model`.

---

## Custom slash commands (skills)

Custom slash commands let you define frequently-used prompts as markdown files that Claude Code can execute. They're scoped (project-specific or personal) and support namespacing through directories.

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

> 💡 **Next level:** custom slash commands and Skills are the same thing. For workflows, recipes, and best practices, see [`docs/skills.md`](../skills.md).

---

[← Back to README](../../README.md#claude-commands) · [Skills guide](../skills.md) · [FAQ](faq.md)
