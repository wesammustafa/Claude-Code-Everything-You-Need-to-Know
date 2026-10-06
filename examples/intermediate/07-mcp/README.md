# MCP server for Intermediate lesson 7

`dot-mcp.json` adds [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) (Vendor: Google, Apache-2.0) to a project, for the Intermediate lesson "Connect a tool with MCP". It lets Claude open pages in Chrome, read console messages and network requests, take screenshots and record performance traces.

Copy it to `.mcp.json` at your project's root, the file Claude Code reads project-scope servers from ([Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp#project-scope)):

```bash
cp <path-to-this-folder>/dot-mcp.json .mcp.json
```

`dot-mcp.json`:
- **What:** one stdio server, `chrome-devtools`, started with `npx` at the pinned version `chrome-devtools-mcp@1.10.1`.
- **When:** in an interactive session, Claude Code asks you to approve a project's servers before it uses them. In a `claude -p` run it loads them without asking ([Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp#project-scope)).
- **Side effects:** `npx` downloads the package from npm the first time. The server starts Chrome when Claude first uses a browser tool. `--isolated` gives that browser a temporary profile, deleted when the browser closes, so no cookies or logins carry over between sessions ([upstream advanced usage](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/chrome-devtools-mcp-v1.10.1/docs/advanced-usage.md#user-data-directory)).
- **Requires:** Node.js LTS with npm, and Chrome, current stable or newer ([upstream requirements](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/chrome-devtools-mcp-v1.10.1/README.md#requirements)).
- **Remove:** delete the `chrome-devtools` entry from `.mcp.json`, or the file.

> [!WARNING]
> Data that leaves your machine. By default the server sends usage statistics to Google, may send the URLs of performance traces to Google's CrUX API, and checks npm for updates ([upstream README](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/chrome-devtools-mcp-v1.10.1/README.md)). This config turns all three off with `--no-usage-statistics`, `--no-performance-crux` and `CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS`. The pages Claude opens are still fetched from the web as in any browser, and the server exposes everything in that browser to Claude: don't open pages with data you wouldn't paste into a session.

Third-party: it can run code on your machine or give Claude new tools. Review it before installing; this guide does not audit it.

Listings checked against the listing bar on 2026-10-06.

Smoke test, without Claude or the network: `bash test.sh`.

Tested in Claude Code v2.1.285 (stable) on macOS, 2026-10-06

Sources: [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp), [Chrome DevTools MCP README](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/chrome-devtools-mcp-v1.10.1/README.md), [Chrome DevTools MCP configuration](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/chrome-devtools-mcp-v1.10.1/docs/configuration.md), [Chrome DevTools MCP advanced usage](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/chrome-devtools-mcp-v1.10.1/docs/advanced-usage.md)
