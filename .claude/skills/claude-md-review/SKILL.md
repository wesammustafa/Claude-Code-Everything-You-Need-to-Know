---
description: Audit a CLAUDE.md file for the patterns that actually degrade Claude Code's output — vagueness, unnamed files, stale facts, and bloat. Use when asked to review, audit, improve, shrink, or fix a CLAUDE.md, and when a project's results feel inconsistent or Claude keeps rediscovering the same context.
when_to_use: Trigger phrases include "review my CLAUDE.md", "why does Claude keep forgetting", "my CLAUDE.md is too long", "Claude ignores my instructions", "audit project instructions".
argument-hint: "[path to CLAUDE.md, defaults to ./CLAUDE.md]"
allowed-tools: Read, Glob, Grep
---

# CLAUDE.md Review

Audit a `CLAUDE.md` against the failure modes that actually cost output quality.

**Premise:** `CLAUDE.md` loads into context on every single session, so every line is either paying rent or costing you tokens on every turn forever. Most "the model isn't following instructions" problems are instruction problems.

## Steps

1. Read the target file (default `./CLAUDE.md`; also check `~/.claude/CLAUDE.md` and any nested `**/CLAUDE.md` if the project has them, since the closest one wins).
2. Score each dimension below and quote the specific lines that fail.
3. Output the report format at the bottom. Propose concrete rewrites, not "consider being more specific."

## What to check

**Specificity** — the highest-leverage dimension.
- Flag unfalsifiable directives: "write clean code", "follow best practices", "be careful", "use good naming".
- Every rule should be checkable by reading a diff. `"Refactor functions over 40 lines"` is checkable; `"keep functions short"` is not.

**Named anchors.**
- Rules that reference "the config", "our API layer", or "the usual pattern" force rediscovery every session. Replace with real paths: `src/config/env.ts`, `src/api/client.ts`.
- Verify every path, command, and filename mentioned still exists. Report the dead ones — a `CLAUDE.md` pointing at a deleted file actively misleads.

**Staleness.**
- Version numbers, model names, and tool commands that no longer match the repo.
- Instructions for a framework, script, or directory that's since been removed.
- Cross-check build/test/lint commands against `package.json`, `Makefile`, `pyproject.toml`, or equivalent — a wrong test command is worse than none.

**Bloat and rent.**
- Anything derivable from the code itself (file tree listings, dependency lists, restating what a function does). Claude can read the repo.
- Long procedures that only apply to one occasional task: those belong in a skill, whose body loads only when used, rather than in context on every turn.
- Generic advice that applies to all software everywhere and therefore teaches nothing about *this* project.

**Conflicts.**
- Rules that contradict each other, or contradict what the code actually does. Flag both sides and ask which wins.
- Precedence surprises: a nested `CLAUDE.md` or `~/.claude/CLAUDE.md` overriding what the author expects.

**What's missing.** The gaps worth calling out, if absent:
- How to run tests, build, and lint — the three things needed to self-verify a change.
- Non-obvious project constraints (a directory that must not be touched, a generated file, a required migration step).
- Conventions that are genuinely surprising and not visible from a quick read of the code.

## Output format

```
## CLAUDE.md review — <path> (<N> lines)

**Verdict:** <one sentence>

### Blocking
- L<n>: <quoted line> → <concrete rewrite>

### Worth fixing
- L<n>: <quoted line> → <concrete rewrite>

### Delete (costs context on every session, earns nothing)
- L<n>–<m>: <what and why>

### Missing
- <gap> → <suggested line to add>

**Estimated size after edits:** <N> lines (from <M>)
```

## Rules

- Quote real line numbers and real text. Never invent a finding to fill a section.
- If a section has no findings, write `None.` — a clean file is a valid result.
- Prefer deleting to rewriting. The best `CLAUDE.md` is short enough that people actually read it.
- Do not edit the file unless asked. Report first.
