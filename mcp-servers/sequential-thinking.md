# Sequential Thinking MCP Server

## Overview

The **Sequential Thinking** server helps Claude Code **break down complex problems into manageable steps**, improving reasoning and multi-step task execution.

---

## Installation

### 1️⃣ Global Installation (Recommended)

Install Sequential Thinking globally for use across all projects:

```bash
claude mcp add sequential-thinking -s user -- npx -y @modelcontextprotocol/server-sequential-thinking
```

### Local Installation (Project-Specific)

For project-specific installations:

```bash
claude mcp add sequential-thinking -s local -- npx -y @modelcontextprotocol/server-sequential-thinking
```

---

## Usage

### 2️⃣ Using Sequential Thinking in Claude Code

Once installed, Sequential Thinking integrates automatically into Claude sessions. It activates when you request step-by-step reasoning or task breakdown.

#### Example Usage

```
"Break down the task of building a REST API into sequential steps"
```

Claude will respond with structured, step-by-step instructions, leveraging Sequential Thinking for organized problem-solving.

---

## Features

- **Complex problem decomposition**: Breaks down large tasks into manageable steps
- **Structured reasoning**: Provides logical, sequential thought processes
- **Planning assistance**: Helps organize multi-step workflows
- **Automatic integration**: Works seamlessly without manual activation

---

## Verification

Verify Sequential Thinking is connected:

```bash
claude mcp list
```

Expected output:

```
sequential-thinking: npx -y @modelcontextprotocol/server-sequential-thinking - ✓ Connected
```

---

## Best Practices

- **Use for planning**: Ideal for task breakdown and project planning
- **Complex workflows**: Best suited for multi-step reasoning tasks
- **Global installation**: Recommended for consistent availability across projects
- **No configuration needed**: Works out of the box after installation

---

## Use Cases

- Breaking down large features into implementation steps
- Planning architectural changes
- Debugging complex issues systematically
- Creating structured documentation outlines
- Organizing multi-stage deployments

---

## Troubleshooting

If Sequential Thinking fails to connect:
1. Verify Node.js is installed: `node --version`
2. Check `npx` availability: `npx --version`
3. Remove and reinstall: 
   ```bash
   claude mcp remove sequential-thinking -s user
   claude mcp add sequential-thinking -s user -- npx -y @modelcontextprotocol/server-sequential-thinking
   ```

For more help, see the [Troubleshooting Guide](./README.md#troubleshooting).