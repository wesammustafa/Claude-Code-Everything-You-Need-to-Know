# Turn a repeated workflow into a skill

<sub>**Intermediate** · Lesson 1 of 8 · about 20 minutes · Needs: [Intermediate index](README.md) · Verified against Claude Code v2.1.292 (stable) on 2026-10-20</sub>

## Goal

By the end of this lesson you can turn a workflow you keep repeating into a project skill, choose which requests should load it, and review the change it produces.

## You need

- One of your own repositories with a test command and no uncommitted changes, and your copy of the practice template with Node.js LTS: the check runs from the copy. To practice in the template copy instead, use it for both. Set up the repository's `.practice/` folder as the [Intermediate index](README.md#prepare-your-own-repository) describes, if you haven't yet.
- Usage: light to moderate. The Your turn builds one small feature.

> [!NOTE]
> From this level on, the lessons are written for macOS, Linux and WSL 2. On Windows, run Claude Code inside WSL 2 ([Set up on Windows](https://code.claude.com/docs/en/setup#set-up-on-windows)): native Windows has no sandbox, which lesson 4 uses, and the hooks in lesson 5 are bash scripts.

## The idea

Write a [skill](https://code.claude.com/docs/en/skills) when you paste the same playbook into chat for the third time ([Build your setup over time](https://code.claude.com/docs/en/features-overview#build-your-setup-over-time)). A skill is a folder holding a `SKILL.md` file: YAML frontmatter that says what the skill is for, then the instructions Claude follows. A project skill lives in `.claude/skills/<name>/SKILL.md`. Commit it, and everyone who works in the repository gets it.

Claude decides whether to load a skill from its description, plus any `when_to_use` text, in the skill listing, not from the skill body ([Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)). Invoking the skill loads the full instructions:

```mermaid
flowchart LR
  accTitle: Two ways a skill runs
  accDescr: You invoke a skill by name, or Claude matches a request to its listing. Either way Claude Code loads the full skill instructions.
  A["You type /five-whys and a problem"] --> C["Claude Code loads SKILL.md"]
  B["Claude matches your request to the skill listing"] --> C
  C --> D["Claude follows the instructions"]
```

- `$ARGUMENTS` receives the text after the skill's name ([Pass arguments to skills](https://code.claude.com/docs/en/skills#pass-arguments-to-skills)).
- Each skill Claude can load on its own sits in the skill listing, which adds to your context on every turn. `disable-model-invocation: true` makes invocation manual and keeps the description out. Use it for a workflow with side effects or whose timing you must control, such as a commit or a deploy ([Control who invokes a skill](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)).

## Worked example

1. In your repository, create the skill's folder and download this guide's example skill, [`five-whys`](../../examples/intermediate/01-first-skill/dot-claude/skills/five-whys/SKILL.md). Read it before you use it:

   ```bash
   mkdir -p .claude/skills/five-whys
   curl -fsSL https://raw.githubusercontent.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/main/examples/intermediate/01-first-skill/dot-claude/skills/five-whys/SKILL.md -o .claude/skills/five-whys/SKILL.md
   ```

   Without its header comments, it starts:

   ```markdown
   ---
   name: five-whys
   description: Finds the root cause of a bug, failure or recurring problem by asking "why" until the answer is a cause you can fix. Use when the user asks why something keeps happening, or wants the root cause rather than a quick fix.
   argument-hint: "[problem]"
   ---

   Find the root cause of this problem: $ARGUMENTS
   ```

   followed by the investigation steps and the rule "Don't change any files."
2. Start `claude` in the repository and run `/skills` ([Commands](https://code.claude.com/docs/en/commands)). If the [workspace trust dialog](https://code.claude.com/docs/en/security#additional-safeguards) appears, trust only a repository you own or have reviewed. The list includes `five-whys`, a project skill because it lives in `.claude/skills/` ([Choose where skills load](https://code.claude.com/docs/en/skills#where-skills-live)).
3. Run the skill by name, with a problem from your repository. For example, in the practice copy:

   ```text
   /five-whys npm run linkcheck -- samples exits with code 1
   ```

   Read the reported chain, root cause and proposed fixes. Your wording will differ. In a terminal in your repository, run [`git status --short`](https://git-scm.com/docs/git-status): only the downloaded skill should be new. Investigate any code edit before proceeding; this skill tells Claude to change nothing.
4. Run `/clear`, then ask a question that matches the description without naming the skill. For example, in the practice copy:

   ```text
   Why does the test suite pass even though samples/guide.md has a broken link? I want the root cause, not a quick fix.
   ```

   Look for a `Skill` tool call for `five-whys` before the investigation ([Tools reference](https://code.claude.com/docs/en/tools-reference)). If it does not appear, compare the request with the description, revise the request and try in a cleared conversation.

## Your turn

The team wants a test-first workflow for requested features, while explanation-only questions should stay read-only. Make test-first load for feature requests, never for questions, and leave the commit to you.

1. Download the partial [`tdd` skill](../../examples/intermediate/01-first-skill/dot-claude/skills/tdd/SKILL.md) and read it:

   ```bash
   mkdir -p .claude/skills/tdd
   curl -fsSL https://raw.githubusercontent.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/main/examples/intermediate/01-first-skill/dot-claude/skills/tdd/SKILL.md -o .claude/skills/tdd/SKILL.md
   ```

   The frontmatter has `description: TODO` and `disable-model-invocation: true`, and the Green and Refactor steps are unfinished. The skill ends by showing the diff, not by committing.
2. Decide which requests should load this skill before you edit it. Write the description for requested feature work; keep explanation-only questions outside its stated scope. The skill stops at a diff you review, so it has no side effect that needs a manual trigger, and it can load on its own.

   In your editor, finish it:
   - replace `TODO` in the description with what the skill does followed by "Use when" and the feature requests it fits;
   - write the Green and Refactor steps, keeping the Red step's style;
   - delete the `disable-model-invocation: true` line so this skill can load automatically as well as run by name.
3. Commit both reviewed skills with [git add](https://git-scm.com/docs/git-add) and [git commit](https://git-scm.com/docs/git-commit):

   ```bash
   git add .claude/skills/five-whys .claude/skills/tdd
   git commit -m "Add project skills"
   ```

   Run `git status --short` and resolve any remaining lesson changes before continuing.
4. In a session, run it by name on a small feature your repository needs. For example, in the practice copy:

   ```text
   /tdd a slugify(heading) function in src/slug.js that turns a Markdown heading into its link anchor: lowercase, punctuation dropped, spaces turned into hyphens
   ```

   Keep auto mode. Read the failing test output, the passing run and the complete diff. After Claude responds, Claude Code can suggest your next prompt; start typing to dismiss a suggestion you don't want, because the commit is yours to make ([Prompt suggestions](https://code.claude.com/docs/en/interactive-mode#prompt-suggestions)). If the change is what you asked for, commit the test and the code together in a terminal in your repository, then save that commit: [`git rev-parse HEAD > .practice/i-1-commit.txt`](https://git-scm.com/docs/git-rev-parse).
5. Probe the trigger both ways: on a request the skill should load for, and on one it shouldn't ([Evaluate and iterate on a skill](https://code.claude.com/docs/en/skills#evaluate-and-iterate-on-a-skill)). Run `/clear` and ask for another small feature test-first without naming the skill, such as `Add a countHeadings(markdown) function, test-first.` Press `Esc` as soon as the `Skill` tool call for `tdd` appears, before it starts editing ([Interactive mode](https://code.claude.com/docs/en/interactive-mode)). Run `/clear` again and ask a question, such as `Explain how isExternal decides that a link is external.` No `Skill` call for `tdd` should appear.

   If either probe fails, revise the description, commit it and repeat both. Then run `git status --short` and undo anything the probes changed, so the repository is clean.

## Check

You are done when all of these are true:

- [ ] The finished skill is committed with no TODO left: `git grep -n TODO HEAD -- .claude/skills/tdd` prints nothing.
- [ ] It can run as `/tdd` and load on its own: `git show HEAD:.claude/skills/tdd/SKILL.md` shows a description of what it does and when to use it, and no `disable-model-invocation: true`.
- [ ] The commit saved in `.practice/i-1-commit.txt` holds a test and the code it tests: `git show --stat $(cat .practice/i-1-commit.txt)` lists both.
- [ ] Self-check (not tested): `/tdd` ran the skill, a cleared conversation loaded `tdd` on its own for a feature request, and a question didn't load `tdd`.

Run `npm run check -- i-1 --dir <your repo>` from your practice copy, or `npm run check -- i-1` in the copy itself.

If the skill isn't committed, run `git check-ignore -v .claude/skills/tdd/SKILL.md`: an ignore rule that matches `.claude`, in a `.gitignore`, `.git/info/exclude` or your global excludes file, hides the folder from `git add`, so add the file with `git add -f`. If the invocation item fails, rewrite the description as what the skill does followed by "Use when" and the feature requests it fits, then commit again. If the commit item fails, run `/tdd` on a new small feature, review the diff, and commit the test with the code before you save that commit.

## Watch out

- A skill can pre-approve tools with `allowed-tools`, even in a `claude -p` run in a folder you've never trusted ([Pre-approve tools for a skill](https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill)). Read the skills in a repository before you run Claude Code there.
- If `.claude/skills/` didn't exist at session startup, run `/reload-skills`, and repeat it after each later change there ([Edit a skill during a session](https://code.claude.com/docs/en/skills#live-change-detection)). After editing an invoked skill, invoke it again to load the changed instructions ([Skill content lifecycle](https://code.claude.com/docs/en/skills#skill-content-lifecycle)).

## Go further

- [Introduction to agent skills](https://academy.claude.com/courses/introduction-to-agent-skills): Claude Academy's course on writing and sharing skills.
- [Agent Skills](https://agentskills.io): the open standard that Claude Code skills follow, which works across other AI tools too.
- [Extend Claude with skills](https://code.claude.com/docs/en/skills): every frontmatter field, arguments, supporting files and running a skill in a subagent.

---

<sub>Sources: [Extend Claude with skills](https://code.claude.com/docs/en/skills) · [Extend Claude Code](https://code.claude.com/docs/en/features-overview) · [Advanced setup](https://code.claude.com/docs/en/setup) · [Commands](https://code.claude.com/docs/en/commands) · [Security](https://code.claude.com/docs/en/security) · [Tools reference](https://code.claude.com/docs/en/tools-reference) · [Interactive mode](https://code.claude.com/docs/en/interactive-mode) · [git-status](https://git-scm.com/docs/git-status) · [git-add](https://git-scm.com/docs/git-add) · [git-commit](https://git-scm.com/docs/git-commit) · [git-rev-parse](https://git-scm.com/docs/git-rev-parse)</sub>

<sub>← [Intermediate index](README.md) · [Organize project memory and see what loaded](02-organize-memory.md) → · Topic: [Skills](../topics/skills.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-1)</sub>
