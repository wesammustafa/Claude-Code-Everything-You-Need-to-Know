# Claude Skills — The Complete Guide

> [!NOTE]
> From the previous edition, not yet re-verified. The guide is being rebuilt as lessons; this page keeps the earlier material reachable until they land.

*~30 min read · [← Back to README](../README.md#claude-skills)*

> **Mental model:** Skills package a workflow into a markdown file Claude can run. Two flavors — officially one system now: *slash skills* you invoke with `/name`, and *Agent Skills* Claude reaches for automatically when their description matches the task. `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md` both create `/deploy`.

> ⚠️ **Security:** Skills are executable instructions running with your shell permissions. Only install skills from trusted sources, and read the file before adding it to your project — exactly like reviewing a shell script before sourcing it.

![Skill resolution: typing /name or Claude matching a description both enter one lookup order: user ~/.claude/, then project .claude/, then plugins (namespaced as /plugin:name), then built-in, first match wins. Both .claude/commands/name.md and .claude/skills/name/SKILL.md create the same /name command.](../Images/skill-resolution.svg)

<a id="where-claude-looks"></a>

### Where Claude looks for `/name`

First match wins:

| # | Location | Scope |
|---|---|---|
| 1 | `~/.claude/commands/…` or `~/.claude/skills/…` | User: all your projects |
| 2 | `.claude/commands/name.md` or `.claude/skills/name/SKILL.md` | Project: same-named skills in nested `.claude/skills/` folders both stay available, the nested one under a path-qualified name such as `/apps/web:name` |
| 3 | Plugin-provided skills | Namespaced as `/plugin:name`, so on a name clash both load |
| 4 | Built-in skills | Shipped with Claude Code |

User beats project, enterprise skills beat both, and a skill beats a same-named file in `.claude/commands/`. Your skill replaces a same-named bundled skill (or, in a local terminal session, a built-in command), but not its aliases ([official rules](https://code.claude.com/docs/en/skills#resolve-skills-that-share-a-name)).

## Two flavors of skills

| | Slash skills *(custom slash commands)* | Agent Skills |
|---|---|---|
| **File path** | `.claude/commands/<name>.md` | `.claude/skills/<name>/SKILL.md` |
| **Frontmatter** | Optional — supports the same fields | Optional, but `description` is what lets Claude auto-invoke |
| **Invocation** | User types `/<name>` | **Both** — you type `/<name>`, *and* Claude auto-invokes when the description matches |
| **Scope** | Project (`.claude/`) or user (`~/.claude/`) | Project (`.claude/skills/`) or user (`~/.claude/skills/`) |
| **Loading** | Loaded on `/` autocomplete | Metadata pre-loaded; full content read on demand (progressive disclosure) |
| **Extras** | — | A whole directory for supporting files (`scripts/`, `references/`, `assets/`) |
| **Best for** | Workflows you want to trigger explicitly | Capabilities Claude should reach for when relevant |

> 💡 **Which to write?** For new work, prefer a skill in `.claude/skills/<name>/SKILL.md`: a file in `.claude/commands/` is the older format and still works, but a skill also supports supporting files ([Skills](https://code.claude.com/docs/en/skills#where-skills-live)). Add `disable-model-invocation: true` when only you should start it, or leave it off to let Claude *decide* when the workflow applies (e.g., "if the user asks about PDFs, invoke `pdf-handler`").

Most examples in this guide are **slash skills**, the older `.claude/commands/` format, which still works. Agent Skills follow the same patterns and frontmatter, plus the `name` and `paths` fields and the `.claude/skills/<name>/SKILL.md` layout, whose folder can hold supporting files.

## Contents

- [Quickstart: your first skill in 3 minutes](#quickstart-your-first-skill-3-minutes)
- [What are Claude Skills?](#what-are-claude-skills)
- [Built-in skills vs custom skills](#built-in-skills-vs-custom-skills)
- [Skills FAQ](#skills-faq)
- [Creating custom skills](#creating-custom-skills)
- [Troubleshooting skills](#troubleshooting-skills)
- [Skills best practices](#skills-best-practices)

---

## Quickstart: your first skill (3 minutes)

The fastest path to a working skill:

```bash
# 1. Create the skills directory
mkdir -p .claude/commands

# 2. Create a simple skill file
cat > .claude/commands/analyze.md << 'EOF'
# Code Analysis

Analyze the current code for:
- Potential bugs and edge cases
- Performance optimizations
- Code quality improvements
- Security vulnerabilities

Provide specific, actionable recommendations.
EOF

# 3. Start Claude Code (if not already running)
claude

# 4. Use your new skill
# Type: /analyze
```

**That's it.** You now have a working skill. Read on for the deeper patterns.

---

<a id="what-are-skills"></a>
<a id="what-are-claude-skills"></a>

## What are Claude Skills?

Claude Skills (a.k.a. *custom slash commands*) are markdown files in `.claude/commands/` that hold structured instructions Claude Code runs on demand. Type `/skill-name` and Claude loads the file, then applies its instructions to your current context.

| Skills are… | Skills are not… |
|---|---|
| Reusable across projects and sessions | One-shot prompts that vanish after the session |
| Plain-text, version-controlled, peer-reviewable | Hidden, opaque, or model-specific |
| Single-responsibility (one workflow per file) | Catch-all "do everything" instructions |
| Discoverable — type `/` to autocomplete, or `/help` to list | Discovered through tribal knowledge |
| Context-aware — fold in your current code and files | Static prompt templates |

---

<a id="built-in-vs-custom-skills"></a>
<a id="built-in-skills-vs-custom-skills"></a>

## Built-in skills vs custom skills

**Built-in skills** (bundled with Claude Code):

| Skill | Purpose | Invocation |
|---|---|---|
| `dataviz` | Design-system guidance for charts, dashboards, and data visualizations (bundled since v2.1.198) | `/dataviz` |
| `debug` | Troubleshoot the current session and configuration | `/debug` |
| `keybindings-help` | Customize keyboard shortcuts and modify `~/.claude/keybindings.json` | `/keybindings-help` |

**Custom skill** (shipped in this repository):

| Skill | Format | What it does |
|---|---|---|
| `/claude-md-review` | **Agent Skill** | Audits a `CLAUDE.md` for vagueness, dead file paths, stale commands, and bloat, and Claude reaches for it on its own when a project's instructions look like the problem |

[`/claude-md-review`](../.claude/skills/claude-md-review/SKILL.md) lives in `.claude/skills/` and is the worked example of the [frontmatter contract](#frontmatter-reference). Read it alongside the field table below. The seven slash commands this table used to list were removed; see the [CHANGELOG](../CHANGELOG.md#removed-live-config).

---

<a id="available-skills-reference"></a><a id="-workflow--process"></a><a id="-quality--review"></a><a id="-persona--methodology"></a><a id="-task-management"></a><a id="using-skills-in-workflow"></a><a id="using-skills-in-your-workflow"></a><a id="recipe-1-complete-feature-development"></a><a id="recipe-2-bug-investigation--resolution"></a><a id="recipe-3-ux-focused-development"></a>This repo's skills catalog and workflow recipes were removed with the slash commands they described; see the [CHANGELOG](../CHANGELOG.md#removed-live-config).

---

<a id="skills-faq"></a>

## Skills FAQ

**Q: What's the difference between "skills" and "custom slash commands"?**

In this guide, "slash skills" and "custom slash commands" are interchangeable — both are markdown files in `.claude/commands/` invoked with `/skill-name`. The broader community also uses "skills" to mean Agent Skills (a separate, model-invoked format with YAML frontmatter at `.claude/skills/<name>/SKILL.md`). See [Two flavors of skills](#two-flavors-of-skills) at the top of this guide for the comparison.

**Q: Are skills safe to use from third-party repositories?**

Treat skills like executable code — review them before running. Skills can:

- Read and modify files in your project
- Execute commands via Claude Code
- Access your GitHub/API credentials if configured

Always review `.claude/commands/` files from cloned repositories before invoking skills.

**Q: How do I know if a skill is working correctly?**

1. Check skill autocomplete: type `/` and your skill name should appear
2. Test with simple input: invoke the skill with basic arguments
3. Review Claude's response: skill instructions should be reflected in output
4. Check for errors: run `claude --debug` to see detailed execution logs

**Q: Can I modify built-in skills?**

No. Built-in skills (`/dataviz`, `/debug`, `/keybindings-help`, …) ship with Claude Code and cannot be modified directly. You can create your own custom skill with a similar name for custom behavior: your skill replaces a same-named bundled skill (or, in a local terminal session, a built-in command), but not its aliases.

**Q: How do I share skills with my team?**

1. Create skills in `.claude/commands/` (project directory)
2. Commit skill files to version control: `git add .claude/commands/`
3. Document skills in your project README
4. Team members get skills automatically when they clone the repo

**Q: Do skills work offline?**

Yes. Skills are local markdown files read by Claude Code. No network connection is required to invoke skills, though the AI model execution requires internet access.

**Q: What happens if I have two skills with the same name?**

Personal skills (`~/.claude/skills/`) take precedence over project skills (`.claude/skills/`). The personal skill executes.

**Q: Can skills accept arguments?**

Yes. Type arguments after the skill name:

```bash
/todo add "Fix navigation bug"
/review https://github.com/user/repo/pull/123
```

Claude automatically sees your arguments as context — no special syntax needed.

**Q: How long do skill workflows typically take?**

- Simple skills (5–20 lines): 10–30 seconds
- Medium skills (20–100 lines): 1–3 minutes
- Complex skills like `/tdd`: 5–15 minutes depending on implementation size

**Q: Can I cancel a running skill midway?**

Press `Ctrl+C` to interrupt Claude Code. Some changes may be partially applied; review with `git status` and revert with `git checkout -- <file>` if needed.

**Q: Can I run skills in parallel?**

No — skills execute sequentially within a single Claude Code session. For parallel work, open multiple terminals with separate Claude Code sessions.

---

<a id="creating-custom-skills"></a>

## Creating custom skills

> ⚠️ **Security note:** When creating global skills (`~/.claude/commands/`), they execute in **all** your projects. Only add skills you trust completely. For team projects, use project-specific skills (`.claude/commands/`) and commit them to version control for review.

### Skill file requirements

**File format:**

- **Extension:** Must be `.md` (markdown files only)
- **Encoding:** UTF-8 (required; UTF-16 not supported)
- **Line endings:** Both LF (Unix) and CRLF (Windows) supported
- **File size:** Recommended max 50KB per skill (larger files may cause performance issues)
- **Naming:** Lowercase with hyphens (e.g., `my-skill.md` → `/my-skill`)

**File system:**

- **Symlinks:** Supported (`.claude/commands/` can contain symlinks to skill files)
- **Permissions:** Files must be readable by your user account
- **Location:** Must be in `.claude/commands/` (project) or `~/.claude/commands/` (global)

**Execution context:**

- **Git:** None required — skills work in any directory (git or non-git)
- **Network:** None required — skills execute locally without network access
- **Offline support:** ✅ Full support — skills are read from local files

### Step-by-step: building your first skill

**1. Create the skill file**

```bash
# Project-specific skill (recommended for team projects)
mkdir -p .claude/commands
touch .claude/commands/my-skill.md

# Global skill (available in all projects — use with caution)
mkdir -p ~/.claude/commands
touch ~/.claude/commands/my-skill.md
```

> 💡 Always use project-specific skills (`.claude/commands/`) for team workflows — team members can review changes through version control.

**2. Define the skill structure**

Skills use markdown with structured sections:

```markdown
# Skill Name

Brief description of what this skill does.

## Behavior
- Bullet list of what Claude should do
- Specific actions to take
- Expected outcomes

## Guidelines (optional)
- Best practices to follow
- Constraints or requirements
- Formatting rules

## Examples (optional)
### Example 1: Use case description
[Show example input/output or workflow]
```

**3. Example: simple skill**

A small root-cause skill, saved as `.claude/commands/five.md`:

```markdown
# Five Whys Analysis

Apply the Five Whys root cause analysis technique to investigate issues.

## Steps
1. Start with the problem statement
2. Ask "Why did this happen?" and document the answer
3. For each answer, ask "Why?" again
4. Continue for at least 5 iterations or until root cause is found
5. Validate the root cause by working backwards
6. Propose solutions that address the root cause

## Notes
- Don't stop at symptoms; keep digging for systemic issues
- Multiple root causes may exist — explore different branches
```

> 💡 Copy this to `.claude/commands/five.md`, then start a new session to use it as `/five`.

**4. Example: complex skill (complete file)**

A complete skill file, saved as `.claude/commands/pr.md` in your project:

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

**5. Skill scope: project vs global**

| Location | Scope | Use case |
|---|---|---|
| `.claude/commands/` | Project-specific | Team workflows, project conventions, domain-specific tasks |
| `~/.claude/commands/` | Global (all projects) | Personal preferences, universal patterns, cross-project utilities |

**6. Test your skill**

```bash
# Start Claude Code in your project
claude

# Invoke your skill
/my-skill

# Observe Claude's behavior and iterate on the skill file
```

> 💡 **Creation tips:**
> - **Start simple** — A 10-line skill is better than none.
> - **Be specific** — Vague instructions yield vague results.
> - **Use examples** — Show Claude what good output looks like.
> - **Iterate** — Skills improve with use; refine based on results.
> - **Version control** — Commit skills to `.claude/commands/` for team sharing.

---

<a id="troubleshooting-skills"></a>

## Troubleshooting skills

### Common issues

**1. `/skill-name` not recognized**
- **Cause:** Skill file doesn't exist or wrong location
- **Solution:** Verify file exists in `.claude/commands/skill-name.md`

**2. Skill not executing**
- **Cause:** File permissions issue
- **Solution:** Run `chmod +r .claude/commands/skill-name.md`

**3. Wrong skill executes**
- **Cause:** Name collision between project and global skills
- **Solution:** Personal skills (`~/.claude/skills/`) take precedence over project skills (`.claude/skills/`)

**4. Skill content ignored**
- **Cause:** Markdown formatting errors
- **Solution:** Validate markdown syntax, ensure proper heading levels

**5. Unexpected behavior**
- **Cause:** Skill instructions unclear
- **Solution:** Make instructions more explicit and specific

**6. Changes not reflected**
- **Cause:** Old session cache
- **Solution:** Restart Claude Code session to reload skill files

### Debugging tips

1. **Test in isolation** — Create a minimal test skill to verify the system works
2. **Check file paths** — Use absolute paths: `ls -la .claude/commands/` to verify files exist
3. **Review logs** — Run `claude --debug` to see detailed execution logs
4. **Validate markdown** — Use a markdown validator to check file syntax
5. **Start fresh** — Close and restart Claude Code session after creating/modifying skills

### Error messages

- **"Command not found"** — Skill file doesn't exist at expected path
- **"Permission denied"** — Skill file not readable; check permissions
- **No error but skill doesn't work** — Instructions may be too vague; add specific steps

### Version requirements

- **No special installation needed** — skills work out of the box with any current Claude Code installation.
- **One system** — custom slash commands and Agent Skills are unified: `.claude/commands/<name>.md` ≡ `.claude/skills/<name>/SKILL.md`.
- **Open standard** — skills follow the [agentskills.io](https://agentskills.io) specification (released Dec 18, 2025), adopted by ~40 products including OpenAI Codex, GitHub Copilot, Cursor, and Gemini CLI.
- **Plans** — available on Pro, Max, Team/Enterprise, and usage-based API billing (Claude Code isn't included in the Free plan).
- **All models supported** — works across the current model lineup.

### Edge cases & gotchas

| Scenario | Behavior |
|---|---|
| Wrong extension (not `.md`) | ❌ Not loaded — only `.md` files become skills |
| UTF-16 encoded file | ❌ May fail — re-save as UTF-8 |
| Skill file > 100KB | ⚠️ Slow — split into smaller composable skills |
| Symlinks in `.claude/commands/` | ✅ Supported |
| Non-git directory | ✅ Works — skills don't require git |
| Offline use | ✅ Works — skills are local files |
| Windows CRLF line endings | ✅ Supported |

---

<a id="skills-best-practices"></a>

## Skills best practices

### ✅ Do

1. **Give skills descriptive names** — Use kebab-case: `create-api-endpoint.md`, not `command.md`
2. **Focus on one workflow** — Split complex processes into composable skills
3. **Include examples** — Show expected input/output patterns
4. **Document arguments** — Skills can accept arguments passed after the slash command
5. **Test with edge cases** — Invoke skills with missing/invalid inputs
6. **Share with your team** — Commit to `.claude/commands/` and document in README
7. **Use structured sections** — Behavior, Guidelines, Examples, Notes
8. **Leverage existing skills** — Reference other skills in workflows (e.g., "Run `/test` after implementation")

### Passing arguments to skills

```bash
# Single argument
/todo add "Fix navigation bug"

# Multiple words (use quotes)
/review https://github.com/user/repo/pull/123

# URL or file path
/analyze src/components/Button.tsx
```

**Accessing arguments in skills:** Arguments are automatically available to Claude as context. In your skill file, reference them naturally:

```markdown
# Code Review Skill

Analyze the code at the provided file path or URL.

## Steps
1. Read the provided argument (file path or URL)
2. Perform code review...
```

> **Note:** `$ARGUMENTS` is a supported placeholder in custom commands and skills, for example `**PR Link/Number**: $ARGUMENTS`. Plain trailing text after the command also works: Claude sees whatever you type after `/skill-name` as part of the request context. See [Pass arguments to skills](https://code.claude.com/docs/en/skills#pass-arguments-to-skills).

### ❌ Don't

1. **Overload skills** — A skill doing 10 things is 10 skills in disguise
2. **Use ambiguous language** — "Make it better" → "Refactor for readability: extract functions >20 lines"
3. **Duplicate built-in commands** — Check existing commands first with `/help`
4. **Forget to test** — Always run skills in real scenarios before sharing
5. **Ignore naming conventions** — Consistent naming improves discoverability
6. **Hardcode project paths** — Use relative paths or variables
7. **Skip documentation** — Future you (and teammates) will need context
8. **Run untrusted skills** — Always review third-party skills before executing them
9. **Grant excessive permissions** — Skills should request only the minimum permissions needed

### Advanced patterns

**Skill composition** — Reference other skills within a skill:

```markdown
## Workflow
1. Run `/five` to identify root cause
2. Create feature branch
3. Implement fix using `/tdd`
4. Submit with `/pr`
```

**⚠️ Circular reference prevention:** Skills can reference other skills in their workflows, but be cautious:

- **Avoid circular calls:** Don't create skill A that calls skill B that calls skill A
- **No automatic chaining:** Each `/skill-name` must be invoked manually; skills don't auto-execute other skills
- **Claude interprets references:** When a skill says "Run `/test`", Claude sees this as an instruction, not automatic execution
- **Manual workflow:** Users still need to type each skill command themselves

**Conditional logic** — Guide Claude's decision-making:

```markdown
## Behavior
- If tests exist: Run tests first
- If no tests: Create tests following `/test` guidelines
- If tests fail: Fix code, do not modify tests
```

**Subagent coordination** — Delegate complex tasks:

```markdown
## Implementation
1. Spawn 4 subagents (Task tool) for parallel work:
   - Agent 1: Generate test cases
   - Agent 2: Implement core logic
   - Agent 3: Create documentation
   - Agent 4: Review security implications
2. Integrate results into cohesive implementation
```

### Performance considerations

| Complexity | Token usage | Response time | Best for |
|---|---|---|---|
| Simple (5–20 lines) | Lower | Faster | Single-step tasks, checklists |
| Medium (20–100 lines) | Moderate | Moderate | Multi-step workflows, personas |
| Complex (100+ lines) | Higher | Slower | Comprehensive reviews, TDD cycles |

> **Note:** Actual performance varies based on skill content, model selection, server load, and network conditions. Token counts and response times are approximate guidelines only.

> 🎯 **Optimization tips:**
> - **Use subagents** for parallelizable work within complex skills.
> - **Split mega-skills** into smaller, composable units.
> - **Cache common patterns** as skills instead of re-prompting.
> - **Use Fast Mode** (see [Fast Mode](../README.md#fast-mode)) when latency matters in skill-heavy workflows.
> - **Stack skills** — `/skill-a /skill-b …` invocations run in sequence (v2.1.199+).

---

<a id="the-skills-ecosystem"></a><a id="official-anthropic-resources"></a><a id="marketplaces--registries"></a><a id="curated-awesome-lists"></a><a id="notable-community-skills-by-category"></a><a id="engineering--development"></a><a id="quality-review--debugging"></a><a id="skill--tool-development"></a><a id="-skill-installer"></a><a id="reasoning--process"></a><a id="research--business"></a><a id="memory-context--ops"></a><a id="workflow--collaboration"></a><a id="output-formats--creative"></a><a id="installing-a-community-skill"></a>Removed: third-party skill registries, curated lists and community skill names that no lesson uses. To find more skills, start with Anthropic's [plugin marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces). See the [CHANGELOG](../CHANGELOG.md#removed-listings).

<a id="frontmatter-reference"></a>

### Frontmatter reference

**Every field is optional.** Only `description` is *recommended*: it's how Claude decides when to apply the skill. Without it, Claude Code uses the first non-empty line of the body instead ([Skills](https://code.claude.com/docs/en/skills#frontmatter-reference)).

```yaml
---
description: Use when the user asks for X, Y, or Z. Adds A and B.
allowed-tools: Read, Grep
---

# Skill body — same structured prompt you'd put in a slash skill
```

The fields worth knowing:

| Field | What it does |
|---|---|
| `description` | What the skill does **and when to use it**. Put the key use case first — `description` + `when_to_use` is truncated at **1,536 characters** in the skill listing |
| `when_to_use` | Extra trigger phrases and example requests; appended to `description`, counts toward the same cap |
| `disable-model-invocation` | `true` = only *you* can invoke it. Use for anything with side effects (`/deploy`, `/commit`) — you don't want Claude deciding your code looks ready to ship |
| `user-invocable` | `false` = hide from the `/` menu. For background knowledge users shouldn't trigger directly |
| `allowed-tools` | **Pre-approves** tools for the invoking turn — see the warning below |
| `disallowed-tools` | Removes tools from Claude's pool while the skill is active. *This* is the restricting field |
| `paths` | Globs that limit auto-activation to matching files — e.g. only load a Terraform skill when touching `**/*.tf` |
| `model` / `effort` | Override model or [effort level](reference/effort-levels.md) while the skill is active; reverts on your next prompt |
| `context: fork` | Run the skill in its own subagent context (pair with `agent:` to pick the type, `background: false` to wait for the result) |
| `argument-hint` / `arguments` | Autocomplete hint, and named positional args for `$name` substitution in the body |
| `hooks` | Hooks scoped to this skill's lifecycle |

> ⚠️ **`allowed-tools` grants, it does not restrict.** It lets Claude use the listed tools **without asking you** during the turn that invokes the skill. Every other tool stays callable under your normal permission settings — this field never sandboxes anything. To actually remove tools, use `disallowed-tools`.
>
> For project skills in `.claude/skills/`, `allowed-tools` takes effect once you accept the workspace trust dialog. **A skill can grant itself broad tool access, so read project skills before trusting a repository.**

> ⚠️ **`name` and the directory name both work.** In a project or personal skill, frontmatter `name` sets the command the `/` menu shows and that you type (unless another command already uses that name), and the **directory name** also invokes the skill: `.claude/skills/deploy-staging/SKILL.md` with `name: deploy` runs as `/deploy` or `/deploy-staging`. In *plugin* skills, `name` sets the last command segment after the plugin prefix ([skills docs](https://code.claude.com/docs/en/skills)).

> ℹ️ Skill content is loaded **once** — the rendered `SKILL.md` enters the conversation as a single message and stays for the session. Claude does not re-read the file on later turns, so write standing instructions rather than one-time steps. The `allowed-tools` grant, by contrast, clears on your next message.

---

[← Back to README](../README.md#claude-skills) · [Hooks](../README.md#hooks) · [MCP](../README.md#model-context-protocol-mcp)
