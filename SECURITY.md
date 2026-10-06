# Security Policy

This repo's root [`.claude/`](.claude/) folder holds no hooks and no allow rules: only a deny rule for reading `.env` files, the [`claude-md-review`](.claude/skills/claude-md-review/SKILL.md) skill and the [`stale-docs-audit`](.claude/workflows/stale-docs-audit.js) workflow. Cloning the repo and trusting the folder in Claude Code runs nothing on its own. The skill loads when you or Claude invoke it and may read files without asking during the turn that invokes it (its `allowed-tools` lists Read, Glob and Grep), and the workflow runs when you start it. Copy-ready examples for the lessons go under `examples/`, at paths Claude Code does not load, and stay inert until you copy them into a project. Review every file before you copy it, the same way you'd review a shell script (the guide teaches the same in [Enforce a rule with a hook](docs/intermediate/05-hooks.md#watch-out)).

## Reporting a vulnerability

If you find a security issue in any script or instruction in this repo — e.g. a hook that could be abused, an unsafe command in a walkthrough, or a link pointing somewhere malicious — please report it privately via [GitHub security advisories](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/security/advisories/new) rather than a public issue.

Issues in Claude Code itself should go to [anthropics/claude-code](https://github.com/anthropics/claude-code/issues) or Anthropic's [responsible disclosure program](https://www.anthropic.com/responsible-disclosure-policy).
