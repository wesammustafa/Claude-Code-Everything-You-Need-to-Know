# MCP Servers Documentation

## Overview

This directory contains comprehensive documentation for the four core Model Context Protocol (MCP) servers that enhance Claude Code's capabilities.

---

## Available Servers

| Server | Purpose | Key Features | Documentation |
|--------|---------|--------------|---------------|
| **Serena** | Semantic code intelligence | • Multi-language support (15+)<br>• Symbol-level navigation<br>• Project indexing<br>• Context-aware editing | [serena.md](./serena.md) |
| **Sequential Thinking** | Advanced reasoning | • Problem decomposition<br>• Multi-step planning<br>• Structured analysis<br>• Decision support | [sequential-thinking.md](./sequential-thinking.md) |
| **Memory** | Persistent context | • Cross-session memory<br>• Project preferences<br>• Historical context<br>• Knowledge retention | [memory.md](./memory.md) |
| **Playwright** | Browser automation | • Web scraping<br>• Automated testing<br>• Screenshot capture<br>• Device emulation | [playwright.md](./playwright.md) |

---

## Server Comparison

### By Use Case

#### Code Development
- **Serena**: Deep codebase understanding and navigation
- **Sequential Thinking**: Planning complex implementations
- **Memory**: Remember project patterns and preferences

#### Web Automation
- **Playwright**: Browser control and testing
- **Memory**: Store authentication and workflow preferences

#### Research & Analysis
- **Serena**: Analyze code structure and dependencies
- **Sequential Thinking**: Break down complex problems
- **Playwright**: Gather web data

---

## Server Synergies

### Powerful Combinations

**1. Serena + Sequential Thinking**
```
Use case: Complex refactoring projects
- Sequential Thinking breaks down the approach
- Serena navigates and modifies code intelligently
```

**2. Memory + All Servers**
```
Use case: Enhanced context awareness
- Memory stores project conventions
- Other servers leverage this knowledge
```

**3. Playwright + Memory**
```
Use case: Automated testing workflows
- Playwright executes browser automation
- Memory remembers test patterns and credentials
```

**4. All Four Together**
```
Use case: Full-stack development
- Serena for backend code intelligence
- Playwright for frontend testing
- Sequential Thinking for planning
- Memory for project knowledge
```

---

## Getting Started

### Prerequisites

Before installing MCP servers, ensure the following tools are installed:

| Tool | Required By | Installation |
|------|-------------|--------------|
| **Node.js & npx** | Sequential Thinking, Memory, Playwright | [nodejs.org](https://nodejs.org/) |
| **uv & uvx** | Serena | [Install uv](https://docs.astral.sh/uv/getting-started/installation/) |
| **Claude Code CLI** | All servers | [Claude Docs](https://docs.claude.com/en/docs/claude-code) |

#### Verify Prerequisites

Run the following commands to check installations:

```bash
node --version
npx --version
uv --version
uvx --version
claude --version
```

> **Note:** All commands should return version numbers. If any command fails, install the missing prerequisite.

---

## MCP Registry & Ecosystem (2026)

### Official MCP Registry

The **[MCP Registry](https://registry.modelcontextprotocol.io/)** is now live (launched September 2025), providing a centralized directory for discovering MCP servers.

**Features:**
- 🔍 Browse hundreds of official and community servers
- 📦 One-click installation instructions
- 📚 Comprehensive documentation for each server
- ✅ Quality-verified listings
- 🔐 Support for public and private sub-registries

**Discovering New Servers:**
1. Visit https://registry.modelcontextprotocol.io/
2. Search by category (code, database, browser, AI, etc.)
3. Copy installation command for Claude Code CLI
4. Install with `claude mcp add`

**Popular Server Categories:**
- **Code Intelligence**: Serena, GitHub, GitLab integrations
- **Databases**: PostgreSQL, SQLite, MongoDB servers
- **Browser Automation**: Playwright, Puppeteer
- **AI & ML**: Sequential Thinking, Memory, various AI tool integrations
- **APIs & Services**: REST clients, GraphQL, authentication servers

### Latest MCP Protocol Features (2026)

**New Capabilities:**
- **MCP Apps**: Interactive UI components from servers
- **OAuth Support**: Built-in client credentials authentication
- **Async Operations**: Non-blocking server operations
- **Server Discovery**: `.well-known` URLs for automatic discovery
- **Improved Performance**: Stateless architecture for better scaling

### Agentic AI Foundation

MCP is now maintained by the **Agentic AI Foundation** (Linux Foundation), ensuring:
- Open governance and community-driven development
- Vendor-neutral standardization
- Long-term sustainability

---

### Installation

MCP servers can be installed in two scopes:
- **Global (`-s user`)**: Available across all projects (recommended for everyday use)
- **Local (`-s local`)**: Project-specific installations (useful for testing)

#### Global Installation (Recommended)

Install servers globally to use them across all your projects:

```bash
# Serena - Semantic code intelligence
claude mcp add serena -s user -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server

# Sequential Thinking - Step-by-step reasoning
claude mcp add sequential-thinking -s user -- npx -y @modelcontextprotocol/server-sequential-thinking

# Memory - Persistent context across sessions
claude mcp add memory -s user -- npx -y @modelcontextprotocol/server-memory

# Playwright - Browser automation
claude mcp add playwright -s user -- npx -y @playwright/mcp@latest
```

#### Local Installation (Project-Specific)

Install servers for a specific project only:

```bash
# Serena
claude mcp add serena -s local -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server

# Sequential Thinking
claude mcp add sequential-thinking -s local -- npx -y @modelcontextprotocol/server-sequential-thinking

# Memory
claude mcp add memory -s local -- npx -y @modelcontextprotocol/server-memory

# Playwright
claude mcp add playwright -s local -- npx -y @playwright/mcp@latest
```

#### Verify Installation

After installing MCP servers, verify they are connected:

```bash
claude mcp list
```

**Expected output:**

```
Checking MCP server health...
sequential-thinking: ✓ Connected
serena: ✓ Connected
memory: ✓ Connected
playwright: ✓ Connected
```

> **Tip:** If a server shows as disconnected, try removing and reinstalling it, or see the [Troubleshooting section](#troubleshooting).

### Server-Specific Documentation

- **[Serena](./serena.md)** - For code-heavy projects
- **[Sequential Thinking](./sequential-thinking.md)** - For complex problem-solving
- **[Memory](./memory.md)** - For persistent project knowledge
- **[Playwright](./playwright.md)** - For web automation needs

---

## Installation Scopes

### Global (`-s user`)
- Available across all projects
- Recommended for everyday use
- Single installation, universal access

### Local (`-s local`)
- Project-specific configuration
- Useful for testing
- Isolated from other projects

---

## Troubleshooting

Having issues with MCP server installation or connection? This section covers common problems and their solutions.

### General Troubleshooting

#### 1️⃣ Server Shows "Failed to connect"

**Step 1: Verify Prerequisites**

```bash
node --version
npx --version
uv --version
uvx --version
```

All commands should return version numbers. Install any missing prerequisites.

**Step 2: Remove and Reinstall Server**

```bash
claude mcp remove <server-name> -s user
claude mcp add <server-name> -s user -- <command>
```

**Step 3: Check Configuration File**

Check `~/.claude.json` (macOS/Linux) or `%USERPROFILE%\.claude.json` (Windows) for syntax errors.

**Step 4: Restart Claude Code**

```bash
claude
```

#### 2️⃣ "Command not found" Errors

| Error | Solution |
|-------|----------|
| `npx not found` | Install Node.js from [nodejs.org](https://nodejs.org/) |
| `uvx not found` | Install uv from [docs.astral.sh](https://docs.astral.sh/uv/getting-started/installation/) |
| `claude not found` | Install Claude Code CLI from [docs.claude.com](https://docs.claude.com/en/docs/claude-code) |

---

### Serena-Specific Issues

#### 3️⃣ Serena Connection Failures

**Verify uv Installation**

```bash
uv --version
uvx --version
```

**Test Serena Directly**

```bash
uvx --from git+https://github.com/oraios/serena serena --help
```

**Common Issues**

| Issue | Solution |
|-------|----------|
| Directory permission errors | Check read/write permissions, especially on Windows/WSL |
| Project path incorrect | Verify `--project` path is absolute and exists |
| Indexing fails | Ensure project contains valid source files |

**Reinstall Serena**

```bash
claude mcp remove serena -s user
claude mcp add serena -s user -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

---

### Playwright-Specific Issues

#### 4️⃣ Playwright Connection Failures

**Verify Node.js**

```bash
node --version
npx --version
```

**Test Playwright Directly**

```bash
npx @playwright/mcp@latest --help
```

**Install Missing Browser Binaries**

```bash
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit
```

**Common Issues**

| Issue | Solution |
|-------|----------|
| Port conflicts | Check if another process is using the port |
| Browser not visible | Remove `--headless` flag or check display settings |
| Chrome not installed (Windows) | Install Google Chrome manually |
| Timeout errors | Increase timeout in configuration or check network |

**Reinstall Playwright**

```bash
claude mcp remove playwright -s user
claude mcp add playwright -s user -- npx -y @playwright/mcp@latest
```

---

### Sequential Thinking & Memory Issues

#### 5️⃣ Sequential Thinking / Memory Failures

Both servers require Node.js and `npx`. If they fail to connect:

**Verify Prerequisites**

```bash
node --version
npx --version
```

**Test Server Directly**

```bash
# Sequential Thinking
npx -y @modelcontextprotocol/server-sequential-thinking --help

# Memory
npx -y @modelcontextprotocol/server-memory --help
```

**Reinstall Server**

```bash
# Sequential Thinking
claude mcp remove sequential-thinking -s user
claude mcp add sequential-thinking -s user -- npx -y @modelcontextprotocol/server-sequential-thinking

# Memory
claude mcp remove memory -s user
claude mcp add memory -s user -- npx -y @modelcontextprotocol/server-memory
```

---

### Complete Reinstall

#### 6️⃣ Full Server Reinstallation

If a server repeatedly fails, perform a complete reinstall:

```bash
# Remove from both scopes
claude mcp remove <server-name> -s local
claude mcp remove <server-name> -s user

# Reinstall globally
claude mcp add <server-name> -s user -- <command>
```

---

### Verification

#### 7️⃣ Verify All Servers

After troubleshooting, always verify server status:

```bash
claude mcp list
```

Expected output:

```
Checking MCP server health...
sequential-thinking: ✓ Connected
serena: ✓ Connected
memory: ✓ Connected
playwright: ✓ Connected
```

---

### Important Notes

- **Restart Claude Code** after configuration changes
- **Prefer one scope per server**: Combining global and local installations may cause conflicts
- **Check logs** in `~/.claude/logs/` for detailed error messages
- **Update regularly**: Use `@latest` for npm packages to get the newest versions

---

### Still Having Issues?

If problems persist:
1. Check the [Claude Code GitHub Issues](https://github.com/anthropics/claude-code/issues)
2. Review server-specific documentation (links below)
3. Ensure all prerequisites are correctly installed
4. Try reinstalling Claude Code CLI itself

---

## Additional Resources

- [Main README](../README.md) - Complete Claude Code guide
