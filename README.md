# Claude-Code-Everything-You-Need-to-Know
The ultimate all-in-one guide to mastering Claude Code. From setup, prompt engineering, commands, hooks, workflows, automation, and integrations, to MCP servers, tools, and the BMAD method—packed with step-by-step tutorials, real-world examples, and expert strategies to make this the global go-to repo for Claude mastery.

> **⚠️ IMPORTANT NOTE**  
> To get the best visualization for the documents in this repo, please install [Obsidian](https://obsidian.md/).

### 🧵 What We Covered:

**Fundamentals:**
- [What are LLMs, and how do they differ from AI tools like Claude Code? Why should we use AI tools?](#what-are-llms-and-how-do-they-differ-from-ai-tools-like-claude-code)
- [What is Claude Code?](#what-is-claude-code)
- [Claude Code Setup: Get up and running seamlessly with a clean, optimized installation.](#claude-code-setup)

**Core Features:**
- [Prompt Engineering Deep Dive](#prompt-engineering-deep-dive)
- [Claude Commands Mastery: Extract the best possible results by leveraging Claude's command capabilities to their fullest.](#claude-commands)
- [Claude Skills: Transform complex workflows into reusable slash commands](#claude-skills)
- [AI Agents: Harness agents, sub-agents, and `worktrees` to structure intelligence with precision.](#ai-agents)
- [Hooks That Work: Discover the power of Claude Hooks and learn how to implement them for maximum impact.](#hooks)
- [What are MCP servers and how to use them?](#model-context-protocol-mcp)

**2026 Updates:**
- [**Claude Opus 4.6**: The most capable model with 1M context window (API), adaptive thinking, and 128K output](#claude-opus-46-the-latest-powerhouse)
- [**Fast Mode**: 2.5x faster responses for rapid development (toggle with `/fast`)](#fast-mode-)
- [**Agent Teams**: Multi-agent collaboration for complex projects (experimental)](#agent-teams-experimental---2026)
- [**MCP Registry**: Live registry at https://registry.modelcontextprotocol.io/ with searchable server catalog](#mcp-ecosystem-updates-2026)
- [**New Commands**: `/fast`, `/auth`, `/debug`, `/teleport`, `/rename`, `/hooks`](#built-in-slash-commands)
- [**Enhanced Pricing**: Pro plan ($20/mo) now includes ALL models (Opus 4.6, Sonnet 4.5, Haiku 4.5)](#faq)

**Advanced Topics:**
- [Software Development Life Cycle (SDLC)](#sdlc)
- [Workflow Design: Build fully customized, high-performance workflows tailored to your project goals.](#1-explore--plan--code--commit)
- [Hands-On Demo: Full App Development Through the SDLC, Step by Step!](#sdlc)
- [Super Claude: Unlock advanced capabilities and push beyond standard limits.](#super-claude-framework)
- [The BMAD Method: Apply a proven, systematic approach to deliver consistent, high-quality outcomes.](#the-bmad-method--ai-agent-framework)

### What are LLMs, and how do they differ from AI tools like Claude Code?

**LLM (Large Language Model):**
- This is the underlying AI technology/engine
- Think of it like a car engine - it's the core component that makes everything work
- Examples: GPT-4, Claude 4.5/4.6 (Opus 4.6, Sonnet 4.5, Haiku 4.5), Gemini (the actual AI models)

**Products built with LLMs:** These are the applications and tools that use LLMs to provide specific services:

**Claude Code:**
- A command-line tool that uses Claude's LLM
- Specifically designed for developers to code from their terminal
- It's like putting the Claude engine into a developer-focused interface

**ChatGPT:**
- A web/app interface that uses GPT models
- Designed for general conversations and tasks

**Google Bard/Gemini:**
- Google's chat interface that uses their Gemini LLM
- Note: "Gemini" refers both to Google's LLM and their chat product

**Analogy:**
- **LLM** = Car engine
- **Claude Code** = A pickup truck (built for specific work)
- **ChatGPT** = A family sedan (built for general use)
- **Google Bard** = A racing car
The LLM is the "brain" that understands and generates language, while products like Claude Code are specialized interfaces that make that brain accessible for particular use cases.
---
### What is Claude Code?
Claude Code is a command-line tool that lets developers work with Claude directly from their terminal or command prompt. Think of it as having an AI coding assistant that lives right in your development environment.

Here's what makes it useful in simple terms:

**What it does:**

- You can ask Claude to write code, fix bugs, or explain programming concepts without leaving your terminal
- It can read and work with files in your project directory
- You can delegate entire coding tasks to Claude and it will work through them step-by-step

**Why developers like it:**

- No need to copy-paste code back and forth between a web browser and your code editor
- Claude can see your actual project files and understand the context of what you're working on
- It fits naturally into existing development workflows
- You can automate repetitive coding tasks

**Example use cases:**

- "Claude, add error handling to this function"
- "Write unit tests for my new feature"
- "Help me refactor this messy code"
- "Explain what this legacy code does"
It's essentially like having a very pair programming partner who can jump in and help with coding tasks whenever you need it.

---

### Claude Opus 4.6: The Latest Powerhouse

**Claude Opus 4.6** is the most capable model in the Claude family (as of February 2026), offering advanced reasoning and coding capabilities.

#### Key Specifications

| Feature | Specification |
|---------|--------------|
| **Model ID** | `claude-opus-4-6` |
| **Context Window** | 200K tokens (1M beta via API) |
| **Max Output** | 128K tokens |
| **Availability** | Pro, Max, and API plans |
| **Fast Mode** | ✅ Yes (2.5x faster, 6x pricing) |

#### Advanced Capabilities

**1. Extended Context Window**
- Standard: 200K tokens (available to all Pro/Max subscribers)
- Beta: 1M tokens (API only, not in subscriptions at launch)
- Best for: Analyzing entire large codebases, extensive documentation

**2. Adaptive Thinking**
- Dynamic reasoning based on task complexity
- Automatically scales computational effort
- Better problem-solving for complex coding challenges

**3. Agent Teams (Experimental)**
- Multi-agent collaboration within single session
- Team leads coordinate multiple specialist agents
- Enable with: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

**4. Top Performance**
- Leading scores on Terminal-Bench 2.0
- Superior code generation and debugging
- Enhanced context understanding

#### When to Use Opus 4.6

**✅ Best For:**
- Complex architectural decisions
- Large-scale refactoring
- Debugging intricate issues
- Multi-file analysis
- Production-critical code

**💡 Consider Sonnet 4.5 or Haiku 4.5 for:**
- Simple code changes
- Documentation updates
- Quick questions
- Budget-conscious projects

#### Pricing & Access

**Subscription Plans:**
- Pro ($20/mo): Full access to Opus 4.6
- Max 5x ($100/mo): 5x usage capacity
- Max 20x ($200/mo): 20x usage capacity

**API Pricing:**
- Standard: $5 input / $25 output per MTok
- Fast Mode: $30 input / $150 output per MTok (6x)

**Special Offers:**
- New Pro subscribers: $50 in free API credits
- Fast Mode: 50% discount until Feb 16, 2026 11:59pm PT

---
### Claude Code Setup

[![Anthropic](Images/Anthropic.png)](https://www.anthropic.com)

[![Claude Installation](Images/claude-installation.png)](https://docs.anthropic.com/en/docs/claude-code/overview)

---
### Prompt Engineering Deep Dive
> **📖 Claude Initialization**
> Run the `/init` command to automatically generate a `CLAUDE.md` file.
> Your `CLAUDE.md` files become part of Claude's prompts, so they should be refined like any frequently used prompt. A common mistake is adding extensive content without iterating on its effectiveness. Take time to experiment and determine what produces the best instruction following from the model.
#### 1. Explore → Plan → Code → Commit
> Versatile workflow for complex problems.

- **Explore:** Read relevant files/images/URLs; use subagents for verification. Do **not code yet**.  
- **Plan:** Ask Claude to make a plan. Use `"think"`, `"think hard"`, `"think harder"`, or `"ultrathink"` to increase computation time. Optionally save plan for future reference.  
- **Code:** Implement the solution; verify reasonableness as you go.  
- **Commit:** Commit results, create pull requests, update READMEs/changelogs.
- Claude has two default modes: `Plan Mode` and `Accept Edits Mode`. You can toggle between them using the `Shift + Tab` keys.
    - ![Plan Mode](Images/plan-mode.png)
    - ![Accept Edit Mode](Images/accept-edit-mode.png)

> **⚠️ Warning:** Research & planning first improves performance for complex tasks.

---

#### 2. Test-Driven Workflow (Write Tests → Code → Commit)
> Ideal for changes verifiable with unit/integration tests.

- **Write Tests:** Create tests based on expected inputs/outputs; mark as TDD.  
- **Run & Fail Tests:** Confirm they fail; no implementation yet.  
- **Commit Tests:** Commit once satisfied.  
- **Write Code:** Implement code to pass tests; iterate with verification via subagents.  
- **Commit Code:** Final commit after all tests pass.

> 🔹 Clear targets (tests, mocks) improve iteration efficiency.

---
#### 3. Visual Iteration (Code → Screenshot → Iterate → Commit)
- Provide screenshots or visual mocks.  
- Implement code, take screenshots, iterate until outputs match mock.  
- Commit once satisfied.

> 🔹 Iteration significantly improves output quality (2-3 rounds usually enough).

---

### Claude Commands
#### Built-in slash commands

| Command                   | Purpose                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/add-dir`                | Add additional working directories                                                                       |
| `/agents`                 | Manage custom AI subagents for specialized tasks                                                         |
| `/auth login`             | Authenticate with your Anthropic account (new Feb 2026)                                                  |
| `/auth status`            | Check authentication status (new Feb 2026)                                                               |
| `/auth logout`            | Sign out from your account (new Feb 2026)                                                                |
| `/bug`                    | Report bugs (sends conversation to Anthropic)                                                            |
| `/clear`                  | Clear conversation history                                                                               |
| `/compact [instructions]` | Compact conversation with optional focus instructions                                                    |
| `/config`                 | View/modify configuration                                                                                |
| `/cost`                   | Show token usage statistics                                                                              |
| `/debug`                  | Troubleshoot current session and configuration (new Feb 2026)                                            |
| `/doctor`                 | Checks the health of your Claude Code installation                                                       |
| `/fast`                   | Toggle Fast Mode for 2.5x faster Opus 4.6 responses (6x pricing) (new Feb 2026)                          |
| `/help`                   | Get usage help                                                                                           |
| `/hooks`                  | Interactive menu for hook configuration (new Feb 2026)                                                   |
| `/init`                   | Initialize project with CLAUDE.md guide                                                                  |
| `/login`                  | Switch Anthropic accounts (use `/auth login` instead)                                                    |
| `/logout`                 | Sign out from your Anthropic account (use `/auth logout` instead)                                        |
| `/mcp`                    | Manage MCP server connections and OAuth authentication                                                   |
| `/memory`                 | Edit CLAUDE.md memory files                                                                              |
| `/model`                  | Select or change the AI model (Opus 4.6, Sonnet 4.5, Haiku 4.5)                                          |
| `/permissions`            | View or update [permissions](https://docs.anthropic.com/en/docs/claude-code/iam#configuring-permissions) |
| `/pr_comments`            | View pull request comments                                                                               |
| `/rename`                 | Auto-generate descriptive session names (new Feb 2026)                                                   |
| `/review`                 | Request code review                                                                                      |
| `/status`                 | View account and system statuses                                                                         |
| `/teleport`               | Send current session to claude.ai/code for web access (new Feb 2026)                                     |
| `/terminal-setup`         | Install Shift+Enter key binding for newlines (built-in since 2026, zero setup needed)                    |
| `/vim`                    | Enter vim mode for alternating insert and command modes                                                  |

#### Custom slash commands
> **📖 Note:** Custom slash commands allow you to define frequently-used prompts as Markdown files that Claude Code can execute. Commands are organized by scope (project-specific or personal) and support namespacing through directory structures.

```bash
mkdir -p .claude/commands
echo "Analyze this code for performance issues and suggest optimizations:" > .claude/commands/optimize.md
```

**Example**
- Create new file named `pull-request.md` in `.claude/commands`
- Add the following info to file
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

> **💡 Next Level:** This is a basic custom slash command. For more sophisticated workflows, check out [Claude Skills](#claude-skills) to learn how to build reusable, team-wide skills with advanced patterns.

---

<a id="claude-skills"></a>
### Claude Skills

> **📖 Extensibility Layer:** Claude Skills transform complex, multi-step workflows into reusable slash commands. Think of them as "macros for AI" — instead of repeating the same detailed instructions, encapsulate them once and invoke them with a simple `/skill-name` command.

> **⚠️ IMPORTANT TERMINOLOGY:** **"Skills"** and **"custom slash commands"** are the same thing. This documentation uses "skills" as the primary term, but you may see both used interchangeably. They both refer to markdown files in `.claude/commands/` that you invoke with `/skill-name`.

> **🚨 SECURITY WARNING:** Skills execute with full access to your codebase and can run arbitrary commands. Only use skills from trusted sources. Review all third-party skills before adding them to your project. Skills from untrusted repositories can access files, execute commands, and potentially compromise your system.

![Skills Workflow](Images/skill-workflow.png)

#### Quickstart: Your First Skill (3 minutes)

Want to try skills immediately? Here's the fastest path:

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

**That's it!** You now have a working skill. Continue reading to learn how to create more sophisticated workflows.

---

<a id="what-are-skills"></a>
#### What Are Claude Skills?

**Claude Skills** (also called "custom slash commands") are markdown files stored in `.claude/commands/` that contain structured instructions for Claude Code to execute. When you type `/skill-name`, Claude loads the corresponding markdown file and applies its instructions to your current context.

**Key Characteristics:**

1. **Single Responsibility** — Each skill focuses on one workflow (e.g., PR creation, code review, TDD)
2. **Reusable** — Define once, invoke repeatedly across projects and sessions
3. **Markdown-Based** — Simple text files, easy to read, write, and version control
4. **Customizable** — Modify existing skills or create new ones to match your team's processes
5. **Context-Aware** — Skills combine their instructions with your current code, files, and conversation

> **📖 Quick Links:** [Built-in vs Custom Skills](#built-in-vs-custom-skills) | [Creating Skills](#creating-custom-skills) | [Troubleshooting](#troubleshooting-skills) | [FAQ](#skills-faq)

**Skills vs Regular Prompts:**

> **📱 Mobile Users:** View this comparison in landscape mode or on desktop for best readability.

| Aspect | Regular Prompts | Claude Skills |
|--------|----------------|---------------|
| **Definition** | Ad-hoc instructions typed each time | Reusable markdown files in `.claude/commands/` |
| **Reusability** | Manual copy-paste required | Instant invocation with `/skill-name` |
| **Complexity** | Limited by chat input | Multi-step workflows with detailed checklists |
| **Sharing** | Share via text/screenshots | Share via files in version control |
| **Evolution** | Lost after session ends | Iteratively improved and committed to repo |
| **Discoverability** | None | Auto-listed in Claude Code's skill registry |

> **💡 Accessing the Skill Registry:** Skills are discovered automatically when you start Claude Code. To see available skills, start typing `/` in Claude Code and you'll see an autocomplete list of all available skills (both built-in and custom). You can also use `/help` to view all commands, which includes skills.

<a id="built-in-vs-custom-skills"></a>
#### Built-in Skills vs Custom Skills

**Built-in Skills** (shipped with Claude Code):

| Skill | Purpose | Invocation |
|-------|---------|------------|
| `keybindings-help` | Customize keyboard shortcuts and modify `~/.claude/keybindings.json` | `/keybindings-help` |
| `mermaid` | Create entity relationship diagrams and flowcharts | `/mermaid` |

**Custom Skills** (in this repository's `.claude/commands/`):

**Quick Reference:**

| Skill | Category + Complexity |
|-------|---------------------|
| `/pr` | Workflow (High) |
| `/review` | Quality (High) |
| `/test` | Quality (Medium) |
| `/tdd` | Workflow (High) |
| `/five` | Persona (Low) |
| `/ux` | Persona (Medium) |
| `/todo` | Task (Low) |

**Detailed Purpose:**

| Skill | What It Does |
|-------|--------------|
| `/pr` | Automated pull request creation with branch management and commit splitting |
| `/review` | Multi-perspective code review (PM, Dev, QA, Security, DevOps, UX) |
| `/test` | Unit testing best practices checklist for LLM-driven test generation |
| `/tdd` | Complete test-driven development workflow with Red-Green-Refactor cycle |
| `/five` | Five Whys root cause analysis for debugging and problem-solving |
| `/ux` | User experience designer persona for empathetic, user-centric design |
| `/todo` | Task management in `todos.md` with due dates and completion tracking |

> **💡 Pro Tip:** Start with simple skills (like `/five` or `/todo`) to understand the pattern, then progress to complex workflows (like `/tdd` or `/review`).

<a id="available-skills-reference"></a>
#### Available Skills Reference

**🔹 Workflow & Process**

**`/pr` - Pull Request Creation**
- Automatically creates feature branch from current changes
- Formats code using project linter (e.g., Biome)
- Intelligently splits changes into logical, atomic commits
- Generates descriptive commit messages for each unit of work
- Pushes to remote and creates PR with summary and test plan
- **Perfect for:** Teams requiring consistent PR quality and commit hygiene

**`/tdd` - Test-Driven Development**
- Enforces strict Red-Green-Refactor cycle
- Guides through: failing test → minimal implementation → refactoring
- Maintains feature notes in `notes/features/` for long-term memory
- Ensures tests pass before commits, commits only when green
- Integrates with feature branch workflows
- **Perfect for:** Projects requiring high code quality and comprehensive test coverage

**🔹 Quality & Review**

**`/review` - Multi-Perspective Code Review**
Six-role review framework:
1. **Product Manager** — Business value, user experience, strategic alignment
2. **Developer** — Code quality, maintainability, performance, best practices
3. **QA Engineer** — Test coverage, edge cases, regression risks
4. **Security Engineer** — Vulnerabilities, data handling, compliance (OWASP, GDPR)
5. **DevOps** — CI/CD integration, infrastructure, monitoring
6. **UI/UX Designer** — Visual consistency, usability, accessibility

- Enforces "fix now, not later" philosophy for all recommendations
- Posts comprehensive review directly to GitHub PR as a comment
- **Perfect for:** Critical PRs, production releases, architecture changes
- **Note:** When run on your own PR, this will post a review comment from your account

**`/test` - Unit Testing Best Practices**
- Comprehensive checklist for writing robust unit tests
- Focuses on testing internal logic, not API endpoints
- Covers context verification, test structure, test cases, isolation, assertions
- Includes strict guidance against over-mocking and framework bindings
- Encourages spawning sub-agents for complex test flows
- **Perfect for:** Ensuring consistent, maintainable test suites

**🔹 Persona & Methodology**

**`/five` - Five Whys Root Cause Analysis**
- Systematic investigation technique drilling from symptoms to root causes
- Iteratively asks "why" to uncover fundamental issues
- Validates findings by working backwards from root cause
- Proposes solutions addressing systemic problems, not just symptoms
- Handles both technical and process-related causes
- **Perfect for:** Debugging production incidents, understanding recurring bugs

**`/ux` - User Experience Designer Persona**
Claude becomes an empathetic UX specialist:
- Conducts user research identifying needs, pain points, motivations
- Designs accessible, aesthetically pleasing interfaces
- Prioritizes user needs above all other considerations
- Creates thoughtful micro-interactions and anticipates edge cases
- Generates precise prompts for AI UI generation tools
- **Perfect for:** Design-first projects, prototyping, user-centric product development

**🔹 Task Management**

**`/todo` - Project Task Manager**
- Manages `todos.md` in project root with Active/Completed sections
- Supports due dates/times with smart sorting (due tasks prioritized)
- Commands: `add`, `complete`, `remove`, `undo`, `list`, `past due`, `next`
- Auto-numbers todos for easy reference
- Tracks completion timestamps
- **Perfect for:** Sprint planning, personal task tracking, session continuity

**`/mermaid` - Diagram Generation**
- Creates entity relationship diagrams from database schemas
- Generates flowcharts, sequence diagrams, and architecture visualizations
- Outputs valid Mermaid syntax for embedding in markdown
- **Perfect for:** Documentation, architecture discussions, onboarding

<a id="using-skills-in-workflow"></a>
#### Using Skills in Your Workflow

**Basic Invocation:**
```bash
# In Claude Code CLI
/skill-name

# With arguments (for skills that accept them)
/todo add "Fix navigation bug"
/review https://github.com/user/repo/pull/123
```

**Workflow Prerequisites:**

Before using these workflow combinations, ensure you have:
- ✅ Git repository initialized (`git init`)
- ✅ Remote repository configured (`git remote -v` shows your repo)
- ✅ Commit permissions to your repository
- ✅ GitHub authentication configured (for `/review` and `/pr` skills)
- ✅ Skills installed in `.claude/commands/` or `~/.claude/commands/`
- ✅ Current working directory is your project root

**Workflow Execution Notes:**
- Skills execute sequentially - wait for each to complete before invoking the next
- Skills do NOT auto-chain - you must type each `/skill-name` command manually
- If a skill fails, address the error before proceeding to the next step
- Use `/help` to verify skill availability before running workflows

**Example Workflow Combinations:**

**1. Complete Feature Development**
```bash
# Start with TDD workflow
/tdd
# Claude guides through Red-Green-Refactor cycle

# Ensure tests pass
/test
# Validates test coverage and quality

# Create PR with automatic commit splitting
/pr
# Creates branch, commits, and opens PR

# Conduct comprehensive review (optional - creates PR comment)
/review
```

**Common Issues:**
- **`/tdd` fails:** Ensure tests are properly written; review test syntax
- **`/test` reports failures:** Fix failing tests before proceeding to `/pr`
- **`/pr` merge conflicts:** Resolve conflicts manually, then retry
- **`/review` auth failure:** Run `gh auth login` to configure GitHub CLI
- **No Biome configured:** `/pr` assumes Biome formatter; install or modify skill

**2. Bug Investigation & Resolution**
```bash
# Identify root cause
/five
# Five Whys analysis to find systemic issues

# Implement fix using TDD
/tdd
# Write failing test, implement fix, refactor

# Verify with unit tests
/test
# Ensure all tests pass

# Submit PR
/pr
# Create and push PR
```

**Common Issues:**
- **`/five` identifies unfixable issue:** Root cause may require architecture changes
- **Bug in dependency:** Report upstream; consider workaround or fork
- **`/tdd` tests pass but bug persists:** Review test coverage; bug may be in untested code

**3. UX-Focused Development**
```bash
# Start with user-centric design
/ux
# Claude adopts UX designer persona

# Implement with tests
/test
# Build with test coverage

# Review for accessibility and usability
/review
# Multi-perspective review including UX
```

**Common Issues:**
- **`/ux` suggestions conflict with brand:** Provide brand guidelines as context
- **`/review` finds accessibility violations:** Address WCAG issues before merge
- **Performance issues with new UI:** Use browser profiling tools; optimize assets

**Workflow FAQs:**

**Q: How long do skill workflows typically take?**
- Simple skills (5-20 lines): 10-30 seconds
- Medium skills (20-100 lines): 1-3 minutes
- Complex skills like `/tdd`: 5-15 minutes depending on implementation size

**Q: Can I cancel a running skill midway?**
- Press `Ctrl+C` to interrupt Claude Code execution
- Some changes may be partially applied; review with `git status`

**Q: What if a skill modifies files I didn't expect?**
- Review changes with `git diff` before committing
- Use `git checkout -- <file>` to revert unwanted changes
- Report unexpected behavior to skill author

**Q: Can I run skills in parallel?**
- No - skills execute sequentially in a single Claude Code session
- For parallel work, open multiple terminals with separate Claude Code sessions

> **💡 Workflow Tips:**
> - **Chain skills sequentially** - Skills execute one at a time; wait for completion before invoking the next
> - **Combine with hooks** for automatic skill invocation on events (see [Hooks](#hooks) section)
> - **Use `/todo`** at session start to maintain context across interruptions
> - **Run `/review`** on your own PRs before requesting human review (note: posts as a PR comment from your account)
> - **Skills don't auto-chain** - Each `/skill` must be invoked manually; they don't automatically call other skills

<a id="skills-faq"></a>
#### Skills FAQ

**Q: What's the difference between "skills" and "custom slash commands"?**

**A:** They're the same thing. This documentation uses "skills" as the primary term, but both refer to markdown files in `.claude/commands/` that you invoke with `/skill-name`. You may see both terms used interchangeably.

**Q: Are skills safe to use from third-party repositories?**

**A:** Treat skills like executable code - review them before running. Skills can:
- Read and modify files in your project
- Execute commands via Claude Code
- Access your GitHub/API credentials if configured

Always review `.claude/commands/` files from cloned repositories before invoking skills.

**Q: How do I know if a skill is working correctly?**

**A:**
1. Check skill autocomplete: Type `/` and your skill name should appear
2. Test with simple input: Invoke the skill with basic arguments
3. Review Claude's response: Skill instructions should be reflected in output
4. Check for errors: Run `claude --debug` to see detailed execution logs

**Q: Can I modify built-in skills?**

**A:** No. Built-in skills (`/keybindings-help`, `/mermaid`) are shipped with Claude Code and cannot be modified. You can create your own custom skills with similar names (e.g., `/my-mermaid`) for custom behavior.

**Q: How do I share skills with my team?**

**A:**
1. Create skills in `.claude/commands/` (project directory)
2. Commit skill files to version control: `git add .claude/commands/`
3. Document skills in your project README
4. Team members get skills automatically when they clone the repo

**Q: Do skills work offline?**

**A:** Yes. Skills are local markdown files read by Claude Code. No network connection is required to invoke skills, though the AI model execution requires internet access.

**Q: What happens if I have two skills with the same name?**

**A:** Project skills (`.claude/commands/`) take precedence over global skills (`~/.claude/commands/`). The project-level skill will execute.

**Q: Can skills accept arguments?**

**A:** Yes. Type arguments after the skill name:
```bash
/todo add "Fix navigation bug"
/review https://github.com/user/repo/pull/123
```
Claude automatically sees your arguments as context - no special syntax needed.

<a id="creating-custom-skills"></a>
#### Creating Custom Skills

> **🚨 SECURITY NOTE:** When creating global skills (`~/.claude/commands/`), remember they will execute in ALL your projects. Only add skills you trust completely. For team projects, use project-specific skills (`.claude/commands/`) and commit them to version control for team review.

> **💡 New to Skills?** Review [What Are Claude Skills](#what-are-skills) and [Available Skills Reference](#available-skills-reference) before creating your first skill.

#### Skill File Requirements

**File Format:**
- **Extension:** Must be `.md` (markdown files only)
- **Encoding:** UTF-8 (required; UTF-16 not supported)
- **Line endings:** Both LF (Unix) and CRLF (Windows) supported
- **File size:** Recommended maximum 50KB per skill (larger files may cause performance issues)
- **Naming:** Lowercase with hyphens (e.g., `my-skill.md` → `/my-skill`)

**File System:**
- **Symlinks:** Supported (`.claude/commands/` can contain symlinks to skill files)
- **Permissions:** Files must be readable by your user account
- **Location:** Must be in `.claude/commands/` (project) or `~/.claude/commands/` (global)

**Execution Context:**
- **Git requirement:** None - skills work in any directory (git or non-git)
- **Network requirement:** None - skills execute locally without network access
- **Offline support:** ✅ Full support - skills are read from local files

**Step-by-step guide to building your first skill:**

**1. Create the skill file**
```bash
# Project-specific skill (recommended for team projects)
# The .claude/commands/ directory will be created automatically if it doesn't exist
mkdir -p .claude/commands
touch .claude/commands/my-skill.md

# Global skill (available in all projects - use with caution)
mkdir -p ~/.claude/commands
touch ~/.claude/commands/my-skill.md
```

> **💡 Tip:** Always use project-specific skills (`.claude/commands/`) for team workflows to ensure team members can review changes through version control.

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

**3. Example: Simple Skill (Complete File)**

Complete contents of `.claude/commands/five.md`:
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
- Multiple root causes may exist - explore different branches
```

> **💡 Tip:** This is a complete, working skill file. Copy this exactly to `.claude/commands/five.md` to use it immediately.

**4. Example: Complex Skill (Complete File)**

Complete contents of `.claude/commands/pr.md`:
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

> **💡 Tip:** This is a complete, working skill file. Copy this exactly to `.claude/commands/pr.md` to use it immediately.

**5. Skill Scope: Project vs Global**

| Location | Scope | Use Case |
|----------|-------|----------|
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

> **💡 Creation Tips:**
> - **Start simple** — A 10-line skill is better than none
> - **Be specific** — Vague instructions yield vague results
> - **Use examples** — Show Claude what good output looks like
> - **Iterate** — Skills improve with use; refine based on results
> - **Version control** — Commit skills to `.claude/commands/` for team sharing

<a id="troubleshooting-skills"></a>
#### Troubleshooting Skills

> **💡 Still stuck?** Check the [Skills FAQ](#skills-faq) for common questions or review [Skills Best Practices](#skills-best-practices).

**Common Issues:**

**1. `/skill-name` not recognized**
- **Cause:** Skill file doesn't exist or wrong location
- **Solution:** Verify file exists in `.claude/commands/skill-name.md`

**2. Skill not executing**
- **Cause:** File permissions issue
- **Solution:** Run `chmod +r .claude/commands/skill-name.md`

**3. Wrong skill executes**
- **Cause:** Name collision between project and global skills
- **Solution:** Project skills (`.claude/commands/`) take precedence over global (`~/.claude/commands/`)

**4. Skill content ignored**
- **Cause:** Markdown formatting errors
- **Solution:** Validate markdown syntax, ensure proper heading levels

**5. Unexpected behavior**
- **Cause:** Skill instructions unclear
- **Solution:** Make instructions more explicit and specific

**6. Changes not reflected**
- **Cause:** Old session cache
- **Solution:** Restart Claude Code session to reload skill files

**Debugging Tips:**
1. **Test in isolation** - Create a minimal test skill to verify the system works
2. **Check file paths** - Use absolute paths: `ls -la .claude/commands/` to verify files exist
3. **Review logs** - Run `claude --debug` to see detailed execution logs
4. **Validate markdown** - Use a markdown validator to check file syntax
5. **Start fresh** - Close and restart Claude Code session after creating/modifying skills

**Error Messages:**

- **"Command not found"** - Skill file doesn't exist at expected path
- **"Permission denied"** - Skill file not readable; check permissions
- **No error but skill doesn't work** - Instructions may be too vague; add specific steps

**Version Requirements:**
- **Claude Code Version**: Skills are available in Claude Code v1.0+ (released 2024)
- **No special installation needed** - Skills work out of the box with any Claude Code installation
- **All plans supported** - Available in Free, Pro, and Max plans
- **All models supported** - Works with Opus 4.6, Sonnet 4.5, and Haiku 4.5

**Edge Cases and Special Scenarios:**

| Scenario | Behavior | Notes |
|----------|----------|-------|
| **File without .md extension** | Not recognized as skill | Only `.md` files are loaded as skills |
| **Symlinked skill files** | ✅ Supported | `.claude/commands/` can contain symlinks |
| **Skill in non-git directory** | ✅ Works normally | Skills don't require git |
| **Running skills offline** | ✅ Fully supported | Skills are local files, no network needed |
| **CRLF line endings (Windows)** | ✅ Supported | Both Unix (LF) and Windows (CRLF) work |
| **UTF-16 encoded file** | ❌ May fail | Use UTF-8 encoding for compatibility |
| **Skill file > 100KB** | ⚠️ Performance impact | Keep skills focused; split large workflows |
| **Circular skill references** | ⚠️ User must break loop | Skills don't auto-execute; user types each command |

<a id="skills-best-practices"></a>
#### Skills Best Practices

**✅ Do:**

1. **Give skills descriptive names** — Use kebab-case: `create-api-endpoint.md`, not `command.md`
2. **Focus on one workflow** — Split complex processes into composable skills
3. **Include examples** — Show expected input/output patterns
4. **Document arguments** — Skills can accept arguments passed after the slash command

**Passing Arguments to Skills:**
```bash
# Single argument
/todo add "Fix navigation bug"

# Multiple words (use quotes)
/review https://github.com/user/repo/pull/123

# URL or file path
/analyze src/components/Button.tsx
```

**Accessing Arguments in Skills:**
Arguments are automatically available to Claude as context. In your skill file, reference them naturally:
```markdown
# Code Review Skill

Analyze the code at the provided file path or URL.

## Steps
1. Read the provided argument (file path or URL)
2. Perform code review...
```

**Note:** There is no special `$ARGUMENTS` variable syntax - Claude automatically sees the text you type after `/skill-name` as part of the request context.

5. **Test with edge cases** — Invoke skills with missing/invalid inputs
6. **Share with your team** — Commit to `.claude/commands/` and document in README
7. **Use structured sections** — Behavior, Guidelines, Examples, Notes
8. **Leverage existing skills** — Reference other skills in workflows (e.g., "Run `/test` after implementation")

**❌ Don't:**

1. **Overload skills** — A skill doing 10 things is 10 skills in disguise
2. **Use ambiguous language** — "Make it better" → "Refactor for readability: extract functions >20 lines"
3. **Duplicate built-in commands** — Check existing commands first with `/help`
4. **Forget to test** — Always run skills in real scenarios before sharing
5. **Ignore naming conventions** — Consistent naming improves discoverability
6. **Hardcode project paths** — Use relative paths or variables
7. **Skip documentation** — Future you (and teammates) will need context
8. **Run untrusted skills** — Always review third-party skills before executing them
9. **Grant excessive permissions** — Skills should request only the minimum permissions needed

**Advanced Patterns:**

**Skill Composition** — Reference other skills within a skill:
```markdown
## Workflow
1. Run `/five` to identify root cause
2. Create feature branch
3. Implement fix using `/tdd`
4. Submit with `/pr`
```

**⚠️ Circular Reference Prevention:**
Skills can reference other skills in their workflows, but be cautious:
- **Avoid circular calls:** Don't create skill A that calls skill B that calls skill A
- **No automatic chaining:** Each `/skill-name` must be invoked manually; skills don't auto-execute other skills
- **Claude interprets references:** When a skill says "Run `/test`", Claude sees this as an instruction, not automatic execution
- **Manual workflow:** Users still need to type each skill command themselves

**Conditional Logic** — Guide Claude's decision-making:
```markdown
## Behavior
- If tests exist: Run tests first
- If no tests: Create tests following `/test` guidelines
- If tests fail: Fix code, do not modify tests
```

**Subagent Coordination** — Delegate complex tasks:
```markdown
## Implementation
1. Spawn 4 subagents (Task tool) for parallel work:
   - Agent 1: Generate test cases
   - Agent 2: Implement core logic
   - Agent 3: Create documentation
   - Agent 4: Review security implications
2. Integrate results into cohesive implementation
```

**Performance Considerations:**

| Complexity | Token Usage | Response Time | Best For |
|------------|-------------|---------------|----------|
| Simple (5-20 lines) | Lower token usage | Faster response | Single-step tasks, checklists |
| Medium (20-100 lines) | Moderate token usage | Moderate response | Multi-step workflows, personas |
| Complex (100+ lines) | Higher token usage | Slower response | Comprehensive reviews, TDD cycles |

> **Note:** Actual performance varies based on skill content, model selection, server load, and network conditions. Token counts and response times are approximate guidelines only.

> **🎯 Optimization Tips:**
> - **Use subagents** for parallelizable work within complex skills
> - **Split mega-skills** into smaller, composable units
> - **Cache common patterns** as skills instead of re-prompting
> - **Use Fast Mode** (see [Fast Mode section](#fast-mode)) when running skill-heavy workflows for 2.5x faster responses

---

<a id="fast-mode"></a>
### Fast Mode ↯

**Fast Mode** delivers **2.5x faster responses** using Claude Opus 4.6, ideal for rapid iteration and time-sensitive development work.

#### How It Works
- Toggle on/off instantly with `/fast` command
- Only available for Opus 4.6 (not Sonnet or Haiku)
- Visual indicator: **↯** icon appears in session when active
- Same model quality, just optimized for speed

#### Pricing
Fast Mode uses **6x standard pricing**:

| Mode | Input (per MTok) | Output (per MTok) |
|------|------------------|-------------------|
| Standard Opus 4.6 | $5 | $25 |
| Fast Mode Opus 4.6 | $30 | $150 |

**Special Offer:** 50% discount on Fast Mode until Feb 16, 2026 11:59pm PT

#### When to Use Fast Mode

**✅ Best For:**
- Rapid prototyping and iteration
- Live debugging sessions  
- Time-sensitive deployments
- Quick code reviews
- Interactive pair programming
- Emergency hotfixes

**❌ Skip For:**
- Long background tasks
- Budget-conscious projects
- Non-urgent documentation work
- Batch processing
- Learning/exploration sessions

#### Usage Example
```bash
# Enable Fast Mode for rapid iteration
/fast

# Your prompts now process 2.5x faster
> Fix the authentication bug in login.ts

# Disable when you're done with urgent work
/fast
```

#### Best Practices
1. **Toggle strategically** - Turn on only when you need speed
2. **Monitor costs** - Use `/cost` to track Fast Mode usage
3. **Time-box sessions** - Use for focused sprints, not entire workdays
4. **Combine with /model** - Switch to Haiku for simple tasks to save costs

---

### AI Agents

[**Git worktree**](https://git-scm.com/docs/git-worktree)

> **📖 Git Worktree:** Worktrees allow multiple copies of the same Git repository on your local environment, each on a different branch.

- **Single repo limitation:** Normally, a Git repository can only be on one branch in one folder.  
- **Worktrees:** Enable working on multiple branches simultaneously in separate folders.  
- **Isolation:** Changes in one worktree do **not** interfere with others.
    **Example**
    - **Main repo folder:** branch `main`  
    - **Worktree folder:** branch `feature-x`  
    - You can edit both simultaneously without switching branches.

1. **Create worktrees**
    - `git worktree add -b feature-a ../feature-a`
    - Create additional worktrees as needed (repeat steps 1 in new terminal tabs)
    - Ex: Three separate terminal tabs, each linked to its own branch and worktree
    ![WorkTrees](Images/work-trees.png)
2. **Launch Claude in each worktree**
    - `cd ../feature-a && claude`
    -  Ex: three Claude code sessions to manage each branch
    ![Claude Sessions](Images/claude-sessions.png)

3. **General Agents**
   > **📖 Agent System:** Claude Code's **agent system** — a powerful feature that lets you create specialized AI assistants for different coding tasks. Think of agents as specialized team members, each with their own expertise, tools, and focus area. Instead of having one general-purpose Claude handle everything, you can create focused agents for specific roles.
   
   - Example: Each agent can span multiple sub-agents to accelerate the process:  
     ```markdown
     - Analyze the implementation of the payment feature
     - Span 5 subagents to accelerate work
     - Ultrathink
     ```
     ![Agents Prompt](Images/agents-prompt.png)

   - Subagents executing multiple tasks in parallel, coordinated through a to-do list:  
     ![Subagents](Images/Subagents.png)

4. **Specialized Agents**
    -  **Traditional approach:**
        - One Claude tries to be everything
        - Generic feedback covering all areas
        - Context gets mixed between different types of reviews
        
    -  **Agent approach:**
        - Specialized expertise for each task
        - Focused, deep feedback in specific areas
        - Clean separation of concerns
        - Each agent "remembers" previous conversations in their domain
    
    - Let's do it, step by step

    [View Agent Creation Workflow](Images/agent-creation-workflow.png)
    ![Agent Creation Workflow](Images/agent-creation-workflow.png)

    <img src="Images/Agents/agent-6.png" alt="Set Agent System Prompt" width="600" height="300">

    [Security Reviewer Prompt](specialized-agents/system-prompts/security-reviewer-prompt.md)

    <img src="Images/Agents/agent-7.png" alt="Set Agent Description" width="600" height="300">
    
    [Security Reviewer Description](specialized-agents/descriptions/security-reviewer-description.md)

5. **General Agent orchestrate collaboration between Specialized Agents**
    ```md
    Get the **backend-engineer** to suggest changes for improving the UI of our app. Then, get the **backend-engineer** to implement those changes. Then, get the **code-reviewer** to review the changes made by the **backend-engineer**. Finally, get the **backend-engineer** to fix up any issues pointed out by the reviewer.
    ```
    <img src="Images/Orchestration.png" alt="Confirm and Save Agent" width="600" height="600">

> **💡 Tip:**
> - Use consistent naming conventions for worktrees
> - Maintain one terminal tab per worktree
> - Use [`Tmux`](https://github.com/tmux/tmux/wiki/Installing) to create a session for each terminal, allowing you to **detach** and keep processes running in the background
> - Use separate IDE windows for different worktrees
> - Clean up when finished: `git worktree remove ../feature-a`

---

### Agent Teams (Experimental - 2026)

**Agent Teams** is an experimental feature that enables **multi-agent collaboration** within a single Claude Code session. Instead of one agent handling everything, you can coordinate multiple specialist agents working together on complex tasks.

#### What Are Agent Teams?

Agent Teams introduce a hierarchical structure where:
- **Team Lead**: The main agent that coordinates and delegates work
- **Teammates**: Specialist agents that handle specific subtasks
- **Shared Task List**: All agents can view and update a common to-do list
- **Parallel Execution**: Multiple agents can work simultaneously

Think of it as having a development team where:
- The lead architect makes high-level decisions
- Specialists (frontend dev, backend dev, QA tester) work on their areas
- Everyone stays synchronized through shared task tracking

#### How to Enable Agent Teams

Agent Teams is currently experimental and requires an environment variable:

```bash
# Enable Agent Teams
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

# Launch Claude Code
claude

# Agent Teams will now be available
```

**Permanent Setup (Recommended):**

Add to your shell configuration (`~/.bashrc`, `~/.zshrc`, or equivalent):

```bash
# For bash/zsh
echo 'export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1' >> ~/.zshrc
source ~/.zshrc

# Verify it's set
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS  # Should output: 1
```

#### Team Structure & Roles

**Team Lead (You/Main Agent):**
- Creates and assigns tasks
- Monitors overall progress
- Makes architectural decisions
- Coordinates between teammates
- Reviews completed work

**Teammates (Specialist Agents):**
- Focus on assigned tasks
- Report progress and blockers
- Can request help from other teammates
- Update shared task list
- Work in parallel when possible

**Shared Task List:**
- Central coordination point
- Visible to all team members
- Tracks dependencies between tasks
- Shows task status (pending, in progress, completed)
- Prevents duplicate work

#### Multi-Agent Collaboration Patterns

**1. Parallel Development**
```markdown
Task 1: Frontend engineer - Build login UI
Task 2: Backend engineer - Implement auth API
Task 3: QA engineer - Write integration tests

All three agents work simultaneously on their tasks.
```

**2. Sequential Pipeline**
```markdown
Task 1: Backend engineer - Create database schema
  ↓ (blocks Task 2)
Task 2: Backend engineer - Implement CRUD endpoints
  ↓ (blocks Task 3)
Task 3: Frontend engineer - Build admin dashboard
```

**3. Code Review Workflow**
```markdown
Task 1: Feature developer - Implement new feature
  ↓ (completed)
Task 2: Security reviewer - Check for vulnerabilities
Task 3: Performance reviewer - Analyze optimization opportunities
  ↓ (both complete)
Task 4: Feature developer - Address review feedback
```

**4. Research & Implementation**
```markdown
Task 1: Research agent - Analyze existing codebase patterns
  ↓ (generates recommendations)
Task 2: Implementation team - Apply findings across modules
  - Teammate A: Update authentication module
  - Teammate B: Update payment module
  - Teammate C: Update notification module
```

#### Example Usage

**Simple Team Coordination:**
```markdown
I need to refactor our authentication system. Use agent teams:

1. Create a "research" teammate to analyze current auth implementation
2. Create a "backend" teammate to refactor the auth logic
3. Create a "frontend" teammate to update UI components
4. Create a "qa" teammate to write comprehensive tests

Coordinate them to work in sequence, with each passing findings to the next.
```

**Advanced Team Workflow:**
```markdown
Create an agent team for a full feature implementation:

Team Lead: You (coordinate overall strategy)

Teammates:
- planner: Analyze requirements and create technical spec
- backend-dev: Implement API endpoints
- frontend-dev: Build UI components
- db-specialist: Design and migrate database schema
- qa-engineer: Write unit and integration tests
- security-reviewer: Perform security audit

Task Dependencies:
1. planner → creates spec (blocks all)
2. db-specialist → schema design (blocks backend-dev)
3. backend-dev + frontend-dev → parallel implementation
4. qa-engineer → tests (waits for implementation)
5. security-reviewer → audit (waits for all code)
```

#### Best Practices

**✅ Do:**
- Assign clear, focused tasks to teammates
- Use descriptive teammate names (e.g., "frontend-specialist", not "agent1")
- Set up task dependencies to prevent conflicts
- Monitor the shared task list regularly
- Keep team size manageable (3-5 teammates optimal)
- Let teammates work in parallel when possible

**❌ Don't:**
- Create too many teammates (causes coordination overhead)
- Assign vague or overlapping tasks
- Skip task dependencies (can cause conflicts)
- Micromanage teammate work
- Mix different project contexts in one team

#### Use Cases for Agent Teams

**Ideal For:**
- Large-scale refactoring across multiple files
- Full-stack feature development
- Simultaneous frontend and backend work
- Comprehensive code reviews (multiple perspectives)
- Research + implementation workflows
- Complex migrations or upgrades

**Not Ideal For:**
- Simple single-file edits
- Quick bug fixes
- Exploratory coding sessions
- Learning/tutorial following
- Documentation-only tasks

#### Monitoring & Debugging Teams

**Check Team Status:**
```bash
# View all active teammates
/agents

# Check shared task list
# (task list is visible in conversation context)
```

**Common Issues:**

| Issue | Solution |
|-------|----------|
| Teammates conflicting | Add explicit task dependencies with `blockedBy` |
| Team too slow | Reduce team size, increase parallelization |
| Tasks getting stuck | Check for circular dependencies |
| Context confusion | Use clear task descriptions and teammate names |

#### Current Limitations (Experimental)

- **Experimental Status**: Features may change in future updates
- **Resource Usage**: Multiple agents consume more tokens
- **Coordination Overhead**: Large teams can slow down
- **No Persistence**: Teams are session-specific (don't persist across restarts)
- **Limited to Opus**: Best performance with Claude Opus 4.6

#### Future Roadmap

Expected enhancements for Agent Teams:
- Persistent teams across sessions
- Visual team dashboard
- Advanced task scheduling
- Inter-team communication tools
- Team templates for common workflows
- Performance optimizations

**Learn More:**
- For basic agent usage, see the "General Agents" section above
- For specialized single agents, see "Specialized Agents" section above
- Enable experimental features with environment variables

---

### Hooks

Claude Code hooks are customizable checkpoints that let you intercept and control Claude's autonomous coding operations before they execute on your system. They act as programmable guardrails where you can define safety policies, validate changes, require approvals, or log activities. When Claude attempts to modify files, run commands, or make system changes, your hooks can inspect the proposed action and either allow it, block it, or modify it based on your custom logic, giving you fine-grained control over what the AI agent can actually do to your codebase.

![Hooks Workflow](Images/hooks-workflow.png)

### Setting Up Claude Hooks

Claude Code hooks are configured in **settings files** such as `~/.claude/settings.json` (user settings), `.claude/settings.json` (project settings), `.claude/settings.local.json` (local project settings), and enterprise managed policy settings.

Follow these steps to configure hooks in your project:

1. **Copy Hooks Folder**  
   Copy the `.claude/hooks` directory into the `.claude` folder at the root of your project.

2. **Review Available Hooks**  
   Inside the `hooks` folder, you’ll find Python scripts for each hook (e.g., `notification`, `post_tool_use`, etc.).

3. **Keep Only Required Hooks**  
   Retain the hooks you need and delete the rest.

4. **Install Package Manager**  
   Install the [uv](https://docs.astral.sh/uv/getting-started/installation/) Python package manager.  
   > This is required to execute Python scripts.

5. **Copy Settings File**  
   Copy `.claude/settings.json` into your `.claude` folder.

6. **Update Settings Path**  
   Open `settings.json`, find the entry for: "/Users/wesam/.local/bin/uv" Replace it with the actual path returned by:  
 ```bash which uv```

```text
project-root/
│
├── .claude/
│   ├── hooks/
│   │   ├── notification.py
│   │   ├── post_tool_use.py
│   │   └── ... (other hooks you keep)
│   │
│   └── settings.json
│
└── (other project files)
```

For a complete working example of hooks in action, see the [Event-X repository](https://github.com/wesammustafa/Event-X).

**💡 Quick Configuration (New 2026):**
Use the interactive `/hooks` command for menu-based hook configuration without manually editing JSON files:
```bash
# Launch interactive hook configuration menu
/hooks

# Browse available hooks, enable/disable them, and configure settings
# Much easier than manual JSON editing!
```

### Hook Events

Hooks run in response to various events within Claude Code's lifecycle:
[examples](https://github.com/disler/claude-code-hooks-mastery)
- **`PreToolUse`**: Runs **after Claude creates tool parameters but before processing the tool call**.
- **`PostToolUse`**: Runs **immediately after a tool completes successfully**.
- **`Notification`**: Runs when Claude Code sends notifications, such as when permission is needed to use a tool or when prompt input has been idle.
- **`UserPromptSubmit`**: Runs when the user submits a prompt, **before Claude processes it**.
- **`Stop`**: Runs when the main Claude Code agent has finished responding (does not run if stopped by user interrupt).
- **`SubagentStop`**: Runs when a Claude Code subagent (Task tool call) has finished responding.
- **`SessionEnd`**: Runs when a Claude Code session ends.
- **`PreCompact`**: Runs before Claude Code is about to run a compact operation.
- **`SessionStart`**: Runs when Claude Code starts a new session or resumes an existing session.
- **`TeammateIdle`**: Runs when an agent teammate becomes idle (new 2026, for Agent Teams).
- **`TaskCompleted`**: Runs when a task is marked as completed (new 2026).

### Hook Input

Hooks receive **JSON data via stdin** containing session information and event-specific data. Common fields include `session_id`, `transcript_path` (path to conversation JSON), and `cwd` (current working directory). Event-specific fields vary:

| Hook Event           | Payload / Fields |
|---------------------|-----------------|
| `PreToolUse`         | `tool_name`, `tool_input` |
| `PostToolUse`        | `tool_name`, `tool_input`, `tool_response` |
| `Notification`       | `message` |
| `UserPromptSubmit`   | `prompt` |
| `Stop` / `SubagentStop` | `stop_hook_active` |
| `PreCompact`         | `trigger`, `custom_instructions` |
| `SessionStart`       | `source` |
| `SessionEnd`         | `reason` |
| `TeammateIdle`       | `teammate_id`, `last_activity` |
| `TaskCompleted`      | `task_id`, `task_name`, `completion_time` |


### Hook Output

Hooks communicate status and control Claude Code behavior in two ways:

## Hook Exit Codes and JSON Output

| Exit Code / Feature                     | Behavior / Description |
|----------------------------------------|-----------------------|
| **Exit code 0 (Success)**               | `stdout` is shown to the user in transcript mode (CTRL-R). For `UserPromptSubmit` and `SessionStart`, `stdout` is added to Claude's context. |
| **Exit code 2 (Blocking error)**        | `stderr` is fed back to Claude or shown to the user to block actions depending on the hook event. Examples: **blocks tool calls in `PreToolUse`** and **prompt processing in `UserPromptSubmit`**. |
| **Other exit codes (Non-blocking error)** | `stderr` is shown to the user, but execution continues. |
| **Advanced: JSON Output**               | Hooks can return structured JSON in `stdout` for sophisticated control. |
| `PreToolUse`                            | `permissionDecision`: `"allow"`, `"deny"`, or `"ask"`. Can also return `updatedInput` to modify tool parameters (new 2026). |
| `PostToolUse`                           | `decision`: `"block"` or `undefined`; `additionalContext` can be returned. |
| `UserPromptSubmit`                       | `decision`: `"block"` or `undefined`; `additionalContext` can be returned. |
| `Stop` / `SubagentStop`                 | `decision`: `"block"` or `undefined`. |
| `SessionStart`                           | `additionalContext` can be added. |


### Security Considerations

Hooks execute **arbitrary shell commands** on your system automatically and can modify, delete, or access any files your user account can access. Users are solely responsible for configured commands, and Anthropic provides no warranty.

**Security Best Practices** include:

- Validating and sanitizing inputs.
- Quoting shell variables.
- Blocking path traversal.
- Using absolute paths for scripts.
- Skipping sensitive files (e.g., `.env`, `.git/`). Configuration safety features include capturing a snapshot of hooks at startup and warning if hooks are modified externally, requiring review to apply changes.

### Hook Execution Details and Debugging

- **Timeout**: Hooks have a 60-second execution limit by default, configurable per command.
- **Parallelization**: All matching hooks run in parallel.
- **Environment**: Hooks run in the current directory with Claude Code’s environment, and the `CLAUDE_PROJECT_DIR` environment variable is available.
- **Debugging**: Basic troubleshooting involves checking configuration with `/hooks`, verifying syntax, testing commands manually, and reviewing logs using `claude --debug`. Advanced debugging includes inspecting hook execution details, validating JSON schemas, and monitoring system resources.

### Model Context Protocol (MCP)

> **📚 Comprehensive MCP Documentation**
> For detailed setup, configuration, and usage of MCP servers:
> - **[MCP Servers Documentation](./mcp-servers/)** - Complete guide with prerequisites, installation, and individual server documentation (Serena, Sequential Thinking, Memory, Playwright)
> - **[Troubleshooting Guide](./mcp-servers/README.md#troubleshooting)** - Common issues and solutions

![Why is building AI Agents so chaotic?](Images/MCP/mcp-1.png)

#### The Core Problem: Fragmentation and Inefficiency
- AI agents are becoming smarter but face a massive hidden communication problem that's holding them back from their full potential.
- Building AI agents is chaotic because it's ridiculously hard to get them to talk to the tools and data they need to be useful.
- The current system is described as "a complete and utter mess," referred to by Anthropic as **"the land before MCP"**.
- **Total fragmentation exists**, with teams, even inside the same company, reinventing the wheel by building custom one-off connections for every single tool and data source.
- This chaos is named the **N by M problem**:
	![Without MCP vs With MCP](Images/MCP/mcp-2.png)
	- If you have `n` AI applications and `m` different tools, the old way forces you to build n * m unique integrations.
	- This leads to an **exponential explosion of work that is completely unsustainable**.
	 - This fragmentation everywhere, happening between different teams inside their own company, creating massive inefficiency and wasted effort.
	- The desired outcome is an **N + M world**, where you just build one connection for each app and one for each tool, and they all work together.

> **Installing Playwright MCP for Claude Code (CLI)**
Claude Code uses a different installation method than Claude Desktop, with MCP servers being added per-directory and persisting in a ~/.claude.json configuration file.

  **Quick Installation**

The simplest method for Claude Code CLI:
```bash
# Navigate to your project directory
cd /path/to/your/project

# Add Playwright MCP to Claude Code
claude mcp add playwright npx '@playwright/mcp@latest'
```

**ExecuteAutomation Version (More Features)**

```bash
claude mcp add playwright npx '@executeautomation/playwright-mcp-server'
```

**Usage After Installation**
```bash
# Start Claude Code in your project directory
claude

# Now you can use Playwright through natural language
"Use playwright mcp to open a browser to example.com"
"Take a screenshot of the current page"
"Click on the login button and fill the form"
```


**Verification Commands**

```bash
# Check available MCP tools
/mcp

# Navigate to playwright section to see all tools
# Available tools include: browser_navigate, browser_click, 
# browser_screenshot, browser_type, etc.
```


**Directory-Specific Persistence**
The claude mcp add command will persist but will only affect the directory in which you run it, with configuration stored in ~/.claude.json under a "projects" key.

```bash
# Each directory can have different MCP configurations
cd ~/project-a
claude mcp add playwright npx '@playwright/mcp@latest'

cd ~/project-b  
claude mcp add playwright npx '@executeautomation/playwright-mcp-server'
```

#### The Solution: Model Context Protocol

- **MCP is the proposed solution** to this chaos.
- It functions as a **universal translator for AI**.
- **MCP is an open standard** designed to let any AI application speak fluently with any tool or data source.
- It's the next logical step in a pattern seen before in tech:
    ![The Evolution of Protocols](Images/MCP/mcp-3.png)
    - **Web APIs** standardized how web apps talk to servers.
    - The **Language Server Protocol (LSP)** did the same for code editors and their tools.
    - **MCP is that same evolutionary leap for AI**, creating a common language for how agents talk to the rest of the world.
- The core mission of MCP is to be an **open standard layer that flattens the N by M problem**.
- It is explicitly **not a proprietary thing** but designed to be a public good for the whole ecosystem.
- The goal is to make building with AI faster, more efficient, and more collaborative.

#### How MCP Works: Three Core Pillars (Interfaces)
  ![MCP Deep Dive](Images/MCP/mcp-4.png)
  MCP is built on three core pillars designed to create a clean separation of duties and make it crystal clear who's in control of any given interaction:
1. **Tools**
	- **Controlled by the AI model** so it can take action.
	- Developers expose capabilities like searching a database or writing to a file.
	- The **model decides when and how to use those tools** to accomplish its goal.

2. Resources
	- **Controlled by the application**.
	- Allows developers to feed the AI rich, structured information beyond plain text.
	- Examples include attaching files, surfacing error logs, or sending complex JSON objects.
	- The application developer decides what important context the AI needs.

3. Prompts
	- **Controlled by the user**.
	- Function like slash commands in apps like Slack or Discord.
	- A simple user shortcut (e.g., `/summarize_this_pull_request`) kicks off complex multi-step actions.
	- This puts **direct powerful control** back in the user's hands.

#### The Future Vision: The MCP Registry and Self-Evolving Agents

![Agent Learning on the Fly](Images/MCP/mcp-5.png)
- **MCP lays the foundation for the next generation of AI**, enabling agents that can learn, grow, and evolve on their own.
- The key to this future is the **MCP Registry**.
- **The MCP Registry** is imagined as a global centralized directory, like an app store for AI tools and capabilities.
- Its function allows an AI agent to:
    - **Search for** new tools **Verify** their authenticity
    - **Dynamically connect** to brand new tools it's never encountered
    - **Real-world example**: 
        - An agent needs to check logs in Grafana but has no idea what Grafana is.
        - Instead of failing, it pings the MCP registry, searches for a verified Grafana server, finds the official one, and instantly connects.
        - The agent uses these new tools to read the log and complete the task.
        - This demonstrates the agent **literally teaching itself a new skill on the fly**.
- The ultimate vision: agents that are **no longer limited to their original tools**.
- They will **proactively discover and integrate new capabilities** by themselves.
- The agent will give itself context and evolve to meet whatever new challenge comes its way.

---

#### MCP Ecosystem Updates (2026)

The Model Context Protocol has evolved significantly since its introduction. Here's what's new:

**🎯 MCP Registry - Now Live!**

The official **[MCP Registry](https://registry.modelcontextprotocol.io/)** launched in September 2025, providing a centralized directory of MCP servers.

**Key Features:**
- 🔍 **Searchable catalog** of official and community MCP servers
- 📦 **One-click installation** for supported servers
- 🔐 **Public and private sub-registries** for organizations
- ✅ **Quality verification** for listed servers
- 📚 **Comprehensive documentation** for each server

**Browse Available Servers:**
```bash
# Visit the registry online
https://registry.modelcontextprotocol.io/

# Or search directly via claude mcp
claude mcp search <keyword>
```

**🏢 Agentic AI Foundation**

As of 2026, MCP has been **donated to the Agentic AI Foundation** (part of the Linux Foundation), ensuring:
- Open governance and community-driven development
- Long-term sustainability and vendor neutrality
- Industry-wide collaboration and standardization

**🆕 Latest Protocol Features**

**1. MCP Apps (Interactive UI Components)**
- Servers can now provide interactive UI elements
- Visual components for complex interactions
- Enhanced user experience for tool configuration

**2. OAuth Client Credentials**
- Built-in OAuth support for secure authentication
- Use `--client-id` and `--client-secret` flags
- Simplified integration with authenticated services

**3. Async Operations**
- Non-blocking server operations
- Better performance for long-running tasks
- Improved responsiveness

**4. Server Discovery**
- `.well-known` URLs for automatic server discovery
- Easier integration with new services
- Standard protocol for server metadata

**5. Stateless Architecture**
- Improved server reliability
- Better scaling characteristics
- Simplified server implementation

**Example: Installing from Registry**
```bash
# Browse registry for interesting servers
# Visit https://registry.modelcontextprotocol.io/

# Install a server from the registry
claude mcp add <server-name> npx '@<package-name>@latest'

# Example: Install a database MCP server
claude mcp add sqlite npx '@modelcontextprotocol/server-sqlite@latest'
```

**OAuth Authentication Example**
```bash
# Add server with OAuth credentials
claude mcp add my-api \
  --client-id "your-client-id" \
  --client-secret "your-secret" \
  npx '@api-mcp-server@latest'
```

**🔮 What's Next for MCP**

The MCP ecosystem continues to grow with:
- More official integrations from major platforms
- Enhanced protocol capabilities
- Expanded registry features
- Better tooling and debugging support
- Community-built server ecosystem

**Resources:**
- Official Registry: https://registry.modelcontextprotocol.io/
- MCP Roadmap: https://modelcontextprotocol.io/development/roadmap
- Agentic AI Foundation: https://www.anthropic.com/news/donating-the-model-context-protocol

---

### SDLC
![Software Software Development Life Cycle](Images/sdlc.png)

![What is Software Software Development Life Cycle?](Images/what-is-sdlc.png)

[What is Software Development Life Cycle](https://aws.amazon.com/what-is/sdlc)

### Super Claude Framework
[Source](https://github.com/SuperClaude-Org/SuperClaude_Framework)

### The BMAD METHOD — AI Agent Framework
[Source](https://github.com/bmad-code-org/BMAD-METHOD)

### FAQ

#### Q: What Claude models are available in 2026?

**A:** As of February 2026, the Claude 4.5/4.6 model family is available:

| Model | Model ID | Context Window | Max Output | Best For |
|-------|----------|----------------|------------|----------|
| **Opus 4.6** | `claude-opus-4-6` | 200K tokens (1M beta via API) | 128K tokens | Complex reasoning, coding, analysis |
| **Sonnet 4.5** | `claude-sonnet-4-5-20250929` | 200K tokens | 8K tokens | Balanced performance & speed |
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | 200K tokens | 8K tokens | Fast, lightweight tasks |

**Key Features:**
- **Opus 4.6**: Adaptive thinking, agent teams, top Terminal-Bench 2.0 scores
- **1M Context Window**: Available in beta via API only (not in subscription plans at launch)
- **Fast Mode**: 2.5x faster Opus 4.6 responses (6x pricing, toggle with `/fast`)

#### Q: What's the difference between custom slash commands and skills?

**A:** They're the same thing. See the [Skills FAQ section](#skills-faq) in the Claude Skills documentation for complete details on skills, including security best practices, team sharing, and troubleshooting.

#### Q: How many tokens do I get with Claude Code Pro plan?

**A:** Pro plan users get approximately **~45 messages per 5-hour period** (or roughly **10-40 coding prompts** depending on complexity).

- Usage limits reset every 5 hours (rolling window)
- **Full access to ALL models:** Claude Opus 4.6, Sonnet 4.5, and Haiku 4.5
- Pro plan now includes Opus 4.6 (as of 2026)

#### Q: How are tokens calculated in Claude Code?

**A:** Tokens include everything in your interaction:

**Text Tokenization:**
- Basic formula: `tokens ≈ number of words + punctuation marks`
- Example: "Hello, world!" = approximately 4 tokens (use claude tokenizer to calculate tokens [Tokenizer for Claude 4](https://claude-tokenizer.vercel.app/))
- Uses BPE (Byte Pair Encoding) for subword tokenization

**What Counts Toward Your Limit:**
- Your prompts and questions
- Claude's responses and explanations  
- System instructions and tool definitions
- File content that Claude reads
- Project structure analysis
- Images: `tokens = (width px × height px) / 750`

**Rough Conversion:**
- 1 token ≈ 0.75 words (English text)
- 1,000 tokens ≈ 750 words
- 44,000 tokens ≈ 33,000 words

#### Q: What are the Claude subscription plans and pricing (2026)?

**A:** As of February 2026, Claude offers the following subscription tiers:

| Plan | Price | Models Available | Usage Limit | Claude Code Access | Priority |
|------|-------|------------------|-------------|-------------------|----------|
| **Free** | $0 | Limited | Base | Limited | Standard |
| **Pro** | $20/mo ($17/mo annually) | All (Opus 4.6, Sonnet 4.5, Haiku 4.5) | ~45 messages/5hr | Full | Standard |
| **Max 5x** | $100/mo | All | 5x Pro (~225 messages/5hr) | Full | High |
| **Max 20x** | $200/mo | All | 20x Pro (~900 messages/5hr) | Full | Maximum |

**Key Points:**
- **Unified Subscription**: One subscription covers both web (claude.ai) and CLI (Claude Code)
- **Pro Benefits**: Full access to all models including Opus 4.6 (major upgrade from previous Sonnet-only access)
- **Average Costs**: Pro users typically spend ~$6/day on coding tasks, with 90% spending under $12/day

**API Pricing (Pay-as-you-go):**

| Model | Input (per MTok) | Output (per MTok) | Fast Mode Input | Fast Mode Output |
|-------|------------------|-------------------|-----------------|------------------|
| Opus 4.6 | $5 | $25 | $30 (6x) | $150 (6x) |
| Sonnet 4.5 | $3 | $15 | N/A | N/A |
| Haiku 4.5 | $1 | $5 | N/A | N/A |

**Fast Mode Pricing:**
- Only available for Opus 4.6
- 6x standard pricing: $30 input / $150 output per million tokens
- 50% discount promotion until Feb 16, 2026 11:59pm PT
- Toggle with `/fast` command

**Special Offer:**
- New Pro subscribers get $50 in free API credits to try Opus 4.6

#### Q: How many lines of code can I write with 44,000 tokens?

**A:** **Theoretical capacity:** ~2,900-3,400 lines of pure code (13-15 tokens per line average)

**Practical reality:** Effective for projects with **1,000-2,000 lines** because tokens are shared across:
- Reading existing codebase
- Claude's analysis and suggestions
- Back-and-forth conversation
- File modifications and explanations
- Project context loading

#### Q: What happens when I run multiple Claude Code sessions in different terminals?

**A:** Two types of "sharing" occur:

**1. Usage Limits (Shared Pool):**
- All Claude Code sessions share the same 44,000 token allowance
- Multiple sessions will exhaust your limits faster
- Running 3 parallel sessions ≈ 3-13 prompts per session before hitting limits

**2. Conversation Context (Independent):**
- Each terminal has separate conversation history
- Claude in tab 1 doesn't know what happened in tab 2
- Each session analyzes codebases independently

#### Q: How do Git worktrees affect Claude Code sessions?

**A:** Git worktrees create an interesting hybrid situation:

**Separate Working Directories:**
- Each worktree shows different file contents
- Changes committed in feature X won't appear in feature Y's files
- Each Claude session sees different code states

**Shared Git Metadata:**
- All worktrees share the same `.git` directory
- Git history, branches, and commit logs are visible across all worktrees
- Claude can see that commits happened in other features (but not the actual code changes)

**Example:**
```bash
# Terminal 1: feature/auth
git commit -m "Add auth middleware"

# Terminal 2: feature/payment  
cat middleware.js        # Won't show auth changes
git log --oneline --all  # WILL show the auth commit
```

#### Q: How can I get completely separate Claude Code contexts?

**A:** Use **separate repository clones** instead of worktrees:

```bash
# Instead of worktrees:
~/project-auth/     # Complete separate clone
~/project-payment/  # Complete separate clone

# Benefits:
# - Separate .git directories
# - Independent Git histories  
# - No shared state whatsoever
# - Claude sees completely isolated projects
```

#### Q: What is Fast Mode and when should I use it?

**A:** Fast Mode provides **2.5x faster responses** using Claude Opus 4.6 at the cost of 6x pricing.

**How to Use:**
- Toggle on/off with `/fast` command
- Visual indicator: **↯** icon appears when active
- Only works with Opus 4.6 (not Sonnet or Haiku)

**Pricing:**
- Standard Opus 4.6: $5 input / $25 output per MTok
- Fast Mode: $30 input / $150 output per MTok (6x cost)
- 50% discount promotion until Feb 16, 2026 11:59pm PT

**When to Use Fast Mode:**
- ✅ Rapid iteration and experimentation
- ✅ Live debugging sessions
- ✅ Time-sensitive deployments
- ✅ Quick prototyping
- ❌ Long background tasks
- ❌ Budget-conscious projects
- ❌ Non-urgent documentation work

**Best Practice:** Toggle Fast Mode on only when you need speed, then toggle off to save costs.

#### Q: What's the difference between Claude Max 5x and 20x?

**A:** Claude Max plans multiply your usage capacity compared to Pro:

**Max 5x ($100/month):**
- 5x Pro usage: ~225 messages per 5-hour window
- Best for: Professional developers with heavy daily usage
- Priority access during peak times

**Max 20x ($200/month):**
- 20x Pro usage: ~900 messages per 5-hour window
- Best for: Teams, power users, or production development
- Maximum priority access

**Who Should Upgrade:**
- Frequently hit Pro limits (45 messages/5hr)
- Work on multiple projects simultaneously
- Need guaranteed availability during high-traffic periods
- Professional/commercial development work

#### Q: Can I use Opus 4.6's 1M context window?

**A:** The 1M token context window is currently in **beta and available via API only**.

**Current Status (February 2026):**
- ✅ Available: Via API with API key
- ❌ Not Available: In Pro/Max subscription plans (limited to 200K context)
- Beta access required

**How to Access:**
- Use Claude API directly with your API key
- Set model to `claude-opus-4-6`
- Enable beta features in API settings
- Note: 1M context window may be added to subscriptions in future updates

**Use Cases for 1M Context:**
- Analyzing entire large codebases at once
- Processing extensive documentation
- Complex multi-file refactoring
- Long-form content generation

#### Q: How can I maximize my Claude Code Pro usage?

**A:** **Session Management:**
- Use `/compact` command to reduce context in long sessions
- Close unused sessions to avoid accidental token consumption
- Time your sessions to align with your peak coding periods
- Start fresh contexts for different types of work

**Token Efficiency:**
- Batch similar tasks together
- Use `/model` command strategically (choose between Opus 4.6, Sonnet 4.5, Haiku 4.5 based on task complexity)
- Be specific in prompts to avoid back-and-forth
- Work on one feature at a time when possible

**Project Structure:**
- Create concise CLAUDE.md files for project context
- Use selective file reading when possible

---

### Updates & Deprecations (February 2026)

This section tracks major changes, new features, and deprecated functionality as of February 2026.

#### 🆕 New Features

**Claude Models & Performance:**
- ✅ **Claude Opus 4.6** - Most capable model with adaptive thinking and 128K max output
- ✅ **1M Context Window** - Beta access via API (200K in subscriptions)
- ✅ **Fast Mode** - 2.5x faster Opus 4.6 responses with `/fast` command
- ✅ **Haiku 4.5** - New fast, lightweight model for simple tasks

**Agent Features:**
- ✅ **Agent Teams** - Multi-agent collaboration (experimental, enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
- ✅ **Team Leads & Teammates** - Hierarchical agent structure with shared task lists
- ✅ **Parallel Agent Execution** - Multiple agents working simultaneously

**Commands & Tools:**
- ✅ `/fast` - Toggle Fast Mode for rapid responses
- ✅ `/auth login`, `/auth status`, `/auth logout` - Authentication management
- ✅ `/debug` - Troubleshoot current session
- ✅ `/teleport` - Send session to claude.ai/code for web access
- ✅ `/rename` - Auto-generate descriptive session names
- ✅ `/hooks` - Interactive menu for hook configuration

**MCP Ecosystem:**
- ✅ **MCP Registry** - Official registry live at https://registry.modelcontextprotocol.io/
- ✅ **MCP Apps** - Interactive UI components from servers
- ✅ **OAuth Support** - Built-in client credentials authentication
- ✅ **Agentic AI Foundation** - MCP now maintained by Linux Foundation
- ✅ **Async Operations** - Non-blocking server operations
- ✅ **Server Discovery** - `.well-known` URLs for automatic discovery

**Hooks Enhancement:**
- ✅ **New Hook Events** - `TeammateIdle` and `TaskCompleted`
- ✅ **PreToolUse updatedInput** - Hooks can now modify tool parameters
- ✅ **Interactive Configuration** - `/hooks` command for easier setup

**Other Features:**
- ✅ **Automatic Memory** - Recording and recall across sessions
- ✅ **PDF Support** - Read PDFs with page range selection
- ✅ **Shift+Enter** - Built-in newline support (zero setup needed)
- ✅ **Wildcard Permissions** - More flexible tool permission patterns

#### 📝 Changed

**Subscription & Pricing:**
- 🔄 **Pro Plan Enhancement** - Now includes ALL models (Opus 4.6, Sonnet 4.5, Haiku 4.5)
  - Previously: Sonnet 4 only
  - Now: Full access to entire Claude family
- 🔄 **Usage Metrics** - Changed from token counts to message counts
  - Pro: ~45 messages per 5-hour window (previously "44,000 tokens")
  - Easier to understand and track
- 🔄 **Unified Subscription** - One subscription for both web (claude.ai) and CLI
- 🔄 **Average Costs** - Pro users spend ~$6/day on coding (90% under $12/day)

**MCP Ecosystem:**
- 🔄 **MCP Governance** - Donated to Agentic AI Foundation (Linux Foundation)
  - Open governance model
  - Vendor-neutral development
  - Industry collaboration
- 🔄 **Registry Status** - Changed from "future vision" to live production service

**Model IDs:**
- 🔄 Use specific model IDs instead of generic references:
  - `claude-opus-4-6` (not "Opus 4")
  - `claude-sonnet-4-5-20250929` (not "Sonnet 4")
  - `claude-haiku-4-5-20251001` (not "Haiku 4")

**Commands:**
- 🔄 **Authentication** - Use `/auth login` instead of `/login`
- 🔄 **Terminal Setup** - Shift+Enter now built-in, `/terminal-setup` still available for iTerm2/VSCode custom bindings

#### ❌ Deprecated

**Subscription Tiers:**
- ⛔️ **Separate Opus Access** - No longer needed; Opus 4.6 included in Pro ($20/mo)
  - Pro plan now includes all models
  - No separate "Opus-only" tier

**Workarounds:**
- ⛔️ **Manual Token Calculations** - Use `/cost` command instead
  - Built-in token tracking
  - Real-time usage monitoring
  - No need for external calculators

**Legacy Commands:**
- ⛔️ `/login` and `/logout` - Use `/auth login` and `/auth logout` instead
  - Still functional but use new commands

#### 🎁 Special Promotions (Limited Time)

- **🎉 Pro Subscribers** - $50 in free API credits for Opus 4.6 (new subscribers)
- **⚡ Fast Mode** - 50% discount until Feb 16, 2026 11:59pm PT
  - Regular: $30/$150 per MTok
  - Discounted: $15/$75 per MTok

#### 📅 Important Dates

- **September 2025** - MCP Registry launched
- **January 2026** - Claude 4.5/4.6 model family released
- **February 2026** - Agent Teams experimental release
- **February 16, 2026** - Fast Mode promotion ends

#### 🔮 Coming Soon

Based on current roadmap and experimental features:
- Agent Teams general availability
- 1M context window in subscriptions (currently API-only)
- Enhanced MCP Apps capabilities
- Persistent agent teams across sessions
- Visual team dashboard
- Advanced task scheduling

---

**Last Updated:** February 16, 2026

**Note:** Features, pricing, and availability subject to change. Check official Anthropic documentation for the most current information.

---

### References

#### Official Claude & Anthropic Resources (2026)

**Claude Code Documentation:**
- https://code.claude.com/docs/en/overview - Claude Code overview
- https://docs.anthropic.com/en/docs/claude-code/quickstart - Quick start guide
- https://code.claude.com/docs/en/cli-reference - CLI command reference
- https://code.claude.com/docs/en/fast-mode - Fast Mode documentation
- https://code.claude.com/docs/en/hooks - Hooks reference
- https://docs.anthropic.com/en/docs/claude-code/slash-commands - Slash commands
- https://www.anthropic.com/engineering/claude-code-best-practices - Best practices
- https://www.anthropic.com/news/how-anthropic-teams-use-claude-code - Team usage

**Claude Models & API:**
- https://platform.claude.com/docs/en/about-claude/models/overview - Models overview
- https://platform.claude.com/docs/en/about-claude/pricing - API pricing
- https://www.anthropic.com/claude/opus - Claude Opus 4.6 official page
- https://claude-tokenizer.vercel.app/ - Token calculator

**Agent Development:**
- https://www.anthropic.com/engineering/building-effective-agents - Building agents guide

#### MCP (Model Context Protocol) Resources

**Official MCP:**
- https://registry.modelcontextprotocol.io/ - **Official MCP Registry (Live)**
- https://modelcontextprotocol.io/docs/getting-started/intro - Getting started
- https://modelcontextprotocol.io/development/roadmap - MCP roadmap
- https://github.com/modelcontextprotocol/servers - Official MCP servers
- http://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/ - Registry announcement
- https://www.anthropic.com/news/donating-the-model-context-protocol - Agentic AI Foundation announcement
- https://auth0.com/blog/mcp-specs-update-all-about-auth/ - MCP auth specifications

**MCP Server Examples:**
- https://github.com/microsoft/playwright-mcp - Playwright MCP
- https://github.com/lastmile-ai/mcp-agent - MCP agent implementation
- https://github.com/oraios/serena - Serena semantic code intelligence

#### Hooks & Automation

- https://github.com/disler/claude-code-hooks-mastery - Hooks examples
- https://www.eesel.ai/blog/hooks-in-claude-code - Hooks guide
- https://github.com/wesammustafa/Event-X - Complete hooks example

#### Workflows & Tutorials

- https://github.com/OneRedOak/claude-code-workflows - Claude Code workflows
- https://www.youtube.com/watch?v=kQmXtrmQ5Zg - Video tutorial
- https://www.youtube.com/watch?v=xOO8Wt_i72s - Advanced tutorial

#### Pricing & Subscription Information (2026)

- https://intuitionlabs.ai/articles/claude-pricing-plans-api-costs - Pricing guide
- https://www.nops.io/blog/anthropic-api-pricing/ - API pricing details
- https://www.braingrid.ai/blog/claude-code-pricing - Claude Code pricing
- https://screenapp.io/blog/claude-ai-pricing - Subscription comparison
- https://www.eesel.ai/blog/claude-opus-46-pricing - Opus 4.6 pricing
- https://www.xda-developers.com/psa-claude-users-can-claim-50-in-free-credits-to-try-opus-46/ - Free credits offer

#### Fast Mode Resources (2026)

- https://simonwillison.net/2026/Feb/7/claude-fast-mode/ - Fast Mode analysis
- https://medium.com/@joe.njenga/how-im-using-new-claude-code-fast-mode-to-code-faster-like-a-whiz-09a2694da6ae - Fast Mode usage
- https://wmedia.es/en/tips/claude-code-fast-mode-faster-responses - Fast Mode guide

#### Development Tools & Resources

- https://github.com/adrianhajdin/ecommerce_sanity_stripe - Example project
- https://aws.amazon.com/what-is/sdlc/ - SDLC overview
- https://tmuxcheatsheet.com/ - Tmux reference
- https://obsidian.md/ - Obsidian documentation viewer
- https://github.com/yamadashy/repomix - Repository packaging tool
- https://github.com/cline/cline - Alternative AI coding assistant

#### Agent Interoperability

- https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/ - Agent-to-agent communication

---

**Documentation Version:** 2.0 (Updated February 2026)

**Contributing:** Found outdated information? Please open an issue or submit a pull request.
