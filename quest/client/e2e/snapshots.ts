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
  Mastery,
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
  check: [],
  needs: [],
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
    decidedBy: "check",
    ranIn: null,
    watches: null,
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

/** The first Step-down, from Guided to Hinted, with more help on offer. */
export const stepDownGuided: StepDownLesson = {
  ...stepDown,
  from: "guided",
  to: "hinted",
  moreHelp: true,
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

/** fullCourse with every Lesson and Level complete, and nothing next. */
export const courseDone: CourseView = {
  levels: fullCourse.levels.map((level) => ({
    ...level,
    complete: true,
    lessons: level.lessons.map((lesson) => ({ ...lesson, complete: true })),
  })),
  next: null,
};

/** fullCourse with the Beginner Level complete, its capstone too, and i-1 next (249). */
export const beginnerDone: CourseView = {
  levels: fullCourse.levels.map((level) =>
    level.id === "beginner"
      ? {
          ...level,
          complete: true,
          lessons: level.lessons.map((lesson) => ({
            ...lesson,
            complete: true,
          })),
        }
      : level,
  ),
  next: "i-1",
};

/** The Beginner capstone completed for the first time, with no next in the Level (249). */
export const completeCapstone: CompleteLesson = {
  ...complete,
  id: "b-capstone",
  title: "Beginner capstone",
  capstone: true,
  badge: "Beginner",
  handover: true,
  invitation: true,
  next: {
    id: "i-1",
    title: "Turn a repeated workflow into a skill",
    notchHarder: false,
  },
};

/** The capstone's first completion and the Level complete it brought (249). */
export const levelCompleted: Milestone[] = [
  {
    id: "e2e.40",
    revision: 1,
    serverTime: 1793380000000,
    type: "lesson.completed",
    badge: "Beginner",
    capstone: true,
    firstTime: true,
  },
  {
    id: "e2e.41",
    revision: 1,
    serverTime: 1793380000000,
    type: "level.completed",
    level: "beginner",
  },
];

/** The last Level and the course complete, waiting together (249). */
export const courseCompleted: Milestone[] = [
  {
    id: "e2e.50",
    revision: 1,
    serverTime: 1793380000000,
    type: "level.completed",
    level: "advanced",
  },
  {
    id: "e2e.51",
    revision: 1,
    serverTime: 1793380000000,
    type: "course.completed",
  },
];

/** An unreadable-save notice ahead of b-1's first completion (249). */
export const noticeFirst: Milestone[] = [
  {
    id: "e2e.30",
    revision: 1,
    serverTime: 1793380000000,
    type: "notice",
    kind: "unreadable",
  },
  ...completed,
];

/** Three of b-1's skills with a step finished, in course order. */
export const someMastery: Record<string, Mastery> = {
  install: { used: "commands", at: 1793380000000 },
  ask: { used: "own", at: 1793380060000 },
  exit: { used: "hints", at: 1793380120000 },
};

/** A whole snapshot around one phase of b-1. */
export function snapshotOf(
  lesson: ActiveLesson,
  {
    revision = 1,
    welcomed = lesson.phase !== "overview",
    milestones = [],
    name = learner.name,
    course: view = course,
    mastery = {},
  }: {
    revision?: number;
    welcomed?: boolean;
    milestones?: Milestone[];
    name?: string | null;
    course?: CourseView;
    mastery?: Record<string, Mastery>;
  } = {},
): Snapshot {
  return {
    instance: FIXTURE_INSTANCE,
    revision,
    milestones,
    course: view,
    learner: { ...learner, welcomed, name, mastery },
    lesson,
  };
}

/** b-1's skills card, as the engine words it once its steps are done (244). */
export const cardEntries: LearnerView["card"] = [
  { skill: "esc", show: "Esc", does: "Stops Claude mid-turn.", lesson: "b-1" },
  {
    skill: "version",
    show: "claude --version",
    does: "Prints the installed `claude` version.",
    lesson: "b-1",
  },
];

/** `playing`'s Check step, moved to Lesson `id`, with `warmup` on its step. */
function playingAt(
  id: string,
  warmup: { from: string; explainer: boolean } | null,
): PlayingLesson {
  const summary = fullCourse.levels
    .flatMap((level) => level.lessons.map((lesson) => ({ level, lesson })))
    .find(({ lesson }) => lesson.id === id);
  if (!summary || !playing.step) throw new Error(`No Lesson ${id}`);
  return {
    ...playing,
    id,
    title: summary.lesson.title,
    level: summary.level.id,
    step: { ...playing.step, warmup },
  };
}

/** b-2 on its warm-up from b-1 (244: Read the full lesson opens b-1's page). */
export const warmupB2 = playingAt("b-2", { from: "b-1", explainer: true });
/** A step of b-3. */
export const playingB3 = playingAt("b-3", null);
/** i-1 on a warm-up from the Beginner index (the Level README, on GitHub). */
export const indexWarmupI1 = playingAt("i-1", {
  from: "beginner-index",
  explainer: false,
});

/**
 * `playing` with its step, beat and Lesson fields changed (246). The beat
 * starts from `playing`'s Check beat; a fixture that is not a Check passes
 * the fields that make it so, and every fixture says what decides it.
 */
export function playingWith({
  step = {},
  beat,
  lesson = {},
}: {
  step?: Partial<NonNullable<PlayingLesson["step"]>>;
  beat: Partial<NonNullable<PlayingLesson["beat"]>> &
    Pick<NonNullable<PlayingLesson["beat"]>, "decidedBy">;
  lesson?: Partial<PlayingLesson>;
}): PlayingLesson {
  if (!playing.step || !playing.beat) throw new Error("playing has a beat");
  return {
    ...playing,
    ...lesson,
    step: { ...playing.step, ...step },
    beat: { ...playing.beat, ...beat },
  };
}

/** A watched file beat (b-2 Y4's shape): its Done when line, before a look. */
const fileBeat = {
  decidedBy: "watch" as const,
  verification: [],
  fail: null,
  lines: [
    { kind: "do" as const, text: "Save the notes as `notes.md`." },
    {
      kind: "do" as const,
      text: "Done when `notes.md` exists.",
      doneWhen: true,
    },
  ],
};

export const watchWaiting = playingWith({
  beat: { ...fileBeat, status: "waiting" },
});
export const watchChecking = playingWith({
  beat: { ...fileBeat, status: "checking", checking: "notes.md" },
});
export const watchNotYet = playingWith({
  beat: { ...fileBeat, status: "fail", fail: "`notes.md` is not there yet." },
});
export const watchPassed = playingWith({
  beat: {
    ...fileBeat,
    status: "done",
    found: "notes.md",
    evidence: "# Notes",
  },
});
export const checkBroken = playingWith({
  beat: {
    decidedBy: "check",
    status: "broken",
    broken: "timeout",
    fail: null,
  },
});
export const checkSame = playingWith({
  beat: { decidedBy: "check", same: true },
});
export const checkStale = playingWith({
  beat: { decidedBy: "check", stale: true },
});
export const checkRunning = playingWith({
  beat: {
    decidedBy: "check",
    status: "checking",
    running: { n: 2, m: 5 },
    fail: null,
  },
});
export const alreadyCodespace = playingWith({
  beat: {
    decidedBy: "check",
    status: "already",
    fail: null,
    codespace: "In a Codespace **Claude Code** is already installed.",
  },
});
/** A self-check beat with its own done-label. */
export const learnerBeat = playingWith({
  beat: {
    decidedBy: "learner",
    kind: "self",
    status: "waiting",
    verification: [],
    fail: null,
    lines: [],
    self: "Self-check: you can say which model it was.",
    doneLabel: "I've said it",
  },
});
/** A git-clean beat with a done-label: session.ended. */
export const sessionBeat = playingWith({
  beat: {
    status: "waiting",
    verification: [],
    fail: null,
    lines: [],
    doneLabel: "The session has ended",
    decidedBy: "session",
  },
});
/** A code beat on lines 9 to 11 of a longer block, explaining line 10. */
export const codeWindow = playingWith({
  beat: {
    decidedBy: "learner",
    status: "waiting",
    verification: [],
    fail: null,
    lines: [{ kind: "say", text: "Read the loop." }],
    code: {
      lines: [
        { n: 9, text: "for (const url of urls) {" },
        { n: 10, text: "  const res = await fetch(url);" },
        { n: 11, text: "}" },
      ],
      point: 10,
      copy: "const urls = [];\nfor (const url of urls) {\n  const res = await fetch(url);\n}\n",
    },
  },
});
/** An optional step that offers Skip, and Back with a long done-label. */
export const offersBoth = playingWith({
  beat: {
    decidedBy: "learner",
    kind: "self",
    status: "waiting",
    verification: [],
    fail: null,
    lines: [],
    self: "Read the **settings** page.",
    doneLabel: "I've read the settings page and tried it",
  },
  lesson: {
    offers: {
      back: playing.offers.back,
      skip: { when: "Skip it if you have no second machine." },
    },
  },
});
/** The first Tear down step, after the Check passed. */
export const tearDown = playingWith({
  step: { id: "D1", part: "Tear down", title: "Remove the hook" },
  beat: {
    decidedBy: "learner",
    kind: "self",
    status: "waiting",
    verification: [],
    fail: null,
    lines: [],
    self: "Delete the hook file.",
  },
  lesson: {
    steps: [
      ...playing.steps.map((s) => ({ ...s, state: "done" as const })),
      {
        id: "D1",
        part: "Tear down",
        title: "Remove the hook",
        tier: "guided",
        state: "current",
        optional: false,
      },
      {
        id: "D2",
        part: "Tear down",
        title: "Check the tree",
        tier: "guided",
        state: "todo",
        optional: false,
      },
    ],
  },
});
/** i-1's Check in its Work folder: the run line keeps --dir. */
export const workFolderCheck = {
  ...playingWith({
    step: {
      where: { kind: "terminal", terminal: null, folder: "your Practice copy" },
    },
    beat: {
      decidedBy: "check",
      lines: [
        {
          kind: "run",
          text: "npm run check -- i-1 --dir ../work",
          watched: false,
        },
      ],
    },
  }),
  id: "i-1",
  level: "intermediate" as const,
};
/** A say and a why with bold and a link, through InlineText. */
export const richCopy = playingWith({
  beat: {
    decidedBy: "check",
    lines: [
      {
        kind: "say",
        text: "See **the settings** in [the page](beginner/02-first-session.md).",
      },
      { kind: "run", text: "npm run check -- b-1", watched: true },
    ],
    why: {
      onCard: "It is **faster** than [asking](https://code.claude.com/docs).",
      all: [],
    },
  },
});

// ---- Questions, warm-ups and hints (247) -------------------------------------

/** The fields every question beat shares: no Check, decided by its answer. */
const questionBeat = {
  decidedBy: "answer" as const,
  status: "waiting" as const,
  verification: [],
  fail: null,
  lines: [{ kind: "say" as const, text: "Before you run it, guess." }],
};

/** A predict beat before its guess. */
export const predictBeat = playingWith({
  beat: {
    ...questionBeat,
    kind: "predict",
    ask: "What will `claude --version` print?",
    options: [{ text: "A version number" }, { text: "Nothing at all" }],
  },
});

const askOptions = [
  { text: "`CLAUDE.md`" },
  { text: "Every file in the folder" },
  { text: "The settings file" },
];

/** An ask beat before a pick. */
export const askBeat = playingWith({
  beat: {
    ...questionBeat,
    kind: "ask",
    ask: "Which file does Claude Code read at the start of a session?",
    options: askOptions,
    why: { onCard: "It is where the project's rules live.", all: [] },
  },
});

/** The ask beat after one wrong pick: its reason and what to look for. */
export const askWrong = playingWith({
  beat: {
    ...(askBeat.beat as NonNullable<PlayingLesson["beat"]>),
    options: [
      askOptions[0] as { text: string },
      {
        text: "Every file in the folder",
        kind: "wrong",
        because: "It reads only the files a task needs.",
      },
      askOptions[2] as { text: string },
    ],
    answer: {
      ...(playing.beat as NonNullable<PlayingLesson["beat"]>).answer,
      feedback: "wrong",
      because: "It reads only the files a task needs.",
      point: "Look for the file named in the lesson's first step.",
    },
  },
});

/** The ask beat after a right pick. */
export const askRight = playingWith({
  beat: {
    ...(askWrong.beat as NonNullable<PlayingLesson["beat"]>),
    status: "done",
    options: [
      { text: "`CLAUDE.md`", kind: "right", because: "Its rules load first." },
      ...(askWrong.beat?.options.slice(1) ?? []),
    ],
    answer: {
      ...(askWrong.beat as NonNullable<PlayingLesson["beat"]>).answer,
      picked: 0,
      feedback: "right",
      because: null,
      point: null,
      reveal: "Claude Code reads `CLAUDE.md` when a session starts.",
    },
  },
});

/** The ask beat once its answer is shown. */
export const askRevealed = playingWith({
  beat: {
    ...(askRight.beat as NonNullable<PlayingLesson["beat"]>),
    answer: {
      ...(askRight.beat as NonNullable<PlayingLesson["beat"]>).answer,
      feedback: "revealed",
    },
  },
});

/** A typed-answer beat. */
export const typeBeat = playingWith({
  beat: {
    ...questionBeat,
    kind: "type",
    ask: "Which command shows the session's cost?",
    options: [],
  },
});

/** The typed beat after a miss: the page's words for it. */
export const typeWrong = playingWith({
  beat: {
    ...(typeBeat.beat as NonNullable<PlayingLesson["beat"]>),
    answer: {
      ...(playing.beat as NonNullable<PlayingLesson["beat"]>).answer,
      feedback: "wrong",
      because: "It starts with a slash.",
    },
  },
});

/** A choice whose pick shows later beats (`when:`): a guess, not judged. */
export const whenOption = playingWith({
  beat: {
    ...questionBeat,
    kind: "ask",
    status: "done",
    ask: "Which shell do you use?",
    options: [
      { text: "bash", kind: "option" },
      { text: "zsh", kind: "option" },
    ],
    answer: {
      ...(playing.beat as NonNullable<PlayingLesson["beat"]>).answer,
      picked: 1,
      feedback: "option",
    },
  },
});

/** b-2's warm-up question from b-1, with the line that explains warm-ups. */
export const warmupAsk = {
  ...askBeat,
  id: "b-2",
  title: warmupB2.title,
  step: {
    ...(askBeat.step as NonNullable<PlayingLesson["step"]>),
    warmup: { from: "b-1", explainer: true },
  },
};
/** The same warm-up, its explainer already seen. */
export const warmupAskQuiet = {
  ...warmupAsk,
  step: {
    ...warmupAsk.step,
    warmup: { from: "b-1", explainer: false },
  },
};

const waitQuestion = {
  prompt: "While the check runs: which file holds the project's rules?",
  options: [
    { text: "`CLAUDE.md`", kind: "right" as const },
    { text: "`README.md`" },
  ],
  answered: null,
  words: null,
};

/** A long wait with its question. */
export const waitQuestionOpen = playingWith({
  beat: { ...fileBeat, status: "checking", checking: "notes.md" },
  lesson: { waitQuestion },
});
/** The wait question answered, with the page's words. */
export const waitQuestionAnswered = playingWith({
  beat: { ...fileBeat, status: "checking", checking: "notes.md" },
  lesson: {
    waitQuestion: {
      ...waitQuestion,
      answered: 0,
      words: "Yes: `CLAUDE.md` holds them.",
    },
  },
});
/** The wait over: the snapshot drops the question. */
export const waitQuestionEnded = watchPassed;

/** A Challenge step before its first Check: hints wait. */
export const challengeUnavailable = {
  ...playing,
  hints: {
    shown: [],
    available: false,
    unavailable: "run-check",
    confirmExact: false,
  },
} satisfies PlayingLesson;
/** A Challenge question before its first answer: hints wait. */
export const challengeUnavailableAnswer = {
  ...askBeat,
  hints: {
    shown: [],
    available: false,
    unavailable: "pick-answer",
    confirmExact: false,
  },
} satisfies PlayingLesson;

/** The hints open to the question before the exact command. */
export const confirmExact = {
  ...hinted,
  hints: { ...hinted.hints, available: false, confirmExact: true },
} satisfies PlayingLesson;

/** The exact command taken: its rung has the command with Copy. */
export const exactTaken = {
  ...hinted,
  hints: {
    ...hinted.hints,
    shown: [
      ...hinted.hints.shown,
      {
        kind: "exact",
        commands: [
          {
            leadIn: "Run the check:",
            text: "npm run check -- b-1",
            code: null,
          },
        ],
      },
    ],
    available: false,
  },
} satisfies PlayingLesson;

/** The predict once guessed: a guess is drawn chosen, then the step goes on. */
export const predictDone = playingWith({
  beat: {
    ...(predictBeat.beat as NonNullable<PlayingLesson["beat"]>),
    status: "done",
    answer: {
      ...(playing.beat as NonNullable<PlayingLesson["beat"]>).answer,
      picked: 1,
    },
  },
});
