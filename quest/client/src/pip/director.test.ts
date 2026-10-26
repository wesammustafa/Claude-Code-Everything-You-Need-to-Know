import type { QuestEvent } from "@quest/contract";
import { describe, expect, test } from "vitest";
import { envelope } from "../../test/events";
import {
  CELEBRATION_FLOOR_MS,
  GAZE_HOLD_MS,
  GLANCE_INTERVAL_MS,
  IDLE_REST_MS,
  NOD_WINDOW_MS,
  createPipDirector,
  directorReduce,
  initialDirectorState,
  pipModel,
  type DirectorStart,
} from "./director";

// A director on a fake clock that only moves when a test moves it.
function setup(start: DirectorStart = {}) {
  let t = 0;
  const director = createPipDirector(() => t, start);
  const at = (ms: number) => {
    t = ms;
  };
  const send = (...events: QuestEvent[]) =>
    director.send({ type: "events", events: events.map((e) => envelope(e)) });
  return { director, at, send };
}

const passed: QuestEvent = { type: "check.passed", firstTime: true };
const notYet: QuestEvent = { type: "check.notYet", evidence: "no file yet" };
const firstLesson: QuestEvent = {
  type: "lesson.completed",
  capstone: false,
  firstTime: true,
};

describe("the spec's timings", () => {
  // Literal values from the spec, so a wrong constant fails here even where a
  // test below measures time by the constant.
  test("a Celebration's floor is 1 s", () => {
    expect(CELEBRATION_FLOOR_MS).toBe(1000);
  });
  test("the nod window is 3 s", () => {
    expect(NOD_WINDOW_MS).toBe(3000);
  });
  test("work.changed glances at most once every 20 s", () => {
    expect(GLANCE_INTERVAL_MS).toBe(20000);
  });
  test("Pip rests after 5 minutes", () => {
    expect(IDLE_REST_MS).toBe(300000);
  });
  test("the gaze holds 3 s", () => {
    expect(GAZE_HOLD_MS).toBe(3000);
  });
});

describe("modes", () => {
  test("Idle by default", () => {
    const { director } = setup();
    expect(director.model()).toMatchObject({ mode: "idle", reaction: null });
  });

  test.each([
    ["check.passed", passed],
    ["check.notYet", notYet],
    ["check.broken", { type: "check.broken" } as const],
  ])("Thinking from check.started until %s", (_name, result) => {
    const { director, send } = setup();
    expect(send({ type: "check.started" }).mode).toBe("thinking");
    expect(send({ type: "check.progress", n: 1, m: 3 }).mode).toBe("thinking");
    expect(director.model().reaction).toBeNull();
    expect(send(result).mode).toBe("idle");
  });

  test("check.progress alone changes nothing", () => {
    const { send } = setup();
    expect(send({ type: "check.progress", n: 1, m: 3 })).toMatchObject({
      mode: "idle",
      reaction: null,
    });
  });

  test("Rest while the lesson page panel is open", () => {
    const { director } = setup();
    expect(director.send({ type: "pagePanel", open: true }).mode).toBe("rest");
    expect(director.send({ type: "pagePanel", open: false }).mode).toBe("idle");
  });

  test("Rest while the page is hidden", () => {
    const { director } = setup();
    expect(director.send({ type: "visibility", hidden: true }).mode).toBe(
      "rest",
    );
    expect(director.send({ type: "visibility", hidden: false }).mode).toBe(
      "idle",
    );
  });

  test("Rest while Pip is off-screen", () => {
    const { director } = setup();
    expect(director.send({ type: "onScreen", visible: false }).mode).toBe(
      "rest",
    );
    expect(director.send({ type: "onScreen", visible: true }).mode).toBe(
      "idle",
    );
  });

  test("Rest while reduced motion is on", () => {
    const { director } = setup();
    expect(director.send({ type: "reducedMotion", on: true })).toMatchObject({
      mode: "rest",
      reducedMotion: true,
    });
    expect(director.send({ type: "reducedMotion", on: false }).mode).toBe(
      "idle",
    );
    expect(setup({ reducedMotion: true }).director.model().mode).toBe("rest");
  });

  test("Rest after 5 minutes with no event or input; either wakes Pip", () => {
    const { director, at, send } = setup();
    at(IDLE_REST_MS - 1);
    expect(director.model().mode).toBe("idle");
    at(IDLE_REST_MS);
    expect(director.model().mode).toBe("rest");
    expect(director.send({ type: "activity" }).mode).toBe("idle");
    at(2 * IDLE_REST_MS);
    expect(director.model().mode).toBe("rest");
    // Any event counts, even one that makes no Reaction.
    expect(send({ type: "notice", kind: "saved" }).mode).toBe("idle");
    at(3 * IDLE_REST_MS);
    expect(director.send({ type: "screen", screen: "map" }).mode).toBe("idle");
  });

  test("a mode-only input is not activity", () => {
    const { director, at } = setup();
    at(IDLE_REST_MS);
    expect(director.send({ type: "pagePanel", open: false }).mode).toBe("rest");
  });

  test("Rest while the connection is lost", () => {
    const { director } = setup();
    expect(director.send({ type: "connection", lost: true }).mode).toBe("rest");
    expect(director.send({ type: "connection", lost: false }).mode).toBe(
      "idle",
    );
  });

  test("reduced motion means Rest, so a Check shows no Thinking", () => {
    const { send } = setup({ reducedMotion: true });
    expect(send({ type: "check.started" }).mode).toBe("rest");
  });

  test("Rest outranks Thinking, which comes back when Rest ends", () => {
    const { director, send } = setup();
    send({ type: "check.started" });
    expect(director.send({ type: "pagePanel", open: true }).mode).toBe("rest");
    expect(director.send({ type: "pagePanel", open: false }).mode).toBe(
      "thinking",
    );
  });
});

describe("Reactions", () => {
  test("a Reaction plays under its event's ID", () => {
    const { director } = setup();
    const e = envelope({ type: "answer.right" });
    const model = director.send({ type: "events", events: [e] });
    expect(model.reaction).toEqual({ id: e.id, kind: "success", intensity: 1 });
  });

  test("the newest Reaction replaces the one playing", () => {
    const { at, send } = setup();
    send({ type: "answer.right" });
    at(100);
    expect(send({ type: "hint.shown", rung: 1 }).reaction?.kind).toBe(
      "explaining",
    );
    at(200);
    expect(send(notYet).reaction).toMatchObject({
      kind: "retry",
      intensity: 0.5,
    });
  });

  test("notice leaves the playing Reaction alone", () => {
    const { send } = setup();
    const before = send({ type: "answer.wrong" }).reaction;
    expect(send({ type: "notice", kind: "x" }).reaction).toEqual(before);
  });

  test("a Celebration plays at least 1 s before anything else replaces it", () => {
    const { director, at, send } = setup();
    const celebration = send(firstLesson).reaction;
    expect(celebration).toMatchObject({ kind: "celebration", intensity: 0.7 });

    at(CELEBRATION_FLOOR_MS - 1);
    expect(send({ type: "answer.right" }).reaction).toEqual(celebration);
    // Only the newest waiting Reaction plays when the second is up.
    const hint = envelope({ type: "hint.shown", rung: 1 });
    expect(director.send({ type: "events", events: [hint] }).reaction).toEqual(
      celebration,
    );
    expect(director.nextWakeAt()).toBe(CELEBRATION_FLOOR_MS);

    at(CELEBRATION_FLOOR_MS);
    expect(director.send({ type: "tick" }).reaction).toEqual({
      id: hint.id,
      kind: "explaining",
      intensity: 1,
    });
  });

  test("another Celebration replaces a Celebration at once", () => {
    const { at, send } = setup();
    send(firstLesson);
    at(10);
    expect(send({ type: "course.completed" }).reaction).toMatchObject({
      kind: "celebration",
      intensity: 1,
    });
  });

  test("a Celebration replaces a waiting Reaction too", () => {
    const { director, at, send } = setup();
    send(firstLesson);
    at(100);
    send({ type: "answer.right" });
    at(200);
    const level = send({ type: "level.completed", level: "beginner" }).reaction;
    at(CELEBRATION_FLOOR_MS + 200);
    expect(director.send({ type: "tick" }).reaction).toEqual(level);
  });

  test("after its floor a Celebration is replaced at once", () => {
    const { at, send } = setup();
    send(firstLesson);
    at(CELEBRATION_FLOOR_MS);
    expect(send({ type: "answer.right" }).reaction?.kind).toBe("success");
  });

  test("the same Reaction within 3 s plays as a nod", () => {
    const { at, send } = setup();
    const first = send({ type: "answer.right" }).reaction;
    at(2999);
    const second = send({ type: "warmup.recalled" }).reaction;
    expect(second).toMatchObject({ kind: "success", intensity: 0.2 });
    // A nod is still a new Reaction: a new ID, so it plays.
    expect(second?.id).not.toBe(first?.id);
    // The window runs from the first full play, not from the nod.
    at(3000);
    expect(send({ type: "step.completed" }).reaction?.intensity).toBe(1);
    at(5999);
    expect(send({ type: "answer.right" }).reaction?.intensity).toBe(0.2);
    at(6000);
    expect(send({ type: "answer.right" }).reaction?.intensity).toBe(1);
  });

  test("a nod does not lower what the window counts as strongest", () => {
    const { at, send } = setup();
    expect(send({ type: "answer.right" }).reaction?.intensity).toBe(1);
    at(1000);
    expect(
      send({ type: "check.passed", firstTime: false }).reaction?.intensity,
    ).toBe(0.2);
    at(2000);
    expect(send({ type: "step.completed" }).reaction).toMatchObject({
      kind: "success",
      intensity: 0.2,
    });
  });

  test("a Lesson's Celebration then its Level's both play in full", () => {
    const { at, send } = setup();
    expect(send(firstLesson).reaction?.intensity).toBe(0.7);
    at(1000);
    expect(
      send({ type: "level.completed", level: "beginner" }).reaction?.intensity,
    ).toBe(0.9);
    // The Level's 0.9 is now the strongest, and the window still runs from
    // the Lesson's play at 0 ms.
    at(2000);
    expect(
      send({ type: "level.completed", level: "beginner" }).reaction?.intensity,
    ).toBe(0.2);
    at(2500);
    expect(send({ type: "course.completed" }).reaction?.intensity).toBe(1);
    at(3000);
    expect(send(firstLesson).reaction?.intensity).toBe(0.7);
  });

  test("the nod window measures each kind on its own", () => {
    const { at, send } = setup();
    send({ type: "check.notYet", evidence: "x" });
    at(500);
    send({ type: "hint.shown", rung: 1 });
    at(1000);
    expect(send({ type: "answer.wrong" }).reaction).toMatchObject({
      kind: "retry",
      intensity: 0.2,
    });
    at(1500);
    expect(send({ type: "answer.right" }).reaction?.intensity).toBe(1);
  });

  test("a stronger Reaction of the same kind is not a nod", () => {
    const { at, send } = setup();
    send({ type: "warmup.missed" });
    at(1000);
    expect(send(notYet).reaction?.intensity).toBe(0.5);
    at(1500);
    send(firstLesson);
    at(2000);
    expect(
      send({ type: "level.completed", level: "beginner" }).reaction?.intensity,
    ).toBe(0.9);
  });

  test("a repeated check.passed on a passed step nods at 0.2", () => {
    const { at, send } = setup();
    expect(send(passed).reaction?.intensity).toBe(1);
    at(NOD_WINDOW_MS + 1000);
    const repeat: QuestEvent = { type: "check.passed", firstTime: false };
    expect(send(repeat).reaction).toMatchObject({
      kind: "success",
      intensity: 0.2,
    });
    at(NOD_WINDOW_MS + 2000);
    expect(send(repeat).reaction?.intensity).toBe(0.2);
  });

  test("work.changed glances at most once every 20 s", () => {
    const { at, send } = setup();
    const glance = send({ type: "work.changed" }).reaction;
    expect(glance).toMatchObject({ kind: "curious", intensity: 0.4 });
    at(GLANCE_INTERVAL_MS - 1);
    expect(send({ type: "work.changed" }).reaction).toEqual(glance);
    at(GLANCE_INTERVAL_MS);
    const next = send({ type: "work.changed" }).reaction;
    expect(next).toMatchObject({ kind: "curious" });
    expect(next?.id).not.toBe(glance?.id);
  });

  test("a held-back glance does not restart the 20 s window", () => {
    const { at, send } = setup();
    send({ type: "work.changed" });
    at(10_000);
    send({ type: "work.changed" });
    at(GLANCE_INTERVAL_MS);
    expect(send({ type: "work.changed" }).reaction?.kind).toBe("curious");
  });

  test("the glance window does not hold back stepDown.reached", () => {
    const { at, send } = setup();
    send({ type: "work.changed" });
    at(NOD_WINDOW_MS);
    expect(
      send({ type: "stepDown.reached", from: "hinted", to: "challenge" })
        .reaction?.kind,
    ).toBe("curious");
  });

  test("a revision plays only its highest-ranked Reaction", () => {
    const { send } = setup();
    expect(
      send(
        { type: "check.started" },
        passed,
        { type: "step.completed" },
        firstLesson,
        { type: "level.completed", level: "intermediate" },
      ).reaction,
    ).toMatchObject({ kind: "celebration", intensity: 0.9 });
  });

  test("no Reaction starts while Pip can't be seen", () => {
    const hidden = setup();
    hidden.director.send({ type: "visibility", hidden: true });
    expect(hidden.send({ type: "answer.right" }).reaction).toBeNull();

    const off = setup();
    off.director.send({ type: "onScreen", visible: false });
    expect(off.send({ type: "answer.right" }).reaction).toBeNull();
    // Nothing was played, so nothing nods when Pip is back in view.
    off.director.send({ type: "onScreen", visible: true });
    expect(off.send({ type: "answer.right" }).reaction?.intensity).toBe(1);
  });

  test("a Celebration's waiting Reaction is dropped if Pip leaves view", () => {
    const { director, at, send } = setup();
    const celebration = send(firstLesson).reaction;
    at(100);
    send({ type: "answer.right" });
    director.send({ type: "visibility", hidden: true });
    at(CELEBRATION_FLOOR_MS);
    director.send({ type: "visibility", hidden: false });
    expect(director.model().reaction).toEqual(celebration);
  });

  test("Reactions still play with the page panel open and under reduced motion", () => {
    const { director, send } = setup();
    director.send({ type: "pagePanel", open: true });
    expect(send({ type: "answer.right" })).toMatchObject({
      mode: "rest",
      reaction: { kind: "success" },
    });
    director.send({ type: "reducedMotion", on: true });
    expect(send(notYet)).toMatchObject({
      mode: "rest",
      reducedMotion: true,
      reaction: { kind: "retry", intensity: 0.5 },
    });
  });
});

describe("Greeting", () => {
  test("plays on the first Welcome screen of a page load, once", () => {
    const { director, at } = setup({ screen: "welcome" });
    const greeting = director.model().reaction;
    expect(greeting).toMatchObject({ kind: "greeting", intensity: 1 });
    at(10_000);
    director.send({ type: "screen", screen: "map" });
    at(20_000);
    expect(
      director.send({ type: "screen", screen: "welcome" }).reaction,
    ).toEqual(greeting);
    director.send({ type: "screen", screen: "resume" });
    expect(director.state().greeted).toBe(true);
    expect(director.model().reaction).toEqual(greeting);
  });

  test("plays on the first Resume screen", () => {
    const { director } = setup();
    expect(director.model().reaction).toBeNull();
    expect(
      director.send({ type: "screen", screen: "resume" }).reaction?.kind,
    ).toBe("greeting");
  });

  test("never plays on other screens", () => {
    const { director } = setup({ screen: "step" });
    for (const screen of [
      "map",
      "intro",
      "step",
      "levelup",
      "complete",
      "next",
      "levelComplete",
      "courseComplete",
      "other",
    ] as const) {
      expect(director.send({ type: "screen", screen }).reaction).toBeNull();
    }
  });

  test("a page loaded on a Lesson greets the first time Welcome shows", () => {
    const { director, at, send } = setup({ screen: "step" });
    send({ type: "answer.right" });
    at(5000);
    expect(
      director.send({ type: "screen", screen: "welcome" }).reaction?.kind,
    ).toBe("greeting");
  });

  test("waits until Pip can be seen", () => {
    const { director } = setup({ screen: "welcome", hidden: true });
    expect(director.model().reaction).toBeNull();
    expect(
      director.send({ type: "visibility", hidden: false }).reaction?.kind,
    ).toBe("greeting");
  });

  test("a new page load greets again", () => {
    expect(setup({ screen: "welcome" }).director.model().reaction?.kind).toBe(
      "greeting",
    );
    expect(setup({ screen: "resume" }).director.model().reaction?.kind).toBe(
      "greeting",
    );
  });
});

describe("gaze", () => {
  const targets = {
    hint: { x: 0.6, y: -0.2 },
    tiers: { x: 2, y: -3 },
    work: { x: -0.5, y: 0.1 },
  };

  test("Explaining looks at the hint", () => {
    const { director, send } = setup();
    director.send({ type: "gazeTargets", targets });
    expect(send({ type: "hint.shown", rung: 1 }).gaze).toEqual(targets.hint);
    expect(send({ type: "help.offered" }).gaze).toEqual(targets.hint);
  });

  test("Curious looks at its target, clamped to -1..1", () => {
    const { director, at, send } = setup();
    director.send({ type: "gazeTargets", targets });
    expect(send({ type: "work.changed" }).gaze).toEqual(targets.work);
    at(100);
    expect(
      send({ type: "stepDown.reached", from: "guided", to: "hinted" }).gaze,
    ).toEqual({ x: 1, y: -1 });
  });

  test("every other Reaction leaves gaze to the rig", () => {
    const { director, at, send } = setup({ screen: "welcome" });
    director.send({ type: "gazeTargets", targets });
    expect(director.model().gaze).toBeNull();
    const others: QuestEvent[] = [
      passed,
      notYet,
      firstLesson,
      { type: "answer.right" },
    ];
    others.forEach((event, i) => {
      at((i + 1) * 5000);
      expect(send(event).gaze).toBeNull();
    });
  });

  test("the gaze is released after its hold", () => {
    const { director, at, send } = setup();
    director.send({ type: "gazeTargets", targets });
    send({ type: "hint.shown", rung: 1 });
    expect(director.nextWakeAt()).toBe(GAZE_HOLD_MS);
    at(GAZE_HOLD_MS - 1);
    expect(director.model().gaze).toEqual(targets.hint);
    at(GAZE_HOLD_MS);
    expect(director.model().gaze).toBeNull();
  });

  test("a target the page has not placed leaves gaze to the rig", () => {
    const { send } = setup();
    expect(send({ type: "hint.shown", rung: 1 }).gaze).toBeNull();
  });

  test("no gaze under reduced motion", () => {
    const { director, send } = setup({ reducedMotion: true });
    director.send({ type: "gazeTargets", targets });
    const model = send({ type: "hint.shown", rung: 1 });
    expect(model.reaction?.kind).toBe("explaining");
    expect(model.gaze).toBeNull();
    expect(send({ type: "work.changed" }).gaze).toBeNull();
  });
});

describe("the model", () => {
  test("Pip is large on Welcome, Resume, Step-down and every Complete, beside the step elsewhere", () => {
    const { director } = setup();
    const sizes = (
      [
        "welcome",
        "resume",
        "levelup",
        "complete",
        "next",
        "levelComplete",
        "courseComplete",
        "map",
        "intro",
        "step",
        "other",
      ] as const
    ).map((screen) => director.send({ type: "screen", screen }).size);
    expect(sizes).toEqual([
      "hero",
      "hero",
      "hero",
      "hero",
      "hero",
      "hero",
      "hero",
      "beside",
      "beside",
      "beside",
      "beside",
    ]);
  });

  test("the reducer is pure: the same input and time give the same state", () => {
    const s = initialDirectorState(0, { screen: "step" });
    const input = {
      type: "events",
      events: [envelope({ type: "answer.right" })],
    } as const;
    const a = directorReduce(s, input, 50);
    const b = directorReduce(s, input, 50);
    expect(a).toEqual(b);
    expect(s.playing).toBeNull();
    expect(pipModel(a, 50)).toEqual(pipModel(b, 50));
  });

  test("nextWakeAt names the 5-minute rest when nothing sooner is due", () => {
    const { director, at } = setup();
    expect(director.nextWakeAt()).toBe(IDLE_REST_MS);
    at(IDLE_REST_MS);
    expect(director.nextWakeAt()).toBeNull();
  });
});
