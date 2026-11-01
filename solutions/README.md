# Reference solutions

One worked solution per Lesson, in course order, for the Practice template a Learner copies. Each folder is named by the Lesson's id in [the course manifest](../course/manifest.json) and holds:

- the files the Lesson adds or changes, at their paths under the copy's `project/`, in the inert names the [examples](../examples/) use: `dot-claude/` for `.claude/`, `dot-mcp.json`, `CLAUDE.example.md`, `CLAUDE.local.example.md`, `AGENTS.example.md` and `dot-claude-plugin/`;
- `steps.sh`, the Lesson's git steps: when the files land, the commits, worktrees and merges, and the evidence a Check reads under `.practice/`.

No file here names a commit. Every commit, and every file that records one, is made by the replay's real git commands.

## How steps.sh runs

- With `sh`, in the copy's `project/` folder, so it stays POSIX: no bash features, no `sed -i`.
- `SOLUTION` names a temporary folder with this Lesson's files under their live names, and `COPY` names the copy's root.
- git runs with no user or system config, as "Practice Learner" `<learner@example.invalid>`, and with real dates.
- It copies the files itself, from `"$SOLUTION"`, when the Lesson's flow needs them.

## Replay

Assemble a template with `npm run template -- <folder>`, then apply the solutions to it:

```bash
npm run replay -- --through b-capstone <folder>
```

The replay makes the folder a fresh git repository with one commit, as a new copy is, then runs each Lesson's `steps.sh` in course order. Without `--through` it applies every Lesson. Then run `npm run check -- all` in `<folder>/project`. The replay is [quest/release/src/replay.mjs](../quest/release/src/replay.mjs).
