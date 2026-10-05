@AGENTS.md

## Claude Code notes

- When you edit this guide, load the bundled `/claude-api` skill before you state a model fact, then confirm the fact on its Tier 1 source from the table in `AGENTS.md`. The guide states no prices or plan limits.
- This repo's example hook, when `.claude/settings.json` registers it, can run in your session with the user's full permissions: `.claude/hooks/notification.py` speaks a message aloud when Claude Code needs input, using the ElevenLabs or OpenAI API when those keys are in `.env` or the shell environment. Never commit `.env`, and pass `--settings '{"disableAllHooks": true}'` when you script `claude -p` in this clone ([SECURITY.md](SECURITY.md)).
