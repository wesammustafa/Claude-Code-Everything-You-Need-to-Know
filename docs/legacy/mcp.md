# Model Context Protocol (MCP)

> [!NOTE]
> From the previous edition, not yet re-verified. The guide is being rebuilt as lessons; this page keeps the earlier material reachable until they land.

> **Mental model:** MCP is a universal translator that lets any AI tool talk to any data source through one open protocol: USB-C for AI integrations.

## The N×M problem MCP solves

Before MCP, every AI app needed a custom integration for every tool: `n` apps × `m` tools = `n × m` brittle one-off connections. Teams inside the same company would reinvent the same Slack/GitHub/Postgres integration over and over.

MCP collapses this to **N + M**: each app implements MCP once, each tool exposes MCP once, and any combination works together. Same pattern Web APIs gave us for app-to-server and LSP gave us for editor-to-language tooling.

## Three pillars

Each pillar makes ownership explicit, so it's always clear who's driving:

| Pillar | Controlled by | Purpose |
|---|---|---|
| **Tools** | The model | Lets the AI take actions: query a DB, call an API, write a file |
| **Resources** | The application | Feeds the AI structured context: files, error logs, JSON objects |
| **Prompts** | The user | Slash-command shortcuts that kick off multi-step workflows |

## The MCP Registry & self-discovering agents

The [official MCP Registry](https://registry.modelcontextprotocol.io/) (public preview since September 2025) is the app-store-equivalent for MCP servers. An agent that needs to check Grafana logs but doesn't have a Grafana tool wired up can ping the registry, find the verified server, install it, and continue, teaching itself a new capability on the fly.

---

<sub>From the previous edition of [Claude Code: Everything You Need to Know](../../README.md).</sub>
