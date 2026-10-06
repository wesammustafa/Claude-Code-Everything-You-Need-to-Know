# Skills for Intermediate lesson 1

Two project skills for the Intermediate lesson "Turn a repeated workflow into a skill". Copy a skill's folder from `dot-claude/skills/` into `.claude/skills/` in your project, where Claude Code loads project skills ([Extend Claude with skills](https://code.claude.com/docs/en/skills#where-skills-live)):

```bash
mkdir -p .claude/skills
cp -R <path-to-this-folder>/dot-claude/skills/five-whys .claude/skills/
```

| Skill | What it does | Runs |
|---|---|---|
| `five-whys` | Finds a problem's root cause by asking "why" until the answer is something you can fix. Tells Claude not to change any files. | `/five-whys <problem>`, or when Claude matches your request to its description |
| `tdd` | Builds a feature test-first. Unfinished on purpose: the lesson's Your turn has you finish it. | `/tdd <feature>` only, until you finish it |

Each `SKILL.md` carries its header block as comments at the top of its frontmatter: what it does, when it runs, side effects, platforms, how to remove it, and its test line. Neither skill pre-approves any tool, so Claude asks before anything your permission settings don't already allow.

If `.claude/skills/` didn't exist when your session started, run `/reload-skills` to load the new skill ([Extend Claude with skills](https://code.claude.com/docs/en/skills#live-change-detection)). Remove a skill by deleting its folder under `.claude/skills/`.

Smoke test, without Claude: `bash test.sh`.

Tested in Claude Code v2.1.285 (stable) on macOS, 2026-10-06
