// Typed b-1 snapshots for the screens tests and the preview specs, taken
// from a run of the built app on a fresh Practice copy (221) and trimmed:
// the course keeps two Lessons, and the workspace sits on the Check step
// with one line not met yet and a hint ready, its command as a run line.
// Times are fixed.
import type {
  ActiveLesson,
  CompleteLesson,
  CourseView,
  LearnerView,
  Milestone,
  OverviewLesson,
  PlayingLesson,
  Snapshot,
  StepDownLesson,
} from "@quest/contract";

export const FIXTURE_INSTANCE = "e2e";

export const course: CourseView = {
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
      ],
    },
  ],
  next: "b-1",
};

/** A first run: not welcomed yet, greeted by first name. */
export const learner: LearnerView = {
  welcomed: false,
  name: "Sam",
  practiceCopy: "/home/sam/practice",
  workFolders: [],
  card: [],
  mastery: {},
  windows: false,
  saving: true,
};

export const overview: OverviewLesson = {
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
};

export const playing: PlayingLesson = {
  id: "b-1",
  title: "Install, sign in and look around",
  level: "beginner",
  capstone: false,
  phase: "playing",
  steps: [
    {
      id: "W1",
      part: "Worked example",
      title: "Run the installer",
      tier: "guided",
      state: "done",
      optional: false,
    },
    {
      id: "W2",
      part: "Worked example",
      title: "Check the install",
      tier: "guided",
      state: "done",
      optional: false,
    },
    {
      id: "W3",
      part: "Worked example",
      title: "Start, sign in and trust",
      tier: "guided",
      state: "done",
      optional: false,
    },
    {
      id: "W4",
      part: "Worked example",
      title: "Compare the session",
      tier: "guided",
      state: "done",
      optional: false,
    },
    {
      id: "W5",
      part: "Worked example",
      title: "Ask, stop and ask again",
      tier: "guided",
      state: "done",
      optional: false,
    },
    {
      id: "W6",
      part: "Worked example",
      title: "Check the source",
      tier: "guided",
      state: "done",
      optional: false,
    },
    {
      id: "Y1",
      part: "Your turn",
      title: "Check the onboarding notes",
      tier: "hinted",
      state: "done",
      optional: false,
    },
    {
      id: "Y2",
      part: "Your turn",
      title: "Read the cited lines",
      tier: "hinted",
      state: "done",
      optional: false,
    },
    {
      id: "Y3",
      part: "Your turn",
      title: "Correct one claim",
      tier: "challenge",
      state: "done",
      optional: false,
    },
    {
      id: "Y4",
      part: "Your turn",
      title: "Finish from a clean tree",
      tier: "hinted",
      state: "done",
      optional: false,
    },
    {
      id: "C",
      part: "Check",
      title: "Check",
      tier: "challenge",
      state: "current",
      optional: false,
    },
  ],
  step: {
    index: 10,
    id: "C",
    part: "Check",
    title: "Check",
    tier: "challenge",
    authoredTier: "challenge",
    where: {
      kind: "terminal",
      terminal: null,
      folder: null,
    },
    note: null,
    doneBefore: false,
    extraHelp: false,
    warmup: null,
  },
  beat: {
    index: 0,
    kind: "do",
    last: false,
    lines: [
      // Shown as its run line, as at Hinted, for the preview specs' Command.
      { kind: "run", text: "npm run check -- b-1", watched: false },
    ],
    code: null,
    commandsInHints: false,
    ask: null,
    self: null,
    doneLabel: null,
    wait: null,
    why: {
      onCard: null,
      all: [],
    },
    winNote: null,
    codespace: null,
    options: [],
    answer: {
      picked: null,
      feedback: null,
      because: null,
      point: null,
      reveal: null,
      recall: null,
    },
    status: "fail",
    running: null,
    checking: null,
    verification: [
      {
        text: "`claude --version` prints a Claude Code version",
        pass: true,
      },
      {
        text: "the claim in `practice/b-1/onboarding.md` that the code contradicts is corrected",
        pass: false,
      },
    ],
    evidence: null,
    found: null,
    fail: 'The note still says "linkcheck always exits with code 0, even when it finds broken links, so it can\'t fail a CI job on its own". Ask Claude which file decides how linkcheck exits, open that line yourself, and write what the code does.',
    broken: null,
    same: false,
    slowWait: false,
    stale: false,
  },
  hints: {
    shown: [],
    available: true,
    unavailable: null,
    confirmExact: false,
  },
  offers: {
    // Y3's back line, so the bar shows Back as well.
    back: {
      to: "Y2",
      title: "Read the cited lines",
      why: "Reopen the cited source line and compare the claim with it.",
    },
    skip: null,
  },
  waitQuestion: null,
};

/**
 * The same step watching, before its Check runs: what the preview specs
 * show, with a hint ready. The slow item waits for Check again.
 */
export const watching: PlayingLesson = {
  ...playing,
  beat: {
    ...(playing.beat as NonNullable<PlayingLesson["beat"]>),
    status: "waiting",
    fail: null,
    slowWait: true,
    verification: [],
  },
};

/** `watching` with the step's first hint open, as hint.next answers it. */
export const hinted: PlayingLesson = {
  ...watching,
  hints: {
    ...watching.hints,
    shown: [
      {
        kind: "check",
        text: "Does the corrected claim state the broken-link exit code?",
      },
    ],
    available: false,
  },
};

export const stepDown: StepDownLesson = {
  id: "b-1",
  title: "Install, sign in and look around",
  level: "beginner",
  capstone: false,
  phase: "step-down",
  from: "hinted",
  to: "challenge",
  toCome: [
    {
      tier: "challenge",
      count: 1,
    },
  ],
  moreHelp: false,
};

export const complete: CompleteLesson = {
  id: "b-1",
  title: "Install, sign in and look around",
  level: "beginner",
  capstone: false,
  phase: "complete",
  practised: [
    {
      skill: "install",
      mastery: {
        used: "commands",
        at: 1793380000000,
      },
    },
    {
      skill: "start",
      mastery: {
        used: "commands",
        at: 1793380000000,
      },
    },
    {
      skill: "status",
      mastery: {
        used: "commands",
        at: 1793380000000,
      },
    },
    {
      skill: "ask",
      mastery: {
        used: "own",
        at: 1793380000000,
      },
    },
    {
      skill: "exit",
      mastery: {
        used: "hints",
        at: 1793380000000,
      },
    },
    {
      skill: "check",
      mastery: {
        used: "own",
        at: 1793380000000,
      },
    },
  ],
  badge: "Explorer",
  firstTime: true,
  checkSummary: [
    {
      text: "`claude --version` prints a Claude Code version",
      pass: true,
    },
    {
      text: "the claim in `practice/b-1/onboarding.md` that the code contradicts is corrected",
      pass: true,
    },
  ],
  staircase: [
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
  handover: false,
  invitation: false,
  next: {
    id: "b-2",
    title: "Permission modes and plan mode",
    notchHarder: true,
  },
};

/** b-1 completed for the first time: its Badge waits to be shown. */
export const completed: Milestone[] = [
  {
    id: "e2e.37",
    revision: 1,
    serverTime: 1793380000000,
    type: "lesson.completed",
    badge: "Explorer",
    capstone: false,
    firstTime: true,
  },
];

// The whole course, all 3 Levels and 23 Lessons with their capstones, as the
// engine projects it (project of initialState on the compiled course), made
// once on 2026-10-31 for the Learning journey (243). Then b-1 to b-3 were
// set complete, their Badges earned, and next set to b-4.
export const fullCourse: CourseView = {
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
          complete: true,
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
          complete: true,
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
          complete: true,
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
            set: false,
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
            set: false,
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
            set: false,
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
            set: false,
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
            set: false,
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
            set: false,
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
            set: false,
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
            set: false,
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
            set: false,
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
            set: false,
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
            set: false,
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
            set: false,
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
            set: false,
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
            set: false,
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
            set: false,
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
            set: false,
          },
          tearDownLeft: false,
        },
      ],
    },
  ],
  next: "b-4",
};

/** The overview of another Lesson of fullCourse, with b-1's overview body. */
export function overviewAt(id: string): OverviewLesson {
  const summary = fullCourse.levels
    .flatMap((level) => level.lessons.map((lesson) => ({ level, lesson })))
    .find(({ lesson }) => lesson.id === id);
  if (!summary) throw new Error(`No Lesson ${id} in fullCourse`);
  return {
    ...overview,
    id,
    title: summary.lesson.title,
    level: summary.level.id,
    capstone: summary.lesson.capstone,
  };
}

/** A whole snapshot around one phase of b-1. */
export function snapshotOf(
  lesson: ActiveLesson,
  {
    revision = 1,
    welcomed = lesson.phase !== "overview",
    milestones = [],
    name = learner.name,
    course: view = course,
  }: {
    revision?: number;
    welcomed?: boolean;
    milestones?: Milestone[];
    name?: string | null;
    course?: CourseView;
  } = {},
): Snapshot {
  return {
    instance: FIXTURE_INSTANCE,
    revision,
    milestones,
    course: view,
    learner: { ...learner, welcomed, name },
    lesson,
  };
}
