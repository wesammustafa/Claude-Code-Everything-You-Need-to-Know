@AGENTS.md

## Claude Code notes

- When you edit this guide, load the bundled `/claude-api` skill before you state a model fact, then confirm the fact on its Tier 1 source from the table in `AGENTS.md`. The guide states no prices or plan limits.
- This repo's root `.claude/` holds no hooks and no allow rules: only a deny rule for reading `.env` files, a skill and a workflow ([SECURITY.md](SECURITY.md)). `examples/` is inert until copied; review every file before copying it. Never add a `.claude/`, `CLAUDE.md`, `AGENTS.md` or `.mcp.json` under `examples/`.
