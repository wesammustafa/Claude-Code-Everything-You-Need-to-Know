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
  helpDismissed,
  helpDueAt,
  helpEvents,
  helpHint,
  helpHintOpened,
  helpOffer,
  helpStep,
  initialHelpState,
  type HelpState,
} from "./help";
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
 * How long a Reaction holds Pip's gaze on its target (Explaining and Curious)
 * or on the Learner (Greeting, Celebration, the help offer) before he returns
 * to his resting gaze. The spec names no length; the owner kept 3 s
 * (2026-10-26), matching the nod window, one Reaction's moment.
 */
export const GAZE_HOLD_MS = 3000;
/**
 * How long Pip watches what the Learner just did (a copied command, a hint
 * opening, the check's lines arriving) before he returns to his resting gaze.
 */
export const LOOK_HOLD_MS = 1500;
/**
 * Pip's resting gaze beside the content: turned toward it, to his right
 * (owner, 2026-10-26: "about 0.4"). Centred, he rests facing the Learner.
 */
export const REST_TOWARD_CONTENT = 0.4;
/** The help offer's Explaining: soft, an offer rather than an explanation. */
export const OFFER_INTENSITY = 0.5;
/**
 * A Check result's Reaction (Success or Retry: a brief surprise, then
 * reassurance) plays this long before the help offer may follow it, so the
 * offer never cuts it off.
 */
export const RESULT_REACTION_MS = 1500;

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
  | "progress"
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
/**
 * Where Pip sits beside the content and rests turned toward it: the Lesson
 * overview, the step, and the Learning journey and Progress, where he sits
 * by the Next band and by the skills. Everywhere else he is centred (every
 * hero screen, and the beside Pip of a screen the app has no route for), and
 * rests facing the Learner.
 */
const BESIDE_CONTENT: ReadonlySet<PipScreen> = new Set([
  "map",
  "intro",
  "step",
  "progress",
]);
/** Greeting and Celebration face the Learner (the spec's rig). */
const FACES_LEARNER: ReadonlySet<PipReactionKind> = new Set([
  "greeting",
  "celebration",
]);

/** A point relative to Pip, -1..1 on each axis. */
export interface GazePoint {
  x: number;
  y: number;
}

/**
 * What Pip watches for a moment: what the Learner just did (a copied
 * command, a hint opening, the check's lines arriving), or on Progress the
 * next goal, which he glances toward.
 */
export type LookTarget = "command" | "hint" | "lines" | "goal";

/** Every target the page marks with `data-pip-target`. */
export type GazeTargetName = PipGazeTarget | LookTarget;

/** Where a Reaction turns Pip: a target the page places, or the Learner. */
export type ReactionGaze = PipGazeTarget | "learner";

/** What the director is told. */
export type DirectorInput =
  /** One revision's events, at most once per event ID (the stream sees to that). */
  | { type: "events"; events: readonly EventEnvelope[] }
  | { type: "screen"; screen: PipScreen }
  /** The lesson page panel opened or closed. */
  | { type: "pagePanel"; open: boolean }
  /**
   * A Panel (the lesson page, Steps, Settings) opened or closed: while one
   * is open the rest of the page, Pip and his bubble with it, is inert.
   */
  | { type: "pageInert"; inert: boolean }
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
  | {
      type: "gazeTargets";
      targets: Partial<Record<GazeTargetName, GazePoint>>;
    }
  /** The Learner did something Pip watches: `at` is where, relative to Pip. */
  | { type: "look"; target: LookTarget; at: GazePoint }
  /** The step on screen, by the page's key for it; null when it leaves. */
  | { type: "step"; step: string | null }
  /** Whether an unopened hint is ready on the step. */
  | { type: "hint"; ready: boolean }
  /** The Learner opened a hint rung. */
  | { type: "hintOpened" }
  /** The Learner closed the help offer. */
  | { type: "helpDismissed" }
  /** Time passed; nothing else changed. */
  | { type: "tick" };

interface Playing {
  id: string;
  kind: PipReactionKind;
  intensity: number;
  gaze: ReactionGaze | null;
  startedAt: number;
  /** The event that earned it; null for the browser's own Reactions. */
  eventType: EventEnvelope["type"] | null;
}

/** A Reaction waiting for a Celebration's floor to pass. */
interface Waiting {
  reaction: Reaction | BrowserReaction;
}

/** What Pip is watching, and since when. */
interface Looking {
  target: LookTarget;
  at: GazePoint;
  since: number;
}

interface NodWindow {
  /** When the kind's first full play in this window started. */
  since: number;
  /** The strongest intensity the kind earned in this window. */
  strongest: number;
}

/** A Reaction the browser starts on its own: the Greeting, the help offer. */
interface BrowserReaction {
  kind: PipReactionKind;
  intensity: number;
  gaze: ReactionGaze | null;
  eventId: string;
  eventType: null;
}

export interface DirectorState {
  screen: PipScreen;
  pagePanelOpen: boolean;
  /** A Panel is open, so the page behind it, Pip's bubble too, is inert. */
  pageInert: boolean;
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
  targets: Partial<Record<GazeTargetName, GazePoint>>;
  looking: Looking | null;
  /** The step's help offer: the browser's stuck rule (help.ts). */
  help: HelpState;
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
    pageInert: false,
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
    looking: null,
    help: initialHelpState,
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
  reaction: Reaction | BrowserReaction,
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
      gaze:
        reaction.gaze ?? (FACES_LEARNER.has(reaction.kind) ? "learner" : null),
      startedAt: now,
      eventType: reaction.eventType,
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
  reaction: Reaction | BrowserReaction,
  now: number,
): DirectorState {
  if (unseen(s)) return s;
  if (reaction.kind !== "celebration" && floorHolds(s, now)) {
    return { ...s, waiting: { reaction } };
  }
  return start(s, reaction, now);
}

/**
 * Whatever is due at `now`: a waiting Reaction, the page load's Greeting,
 * the step's help offer.
 */
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
  // Pip turns to the Learner with a soft Explaining as the offer shows.
  const due = helpDueAt(next.help);
  if (due !== null && due <= now && helpHeldUntil(next, now) === null) {
    next = { ...next, help: helpOffer(next.help) };
    next = offer(
      next,
      {
        kind: "explaining",
        intensity: OFFER_INTENSITY,
        gaze: "learner",
        eventId: `help.${next.help.step ?? ""}.${String(now)}`,
        eventType: null,
      },
      now,
    );
  }
  return next;
}

/** The events that end a Check: their Reaction plays before the help offer. */
const CHECK_RESULTS: ReadonlySet<EventEnvelope["type"]> = new Set([
  "check.passed",
  "check.notYet",
  "check.broken",
]);

/**
 * Whether the help offer, once due, must wait, and until when: null when it
 * may show now, Infinity while it waits for an input rather than the clock.
 * It waits while Pip and his bubble can't be seen or heard (a Panel open,
 * the page hidden, Pip off-screen), so it is never spent where no one sees
 * it and the bubble's live region announces it when it shows. It waits while
 * a Check runs, and while the Check result's Reaction plays, so it never
 * talks over a result.
 */
function helpHeldUntil(s: DirectorState, now: number): number | null {
  if (unseen(s) || s.pagePanelOpen || s.pageInert || s.checking)
    return Infinity;
  const p = s.playing;
  if (p?.eventType != null && CHECK_RESULTS.has(p.eventType)) {
    const ends = p.startedAt + RESULT_REACTION_MS;
    if (now < ends) return ends;
  }
  return null;
}

const greeting: BrowserReaction = {
  kind: "greeting",
  intensity: FULL,
  // Faces the Learner, as every Greeting does (FACES_LEARNER).
  gaze: null,
  eventId: "greeting",
  eventType: null,
};

/** The events that bring the check's lines. */
const LINES_ARRIVE: ReadonlySet<EventEnvelope["type"]> = new Set([
  "check.progress",
  "check.notYet",
  "check.passed",
  "check.broken",
]);

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
  // The check's lines arriving: Pip watches them, where the page shows them.
  const lines = s.targets.lines;
  const linesArrived =
    lines !== undefined && events.some((event) => LINES_ARRIVE.has(event.type));
  // Every event counts against the 5-minute rest, check.progress and notice
  // included: they change no mode or Reaction, but they are events.
  let next: DirectorState = {
    ...s,
    checking,
    lastActivityAt: events.length > 0 ? now : s.lastActivityAt,
    looking: linesArrived
      ? { target: "lines", at: lines, since: now }
      : s.looking,
    help: helpEvents(s.help, events, now),
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
      // What Pip was watching belonged to the screen he left.
      next = {
        ...s,
        screen: input.screen,
        lastActivityAt: now,
        looking: input.screen === s.screen ? s.looking : null,
      };
      break;
    case "pagePanel":
      next = { ...s, pagePanelOpen: input.open };
      break;
    case "pageInert":
      next = { ...s, pageInert: input.inert };
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
    case "look":
      next = {
        ...s,
        looking: { target: input.target, at: input.at, since: now },
      };
      break;
    case "step":
      next = { ...s, help: helpStep(s.help, input.step) };
      break;
    case "hint":
      next = { ...s, help: helpHint(s.help, input.ready, now) };
      break;
    case "hintOpened":
      next = { ...s, help: helpHintOpened(s.help, now) };
      break;
    case "helpDismissed":
      next = { ...s, help: helpDismissed(s.help) };
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
const clampPoint = (p: GazePoint): GazePoint => ({
  x: clamp(p.x),
  y: clamp(p.y),
});
const FORWARD: GazePoint = { x: 0, y: 0 };

/**
 * Where Pip rests on a screen, never "no gaze": beside the content he rests
 * turned toward it; centred he rests facing the Learner. The rig's own
 * glances play around it.
 */
export function restingGaze(screen: PipScreen): GazePoint {
  return BESIDE_CONTENT.has(screen)
    ? { x: REST_TOWARD_CONTENT, y: 0 }
    : FORWARD;
}

/**
 * Pip's gaze, first match wins: a Reaction that turns him (Explaining and
 * Curious to their target, Greeting, Celebration and the help offer to the
 * Learner) while it holds; then what the Learner just did, while Pip watches
 * it; then the screen's resting gaze. Under reduced motion only the resting
 * gaze, so Pip holds still there.
 */
function gazeAt(s: DirectorState, now: number): GazePoint {
  const rest = restingGaze(s.screen);
  if (s.reducedMotion) return rest;
  const p = s.playing;
  if (p?.gaze != null && now - p.startedAt < GAZE_HOLD_MS) {
    if (p.gaze === "learner") return FORWARD;
    const point = s.targets[p.gaze];
    if (point !== undefined) return clampPoint(point);
  }
  const look = s.looking;
  if (look !== null && now - look.since < LOOK_HOLD_MS)
    return clampPoint(look.at);
  return rest;
}

/** Whether the step's help offer is in the bubble. */
export function helpShowing(s: DirectorState): boolean {
  return s.help.showing;
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
 * a gaze's release, the help offer (or the end of the Reaction it waits on),
 * or the 5-minute rest. A tick then brings
 * it about. Null when nothing is due.
 */
export function nextWakeAt(s: DirectorState, now: number): number | null {
  const due: number[] = [];
  if (s.waiting !== null && s.playing !== null) {
    due.push(s.playing.startedAt + CELEBRATION_FLOOR_MS);
  }
  if (s.playing?.gaze != null && !s.reducedMotion) {
    due.push(s.playing.startedAt + GAZE_HOLD_MS);
  }
  if (s.looking !== null && !s.reducedMotion) {
    due.push(s.looking.since + LOOK_HOLD_MS);
  }
  // The help offer: when it falls due, or when the Reaction it waits on ends.
  const help = helpDueAt(s.help);
  if (help !== null) {
    const held = helpHeldUntil(s, Math.max(now, help));
    if (held === null) due.push(help);
    else if (held !== Infinity) due.push(held);
  }
  due.push(s.lastActivityAt + IDLE_REST_MS);
  const later = due.filter((t) => t > now);
  return later.length === 0 ? null : Math.min(...later);
}

export interface PipDirector {
  send(input: DirectorInput): PipModel;
  model(): PipModel;
  helpShowing(): boolean;
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
    helpShowing: () => helpShowing(state),
    nextWakeAt: () => nextWakeAt(state, now()),
    state: () => state,
  };
}
