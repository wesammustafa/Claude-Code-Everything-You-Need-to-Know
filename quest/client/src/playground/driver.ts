// The Pip Playground's director: the app's own director, on a clock that can
// jump ahead, with a log of what each input made it do. It plays scenarios
// step by step on real time, so the rig shows each moment as it happens.
import type { EventEnvelope, QuestEvent } from "@quest/contract";
import type { PipModel } from "../../pip/contract";
import {
  GLANCE_INTERVAL_MS,
  createPipDirector,
  modeAt,
  type DirectorInput,
  type DirectorStart,
  type DirectorState,
  type GazePoint,
  type PipDirector,
} from "../pip/director";
import { NOD, reactionFor, type Reaction } from "../pip/reactions";
import type { StageClock } from "../pip/stage";
import type { Scenario } from "./scenarios";

/**
 * One Pip's own copy of a model. The Playground draws one Reaction on several
 * Pips, but the renderer plays an ID once per tab, so each Pip (`pip`) in
 * each mount and page load (`scope`) gets IDs of its own.
 */
export function pipModelFor(
  model: PipModel,
  pip: string,
  scope: string,
): PipModel {
  if (model.reaction === null) return model;
  return {
    ...model,
    reaction: { ...model.reaction, id: `${scope}:${model.reaction.id}#${pip}` },
  };
}

/** How an input turned out, for the log's mark. */
export type Outcome = "plays" | "nod" | "waits" | "dropped" | "none";

export interface LogEntry {
  /** Unique in the log, newest highest. */
  n: number;
  /** Milliseconds since the director's page load, on its own clock. */
  at: number;
  /** What the director was told. */
  input: string;
  outcome: Outcome;
  /** What it did, in a short sentence. */
  result: string;
}

/** What the log keeps: the newest entries. */
export const LOG_LIMIT = 60;

const intensityText = (value: number) => String(Math.round(value * 100) / 100);

/** A wait in words: "20 s", "5 min". */
export function durationText(ms: number): string {
  return ms >= 60_000 ? `${String(ms / 60_000)} min` : `${String(ms / 1000)} s`;
}

const kindText = (kind: string) => kind.charAt(0).toUpperCase() + kind.slice(1);

const samePlay = (a: DirectorState["playing"], b: DirectorState["playing"]) =>
  a?.id === b?.id && a?.startedAt === b?.startedAt;

/**
 * What one input made the director do: the Reaction the events earned (if
 * any) played in full or as a nod, waited for a Celebration's first second,
 * or was dropped; or a waiting Reaction or the Greeting started; or nothing.
 * A change of mode is added at the end.
 */
export function describeOutcome(
  before: DirectorState,
  beforeAt: number,
  after: DirectorState,
  afterAt: number,
  earned: Reaction | null,
  glanceThrottled: boolean,
): { outcome: Outcome; result: string } {
  let outcome: Outcome = "none";
  let result: string;
  const started = after.playing;
  if (started !== null && !samePlay(before.playing, started)) {
    const kind = kindText(started.kind);
    if (earned !== null && started.id === earned.eventId) {
      // A nod: the director softened a repeat, or the map gave a nod itself
      // (check.passed on a step that passed before).
      if (started.intensity < earned.intensity || earned.intensity === NOD) {
        outcome = "nod";
        result = `${kind} as a nod, at ${intensityText(started.intensity)}`;
      } else {
        outcome = "plays";
        result = `${kind} plays at ${intensityText(started.intensity)}`;
      }
    } else {
      outcome = "plays";
      result =
        started.kind === "greeting"
          ? `Greeting plays at ${intensityText(started.intensity)}`
          : `The waiting ${kind} plays at ${intensityText(started.intensity)}`;
    }
  } else if (
    earned !== null &&
    after.waiting?.reaction.eventId === earned.eventId
  ) {
    outcome = "waits";
    result = `${kindText(earned.kind)} waits for the Celebration's first second`;
  } else if (earned !== null) {
    outcome = "dropped";
    result = `${kindText(earned.kind)} is dropped: Pip can't be seen`;
  } else if (glanceThrottled) {
    result = `No glance: one at most every ${durationText(GLANCE_INTERVAL_MS)}`;
  } else {
    result = "No Reaction";
  }
  const modeBefore = modeAt(before, beforeAt);
  const modeAfter = modeAt(after, afterAt);
  if (modeBefore !== modeAfter) result += `; mode ${modeAfter}`;
  return { outcome, result };
}

export interface DriverSnapshot {
  model: PipModel;
  state: DirectorState;
  /** Newest first. */
  log: readonly LogEntry[];
  /** Counts page loads, so each load's Reaction IDs are its own. */
  load: number;
  /** The scenario playing, if one is. */
  playing: string | null;
}

export interface PlaygroundDriver {
  snapshot: () => DriverSnapshot;
  subscribe: (listener: () => void) => () => void;
  /** Tells the director something the browser learned. */
  send(input: DirectorInput, label: string): void;
  /** One revision's events. */
  events(events: readonly QuestEvent[]): void;
  /**
   * Where the hint, the tiers and the work sit relative to Pip: Explaining
   * and Curious look there. Kept across page loads.
   */
  setTargets(point: GazePoint): void;
  /** Moves the director's clock ahead without waiting. */
  jump(ms: number, label: string): void;
  /** A new page load: a fresh director, as the app has after a reload. */
  reload(start: DirectorStart): void;
  /** Reloads on the scenario's screen and plays its steps on real time. */
  play(scenario: Scenario, start: DirectorStart): void;
  /** Stops a playing scenario and every timer. */
  dispose(): void;
}

export function createPlaygroundDriver(
  clock: StageClock,
  start: DirectorStart = {},
): PlaygroundDriver {
  let skew = 0;
  const now = () => clock.now() + skew;
  let loadedAt = now();
  let director: PipDirector = createPipDirector(now, start);
  let load = 1;
  let sequence = 0;
  let log: LogEntry[] = [];
  let playing: string | null = null;
  let wake: unknown = null;
  let targets: DirectorInput = { type: "gazeTargets", targets: {} };
  let steps: unknown[] = [];
  /** The playing scenario's steps still to come. */
  let stepsLeft = 0;
  const listeners = new Set<() => void>();

  const snapshotOf = (): DriverSnapshot => ({
    model: director.model(),
    state: director.state(),
    log,
    load,
    playing,
  });
  const publish = () => {
    snapshot = snapshotOf();
    for (const listener of [...listeners]) listener();
  };

  const record = (input: string, outcome: Outcome, result: string) => {
    sequence += 1;
    log = [
      { n: sequence, at: now() - loadedAt, input, outcome, result },
      ...log,
    ].slice(0, LOG_LIMIT);
  };

  // The page load's own entry: the Greeting, if the screen greets.
  const recordLoad = () => {
    const greeted = director.state().playing;
    if (greeted === null) record("Page load", "none", "No Reaction");
    else
      record(
        "Page load",
        "plays",
        `Greeting plays at ${intensityText(greeted.intensity)}`,
      );
  };
  recordLoad();
  let snapshot = snapshotOf();

  // As the app's stage does: tick the director when its model is next due
  // to change with no input (a waiting Reaction, the gaze's release, sleep).
  const schedule = () => {
    if (wake !== null) clock.clearTimeout(wake);
    wake = null;
    const at = director.nextWakeAt();
    if (at === null) return;
    wake = clock.setTimeout(
      () => {
        wake = null;
        apply({ type: "tick" }, null);
      },
      Math.max(0, at - now()),
    );
  };

  /** Sends an input; a labelled one, and a tick that changed something, are logged. */
  const apply = (
    input: DirectorInput,
    label: string | null,
    events: readonly EventEnvelope[] = [],
    jumpBy = 0,
  ) => {
    const before = director.state();
    const beforeAt = now();
    skew += jumpBy;
    const glanceReady =
      before.lastGlanceAt === null ||
      beforeAt - before.lastGlanceAt >= GLANCE_INTERVAL_MS;
    const earned =
      events.length > 0 ? reactionFor(events, { glanceReady }) : null;
    const throttled =
      !glanceReady && events.some((e) => e.type === "work.changed");
    director.send(input);
    const after = director.state();
    const { outcome, result } = describeOutcome(
      before,
      beforeAt,
      after,
      now(),
      earned,
      throttled,
    );
    if (label !== null) record(label, outcome, result);
    else if (result !== "No Reaction") record("Time passes", outcome, result);
    // A scenario plays until its last step, and the Reaction waiting on a
    // Celebration's first second after it, have played.
    if (playing !== null && stepsLeft === 0 && after.waiting === null)
      playing = null;
    schedule();
    publish();
  };

  const stopScenario = () => {
    for (const step of steps) clock.clearTimeout(step);
    steps = [];
    stepsLeft = 0;
    playing = null;
  };

  const driver: PlaygroundDriver = {
    snapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    send(input, label) {
      apply(input, label);
    },
    events(batch) {
      const envelopes = batch.map((event): EventEnvelope => {
        sequence += 1;
        return {
          id: `playground.${String(load)}.${String(sequence)}`,
          revision: sequence,
          serverTime: 0,
          ...event,
        };
      });
      apply(
        { type: "events", events: envelopes },
        batch.map((event) => event.type).join(" + "),
        envelopes,
      );
    },
    setTargets(point) {
      targets = {
        type: "gazeTargets",
        targets: { hint: point, tiers: point, work: point },
      };
      apply(targets, null);
    },
    jump(ms, label) {
      apply({ type: "tick" }, label, [], ms);
    },
    reload(next) {
      stopScenario();
      skew = 0;
      loadedAt = now();
      load += 1;
      log = [];
      director = createPipDirector(now, next);
      director.send(targets);
      recordLoad();
      schedule();
      publish();
    },
    play(scenario, next) {
      driver.reload({ ...next, screen: scenario.screen ?? "step" });
      playing = scenario.id;
      stepsLeft = scenario.steps.length;
      steps = scenario.steps.map((step) =>
        clock.setTimeout(() => {
          stepsLeft -= 1;
          if ("events" in step) driver.events(step.events);
          else if ("input" in step) apply(step.input, step.label);
          else
            driver.jump(
              step.jump,
              `The clock jumps ${durationText(step.jump)} ahead`,
            );
        }, step.at),
      );
      publish();
    },
    dispose() {
      stopScenario();
      if (wake !== null) clock.clearTimeout(wake);
      wake = null;
      // Whoever subscribes next (React's second mount in StrictMode) reads
      // the scenario as stopped.
      snapshot = snapshotOf();
      listeners.clear();
    },
  };
  return driver;
}
