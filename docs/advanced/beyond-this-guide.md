# Beyond this guide

<sub>**Advanced** · Verified against Claude Code v2.1.285 (stable) on 2026-10-09</sub>

Where to go once you finish Advanced. The guide teaches one developer's use of Claude Code, alone or with a team. Building your own agents and MCP servers, running Claude Code for a whole organization, and getting a team to adopt it are separate jobs with their own official docs, so this page links them and doesn't teach them.

Every item is published by Anthropic, except the MCP project's pages on modelcontextprotocol.io.

Listings checked against the listing bar on 2026-10-09.

## Build your own agents

To build Claude Code's agent loop into your own application:

- [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview): the tools, agent loop and context management that power Claude Code, as a Python or TypeScript library. Its first table compares it with other Claude tools.
- [Agent SDK quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart): build an agent that finds and fixes bugs in existing code.
- [Intro to Claude](https://platform.claude.com/docs/en/intro): the Claude API, with a path from a first API call to a working integration.

To drive the same agent loop from a language other than Python or TypeScript, the docs suggest running the CLI as a subprocess with `-p` and `--output-format json` ([Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview#compare-the-agent-sdk-to-other-claude-tools)), as the script in [Script Claude Code with `claude -p`](04-headless.md) does.

A product or service you build on the Agent SDK should use API key authentication through the Claude Console or a supported cloud provider ([Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use)). Unless previously approved, Anthropic doesn't allow third-party developers to offer claude.ai login for their products ([Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview#get-started)).

While you write code that calls the Claude API, the bundled `/claude-api` skill loads Claude API reference material for your project's language, and Claude also loads it on its own when your code imports `anthropic` or `@anthropic-ai/sdk` ([Skills](https://code.claude.com/docs/en/skills#work-on-claude-api-projects)).

## Build MCP servers

[Connect a tool with MCP](../intermediate/07-mcp.md) used a server someone else wrote. To write your own:

- [Find and build MCP servers](https://code.claude.com/docs/en/mcp#find-and-build-mcp-servers): where the Claude Code docs point server builders, for protocol basics and for connector authentication, testing and submission to the Anthropic Directory.
- [Build an MCP server](https://modelcontextprotocol.io/docs/develop/build-server) (Vendor: the MCP project): the MCP project's own tutorial, and its [SDKs](https://modelcontextprotocol.io/docs/sdk) for building servers and clients.
- [Introduction to Model Context Protocol](https://academy.claude.com/courses/introduction-to-model-context-protocol): Claude Academy's course on building servers and clients from scratch with the Python SDK.
- [Model Context Protocol: Advanced topics](https://academy.claude.com/courses/model-context-protocol-advanced-topics): Claude Academy's course on sampling, notifications and roots.

## Run Claude Code for an organization

[Share your setup with a team](06-share-your-setup.md) commits a setup to the repository your team works in. An organization also sets policy, sign-in, network access and reporting for every machine:

- [Set up Claude Code for your organization](https://code.claude.com/docs/en/admin-setup): Anthropic's decision map for administrators, and the place to start. It covers API providers, managed settings, policy enforcement, usage monitoring and data handling, and says where SSO and seat assignment are configured.
- [Deploy managed settings](https://code.claude.com/docs/en/managed-settings), for delivering your organization's settings to every developer's machine on each operating system, and [Configure server-managed settings](https://code.claude.com/docs/en/server-managed-settings), for delivering them from the claude.ai console without device management.
- [Authentication](https://code.claude.com/docs/en/authentication#set-up-team-authentication), for the ways a team or organization can configure access to Claude Code, and the [Enterprise deployment overview](https://code.claude.com/docs/en/third-party-integrations), which helps you choose between deploying through Anthropic and through a cloud provider.
- [Enterprise network configuration](https://code.claude.com/docs/en/network-config) for proxy servers, custom certificate authorities and mTLS, and [Run Claude Code through a gateway](https://code.claude.com/docs/en/gateways) for central credentials, usage tracking and cost controls.
- [Monitoring](https://code.claude.com/docs/en/monitoring-usage), for exporting usage, cost and tool activity through OpenTelemetry, and [Track team usage with analytics](https://code.claude.com/docs/en/analytics), the usage and adoption dashboard.
- [Data usage](https://code.claude.com/docs/en/data-usage): Anthropic's training and retention policies, and where a session's data goes.

If your organization deploys managed settings, a setting from a lesson may not apply on a work machine, or on any machine where you sign in with a work account: no user, project, local or `--settings` value overrides them, apart from a few security-sensitive exceptions where a stricter value from a lower level still counts ([Deploy managed settings](https://code.claude.com/docs/en/managed-settings), [Configure server-managed settings](https://code.claude.com/docs/en/server-managed-settings#platform-availability)). When developers connect through a gateway with a gateway credential, usage is billed to the organization's provider account at API rates, and their claude.ai subscriptions aren't used or charged ([Subscriptions and gateways](https://code.claude.com/docs/en/gateways#subscriptions-and-gateways)).

## Roll it out to a team

Once the setup is in place, these help people adopt it:

- [Champion kit](https://code.claude.com/docs/en/champion-kit): for an engineer already using Claude Code who wants to help their team adopt it.
- [Communications kit](https://code.claude.com/docs/en/communications-kit): launch announcements, drip-campaign messages and FAQ answers for the administrators and engineering leads who roll Claude Code out.
- [The AI-native SDLC playbook](https://academy.claude.com/courses/ai-native-sdlc-playbook): Claude Academy's course for engineering, platform and security leads whose organization already uses Claude Code.
- [Running an AI-native engineering org](https://claude.com/resources/articles/running-an-ai-native-engineering-org): how the Claude Code team's processes and structure changed once agentic coding became its default way of working.

---

<sub>Sources: the pages linked above, each checked on 2026-10-09.</sub>

<sub>Up: [Advanced](README.md)</sub>
