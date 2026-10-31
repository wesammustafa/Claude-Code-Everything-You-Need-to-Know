// Generated 2026-10-31 by a throwaway script (ticket 245, D10) with
//   node gen-overviews.ts
// It ran project(initialState(loadCourse)) and lesson.open for every Lesson,
// each Level's Work folder saved so `start` is set, and added `check` from
// CourseEntry.items (ticket 283's field). Regenerate when the course changes.
import type { CourseView, OverviewLesson } from "@quest/contract";

/** The compiled course, as the overviews' snapshots carry it. */
export const walkCourse = {
  levels: [
    {
      id: "beginner",
      complete: false,
      lessons: [
        {
          id: "b-1",
          number: 1,
          title: "Install, sign in and look around",
          minutes: "about 20 minutes",
          page: "docs/beginner/01-install-and-look-around.md",
          capstone: false,
          complete: false,
          badge: "Explorer",
          folder: {
            kind: "copy",
          },
          tearDownLeft: false,
        },
        {
          id: "b-2",
          number: 2,
          title: "Permission modes and plan mode",
          minutes: "about 25 minutes",
          page: "docs/beginner/02-permission-modes-and-plan-mode.md",
          capstone: false,
          complete: false,
          badge: "Planner",
          folder: {
            kind: "copy",
          },
          tearDownLeft: false,
        },
        {
          id: "b-3",
          number: 3,
          title: "Your first change, from request to commit",
          minutes: "about 20 minutes",
          page: "docs/beginner/03-first-change.md",
          capstone: false,
          complete: false,
          badge: "Builder",
          folder: {
            kind: "copy",
          },
          tearDownLeft: false,
        },
        {
          id: "b-4",
          number: 4,
          title: "Keep a session on track",
          minutes: "about 25 minutes",
          page: "docs/beginner/04-keep-a-session-on-track.md",
          capstone: false,
          complete: false,
          badge: "Navigator",
          folder: {
            kind: "copy",
          },
          tearDownLeft: false,
        },
        {
          id: "b-5",
          number: 5,
          title: "Project memory with CLAUDE.md",
          minutes: "about 20 minutes",
          page: "docs/beginner/05-project-memory.md",
          capstone: false,
          complete: false,
          badge: "Keeper",
          folder: {
            kind: "copy",
          },
          tearDownLeft: false,
        },
        {
          id: "b-capstone",
          number: 6,
          title: "Beginner capstone",
          minutes: "30 to 60 minutes",
          page: "docs/beginner/capstone.md",
          capstone: true,
          complete: false,
          badge: "Beginner",
          folder: {
            kind: "copy",
          },
          tearDownLeft: false,
        },
      ],
    },
    {
      id: "intermediate",
      complete: false,
      lessons: [
        {
          id: "i-1",
          number: 1,
          title: "Turn a repeated workflow into a skill",
          minutes: "about 20 minutes",
          page: "docs/intermediate/01-first-skill.md",
          capstone: false,
          complete: false,
          badge: "Crafter",
          folder: {
            kind: "work",
            level: "intermediate",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "i-2",
          number: 2,
          title: "Organize project memory and see what loaded",
          minutes: "about 20 minutes",
          page: "docs/intermediate/02-organize-memory.md",
          capstone: false,
          complete: false,
          badge: "Organizer",
          folder: {
            kind: "work",
            level: "intermediate",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "i-3",
          number: 3,
          title: "Pick the model and effort",
          minutes: "about 20 minutes",
          page: "docs/intermediate/03-model-and-effort.md",
          capstone: false,
          complete: false,
          badge: "Tuner",
          folder: {
            kind: "work",
            level: "intermediate",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "i-4",
          number: 4,
          title: "Permissions, settings scopes and the sandbox",
          minutes: "about 20 minutes",
          page: "docs/intermediate/04-permissions-and-sandbox.md",
          capstone: false,
          complete: false,
          badge: "Guardian",
          folder: {
            kind: "work",
            level: "intermediate",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "i-5",
          number: 5,
          title: "Enforce a rule with a hook",
          minutes: "about 20 minutes",
          page: "docs/intermediate/05-hooks.md",
          capstone: false,
          complete: false,
          badge: "Enforcer",
          folder: {
            kind: "work",
            level: "intermediate",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "i-6",
          number: 6,
          title: "Delegate to a custom subagent",
          minutes: "about 25 minutes",
          page: "docs/intermediate/06-subagents.md",
          capstone: false,
          complete: false,
          badge: "Delegator",
          folder: {
            kind: "work",
            level: "intermediate",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "i-7",
          number: 7,
          title: "Connect a tool with MCP",
          minutes: "about 25 minutes",
          page: "docs/intermediate/07-mcp.md",
          capstone: false,
          complete: false,
          badge: "Connector",
          folder: {
            kind: "work",
            level: "intermediate",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "i-8",
          number: 8,
          title: "Install and manage plugins",
          minutes: "about 25 minutes",
          page: "docs/intermediate/08-plugins.md",
          capstone: false,
          complete: false,
          badge: "Curator",
          folder: {
            kind: "work",
            level: "intermediate",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "i-capstone",
          number: 9,
          title: "Intermediate capstone",
          minutes: "30 to 60 minutes",
          page: "docs/intermediate/capstone.md",
          capstone: true,
          complete: false,
          badge: "Intermediate",
          folder: {
            kind: "pinned",
          },
          tearDownLeft: false,
        },
      ],
    },
    {
      id: "advanced",
      complete: false,
      lessons: [
        {
          id: "a-1",
          number: 1,
          title: "Parallel sessions with worktrees",
          minutes: "about 20 minutes",
          page: "docs/advanced/01-parallel-sessions.md",
          capstone: false,
          complete: false,
          badge: "Brancher",
          folder: {
            kind: "work",
            level: "advanced",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "a-2",
          number: 2,
          title: "Choose an orchestration pattern",
          minutes: "about 20 minutes",
          page: "docs/advanced/02-orchestration-patterns.md",
          capstone: false,
          complete: false,
          badge: "Strategist",
          folder: {
            kind: "work",
            level: "advanced",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "a-3",
          number: 3,
          title: "Run and save a dynamic workflow",
          minutes: "about 20 minutes, plus run time",
          page: "docs/advanced/03-dynamic-workflows.md",
          capstone: false,
          complete: false,
          badge: "Orchestrator",
          folder: {
            kind: "work",
            level: "advanced",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "a-4",
          number: 4,
          title: "Script Claude Code with `claude -p`",
          minutes: "about 20 minutes",
          page: "docs/advanced/04-headless.md",
          capstone: false,
          complete: false,
          badge: "Scripter",
          folder: {
            kind: "work",
            level: "advanced",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "a-5",
          number: 5,
          title: "GitHub Actions",
          minutes: "about 20 minutes, plus run time",
          page: "docs/advanced/05-github-actions.md",
          capstone: false,
          complete: false,
          badge: "Automator",
          folder: {
            kind: "new-copy",
            lesson: "a-5",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "a-6",
          number: 6,
          title: "Share your setup with a team",
          minutes: "about 20 minutes",
          page: "docs/advanced/06-share-your-setup.md",
          capstone: false,
          complete: false,
          badge: "Steward",
          folder: {
            kind: "work",
            level: "advanced",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "a-7",
          number: 7,
          title: "Put bounds on autonomous runs",
          minutes: "about 20 minutes, plus run time",
          page: "docs/advanced/07-bounded-runs.md",
          capstone: false,
          complete: false,
          badge: "Warden",
          folder: {
            kind: "work",
            level: "advanced",
            set: true,
          },
          tearDownLeft: false,
        },
        {
          id: "a-capstone",
          number: 8,
          title: "Advanced capstone",
          minutes: "60 to 90 minutes, plus run time",
          page: "docs/advanced/capstone.md",
          capstone: true,
          complete: false,
          badge: "Advanced",
          folder: {
            kind: "new-copy",
            lesson: "a-capstone",
            set: true,
          },
          tearDownLeft: false,
        },
      ],
    },
  ],
  next: "b-1",
} as CourseView;

/** Every Lesson's overview, with ticket 283's `check`. */
export const overviews = [
  {
    id: "b-1",
    title: "Install, sign in and look around",
    level: "beginner",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "start it safely in a repository",
        "stop it mid-answer",
        "tell which model and account a session uses",
        "check what it tells you against the code",
      ],
      payoff: "check what it tells you against the code",
      why: "Find and correct the wrong claim in a teammate's onboarding notes before the team builds CI on it.",
      read: "[How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works): what happens between your question and its answer.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "`claude --version` prints a Claude Code version",
      "the claim in `practice/b-1/onboarding.md` that the code contradicts is corrected",
    ],
  },
  {
    id: "b-2",
    title: "Permission modes and plan mode",
    level: "beginner",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "pick a permission mode for a task",
        "decide whether a change needs a plan",
        "use plan mode to approve only a plan you would merge, before Claude edits your files",
      ],
      payoff:
        "use plan mode to approve only a plan you would merge, before Claude edits your files",
      why: "Work a teammate's ticket so that nothing ships you'd reject in review.",
      read: "[Analyze before you edit with plan mode](https://code.claude.com/docs/en/permission-modes#analyze-before-you-edit-with-plan-mode): what plan mode lets Claude run while it plans.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "`.practice/b-2-before.txt`, saved while the plan was on screen, lists no changed files",
      "every file in `.practice/b-2-after.txt` is listed in `.practice/b-2-plan.txt`",
      "An unknown key in `linkcheck.json`, such as `ignores`, makes the tool exit with code 2 and name the key",
      "A broken link still makes the tool exit with code 1 and report the link",
    ],
  },
  {
    id: "b-3",
    title: "Your first change, from request to commit",
    level: "beginner",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "take a change from request to commit",
        "review a change well enough to catch what it gets wrong before it is committed",
      ],
      payoff:
        "review a change well enough to catch what it gets wrong before it is committed",
      why: "Decide whether a teammate's patch does only what it says, and fix it before it's committed.",
      read: "[Give Claude a way to verify its work](https://code.claude.com/docs/en/best-practices#give-claude-a-way-to-verify-its-work): why a test beats a summary.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "links with a title, in double or single quotes, are checked",
      "protocol-relative links, such as `//cdn.example.com/app.js`, are skipped, and every other link is checked as before",
      "your tests catch the planted flaw: with the patch's `isExternal` put back, they fail",
      "your last commit changes a test file and at least one other file",
      "the tests pass",
      "nothing is left uncommitted",
    ],
  },
  {
    id: "b-4",
    title: "Keep a session on track",
    level: "beginner",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "stop or rewind a change that went the wrong way",
        "keep the context to what matters",
        "pick the right conversation up again later",
      ],
      payoff: "stop or rewind a change that went the wrong way",
      why: "Try a teammate's rename script, then undo all of it: another tool imports `findLinks`.",
      read: "[Explore the context window](https://code.claude.com/docs/en/context-window): an interactive view of what fills a session.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "a commit after your copy's first one changes `src/check-links.js`, which still exports a synchronous `brokenLinks`",
      "`.practice/b-4-before-rewind.txt` lists `src/links.js` and `src/check-links.js`",
      "`.practice/b-4-after-rewind.txt` lists `src/links.js` and no other file in `src/` or `test/`",
      "`src/` and `test/` have no uncommitted changes, your last commit's `src/links.js` still exports `findLinks`, and `npm run linkcheck -- samples` runs without an error",
    ],
  },
  {
    id: "b-5",
    title: "Project memory with CLAUDE.md",
    level: "beginner",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "write a short, true project CLAUDE.md",
        "show that a new session follows it",
        "decide which memory file each instruction belongs in",
      ],
      payoff: "decide which memory file each instruction belongs in",
      why: "Sort four notes so each reaches only the people it's for, and no false one is committed.",
      read: "[Write an effective CLAUDE.md](https://code.claude.com/docs/en/best-practices#write-an-effective-claude-md): what to put in it and what to leave out.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "a committed CLAUDE.md has a rule that every new JavaScript file in `src/` starts with a given line",
      "a commit made after that rule adds JavaScript files to `src/`, and each of them starts with the rule's line",
      "the committed CLAUDE.md holds the notes' rule for CLI errors, and every `npm run` script it names is in `package.json`",
      "a committed `.gitignore` keeps `CLAUDE.local.md` out, git tracks no `CLAUDE.local.md`, and the committed CLAUDE.md holds neither personal note",
    ],
  },
  {
    id: "b-capstone",
    title: "Beginner capstone",
    level: "beginner",
    capstone: true,
    phase: "overview",
    intro: {
      can: ["fix a reported bug, from plan to commit"],
      payoff: "fix a reported bug, from plan to commit",
      why: "A missing folder in `linkcheck.json` passes silently: make linkcheck fail on it, test first.",
      read: null,
    },
    staircase: {
      planned: [
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: null,
    },
    notes: [],
    folderQuestion: null,
    start: {
      planned: true,
      less: false,
      first: null,
    },
    resumable: false,
    check: [
      "`.practice/capstone-before.txt`, saved while the plan was on screen, lists no changed files",
      "the commit in `.practice/capstone-commit.txt` changes only files listed in `.practice/capstone-plan.txt`, including a test",
      "the commit's test fails without its fix: with the other files it changes as they were before it, `npm test` fails",
      "the reported bug is fixed: a missing folder in `linkcheck.json` makes the tool exit with code 2 and name the folder",
      "the tests pass",
      "a committed CLAUDE.md names the test command, `npm test`",
      "nothing is left uncommitted",
    ],
  },
  {
    id: "i-1",
    title: "Turn a repeated workflow into a skill",
    level: "intermediate",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "turn a workflow you keep repeating into a project skill, choose which requests should load it, and review the change it produces.",
      ],
      payoff:
        "turn a workflow you keep repeating into a project skill, choose which requests should load it, and review the change it produces.",
      why: "Make test-first load for feature requests, never for questions, and leave the commit to you.",
      read: "[Extend Claude with skills](https://code.claude.com/docs/en/skills): every frontmatter field, arguments, supporting files and running a skill in a subagent.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [
      {
        kind: "need-repo",
        text: "One of your own repositories with a test command and no uncommitted changes",
      },
    ],
    folderQuestion: {
      key: "intermediate",
      asks: "work",
      current: "/home/sam/work-intermediate",
      problem: null,
      open: false,
      checking: false,
    },
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "`.claude/skills/tdd/SKILL.md` is committed, with no TODO left",
      "the tdd skill can run as `/tdd` and load on its own: a description, and no `disable-model-invocation: true`",
      "the commit in `.practice/i-1-commit.txt` changes a test and the code it tests",
    ],
  },
  {
    id: "i-2",
    title: "Organize project memory and see what loaded",
    level: "intermediate",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "split a project's instructions into imports and scoped rules",
        "find out which instruction files loaded when Claude doesn't follow one",
      ],
      payoff:
        "find out which instruction files loaded when Claude doesn't follow one",
      why: "A teammate's rule never takes effect. Find out why, and fix it.",
      read: "[Explore the .claude directory](https://code.claude.com/docs/en/claude-directory): the files you write in `.claude/` and `~/.claude`, and when Claude Code loads each one.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "a committed CLAUDE.md imports a file with `@path`, and the file exists",
      "a committed rule in `.claude/rules/` is scoped with `paths:`, and every scoped rule matches a file in the repository",
      "`.practice/i-2-loaded.txt` shows the imported file and a scoped rule loading",
    ],
  },
  {
    id: "i-3",
    title: "Pick the model and effort",
    level: "intermediate",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "diagnose a weak result before changing models",
        "choose model and effort settings for a real task",
        "give a routine skill its own settings",
      ],
      payoff: "give a routine skill its own settings",
      why: "A changelog entry is routine work: give it only what it needs, and keep root-cause work thorough.",
      read: "[Model configuration](https://code.claude.com/docs/en/model-config): defaults by account and provider, and organization limits.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "the committed changelog skill runs a smaller model at low or medium effort",
      "a committed CHANGELOG.md has an entry under `## Unreleased`",
    ],
  },
  {
    id: "i-4",
    title: "Permissions, settings scopes and the sandbox",
    level: "intermediate",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "choose a narrow permission rule, put it in the right settings scope, and verify the sandbox's boundary.",
      ],
      payoff:
        "choose a narrow permission rule, put it in the right settings scope, and verify the sandbox's boundary.",
      why: "Keep `.env` from Claude for everyone, keep tests prompt-free, and make pushes ask first.",
      read: "[Making Claude Code more secure and autonomous with sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing): why the sandbox has a filesystem boundary and a network boundary.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [
      {
        kind: "need-repo",
        text: "One of your own repositories with a test command for Your turn; or use the practice copy for both.",
      },
    ],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "the committed `.claude/settings.json` denies reading `.env` files and allows a narrow test command",
      "the sandbox is on, and `.claude/settings.local.json` stays out of git",
      "the committed `.claude/settings.json` asks before a command the team approves each time, such as `git push`",
    ],
  },
  {
    id: "i-5",
    title: "Enforce a rule with a hook",
    level: "intermediate",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "enforce a rule with a hook that fails closed, and send Claude back to work when it stops while your tests fail.",
      ],
      payoff:
        "enforce a rule with a hook that fails closed, and send Claude back to work when it stops while your tests fail.",
      why: "Claude sometimes stops while the tests fail: send it back to work when it does, in every session.",
      read: "[Hooks reference](https://code.claude.com/docs/en/hooks): every event, its input and its output.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [
      {
        kind: "need-repo",
        text: "The repository from [lesson 4](04-permissions-and-sandbox.md), with its `.claude/settings.json` and a test command, and your copy of the practice template with Node.js LTS: the check runs from the copy.",
      },
    ],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "`.claude/hooks/protect-files.sh` and `.claude/hooks/test-gate.sh` are committed and executable",
      'the committed `.claude/settings.json` runs protect-files.sh as a `PreToolUse` hook for Edit and Write, with `"onFailure": "block"`',
      "the committed test gate exits 2 with a reason while the tests fail, and 0 once they pass or after one retry",
      "the committed `.claude/settings.json` runs test-gate.sh as a `Stop` hook",
    ],
  },
  {
    id: "i-6",
    title: "Delegate to a custom subagent",
    level: "intermediate",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "write a subagent that has only the tools its task needs",
        "delegate work to it",
      ],
      payoff: "write a subagent that has only the tools its task needs",
      why: "Hand the noisy search for untested code to a read-only helper, and keep only its findings.",
      read: "[Create custom subagents](https://code.claude.com/docs/en/sub-agents): every frontmatter field, background subagents and resuming one.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [
      {
        kind: "need-repo",
        text: "One of your own repositories, and your copy of the practice template with Node.js LTS: the check runs from the copy.",
      },
    ],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "`.claude/agents/test-gaps.md` is committed with its name and a description of when to use it",
      "its `tools` list only reads code: no tool that edits files, runs commands or reaches the web",
      "`.practice/i-6-agents.txt` shows Claude delegating to test-gaps",
    ],
  },
  {
    id: "i-7",
    title: "Connect a tool with MCP",
    level: "intermediate",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "connect a version-pinned MCP server at the right scope and use its browser evidence to find and fix a page error.",
      ],
      payoff:
        "connect a version-pinned MCP server at the right scope and use its browser evidence to find and fix a page error.",
      why: "Give every teammate the exact browser server you reviewed, then use it to fix the broken demo page.",
      read: "[Connect to MCP servers](https://code.claude.com/docs/en/mcp-quickstart): adding remote servers, signing in to them, and other ways to add one.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [
      {
        kind: "need-repo",
        text: "One of your own repositories, and your copy of the practice template with Node.js LTS: the check runs from the copy.",
      },
    ],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "the committed `.mcp.json` runs chrome-devtools-mcp at an exact version, with usage statistics, CrUX lookups and update checks off",
      "`.practice/i-7-page.png` holds a PNG image of the repaired page",
      "the demo script displays `2 links ready` without a script error",
    ],
  },
  {
    id: "i-8",
    title: "Install and manage plugins",
    level: "intermediate",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "judge a plugin before you install it, trial code intelligence locally on your own code, and share only the plugin your team chose.",
      ],
      payoff:
        "judge a plugin before you install it, trial code intelligence locally on your own code, and share only the plugin your team chose.",
      why: "Share only the plugin the team chose, so nobody pulls in the trial you're still judging.",
      read: "[Code intelligence plugins](https://code.claude.com/docs/en/plugins/code-intelligence): language choices, server setup and troubleshooting.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "the committed `.claude/settings.json` enables a plugin from one of Anthropic's marketplaces",
      "`.practice/i-8-plugins.json`, saved in this repository, shows that plugin installed at project scope and enabled",
      "a code intelligence plugin you trialled is installed at local scope here, and the committed settings leave it off",
    ],
  },
  {
    id: "i-capstone",
    title: "Intermediate capstone",
    level: "intermediate",
    capstone: true,
    phase: "overview",
    intro: {
      can: [
        "get a repository ready for a new teammate",
        "choose the mechanism for each need",
        "pick the model and effort for each job",
      ],
      payoff: "get a repository ready for a new teammate",
      why: "A teammate starts Monday with only what's in git: commit a setup that works like the team's.",
      read: null,
    },
    staircase: {
      planned: [
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: null,
    },
    notes: [],
    folderQuestion: null,
    start: {
      planned: true,
      less: false,
      first: null,
    },
    resumable: false,
    check: [
      "a committed project skill that runs the link checker by name and can load on its own",
      "Claude's file-editing tools can't change `samples/` but can edit the rest: a committed `Edit` deny rule, or a fail-closed `PreToolUse` hook",
      "a committed reviewer subagent with only tools that read code",
      "the committed `.mcp.json` runs chrome-devtools-mcp at an exact version, with usage statistics, CrUX lookups and update checks off",
      "the committed `.claude/settings.json` enables a plugin from one of Anthropic's marketplaces",
      "the committed `.claude/settings.json` denies reading `.env` files and allows a narrow test command",
      "the committed `.claude/settings.json` turns the sandbox on, and `.claude/settings.local.json` stays out of git",
      "a committed CLAUDE.md imports a file with `@path`, and the file exists",
      "a committed rule in `.claude/rules/` is scoped with `paths:`, and every scoped rule matches a file in the repository",
      "the tests pass",
      "nothing is left uncommitted",
      "the committed CLI reports malformed percent escapes as broken links and still resolves valid encoded paths",
      "`.practice/i-capstone-agents.txt` shows Claude delegating to the committed reviewer",
      "the committed `.claude/settings.json` asks before a command the team approves each time, such as `git push`",
    ],
  },
  {
    id: "a-1",
    title: "Parallel sessions with worktrees",
    level: "advanced",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "run two Claude Code sessions at once, each in its own git worktree, and merge their work into one branch",
      ],
      payoff:
        "run two Claude Code sessions at once, each in its own git worktree, and merge their work into one branch",
      why: "Land two backlog changes made at once, with neither session touching the other's files.",
      read: "[Isolate subagents with worktrees](https://code.claude.com/docs/en/worktrees#isolate-subagents-with-worktrees): `isolation: worktree` in a subagent's frontmatter gives each run a checkout of its own.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [
      {
        kind: "need-repo",
        text: "One of your own repositories with a test command and no uncommitted changes, checked out on its default branch and up to date with a remote you can push to",
      },
    ],
    folderQuestion: {
      key: "advanced",
      asks: "work",
      current: "/home/sam/work-advanced",
      problem: null,
      open: false,
      checking: false,
    },
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "a committed `.gitignore` ignores `.claude/worktrees/` and not the rest of `.claude/`",
      "`.practice/a-1-worktrees.txt` lists two worktrees under `.claude/worktrees/` whose commits split from each other, and both changes are in your branch",
      "neither of those worktrees still exists",
    ],
  },
  {
    id: "a-2",
    title: "Choose an orchestration pattern",
    level: "advanced",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "choose between the main conversation, subagents, a dynamic workflow, `/batch` and an agent team by what a job needs and what it costs",
        "run a job as parallel subagents",
      ],
      payoff:
        "choose between the main conversation, subagents, a dynamic workflow, `/batch` and an agent team by what a job needs and what it costs",
      why: "pick the cheapest pattern for five backlog jobs, then run the one that needs parallel readers",
      read: "[Run agents in parallel](https://code.claude.com/docs/en/agents): the official comparison of the ways Claude Code works on several tasks at once, and how to check on each.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [
      {
        kind: "need-repo",
        text: "Your repository from [lesson 1](01-parallel-sessions.md), with at least three top-level folders that hold files",
      },
    ],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "`.practice/a-2-choices.md` picks the cheapest pattern that fits each job",
      "`.practice/i-6-agents.txt` shows at least two subagents other than `test-gaps` starting for job 1",
    ],
  },
  {
    id: "a-3",
    title: "Run and save a dynamic workflow",
    level: "advanced",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "keep one session working until a check you can run passes",
        "save an audit that fans out across many files, with each finding checked by a second agent, as a workflow command that takes its folder from `args`",
      ],
      payoff:
        "save an audit that fans out across many files, with each finding checked by a second agent, as a workflow command that takes its folder from `args`",
      why: "make the release audit a saved command that reports only the findings a second agent confirmed",
      read: "[Compare ways to keep a session running](https://code.claude.com/docs/en/goal#compare-ways-to-keep-a-session-running): `/goal`, `/loop` and a Stop hook, and what starts each next turn.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [
      {
        kind: "need-repo",
        text: "One of your own repositories with a test command that passes, such as `npm test`, and a migration it needs in one small folder",
      },
    ],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "a committed script in `.claude/workflows/` has a literal `export const meta`, with a `name` and a `description`, as its first statement, and reads its input from `args` and calls `agent()` at least twice",
      "the `git grep -E` pattern in `.practice/a-3-pattern.txt` matched in a folder at an earlier commit and matches nothing in that folder at `HEAD`",
    ],
  },
  {
    id: "a-4",
    title: "Script Claude Code with `claude -p`",
    level: "advanced",
    capstone: false,
    phase: "overview",
    intro: {
      can: ["write a script that runs Claude Code with no one at the keyboard"],
      payoff:
        "write a script that runs Claude Code with no one at the keyboard",
      why: "Build a pre-commit reviewer that runs nothing you didn't allow and never hides a failed run.",
      read: "[Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview): the same agent loop from Python or TypeScript.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [
      {
        kind: "need-repo",
        text: "One of your own repositories with a test command, and your copy of the practice template with Node.js LTS: the check runs from the copy.",
      },
    ],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "`scripts/review-staged.sh` is committed and executable",
      "its `claude -p` call asks for JSON in `dontAsk` mode, allows only `Read`, `Grep` and `Glob`, with no hook or MCP server, caps turns at 10 or fewer, and has the prompt right after `-p`",
      "it pipes the staged diff in, saves the JSON where its argument says, prints the result, exits non-zero when the run fails, and doesn't call Claude when nothing is staged",
      "`.practice/a-4-result.json` holds a run that succeeded within your cap",
    ],
  },
  {
    id: "a-5",
    title: "GitHub Actions",
    level: "advanced",
    capstone: false,
    phase: "overview",
    intro: {
      can: ["run Claude Code unattended in a GitHub Actions workflow"],
      payoff: "run Claude Code unattended in a GitHub Actions workflow",
      why: "run Claude in CI with every limit written in the file, then leave no credential in the copy",
      read: "[Code Review](https://code.claude.com/docs/en/code-review): Anthropic's managed review of your pull requests, for Team and Enterprise plans, with no workflow to maintain.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [],
    folderQuestion: {
      key: "a-5",
      asks: "new-copy",
      current: "/home/sam/work-a-5",
      problem: null,
      open: false,
      checking: false,
    },
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "a committed workflow runs `anthropics/claude-code-action` pinned to a release or a commit SHA, in automation mode, with its credential from a secret and none in the file",
      "its limits are in the file: `--max-turns` of at most 10, an `--allowedTools` list without unrestricted `Bash`, a read-only job token and `timeout-minutes`",
      "`.practice/a-5-runs.json` shows a completed, successful manual run on a commit that holds the workflow",
    ],
  },
  {
    id: "a-6",
    title: "Share your setup with a team",
    level: "advanced",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "commit the settings everyone should get, keep your personal files out of git, and give the team a plugin that loads from a marketplace inside the repository",
      ],
      payoff:
        "commit the settings everyone should get, keep your personal files out of git, and give the team a plugin that loads from a marketplace inside the repository",
      why: "give every teammate the same Claude Code kit from git, and let each of them opt out without a commit",
      read: "[A team's shared settings](https://code.claude.com/docs/en/settings-example#a-teams-shared-settings): a complete committed settings file to compare with yours.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [
      {
        kind: "need-repo",
        text: "Your own repository with your Intermediate setup",
      },
    ],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "a committed team marketplace lists a plugin by a relative path, and `.practice/a-6-validate.json` records a strict validation of that plugin that passed",
      "the committed `.claude/settings.json` registers that marketplace by a relative path and turns the plugin on",
      "a component you moved is in the plugin and gone from `.claude/`",
      "a committed `.gitignore` keeps `.claude/settings.local.json` and `CLAUDE.local.md` out, and git tracks neither",
    ],
  },
  {
    id: "a-7",
    title: "Put bounds on autonomous runs",
    level: "advanced",
    capstone: false,
    phase: "overview",
    intro: {
      can: [
        "Bound a real task from your backlog that is bigger than one slice",
      ],
      payoff:
        "Bound a real task from your backlog that is bigger than one slice",
      why: "Hand a real task to a run you'd trust overnight, and catch what it shouldn't have done.",
      read: "[Choose a sandbox environment](https://code.claude.com/docs/en/sandbox-environments): containers and VMs for runs the Bash sandbox can't cover.",
    },
    staircase: {
      planned: [
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Worked example",
          tier: "guided",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
      less: [
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Worked example",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "hinted",
        },
        {
          part: "Your turn",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
      ],
    },
    notes: [
      {
        kind: "need-repo",
        text: "The repository you scripted in [lesson 4](04-headless.md) and shared in [lesson 6](06-share-your-setup.md), with a test command",
      },
    ],
    folderQuestion: null,
    start: {
      planned: true,
      less: true,
      first: null,
    },
    resumable: false,
    check: [
      "`scripts/bounded-run.sh` is committed and executable, takes a task and a result path, and starts `claude -p` in `dontAsk` mode with JSON output, no MCP server and a committed `--settings` file",
      "it sets a turn limit and a spend limit",
      "every allow rule names one command or one folder, and the deny rules stop `git commit` and `git push`",
      "the settings file turns the sandbox on in strict mode without auto-allow, and makes the run refuse to start without it",
      "`.practice/a-7-slice.json` holds a slice run whose cost is under your spend limit",
    ],
  },
  {
    id: "a-capstone",
    title: "Advanced capstone",
    level: "advanced",
    capstone: true,
    phase: "overview",
    intro: {
      can: ["add CI review your team can share"],
      payoff: "add CI review your team can share",
      why: "one review for every pull request, the same on laptops and in CI, with nothing left unbounded",
      read: null,
    },
    staircase: {
      planned: [
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "The task",
          tier: "challenge",
        },
        {
          part: "Check",
          tier: "challenge",
        },
        {
          part: "Tear down",
          tier: "challenge",
        },
        {
          part: "Tear down",
          tier: "challenge",
        },
        {
          part: "Tear down",
          tier: "challenge",
        },
      ],
      less: null,
    },
    notes: [],
    folderQuestion: {
      key: "a-capstone",
      asks: "new-copy",
      current: "/home/sam/work-a-capstone",
      problem: null,
      open: false,
      checking: false,
    },
    start: {
      planned: true,
      less: false,
      first: null,
    },
    resumable: false,
    check: [
      "a committed `.gitignore` keeps the worktrees `.practice/a-capstone-worktrees.txt` lists inside the repository out of git, and not the rest of `.claude/`",
      "`.practice/a-capstone-worktrees.txt` lists two worktrees of this repository whose commits split from each other, and both changes are in your branch",
      "a committed script in `.claude/workflows/` has a literal `export const meta`, with a `name` and a `description`, as its first statement, and calls `agent()` at least twice",
      "`scripts/review-staged.sh` is committed and executable",
      "its `claude -p` call asks for JSON in `dontAsk` mode, allows only `Read`, `Grep` and `Glob`, with no hook or MCP server, caps turns at 10 or fewer, and has the prompt right after `-p`",
      "it pipes the staged diff in, saves the JSON where its argument says, prints the result, exits non-zero when the run fails, and doesn't call Claude when nothing is staged",
      "`.practice/a-capstone-run.json` holds a run that succeeded within your cap",
      "a committed workflow runs `anthropics/claude-code-action` on `pull_request`, pinned to a release or a commit SHA, in automation mode, with its credential from a secret and none in the file, a read-only job token, `--max-turns` of at most 10, an `--allowedTools` list without unrestricted `Bash` and `timeout-minutes` of at most 30",
      "no Claude API key or token is committed, at `HEAD` or in the commit the workflow item reads",
      "a committed team marketplace lists a plugin by a relative path, and the entry's name matches the `name` in the plugin's `plugin.json`",
      "the committed `.claude/settings.json` registers that marketplace by a relative path and turns the plugin on",
      "the tests pass",
      "nothing is left uncommitted",
      "the review script's `claude -p` call caps spend with `--max-budget-usd`, and `.practice/a-capstone-run.json` cost less than that cap",
      "the review script's `claude -p` prompt and the CI workflow's `prompt` both run one skill committed in `.claude/skills/`",
      "the CI workflow sets a `concurrency` group with `cancel-in-progress: true`, so a new push cancels the review still running",
      "`.practice/a-capstone-ci.json` shows a completed, successful `pull_request` run of the review workflow",
    ],
  },
] as (OverviewLesson & { check: string[] })[];

/** i-1's overview with no Work folder saved: the folder question asks. */
export const i1Asking = {
  id: "i-1",
  title: "Turn a repeated workflow into a skill",
  level: "intermediate",
  capstone: false,
  phase: "overview",
  intro: {
    can: [
      "turn a workflow you keep repeating into a project skill, choose which requests should load it, and review the change it produces.",
    ],
    payoff:
      "turn a workflow you keep repeating into a project skill, choose which requests should load it, and review the change it produces.",
    why: "Make test-first load for feature requests, never for questions, and leave the commit to you.",
    read: "[Extend Claude with skills](https://code.claude.com/docs/en/skills): every frontmatter field, arguments, supporting files and running a skill in a subagent.",
  },
  staircase: {
    planned: [
      {
        part: "Worked example",
        tier: "guided",
      },
      {
        part: "Worked example",
        tier: "guided",
      },
      {
        part: "Worked example",
        tier: "guided",
      },
      {
        part: "Worked example",
        tier: "guided",
      },
      {
        part: "Your turn",
        tier: "hinted",
      },
      {
        part: "Your turn",
        tier: "hinted",
      },
      {
        part: "Your turn",
        tier: "hinted",
      },
      {
        part: "Your turn",
        tier: "hinted",
      },
      {
        part: "Your turn",
        tier: "challenge",
      },
      {
        part: "Check",
        tier: "challenge",
      },
    ],
    less: [
      {
        part: "Worked example",
        tier: "hinted",
      },
      {
        part: "Worked example",
        tier: "hinted",
      },
      {
        part: "Worked example",
        tier: "hinted",
      },
      {
        part: "Worked example",
        tier: "hinted",
      },
      {
        part: "Your turn",
        tier: "hinted",
      },
      {
        part: "Your turn",
        tier: "hinted",
      },
      {
        part: "Your turn",
        tier: "hinted",
      },
      {
        part: "Your turn",
        tier: "hinted",
      },
      {
        part: "Your turn",
        tier: "challenge",
      },
      {
        part: "Check",
        tier: "challenge",
      },
    ],
  },
  notes: [],
  folderQuestion: {
    key: "intermediate",
    asks: "work",
    current: null,
    problem: null,
    open: true,
    checking: false,
  },
  start: null,
  resumable: false,
} as OverviewLesson;
