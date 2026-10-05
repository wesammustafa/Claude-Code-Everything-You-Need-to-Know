<a id="claude-skills"></a>
# Claude Skills

> [!NOTE]
> From the previous edition, not yet re-verified. The guide is being rebuilt as lessons; this page keeps the earlier material reachable until they land.

*~3 min read · [Full guide in `docs/skills.md` →](../../docs/skills.md)*

> **Mental model:** Skills package a workflow into a markdown file. Two equivalent formats, officially one system now:
> - **Slash skills**: `.claude/commands/<name>.md`, you invoke them with `/<name>`
> - **Agent Skills**: `.claude/skills/<name>/SKILL.md` with YAML frontmatter; Claude can also auto-invoke these when the description matches the task
>
> `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md` both create `/deploy`. Skills follow the open [agentskills.io](https://agentskills.io) standard, adopted by ~40 products beyond Claude Code (Codex, Copilot, Cursor, Gemini CLI, …).

> [!WARNING]
> **Security:** Skills are executable instructions running with your shell permissions. Read every third-party skill before adding it, exactly like reviewing a shell script before sourcing it.

On a name clash, enterprise beats personal (`~/.claude/`) and personal beats project (`.claude/`); a local skill replaces a bundled skill of the same name, or (in a local terminal session) a built-in command, but not its aliases; plugin skills are namespaced as `/plugin-name:skill-name`, so both load ([official rules](https://code.claude.com/docs/en/skills#resolve-skills-that-share-a-name)). Slash skills load on `/` autocomplete; Agent Skills preload only their metadata and read the body on demand. [Full lookup table →](../../docs/skills.md#where-claude-looks)

## Your first skill in 3 minutes

```bash
mkdir -p .claude/commands

cat > .claude/commands/analyze.md << 'EOF'
# Code Analysis

Analyze the current code for:
- Potential bugs and edge cases
- Performance optimizations
- Code quality improvements
- Security vulnerabilities

Provide specific, actionable recommendations.
EOF

claude       # then type: /analyze
```

That's it: a working slash skill. Promote it to an Agent Skill later by moving it to `.claude/skills/analyze/SKILL.md` and adding `name`/`description` frontmatter.

## Want more depth?

The [full Skills guide in `docs/skills.md`](../../docs/skills.md) covers:

- The Agent Skill shipped here, [`/claude-md-review`](../../.claude/skills/claude-md-review/SKILL.md)
- Bundled built-in skills (e.g. `/dataviz`, `/debug`, `/keybindings-help`)
- Slash skills vs Agent Skills, and the [full frontmatter reference](../../docs/skills.md#frontmatter-reference), including why `allowed-tools` **grants** permission rather than restricting it
- How to write your own skills (file format, scope, examples)
- Skills FAQ, troubleshooting, and best practices

## Custom slash commands

Define a frequently-used prompt once as a markdown file, invoke it forever with `/skill-name`:

```bash
mkdir -p .claude/commands
echo "Analyze this code for performance issues and suggest optimizations:" \
  > .claude/commands/optimize.md
```

> [!TIP]
> **Next level:** custom slash commands and Skills are the same thing. Head to [Claude Skills](#claude-skills) for the deep dive: built-in skills, the Agent Skill in this repo, and how to write your own.

---

<sub>From the previous edition of [Claude Code: Everything You Need to Know](../../README.md).</sub>
