import { describe, expect, test, vi } from "vitest";
import { envelope } from "../../test/events";
import { GAZE_HOLD_MS, IDLE_REST_MS } from "./director";
import {
  createPipStage,
  gazeToward,
  measureGazeTargets,
  samePipModel,
  type StageClock,
} from "./stage";

/** A clock the test moves by hand, with the timers the stage sets on it. */
function fakeClock() {
  let now = 0;
  let next = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const clock: StageClock & {
    advance: (ms: number) => void;
    pending: () => number;
  } = {
    now: () => now,
    setTimeout(run, ms) {
      next += 1;
      timers.set(next, { at: now + ms, run });
      return next;
    },
    clearTimeout(handle) {
      timers.delete(handle as number);
    },
    advance(ms) {
      const until = now + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= until)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].run();
      }
      now = until;
    },
    pending: () => timers.size,
  };
  return clock;
}

const rect = (x: number, y: number, size = 10) =>
  new DOMRectReadOnly(x, y, size, size);

describe("Pip's stage", () => {
  test("hands out the director's model, and tells its listeners only when it changes", () => {
    const clock = fakeClock();
    const stage = createPipStage(clock, { screen: "step" });
    const listener = vi.fn();
    stage.subscribe(listener);
    expect(stage.model()).toMatchObject({ mode: "idle", size: "beside" });

    stage.send({ type: "activity" });
    expect(listener).not.toHaveBeenCalled();

    const passed = envelope({ type: "check.passed", firstTime: true });
    stage.send({ type: "events", events: [passed] });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(stage.model().reaction).toEqual({
      id: passed.id,
      kind: "success",
      intensity: 1,
    });
    const held = stage.model();
    stage.send({ type: "tick" });
    expect(stage.model()).toBe(held);
  });

  test("ticks the director when its model is due to change: the gaze's release", () => {
    const clock = fakeClock();
    const stage = createPipStage(clock, { screen: "step" });
    stage.subscribe(() => undefined);
    stage.send({ type: "gazeTargets", targets: { hint: { x: 1, y: 0 } } });
    stage.send({
      type: "events",
      events: [envelope({ type: "hint.shown", rung: 1 })],
    });
    expect(stage.model().gaze).toEqual({ x: 1, y: 0 });
    clock.advance(GAZE_HOLD_MS - 1);
    expect(stage.model().gaze).toEqual({ x: 1, y: 0 });
    clock.advance(1);
    expect(stage.model().gaze).toBeNull();
  });

  test("ticks the director when its model is due to change: the 5-minute rest", () => {
    const clock = fakeClock();
    const stage = createPipStage(clock, { screen: "step" });
    stage.subscribe(() => undefined);
    clock.advance(IDLE_REST_MS - 1);
    expect(stage.model().mode).toBe("idle");
    clock.advance(1);
    expect(stage.model().mode).toBe("rest");
  });

  test("keeps no timer while no one listens", () => {
    const clock = fakeClock();
    const stage = createPipStage(clock, { screen: "step" });
    expect(clock.pending()).toBe(0);
    const stop = stage.subscribe(() => undefined);
    expect(clock.pending()).toBe(1);
    stop();
    expect(clock.pending()).toBe(0);
  });

  test("starts as the page is: reduced motion rests Pip from the first frame", () => {
    const stage = createPipStage(fakeClock(), {
      screen: "step",
      reducedMotion: true,
    });
    expect(stage.model()).toMatchObject({ mode: "rest", reducedMotion: true });
  });
});

describe("samePipModel", () => {
  const base = {
    mode: "idle",
    reaction: { id: "e.1", kind: "success", intensity: 1 },
    gaze: { x: 0.5, y: 0 },
    reducedMotion: false,
    size: "beside",
  } as const;

  test("compares by value", () => {
    expect(
      samePipModel(base, {
        ...base,
        reaction: { ...base.reaction },
        gaze: { ...base.gaze },
      }),
    ).toBe(true);
  });

  test.each([
    ["mode", { mode: "rest" }],
    ["size", { size: "hero" }],
    ["reduced motion", { reducedMotion: true }],
    ["the Reaction's ID", { reaction: { ...base.reaction, id: "e.2" } }],
    [
      "the Reaction's strength",
      { reaction: { ...base.reaction, intensity: 0.2 } },
    ],
    ["no Reaction", { reaction: null }],
    ["the gaze", { gaze: { x: 0.5, y: 0.1 } }],
    ["no gaze", { gaze: null }],
  ] as const)("tells a change of %s", (_name, change) => {
    expect(samePipModel(base, { ...base, ...change })).toBe(false);
  });
});

describe("gaze targets", () => {
  test("point from Pip's centre to the target's, as a unit vector", () => {
    expect(gazeToward(rect(0, 0), rect(100, 0))).toEqual({ x: 1, y: 0 });
    expect(gazeToward(rect(0, 0), rect(0, -50))).toEqual({ x: 0, y: -1 });
    const diagonal = gazeToward(rect(0, 0), rect(30, 40));
    expect(diagonal.x).toBeCloseTo(0.6);
    expect(diagonal.y).toBeCloseTo(0.8);
    expect(gazeToward(rect(0, 0), rect(0, 0))).toEqual({ x: 0, y: 0 });
  });

  test("are measured from the Pip on the page to each marked target", () => {
    document.body.innerHTML = `
      <span data-pip="beside"></span>
      <p data-pip-target="hint"></p>
      <p data-pip-target="work"></p>`;
    const at = (selector: string, r: DOMRectReadOnly) => {
      const el = document.querySelector(selector);
      if (el) el.getBoundingClientRect = () => r;
    };
    at("[data-pip]", rect(0, 0));
    at("[data-pip-target=hint]", rect(100, 0));
    at("[data-pip-target=work]", rect(0, 100));
    expect(measureGazeTargets(document)).toEqual({
      hint: { x: 1, y: 0 },
      work: { x: 0, y: 1 },
    });
    document.body.innerHTML = `<p data-pip-target="hint"></p>`;
    expect(measureGazeTargets(document)).toEqual({});
  });
});
