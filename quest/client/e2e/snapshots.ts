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

/** A whole snapshot around one phase of b-1. */
export function snapshotOf(
  lesson: ActiveLesson,
  {
    revision = 1,
    welcomed = lesson.phase !== "overview",
    milestones = [],
    name = learner.name,
  }: {
    revision?: number;
    welcomed?: boolean;
    milestones?: Milestone[];
    name?: string | null;
  } = {},
): Snapshot {
  return {
    instance: FIXTURE_INSTANCE,
    revision,
    milestones,
    course,
    learner: { ...learner, welcomed, name },
    lesson,
  };
}
