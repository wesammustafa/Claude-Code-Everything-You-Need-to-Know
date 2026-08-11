# Parallel Search MCP Server

*~3 min read*

## Overview

> **Mental model:** Think of Parallel Search MCP as a web research adapter for Claude Code: one remote connection provides both search results and readable page content.

The hosted server exposes two tools:

| Tool | Purpose |
|---|---|
| `web_search` | Search the web for relevant sources |
| `web_fetch` | Retrieve content from a specific URL |

## Prerequisites

- Claude Code CLI
- Internet access

The default endpoint works without an API key.

## Installation

### Global Installation

Add the server for all projects:

```bash
claude mcp add --transport http -s user parallel-search https://search.parallel.ai/mcp
```

### Local Installation

Add it only to the current project:

```bash
claude mcp add --transport http -s local parallel-search https://search.parallel.ai/mcp
```

## Usage

Ask Claude to search and open useful results:

```text
Search the web for the current Claude Code MCP documentation, open the most relevant official source, and summarize the setup steps with links.
```

## Verification

Confirm that the server is connected:

```bash
claude mcp list
```

The output should list `parallel-search` as connected. You can also type `/mcp`
inside Claude Code to inspect the available tools.

## Troubleshooting

If the server does not connect:

1. Confirm the URL is exactly `https://search.parallel.ai/mcp`.
2. Remove and add the entry again: `claude mcp remove parallel-search`.
3. Check that your network permits outbound HTTPS connections.

See the [official Parallel Search MCP documentation](https://docs.parallel.ai/integrations/mcp/search-mcp) for access options and client-specific setup.
