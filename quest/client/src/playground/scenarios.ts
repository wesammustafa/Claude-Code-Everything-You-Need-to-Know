// What the Pip Playground plays through the director: every engine event, one
// at a time, and event sequences that show the director's rules at work
// (ranking, interruptions, the Celebration's first second, the nod, the
// glance throttle, rest). Times are in milliseconds from a scenario's start.
import type { QuestEvent } from "@quest/contract";
import type { PipReactionKind } from "../../pip/contract";
import {
  CELEBRATION_FLOOR_MS,
  GLANCE_INTERVAL_MS,
  IDLE_REST_MS,
  NOD_WINDOW_MS,
  type DirectorInput,
  type PipScreen,
} from "../pip/director";

/** One engine event the Playground can send on its own, as one revision. */
export interface EventChoice {
  /** Unique among the choices, for the button's label and the tests. */
  id: string;
  event: QuestEvent;
  /** What sets this one apart from others of its type, if anything. */
  note?: string;
}

const NOT_YET: QuestEvent = {
  type: "check.notYet",
  evidence: "The file does not exist yet.",
};
const LESSON: QuestEvent = {
  type: "lesson.completed",
  capstone: false,
  firstTime: true,
};

/** The engine's events, grouped by what Pip does with them. */
export const EVENT_GROUPS: readonly {
  title: string;
  kind: PipReactionKind | "thinking" | null;
  choices: readonly EventChoice[];
}[] = [
  {
    title: "Thinking",
    kind: "thinking",
    choices: [
      { id: "check.started", event: { type: "check.started" } },
      {
        id: "check.progress",
        event: { type: "check.progress", n: 1, m: 3 },
        note: "changes nothing",
      },
    ],
  },
  {
    title: "Success",
    kind: "success",
    choices: [
      {
        id: "check.passed",
        event: { type: "check.passed", firstTime: true },
        note: "first pass",
      },
      {
        id: "check.passed.again",
        event: { type: "check.passed", firstTime: false },
        note: "passed before",
      },
      { id: "answer.right", event: { type: "answer.right" } },
      { id: "warmup.recalled", event: { type: "warmup.recalled" } },
      { id: "step.completed", event: { type: "step.completed" } },
      {
        id: "lesson.completed.replay",
        event: { ...LESSON, firstTime: false },
        note: "replay",
      },
    ],
  },
  {
    title: "Retry",
    kind: "retry",
    choices: [
      { id: "check.notYet", event: NOT_YET },
      { id: "answer.wrong", event: { type: "answer.wrong" } },
      { id: "warmup.missed", event: { type: "warmup.missed" } },
      { id: "check.broken", event: { type: "check.broken" } },
    ],
  },
  {
    title: "Explaining",
    kind: "explaining",
    choices: [
      { id: "hint.shown", event: { type: "hint.shown", rung: 1 } },
      { id: "help.offered", event: { type: "help.offered" } },
    ],
  },
  {
    title: "Curious",
    kind: "curious",
    choices: [
      {
        id: "stepDown.reached",
        event: { type: "stepDown.reached", from: "guided", to: "hinted" },
      },
      {
        id: "work.changed",
        event: { type: "work.changed" },
        note: "a glance",
      },
    ],
  },
  {
    title: "Celebration",
    kind: "celebration",
    choices: [
      { id: "lesson.completed", event: LESSON, note: "first time" },
      {
        id: "lesson.completed.capstone",
        event: { ...LESSON, capstone: true },
        note: "a capstone",
      },
      {
        id: "level.completed",
        event: { type: "level.completed", level: "beginner" },
      },
      { id: "course.completed", event: { type: "course.completed" } },
    ],
  },
  {
    title: "No Reaction",
    kind: null,
    choices: [{ id: "notice", event: { type: "notice", kind: "saved" } }],
  },
];

/** One moment of a scenario. */
export type ScenarioStep =
  /** One revision's events. */
  | { at: number; events: readonly QuestEvent[] }
  /** Something the browser tells the director. */
  | { at: number; input: DirectorInput; label: string }
  /** The director's clock jumps ahead, so a long wait takes no time. */
  | { at: number; jump: number };

export interface Scenario {
  id: string;
  name: string;
  /** What to watch for, in a sentence. */
  summary: string;
  /** The screen the scenario's page load starts on; the step otherwise. */
  screen?: PipScreen;
  steps: readonly ScenarioStep[];
}

/** Half the Celebration's first second: well inside it. */
const IN_FLOOR = CELEBRATION_FLOOR_MS / 2;
/** Half the nod window: well inside it. */
const IN_NOD = NOD_WINDOW_MS / 2;

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "check",
    name: "A Check runs",
    summary:
      "Thinking from check.started until the result; progress changes nothing. Then Success.",
    steps: [
      { at: 0, events: [{ type: "check.started" }] },
      { at: 800, events: [{ type: "check.progress", n: 1, m: 2 }] },
      { at: 1600, events: [{ type: "check.progress", n: 2, m: 2 }] },
      { at: 2400, events: [{ type: "check.passed", firstTime: true }] },
    ],
  },
  {
    id: "retry-during-success",
    name: "Retry during a Success",
    summary: "The newest Reaction replaces the one playing, from its pose.",
    steps: [
      { at: 0, events: [{ type: "check.passed", firstTime: true }] },
      { at: 600, events: [NOT_YET] },
    ],
  },
  {
    id: "celebration-floor",
    name: "Success in a Celebration's first second",
    summary: "It waits until the Celebration has played a second, then plays.",
    steps: [
      { at: 0, events: [LESSON] },
      { at: IN_FLOOR, events: [{ type: "answer.right" }] },
    ],
  },
  {
    id: "newest-waits",
    name: "Two in a Celebration's first second",
    summary: "Only the newest waits; the one before it never plays.",
    steps: [
      { at: 0, events: [LESSON] },
      { at: IN_FLOOR / 2, events: [{ type: "answer.wrong" }] },
      { at: IN_FLOOR, events: [{ type: "hint.shown", rung: 1 }] },
    ],
  },
  {
    id: "celebration-replaces",
    name: "A Level right after its last Lesson",
    summary:
      "Another Celebration replaces one at once, and plays in full because it is stronger.",
    steps: [
      { at: 0, events: [LESSON] },
      {
        at: IN_FLOOR,
        events: [{ type: "level.completed", level: "beginner" }],
      },
    ],
  },
  {
    id: "nod",
    name: "The nod",
    summary:
      "The same Reaction within 3 s plays as a nod; after the window, in full again.",
    steps: [
      { at: 0, events: [{ type: "answer.right" }] },
      { at: IN_NOD, events: [{ type: "answer.right" }] },
      { at: NOD_WINDOW_MS + IN_NOD / 2, events: [{ type: "answer.right" }] },
    ],
  },
  {
    id: "passed-again",
    name: "A step that already passed",
    summary:
      "check.passed on a step that passed before only nods, so Check clicks are never rewarded.",
    steps: [
      { at: 0, events: [{ type: "check.started" }] },
      { at: 900, events: [{ type: "check.passed", firstTime: false }] },
    ],
  },
  {
    id: "glance",
    name: "The glance throttle",
    summary:
      "work.changed glances at most once every 20 s; the clock jumps ahead to the next one.",
    steps: [
      { at: 0, events: [{ type: "work.changed" }] },
      { at: 1200, events: [{ type: "work.changed" }] },
      { at: 2400, jump: GLANCE_INTERVAL_MS },
      { at: 2500, events: [{ type: "work.changed" }] },
    ],
  },
  {
    id: "one-revision",
    name: "Several events in one revision",
    summary:
      "Only the highest-ranked plays: Success over Retry over Explaining.",
    steps: [
      {
        at: 0,
        events: [
          { type: "hint.shown", rung: 1 },
          NOT_YET,
          { type: "step.completed" },
        ],
      },
    ],
  },
  {
    id: "course",
    name: "A Lesson, its Level and the course at once",
    summary: "One Celebration, at the course's full strength.",
    steps: [
      {
        at: 0,
        events: [
          { ...LESSON, capstone: true },
          { type: "level.completed", level: "advanced" },
          { type: "course.completed" },
        ],
      },
    ],
  },
  {
    id: "greeting",
    name: "Greeting",
    summary:
      "A page load on Welcome greets; coming back to Welcome in the same load does not.",
    screen: "welcome",
    steps: [
      {
        at: 1600,
        input: { type: "screen", screen: "step" },
        label: "Screen: step",
      },
      {
        at: 2800,
        input: { type: "screen", screen: "welcome" },
        label: "Screen: welcome",
      },
    ],
  },
  {
    id: "unseen",
    name: "While Pip can't be seen",
    summary:
      "The page is hidden: Pip rests and a Reaction is dropped, not kept for later.",
    steps: [
      {
        at: 0,
        input: { type: "visibility", hidden: true },
        label: "Page hidden",
      },
      { at: 700, events: [NOT_YET] },
      {
        at: 1600,
        input: { type: "visibility", hidden: false },
        label: "Page shown",
      },
    ],
  },
  {
    id: "rest",
    name: "Rest after 5 minutes",
    summary:
      "With no event or input for 5 minutes Pip rests; the Learner's input wakes him.",
    steps: [
      { at: 0, jump: IDLE_REST_MS },
      { at: 2000, input: { type: "activity" }, label: "The Learner types" },
    ],
  },
];
