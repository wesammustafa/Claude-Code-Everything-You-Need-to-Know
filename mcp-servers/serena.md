# Serena MCP Server

## Overview

Serena provides **semantic code intelligence** for Claude Code, enabling project understanding, symbol-level navigation, and intelligent editing across multiple programming languages.

---

## Installation

### 1️⃣ Global Installation (Recommended)

Install Serena globally for use across all projects:

```bash
claude mcp add serena -s user -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

### Local Installation (Project-Specific)

For project-specific installations:

```bash
claude mcp add serena -s local -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

### Optional: Project Context Installation

To automatically link Serena to your current project:

```bash
claude mcp add serena -s user -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project $(pwd)
```

> **Note:** Using `--project $(pwd)` makes it project-specific even with global scope.

---

## Usage

### 2️⃣ Activate a Project

Within your Claude Code session, activate the current directory as a project:

```
"Activate the current directory as project using serena"
```

This tells Serena to treat the current folder as the active project context.

### 3️⃣ Index a Project (Optional, Recommended)

Indexing preloads your project into Serena for faster symbol lookup and semantic code understanding:

```bash
uvx --from git+https://github.com/oraios/serena serena project index
```

#### When to Index

- Once during initial project setup
- After significant code changes (new files, major refactors)
- When experiencing slow symbol lookups

> **Tip:** Indexing significantly improves search speed and context-aware suggestions.

---

## Features

- **Multi-language support**: Works with 15+ programming languages
- **Symbol-level navigation**: Jump to definitions, find references
- **Intelligent editing**: Context-aware code modifications
- **Project understanding**: Semantic analysis of codebase structure
- **Memory integration**: Combines with Memory MCP to persist project knowledge

---

## Verification

Verify Serena is connected:

```bash
claude mcp list
```

Expected output:

```
serena: uvx --from git+https://github.com/oraios/serena serena start-mcp-server - ✓ Connected
```

---

## Prerequisites

- **uv** must be installed: [Installation Guide](https://docs.astral.sh/uv/getting-started/installation/)
- Check installation: `uv --version`

---

## Best Practices

- Use **global scope** for general-purpose access across projects
- Use **project context** (`--project $(pwd)`) for dedicated, project-specific workflows
- Index projects regularly for optimal performance
- Combine with Memory MCP for enhanced context retention

---

## Troubleshooting

If Serena fails to connect:
1. Verify `uv` is installed: `uv --version`
2. Test Serena directly: `uvx --from git+https://github.com/oraios/serena serena --help`
3. Check directory permissions
4. Verify project path is correct (if using `--project`)

For more help, see the [Troubleshooting Guide](./README.md#troubleshooting).