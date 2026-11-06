# A companion skill for Claude Code Quest

One project skill for your practice copy: `/quest` reads the progress Claude Code Quest saves in `.practice/learn.json` and the course in `learn/course.json`, and says which lesson and step you are on, what the step asks for, and what its check looks for. The app stays free of AI; the skill only reads the app's own files. Copy it from `dot-claude/skills/` into `.claude/skills/` in your practice copy, where Claude Code loads project skills ([Extend Claude with skills](https://code.claude.com/docs/en/skills#where-skills-live)):

```bash
mkdir -p .claude/skills
cp -R <path-to-this-folder>/dot-claude/skills/quest .claude/skills/
```

| Skill | What it does | Runs |
|---|---|---|
| `quest` | Says where you are in the quest and what the current step's check looks for, and compares a failing check's rule with your files. Tells Claude to change no files. | `/quest` or `/quest <question>` only: it is run by name, so it never loads on its own in the middle of a lesson |

`SKILL.md` carries its header block as comments at the top of its frontmatter: what it does, when it runs, side effects, platforms, how to remove it, and its test line. The skill pre-approves no tool, so Claude asks before anything your permission settings don't already allow.

If `.claude/skills/` didn't exist when your session started, run `/reload-skills` to load it ([Extend Claude with skills](https://code.claude.com/docs/en/skills#live-change-detection)). Remove it by deleting `.claude/skills/quest/`. Your practice copy's `.gitignore` does not ignore `.claude/`, so commit the skill or leave it untracked as you prefer: the lesson checks read neither.

Smoke test, without Claude: `bash test.sh`.

`quest`: Not yet tested in a session at this edition's version
