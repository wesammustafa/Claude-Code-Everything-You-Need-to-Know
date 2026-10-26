// Pip's director: a pure reducer that turns engine events and what the
// browser knows (the screen, the page panel, visibility, reduced motion,
// the Learner's input) into the PipModel the renderer draws. Time arrives
// as an argument, so the director never reads a clock; createPipDirector
// injects one. It replaces the Terminal app's card mood.
import type { EventEnvelope } from "@quest/contract";
import type {
  PipMode,
  PipModel,
  PipReactionKind,
  PipSize,
} from "../../pip/contract";
import {
  FULL,
  NOD,
  reactionFor,
  type PipGazeTarget,
  type Reaction,
} from "./reactions";

/** A Celebration plays at least this long before anything else replaces it. */
export const CELEBRATION_FLOOR_MS = 1000;
/**
 * Within this window from a kind's first full play, later Reactions of that
 * kind play as nods. Nods apply to every kind, Greeting included (the owner's
 * reading, 2026-10-26).
 */
export const NOD_WINDOW_MS = 3000;
/** `work.changed` glances at most once in this window. */
export const GLANCE_INTERVAL_MS = 20_000;
/** With no event and no input for this long, Pip rests. */
export const IDLE_REST_MS = 5 * 60_000;
/**
 * How long Pip holds its gaze on an Explaining or Curious target before the
 * rig's own glances return. The spec names no length; the owner kept 3 s
 * (2026-10-26), matching the nod window, one Reaction's moment.
 */
export const GAZE_HOLD_MS = 3000;

/**
 * The screen the browser shows, by the spec's view names (`levelup` is the
 * Step-down). The spec gives Level complete and course complete no view name;
 * the owner gave them their own (2026-10-26).
 */
export type PipScreen =
  | "welcome"
  | "resume"
  | "map"
  | "intro"
  | "step"
  | "levelup"
  | "complete"
  | "next"
  | "levelComplete"
  | "courseComplete"
  | "other";

// Level complete and course complete are full moments, so Pip is large there
// as on Complete (the owner's decision, 2026-10-26).
const HERO_SCREENS: ReadonlySet<PipScreen> = new Set([
  "welcome",
  "resume",
  "levelup",
  "complete",
  "next",
  "levelComplete",
  "courseComplete",
]);
const GREETING_SCREENS: ReadonlySet<PipScreen> = new Set(["welcome", "resume"]);

/** A point relative to Pip, -1..1 on each axis. */
export interface GazePoint {
  x: number;
  y: number;
}

/** What the director is told. */
export type DirectorInput =
  /** One revision's events, at most once per event ID (the stream sees to that). */
  | { type: "events"; events: readonly EventEnvelope[] }
  | { type: "screen"; screen: PipScreen }
  /** The lesson page panel opened or closed. */
  | { type: "pagePanel"; open: boolean }
  /** The page was hidden or shown (the Page Visibility API). */
  | { type: "visibility"; hidden: boolean }
  /** Pip scrolled out of view or back. */
  | { type: "onScreen"; visible: boolean }
  /** The system setting or the Settings override changed. */
  | { type: "reducedMotion"; on: boolean }
  /** The connection layer's "Reconnecting" state began or ended. */
  | { type: "connection"; lost: boolean }
  /** The Learner pointed, typed or scrolled. */
  | { type: "activity" }
  /** Where the page's gaze targets sit now, relative to Pip. */
  | { type: "gazeTargets"; targets: Partial<Record<PipGazeTarget, GazePoint>> }
  /** Time passed; nothing else changed. */
  | { type: "tick" };

interface Playing {
  id: string;
  kind: PipReactionKind;
  intensity: number;
  gaze: PipGazeTarget | null;
  startedAt: number;
}

/** A Reaction waiting for a Celebration's floor to pass. */
interface Waiting {
  reaction: Reaction | Greeting;
}

interface NodWindow {
  /** When the kind's first full play in this window started. */
  since: number;
  /** The strongest intensity the kind earned in this window. */
  strongest: number;
}

interface Greeting {
  kind: "greeting";
  intensity: number;
  gaze: null;
  eventId: "greeting";
  eventType: null;
}

export interface DirectorState {
  screen: PipScreen;
  pagePanelOpen: boolean;
  hidden: boolean;
  offScreen: boolean;
  reducedMotion: boolean;
  connectionLost: boolean;
  /** A Check is running: from check.started to its result. */
  checking: boolean;
  /** The last event or input, for the 5-minute rest. */
  lastActivityAt: number;
  /** Greeting has played (or is waiting on the Celebration floor) this page load. */
  greeted: boolean;
  playing: Playing | null;
  waiting: Waiting | null;
  /** Each kind's nod window: its first full play, and the strongest it earned since. */
  nodWindow: Partial<Record<PipReactionKind, NodWindow>>;
  lastGlanceAt: number | null;
  targets: Partial<Record<PipGazeTarget, GazePoint>>;
}

export interface DirectorStart {
  screen?: PipScreen;
  reducedMotion?: boolean;
  hidden?: boolean;
}

/** The director's state at page load. */
export function initialDirectorState(
  now: number,
  start: DirectorStart = {},
): DirectorState {
  const state: DirectorState = {
    screen: start.screen ?? "other",
    pagePanelOpen: false,
    hidden: start.hidden ?? false,
    offScreen: false,
    reducedMotion: start.reducedMotion ?? false,
    connectionLost: false,
    checking: false,
    lastActivityAt: now,
    greeted: false,
    playing: null,
    waiting: null,
    nodWindow: {},
    lastGlanceAt: null,
    targets: {},
  };
  // A page that loads on Welcome or Resume greets at once.
  return settle(state, now);
}

/**
 * Pip can't be seen: a Reaction now would play to no one, so it is dropped,
 * not kept (the owner's reading, 2026-10-26). Pending milestones, which must
 * still show, are ticket 220's, through the snapshot.
 */
const unseen = (s: DirectorState) => s.hidden || s.offScreen;

const glanceReady = (s: DirectorState, now: number) =>
  s.lastGlanceAt === null || now - s.lastGlanceAt >= GLANCE_INTERVAL_MS;

const floorHolds = (s: DirectorState, now: number) =>
  s.playing?.kind === "celebration" &&
  now - s.playing.startedAt < CELEBRATION_FLOOR_MS;

function start(
  s: DirectorState,
  reaction: Reaction | Greeting,
  now: number,
): DirectorState {
  // Within 3 s of a kind's first full play, every later Reaction of that
  // kind is a nod, unless it is stronger than the strongest the kind earned
  // in that window: a Level's Celebration right after its last Lesson's is a
  // bigger moment, not a repeat. It plays in full and raises the strongest,
  // but the window still runs from the first full play. A nod leaves the
  // window as it is, so it never resets or lowers the strongest.
  const open = s.nodWindow[reaction.kind];
  const inWindow = open !== undefined && now - open.since < NOD_WINDOW_MS;
  const nod = inWindow && reaction.intensity <= open.strongest;
  let nextWindow: NodWindow;
  if (!inWindow) nextWindow = { since: now, strongest: reaction.intensity };
  else if (nod) nextWindow = open;
  else nextWindow = { since: open.since, strongest: reaction.intensity };
  return {
    ...s,
    playing: {
      id: reaction.eventId,
      kind: reaction.kind,
      intensity: nod ? Math.min(NOD, reaction.intensity) : reaction.intensity,
      gaze: reaction.gaze,
      startedAt: now,
    },
    waiting: null,
    nodWindow: { ...s.nodWindow, [reaction.kind]: nextWindow },
    lastGlanceAt: reaction.eventType === "work.changed" ? now : s.lastGlanceAt,
  };
}

/**
 * The newest Reaction replaces the one playing, except that a Celebration
 * plays at least 1 s before anything but another Celebration replaces it.
 * What arrives during that second waits, newest only, and plays when the
 * second is up. A Reaction Pip can't be seen playing is dropped.
 */
function offer(
  s: DirectorState,
  reaction: Reaction | Greeting,
  now: number,
): DirectorState {
  if (unseen(s)) return s;
  if (reaction.kind !== "celebration" && floorHolds(s, now)) {
    return { ...s, waiting: { reaction } };
  }
  return start(s, reaction, now);
}

/** Whatever is due at `now`: a waiting Reaction, the page load's Greeting. */
function settle(s: DirectorState, now: number): DirectorState {
  let next = s;
  // Like a new one, a waiting Reaction is dropped once Pip can't be seen.
  if (next.waiting !== null && unseen(next)) next = { ...next, waiting: null };
  if (next.waiting !== null && !floorHolds(next, now)) {
    const { reaction } = next.waiting;
    next = { ...next, waiting: null };
    next = offer(next, reaction, now);
  }
  if (!next.greeted && GREETING_SCREENS.has(next.screen) && !unseen(next)) {
    next = {
      ...offer(next, greeting, now),
      greeted: true,
    };
  }
  return next;
}

const greeting: Greeting = {
  kind: "greeting",
  intensity: FULL,
  gaze: null,
  eventId: "greeting",
  eventType: null,
};

function applyEvents(
  s: DirectorState,
  events: readonly EventEnvelope[],
  now: number,
): DirectorState {
  let checking = s.checking;
  for (const event of events) {
    if (event.type === "check.started") checking = true;
    else if (
      event.type === "check.passed" ||
      event.type === "check.notYet" ||
      event.type === "check.broken"
    ) {
      checking = false;
    }
  }
  // Every event counts against the 5-minute rest, check.progress and notice
  // included: they change no mode or Reaction, but they are events.
  let next: DirectorState = {
    ...s,
    checking,
    lastActivityAt: events.length > 0 ? now : s.lastActivityAt,
  };
  const reaction = reactionFor(events, { glanceReady: glanceReady(next, now) });
  if (reaction !== null) next = offer(next, reaction, now);
  return next;
}

/** The director's reducer: pure, with the time passed in. */
export function directorReduce(
  s: DirectorState,
  input: DirectorInput,
  now: number,
): DirectorState {
  let next: DirectorState;
  switch (input.type) {
    case "events":
      next = applyEvents(s, input.events, now);
      break;
    case "screen":
      next = { ...s, screen: input.screen, lastActivityAt: now };
      break;
    case "pagePanel":
      next = { ...s, pagePanelOpen: input.open };
      break;
    case "visibility":
      next = { ...s, hidden: input.hidden };
      break;
    case "onScreen":
      next = { ...s, offScreen: !input.visible };
      break;
    case "reducedMotion":
      next = { ...s, reducedMotion: input.on };
      break;
    case "connection":
      next = { ...s, connectionLost: input.lost };
      break;
    case "activity":
      next = { ...s, lastActivityAt: now };
      break;
    case "gazeTargets":
      next = { ...s, targets: input.targets };
      break;
    case "tick":
      next = s;
      break;
  }
  return settle(next, now);
}

/**
 * Rest while Pip can't be seen or isn't needed; otherwise Thinking or Idle.
 * Rest outranks Thinking, so reduced motion means Rest and a reduced-motion
 * Learner never sees Thinking (the owner's reading, 2026-10-26).
 */
export function modeAt(s: DirectorState, now: number): PipMode {
  if (
    s.pagePanelOpen ||
    s.hidden ||
    s.offScreen ||
    s.reducedMotion ||
    s.connectionLost ||
    now - s.lastActivityAt >= IDLE_REST_MS
  ) {
    return "rest";
  }
  return s.checking ? "thinking" : "idle";
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Gaze only for Explaining and Curious, on their target, while the Reaction
 * holds it; never under reduced motion, so Pip holds still. Null otherwise:
 * the rig's own small glances.
 */
function gazeAt(s: DirectorState, now: number): PipModel["gaze"] {
  const p = s.playing;
  if (s.reducedMotion || p?.gaze == null) return null;
  if (now - p.startedAt >= GAZE_HOLD_MS) return null;
  const point = s.targets[p.gaze];
  return point === undefined ? null : { x: clamp(point.x), y: clamp(point.y) };
}

/** The renderer's model at `now`. */
export function pipModel(s: DirectorState, now: number): PipModel {
  const size: PipSize = HERO_SCREENS.has(s.screen) ? "hero" : "beside";
  return {
    mode: modeAt(s, now),
    reaction:
      s.playing === null
        ? null
        : {
            id: s.playing.id,
            kind: s.playing.kind,
            intensity: s.playing.intensity,
          },
    gaze: gazeAt(s, now),
    reducedMotion: s.reducedMotion,
    size,
  };
}

/**
 * The next time the model changes with no input: a waiting Reaction's turn,
 * the gaze's release, or the 5-minute rest. A tick then brings it about.
 * Null when nothing is due.
 */
export function nextWakeAt(s: DirectorState, now: number): number | null {
  const due: number[] = [];
  if (s.waiting !== null && s.playing !== null) {
    due.push(s.playing.startedAt + CELEBRATION_FLOOR_MS);
  }
  if (s.playing?.gaze != null && !s.reducedMotion) {
    due.push(s.playing.startedAt + GAZE_HOLD_MS);
  }
  due.push(s.lastActivityAt + IDLE_REST_MS);
  const later = due.filter((t) => t > now);
  return later.length === 0 ? null : Math.min(...later);
}

export interface PipDirector {
  send(input: DirectorInput): PipModel;
  model(): PipModel;
  nextWakeAt(): number | null;
  state(): DirectorState;
}

/** The director with its clock injected: real time in the app, a fake in tests. */
export function createPipDirector(
  now: () => number,
  start: DirectorStart = {},
): PipDirector {
  let state = initialDirectorState(now(), start);
  return {
    send(input) {
      const t = now();
      state = directorReduce(state, input, t);
      return pipModel(state, t);
    },
    model: () => pipModel(state, now()),
    nextWakeAt: () => nextWakeAt(state, now()),
    state: () => state,
  };
}
