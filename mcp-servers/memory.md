# Memory MCP Server

## Overview

The **Memory** server allows Claude Code to **store and retrieve information across sessions**, providing persistent context, remembering project details, and maintaining user preferences.

---

## Installation

### 1️⃣ Global Installation (Recommended)

Install Memory globally for cross-project persistence:

```bash
claude mcp add memory -s user -- npx -y @modelcontextprotocol/server-memory
```

### Local Installation (Project-Specific)

For project-specific memory storage:

```bash
claude mcp add memory -s local -- npx -y @modelcontextprotocol/server-memory
```

---

## Usage

### 2️⃣ Using Memory in Claude Code

Once installed, Memory automatically stores and retrieves context from your sessions.

#### Example: Storing Information

```
"Remember that the current project uses TypeScript"
```

Claude stores this information for future reference.

#### Example: Retrieving Information

Later in the same or a new session:

```
"What programming language is used in the current project?"
```

Claude responds:

```
"TypeScript"
```

---

## Features

- **Persistent context**: Information persists across sessions
- **Project-specific notes**: Remember project details, conventions, and preferences
- **User preferences**: Store personal preferences and workflow habits
- **Seamless integration**: Works automatically with Claude Code
- **Cross-session memory**: Recall information from previous conversations

---

## Use Cases

- Remember project-specific coding conventions
- Store frequently used commands or configurations
- Maintain context about ongoing tasks
- Track decisions made in previous sessions
- Remember team preferences and guidelines

---

## Integration with Other Servers

Memory works seamlessly with other MCP servers:

- **With Serena**: Combines persistent memory with semantic code understanding
- **With Sequential Thinking**: Enhances reasoning with historical project context
- **With Playwright**: Remembers browser automation preferences and configurations

> **Tip:** Global installation enables memory sharing across all projects, while local installation keeps project memories separate.

---

## Verification

Verify Memory is connected:

```bash
claude mcp list
```

Expected output:

```
memory: npx -y @modelcontextprotocol/server-memory - ✓ Connected
```

---

## Best Practices

- Use **global installation** for cross-project memory and user preferences
- Use **local installation** for project-specific isolated memory
- Regularly test memory recall to ensure proper functioning
- Combine with Serena for enhanced project-aware context

---

## Troubleshooting

If Memory fails to connect:
1. Verify Node.js is installed: `node --version`
2. Check `npx` availability: `npx --version`
3. Remove and reinstall:
   ```bash
   claude mcp remove memory -s user
   claude mcp add memory -s user -- npx -y @modelcontextprotocol/server-memory
   ```

For more help, see the [Troubleshooting Guide](./README.md#troubleshooting).