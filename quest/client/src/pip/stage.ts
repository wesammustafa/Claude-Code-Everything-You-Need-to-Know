// Pip's stage: the director with a real clock and its timer, as a store React
// can subscribe to. Everything the page learns goes in through `send`; the
// PipModel comes out, and changes only when the director's model does.
import type { PipModel } from "../../pip/contract";
import {
  createPipDirector,
  type DirectorInput,
  type DirectorStart,
  type GazePoint,
} from "./director";
import type { PipGazeTarget } from "./reactions";

export interface StageClock {
  now(): number;
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface PipStage {
  model: () => PipModel;
  send: (input: DirectorInput) => void;
  /** While anyone listens, the stage ticks the director when its model is due to change. */
  subscribe: (listener: () => void) => () => void;
}

/** Whether two models draw the same Pip. */
export function samePipModel(a: PipModel, b: PipModel): boolean {
  return (
    a.mode === b.mode &&
    a.size === b.size &&
    a.reducedMotion === b.reducedMotion &&
    a.reaction?.id === b.reaction?.id &&
    a.reaction?.kind === b.reaction?.kind &&
    a.reaction?.intensity === b.reaction?.intensity &&
    a.gaze?.x === b.gaze?.x &&
    a.gaze?.y === b.gaze?.y
  );
}

export function createPipStage(
  clock: StageClock,
  start: DirectorStart = {},
): PipStage {
  const director = createPipDirector(() => clock.now(), start);
  let model = director.model();
  const listeners = new Set<() => void>();
  let timer: { handle: unknown } | null = null;

  const unschedule = () => {
    if (timer !== null) clock.clearTimeout(timer.handle);
    timer = null;
  };
  // The director names when its model next changes with no input (a waiting
  // Reaction, the gaze's release, the 5-minute rest); a tick then brings it.
  const schedule = () => {
    unschedule();
    if (listeners.size === 0) return;
    const at = director.nextWakeAt();
    if (at === null) return;
    timer = {
      handle: clock.setTimeout(
        () => {
          timer = null;
          send({ type: "tick" });
        },
        Math.max(0, at - clock.now()),
      ),
    };
  };
  const send = (input: DirectorInput) => {
    const next = director.send(input);
    if (!samePipModel(model, next)) {
      model = next;
      for (const listener of [...listeners]) listener();
    }
    schedule();
  };

  return {
    model: () => model,
    send,
    subscribe(listener) {
      listeners.add(listener);
      schedule();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) unschedule();
      };
    },
  };
}

/**
 * Where a target sits as Pip sees it: the direction from Pip's centre to the
 * target's, as a unit vector (-1..1 on each axis, +x to the right, +y down).
 * A target at Pip's centre is straight ahead.
 */
export function gazeToward(
  pip: DOMRectReadOnly,
  target: DOMRectReadOnly,
): GazePoint {
  const dx = target.x + target.width / 2 - (pip.x + pip.width / 2);
  const dy = target.y + target.height / 2 - (pip.y + pip.height / 2);
  const length = Math.hypot(dx, dy);
  return length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length };
}

const TARGETS: readonly PipGazeTarget[] = ["hint", "tiers", "work"];

/**
 * The page's gaze targets, relative to the Pip on screen: elements marked
 * `data-pip-target="hint"` (or `tiers`, `work`). None without a drawn Pip.
 */
export function measureGazeTargets(
  root: ParentNode,
): Partial<Record<PipGazeTarget, GazePoint>> {
  const pip = root.querySelector("[data-pip]");
  if (pip === null) return {};
  const from = pip.getBoundingClientRect();
  const targets: Partial<Record<PipGazeTarget, GazePoint>> = {};
  for (const name of TARGETS) {
    const el = root.querySelector(`[data-pip-target="${name}"]`);
    if (el !== null)
      targets[name] = gazeToward(from, el.getBoundingClientRect());
  }
  return targets;
}
