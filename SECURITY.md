# Security Policy

Maintainer agent instructions, settings, skills, MCP connections and workflows are local configuration and are not distributed with the guide. Copy-ready examples for the lessons go under `examples/` and stay inert until you copy them into a project. Review every file before you copy it, the same way you'd review a shell script (the guide teaches the same in [Enforce a rule with a hook](docs/intermediate/05-hooks.md#watch-out)).

## The Claude Code Quest server

- `npm run learn` starts a server that listens only on `127.0.0.1`; no other address of your machine reaches it.
- It answers only requests addressed to `127.0.0.1` or `localhost`, and in a Codespace only through that Codespace's own forwarded address.
- A page from another site or another local port cannot make it act: it refuses such a request, and a plain page load changes nothing.
- A Work folder you choose must be the root of a git repository inside your home folder, and cannot be the Practice copy or a folder that holds it.
- It writes only to `.practice/`; the Checks it runs also use throwaway folders in your system temp folder.
- It runs only the Checks, read-only git commands and, at start, your platform's browser opener.
- Its lesson engine and the code that runs the Checks make no network request.
- Its logs carry an error's message only, never a header value or a cookie.
- In a Codespace, keep the port private. Private is the default when you forward a port, and a public port is visible to anyone who knows its URL and port number ([Forwarding ports in your codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace)).
- To report a problem with the server, use the private advisory below.

## Reporting a vulnerability

If you find a security issue in any script or instruction in this repo (for example a hook that could be abused, an unsafe command in a walkthrough, or a link pointing somewhere malicious), please report it privately via [GitHub security advisories](https://github.com/wesammustafa/Claude-Code-Quest/security/advisories/new) rather than a public issue.

Issues in Claude Code itself should go to [anthropics/claude-code](https://github.com/anthropics/claude-code/issues) or Anthropic's [responsible disclosure program](https://www.anthropic.com/responsible-disclosure-policy).

<sub>Sources: [Forwarding ports in your codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace)</sub>
