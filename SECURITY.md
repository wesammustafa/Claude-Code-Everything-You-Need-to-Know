# Security Policy

This repo ships executable examples: Python hook scripts in [`.claude/hooks/`](.claude/hooks) and skills in [`.claude/commands/`](.claude/commands) that run with your shell permissions when you copy them into a project, and also when you run Claude Code inside a clone of this repo. In a clone, the hooks wired in [`.claude/settings.json`](.claude/settings.json) run in an interactive session once you accept the workspace trust dialog for the folder; `claude -p` and Agent SDK sessions never show that dialog and treat the folder as trusted, so the hooks run there without it ([workspace trust](https://code.claude.com/docs/en/hooks#workspace-trust)). The file's `permissions.allow` rules [apply only after you accept the dialog](https://code.claude.com/docs/en/permissions#project-allow-rules-and-workspace-trust). Review them like any shell script before use (the guide itself [preaches the same](docs/skills.md#skills-faq)). To script `claude -p` over the clone without its hooks, pass `--settings '{"disableAllHooks": true}'`.

## Reporting a vulnerability

If you find a security issue in any script or instruction in this repo — e.g. a hook that could be abused, an unsafe command in a walkthrough, or a link pointing somewhere malicious — please report it privately via [GitHub security advisories](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/security/advisories/new) rather than a public issue.

Issues in Claude Code itself should go to [anthropics/claude-code](https://github.com/anthropics/claude-code/issues) or Anthropic's [responsible disclosure program](https://www.anthropic.com/responsible-disclosure-policy).
