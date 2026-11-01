export const DEMO_B2 = `---
lesson: b-2
title: "Demo"
stamp: "Verified against Claude Code v2.1.285 (stable) on 2026-10-05"
next: b-3
---

## intro
- minutes: "about 20 minutes"
- can: "do it"

## warm-up

### R1 | Warm-up | Status
- tier: challenge
- skill: status
- from: b-1
- beat: ask
- ask: Which command shows the account?
- right: "\`/status\`"
- wrong: "\`/usage\`"
- because: "Usage is something else."

### R2 | Warm-up | Version
- tier: challenge
- skill: save-version
- from: b-1
- beat: type
- ask: Which command prints the version?
- accept: claude --version
- reveal: "\`claude --version\`"

### R3 | Warm-up | Exit
- tier: challenge
- skill: exit
- from: b-1
- beat: ask
- ask: How do you end a session?
- right: "\`/exit\`"
- wrong: "\`/clear\`"
- because: "Clear is something else."

## steps

### W1 | Worked example step 1 of 1 | Save the list
- tier: guided
- skill: snapshot
- where: shell
- beat: do
- verify: check 0
- watching: .practice/b-2-before.txt
- evidence: .practice/b-2-before.txt
- run: "git status --porcelain > .practice/b-2-before.txt"

### Y1 | Your turn step 1 of 1 | Save it again
- tier: challenge
- skill: snapshot
- where: shell
- beat: do
- verify: check 0 fresh
- watching: .practice/b-2-before.txt
- evidence: .practice/b-2-before.txt
- goal: "Save it again."

### C | Check | Check
- tier: challenge
- skill: check
- where: terminal
- beat: do
- verify: check all
- goal: "Run the check."
`;

export const withCode = (lines) =>
  DEMO_B2.replace(
    '- run: "git status --porcelain > .practice/b-2-before.txt"\n',
    lines.map((line) => `${line}\n`).join(""),
  );

export const DEMO_I1 = `---
lesson: i-1
title: "Demo"
stamp: "Verified against Claude Code v2.1.308 (stable) on 2026-10-25"
next: i-2
---

## intro
- minutes: "about 20 minutes"
- can: "do it"

## warm-up

### R1 | Warm-up | Commit
- tier: challenge
- skill: commit
- from: b-5
- beat: ask
- ask: Which command records the change?
- right: "\`git commit\`"
- wrong: "\`git stash\`"
- because: "Stash is something else."

### R2 | Warm-up | Compact
- tier: challenge
- skill: compact
- from: b-4
- beat: ask
- ask: Which command summarizes the conversation?
- right: "\`/compact\`"
- wrong: "\`/clear\`"
- because: "Clear is something else."

## steps

### W1 | Worked example step 1 of 2 | Write the skill
- tier: guided
- skill: skill-file
- where: editor
- beat: do
- verify: check 0
- watching: .claude/skills/tdd/SKILL.md
- do: "Write the skill."

### W2 | Worked example step 2 of 2 | Commit it
- tier: challenge
- skill: commit
- where: shell
- beat: do
- verify: check 2
- watching: .practice/i-1-commit.txt
- goal: "Commit it."

### C | Check | Check
- tier: challenge
- skill: check
- where: terminal
- beat: do
- verify: check all
- goal: "Run the check."
`;

export const DEMO_I1_INDEX = DEMO_I1.replace(
  /### R2 \| Warm-up \| Compact\n[^#]*/,
  `### R2 | Warm-up | When to use what
- tier: challenge
- skill: when-to-use
- from: intermediate-index
- beat: ask
- ask: Which one runs on every matching event?
- right: "A hook"
- wrong: "A skill"
- because: "A skill is [something else](01-first-skill.md)."

`,
);
