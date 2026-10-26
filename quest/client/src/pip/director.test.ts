import type { QuestEvent } from "@quest/contract";
import { describe, expect, test } from "vitest";
import { envelope } from "../../test/events";
import {
  CELEBRATION_FLOOR_MS,
  GAZE_HOLD_MS,
  GLANCE_INTERVAL_MS,
  IDLE_REST_MS,
  LOOK_HOLD_MS,
  NOD_WINDOW_MS,
  OFFER_INTENSITY,
  RESULT_REACTION_MS,
  REST_TOWARD_CONTENT,
  createPipDirector,
  directorReduce,
  initialDirectorState,
  pipModel,
  restingGaze,
  type DirectorInput,
  type DirectorStart,
} from "./director";
import { HINT_UNUSED_MS, NOT_YETS_IN_A_ROW, helpStep } from "./help";

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
      "progress",
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

const targets = {
  hint: { x: 0.6, y: -0.2 },
  tiers: { x: 2, y: -3 },
  work: { x: -0.5, y: 0.1 },
};
const REST = { x: 0.4, y: 0 };
const FORWARD = { x: 0, y: 0 };

describe("resting gaze", () => {
  test("the spec's values: about 0.4 toward the content, 0 facing the Learner", () => {
    expect(REST_TOWARD_CONTENT).toBe(0.4);
  });

  test.each([
    ["map", REST],
    ["intro", REST],
    ["step", REST],
    ["progress", REST],
    ["welcome", FORWARD],
    ["resume", FORWARD],
    ["levelup", FORWARD],
    ["complete", FORWARD],
    ["next", FORWARD],
    ["levelComplete", FORWARD],
    ["courseComplete", FORWARD],
    ["other", FORWARD],
  ] as const)("on %s Pip rests at %o, never no gaze", (screen, rest) => {
    const { director } = setup({ screen });
    expect(director.model().gaze).toEqual(rest);
    expect(restingGaze(screen)).toEqual(rest);
  });

  test("follows the screen", () => {
    const { director, at } = setup({ screen: "welcome" });
    // After the Greeting, which faces the Learner, has let go.
    at(GAZE_HOLD_MS);
    expect(director.send({ type: "screen", screen: "step" }).gaze).toEqual(
      REST,
    );
    expect(director.send({ type: "screen", screen: "complete" }).gaze).toEqual(
      FORWARD,
    );
  });

  test("reduced motion keeps the resting gaze, and nothing moves it", () => {
    const { director, send } = setup({ screen: "step", reducedMotion: true });
    director.send({ type: "gazeTargets", targets });
    expect(director.model().gaze).toEqual(REST);
    expect(send({ type: "hint.shown", rung: 1 }).gaze).toEqual(REST);
    expect(
      director.send({ type: "look", target: "command", at: { x: 1, y: 1 } })
        .gaze,
    ).toEqual(REST);
    expect(director.nextWakeAt()).toBe(IDLE_REST_MS);
  });
});

describe("Reaction gaze", () => {
  test("Explaining looks at the hint", () => {
    const { director, send } = setup({ screen: "step" });
    director.send({ type: "gazeTargets", targets });
    expect(send({ type: "hint.shown", rung: 1 }).gaze).toEqual(targets.hint);
    expect(send({ type: "help.offered" }).gaze).toEqual(targets.hint);
  });

  test("Curious looks at its target, clamped to -1..1", () => {
    const { director, at, send } = setup({ screen: "step" });
    director.send({ type: "gazeTargets", targets });
    expect(send({ type: "work.changed" }).gaze).toEqual(targets.work);
    at(100);
    expect(
      send({ type: "stepDown.reached", from: "guided", to: "hinted" }).gaze,
    ).toEqual({ x: 1, y: -1 });
  });

  test("Greeting and Celebration face the Learner, even beside the content", () => {
    const { director, at, send } = setup({ screen: "welcome" });
    expect(director.model()).toMatchObject({
      reaction: { kind: "greeting" },
      gaze: FORWARD,
    });
    at(5000);
    director.send({ type: "screen", screen: "step" });
    expect(send(firstLesson)).toMatchObject({
      reaction: { kind: "celebration" },
      gaze: FORWARD,
    });
    at(5000 + GAZE_HOLD_MS);
    expect(director.model().gaze).toEqual(REST);
  });

  test("Success and Retry leave the resting gaze", () => {
    const { director, at, send } = setup({ screen: "step" });
    director.send({ type: "gazeTargets", targets });
    const others: QuestEvent[] = [passed, { type: "answer.right" }, notYet];
    others.forEach((event, i) => {
      at((i + 1) * 5000);
      expect(send(event).gaze).toEqual(REST);
    });
  });

  test("the gaze returns to rest after its hold", () => {
    const { director, at, send } = setup({ screen: "step" });
    director.send({ type: "gazeTargets", targets });
    send({ type: "hint.shown", rung: 1 });
    expect(director.nextWakeAt()).toBe(GAZE_HOLD_MS);
    at(GAZE_HOLD_MS - 1);
    expect(director.model().gaze).toEqual(targets.hint);
    at(GAZE_HOLD_MS);
    expect(director.model().gaze).toEqual(REST);
  });

  test("a target the page has not placed leaves the resting gaze", () => {
    const { send } = setup({ screen: "step" });
    expect(send({ type: "hint.shown", rung: 1 }).gaze).toEqual(REST);
  });
});

describe("watching", () => {
  const command = { x: 0.8, y: 0.6 };

  test("the look hold is about 1.5 s", () => {
    expect(LOOK_HOLD_MS).toBe(1500);
  });

  test("a look sets the gaze, then releases it to rest", () => {
    const { director, at } = setup({ screen: "step" });
    expect(
      director.send({ type: "look", target: "command", at: command }).gaze,
    ).toEqual(command);
    expect(director.nextWakeAt()).toBe(LOOK_HOLD_MS);
    at(LOOK_HOLD_MS - 1);
    expect(director.model().gaze).toEqual(command);
    at(LOOK_HOLD_MS);
    expect(director.model().gaze).toEqual(REST);
  });

  test("a look is clamped to -1..1", () => {
    const { director } = setup({ screen: "step" });
    expect(
      director.send({ type: "look", target: "hint", at: { x: 3, y: -2 } }).gaze,
    ).toEqual({ x: 1, y: -1 });
  });

  test("a newer look replaces the one before and holds from its own start", () => {
    const { director, at } = setup({ screen: "step" });
    director.send({ type: "look", target: "command", at: command });
    at(1000);
    director.send({ type: "look", target: "hint", at: targets.hint });
    at(1000 + LOOK_HOLD_MS - 1);
    expect(director.model().gaze).toEqual(targets.hint);
  });

  test("the check's lines arriving look at the lines", () => {
    const { director, at, send } = setup({ screen: "step" });
    const lines = { x: 0.3, y: 0.9 };
    director.send({ type: "gazeTargets", targets: { lines } });
    expect(send({ type: "check.started" }).gaze).toEqual(REST);
    expect(send({ type: "check.progress", n: 1, m: 2 }).gaze).toEqual(lines);
    at(LOOK_HOLD_MS);
    expect(director.model().gaze).toEqual(REST);
    // The Not yet's Retry has no gaze of its own, so Pip watches the lines.
    expect(send(notYet)).toMatchObject({
      reaction: { kind: "retry" },
      gaze: lines,
    });
  });

  test("Explaining and Curious win over a look while they hold", () => {
    const { director, at, send } = setup({ screen: "step" });
    director.send({ type: "gazeTargets", targets });
    send({ type: "hint.shown", rung: 1 });
    at(100);
    expect(
      director.send({ type: "look", target: "command", at: command }).gaze,
    ).toEqual(targets.hint);
    at(5000);
    director.send({ type: "look", target: "command", at: command });
    expect(send({ type: "work.changed" }).gaze).toEqual(targets.work);
  });

  test("a look outlasting the Reaction's hold shows once the hold ends", () => {
    const { director, at, send } = setup({ screen: "step" });
    director.send({ type: "gazeTargets", targets });
    send({ type: "hint.shown", rung: 1 });
    at(GAZE_HOLD_MS - 500);
    director.send({ type: "look", target: "command", at: command });
    at(GAZE_HOLD_MS);
    expect(director.model().gaze).toEqual(command);
  });

  test("events that bring no lines leave a look running", () => {
    const { director, at, send } = setup({ screen: "step" });
    director.send({
      type: "gazeTargets",
      targets: { lines: { x: 0.3, y: 0.9 } },
    });
    director.send({ type: "look", target: "command", at: command });
    at(500);
    expect(send({ type: "notice", kind: "saved" }).gaze).toEqual(command);
    expect(send({ type: "check.started" }).gaze).toEqual(command);
  });

  test("a broken Check's lines arriving look at the lines", () => {
    const { director, send } = setup({ screen: "step" });
    const lines = { x: 0.3, y: 0.9 };
    director.send({ type: "gazeTargets", targets: { lines } });
    expect(send({ type: "check.broken" })).toMatchObject({
      reaction: { kind: "retry" },
      gaze: lines,
    });
  });

  test("a look ends when the screen changes", () => {
    const { director } = setup({ screen: "step" });
    director.send({ type: "look", target: "command", at: command });
    expect(director.send({ type: "screen", screen: "map" }).gaze).toEqual(REST);
  });
});

describe("the help offer", () => {
  test("the spec's values: 45 s unused, two Not yets in a row", () => {
    expect(HINT_UNUSED_MS).toBe(45_000);
    expect(NOT_YETS_IN_A_ROW).toBe(2);
  });

  /** A director on the step `b-1:0`, with a hint ready from `readyAt`. */
  function onStep(readyAt = 0, start: DirectorStart = {}) {
    const s = setup({ screen: "step", ...start });
    s.director.send({ type: "step", step: "b-1:0" });
    s.at(readyAt);
    s.director.send({ type: "hint", ready: true });
    return s;
  }

  test("a hint ready and unused for 45 s: Pip turns to the Learner with a soft Explaining", () => {
    const { director, at } = onStep(1000);
    expect(director.nextWakeAt()).toBe(1000 + HINT_UNUSED_MS);
    at(1000 + HINT_UNUSED_MS - 1);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
    at(1000 + HINT_UNUSED_MS);
    const model = director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(true);
    expect(model).toMatchObject({
      reaction: { kind: "explaining", intensity: OFFER_INTENSITY },
      gaze: FORWARD,
    });
    expect(OFFER_INTENSITY).toBeLessThan(1);
  });

  test("the 45 s clock starts when the hint is ready, not when the step opens", () => {
    const { director, at } = setup({ screen: "step" });
    director.send({ type: "step", step: "b-1:0" });
    at(HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
    director.send({ type: "hint", ready: true });
    at(2 * HINT_UNUSED_MS - 1);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
    at(2 * HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(true);
  });

  test("a hint opened before 45 s earns no offer", () => {
    const { director, at } = onStep();
    at(1000);
    director.send({ type: "hint", ready: false });
    at(HINT_UNUSED_MS * 2);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
  });

  test("the second Not yet in a row earns it, after the Retry has played", () => {
    const { director, at, send } = onStep();
    at(1000);
    send(notYet);
    expect(director.helpShowing()).toBe(false);
    at(2000);
    expect(send(notYet).reaction?.kind).toBe("retry");
    expect(director.helpShowing()).toBe(false);
    expect(director.nextWakeAt()).toBe(2000 + RESULT_REACTION_MS);
    at(2000 + RESULT_REACTION_MS);
    expect(director.send({ type: "tick" }).reaction?.kind).toBe("explaining");
    expect(director.helpShowing()).toBe(true);
  });

  test("a broken Check between two Not yets neither counts nor breaks the row", () => {
    const { director, at, send } = onStep();
    at(1000);
    send(notYet);
    at(2000);
    send({ type: "check.broken" });
    at(10_000);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
    at(11_000);
    send(notYet);
    at(11_000 + RESULT_REACTION_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(true);
  });

  test("two Not yets with no hint ready wait for one, then offer it at once", () => {
    const { director, at, send } = setup({ screen: "step" });
    director.send({ type: "step", step: "b-1:0" });
    send(notYet);
    at(1000);
    send(notYet);
    at(10_000);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
    director.send({ type: "hint", ready: true });
    expect(director.helpShowing()).toBe(true);
  });

  test("not while a Check runs: it waits for the result, then for the result's Reaction", () => {
    const { director, at, send } = onStep();
    at(1000);
    send({ type: "check.started" });
    at(HINT_UNUSED_MS + 5000);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
    const result = HINT_UNUSED_MS + 6000;
    at(result);
    expect(send({ type: "check.broken" }).reaction?.kind).toBe("retry");
    expect(director.helpShowing()).toBe(false);
    expect(director.nextWakeAt()).toBe(result + RESULT_REACTION_MS);
    at(result + RESULT_REACTION_MS);
    expect(director.send({ type: "tick" }).reaction).toMatchObject({
      kind: "explaining",
      intensity: OFFER_INTENSITY,
    });
    expect(director.helpShowing()).toBe(true);
  });

  test("45 s running out during a Check never replaces a pass's Success, and the pass ends it", () => {
    const { director, at, send } = onStep();
    at(HINT_UNUSED_MS - 1000);
    send({ type: "check.started" });
    at(HINT_UNUSED_MS + 1000);
    director.send({ type: "tick" });
    at(HINT_UNUSED_MS + 5000);
    const model = send(passed);
    expect(model.reaction).toMatchObject({ kind: "success", intensity: 1 });
    expect(director.helpShowing()).toBe(false);
    at(10 * HINT_UNUSED_MS);
    expect(director.send({ type: "tick" }).reaction?.kind).toBe("success");
    expect(director.helpShowing()).toBe(false);
  });

  test("45 s running out during a Check: the Not yet's Retry plays in full before the offer", () => {
    const { director, at, send } = onStep();
    at(HINT_UNUSED_MS - 1000);
    send({ type: "check.started" });
    at(HINT_UNUSED_MS + 1000);
    director.send({ type: "tick" });
    const result = HINT_UNUSED_MS + 5000;
    at(result);
    const retry = send(notYet).reaction;
    expect(retry?.kind).toBe("retry");
    at(result + RESULT_REACTION_MS - 1);
    expect(director.send({ type: "tick" }).reaction).toEqual(retry);
    expect(director.helpShowing()).toBe(false);
    at(result + RESULT_REACTION_MS);
    expect(director.send({ type: "tick" }).reaction?.kind).toBe("explaining");
    expect(director.helpShowing()).toBe(true);
  });

  test("45 s running out while a Retry plays waits for the Retry", () => {
    const { director, at, send } = onStep();
    const result = HINT_UNUSED_MS - 500;
    at(result);
    send(notYet);
    at(HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
    expect(director.nextWakeAt()).toBe(result + RESULT_REACTION_MS);
    at(result + RESULT_REACTION_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(true);
  });

  test.each<[string, QuestEvent]>([
    ["check.passed", passed],
    ["check.passed again", { type: "check.passed", firstTime: false }],
    ["step.completed", { type: "step.completed" }],
  ])("a step that passed (%s) is not stuck: no offer, ever", (_, pass) => {
    const { director, at, send } = onStep();
    at(5000);
    send({ type: "check.started" });
    at(6000);
    send(pass);
    expect(director.nextWakeAt()).not.toBe(HINT_UNUSED_MS);
    at(HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
    // Not even two Not yets after it: the pass ended stuck help on the step.
    at(HINT_UNUSED_MS + 1000);
    send(notYet);
    at(HINT_UNUSED_MS + 2000);
    send(notYet);
    at(10 * HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
  });

  test("a pass closes an offer that is showing", () => {
    const { director, at, send } = onStep();
    at(HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(true);
    at(HINT_UNUSED_MS + 5000);
    expect(send(passed).reaction?.kind).toBe("success");
    expect(director.helpShowing()).toBe(false);
  });

  test("the result Reaction's wait is only for a Check's result: an answer's Retry does not hold it", () => {
    const { director, at, send } = onStep();
    at(HINT_UNUSED_MS - 500);
    send({ type: "answer.wrong" });
    at(HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(true);
  });

  test("once per step: it never fires again there, dismissed or not", () => {
    const { director, at, send } = onStep();
    at(HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(true);
    director.send({ type: "helpDismissed" });
    expect(director.helpShowing()).toBe(false);
    expect(director.nextWakeAt()).not.toBe(2 * HINT_UNUSED_MS);
    at(HINT_UNUSED_MS + 1000);
    send(notYet);
    at(HINT_UNUSED_MS + 2000);
    send(notYet);
    at(5 * HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
  });

  test("leaving the step and coming back never brings a dismissed offer back", () => {
    const { director, at } = onStep();
    at(HINT_UNUSED_MS);
    director.send({ type: "tick" });
    director.send({ type: "helpDismissed" });
    director.send({ type: "step", step: null });
    director.send({ type: "step", step: "b-1:0" });
    director.send({ type: "hint", ready: true });
    at(3 * HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
  });

  test("each step has its own chance", () => {
    const { director, at } = onStep();
    at(HINT_UNUSED_MS);
    director.send({ type: "tick" });
    director.send({ type: "helpDismissed" });
    director.send({ type: "step", step: "b-1:1" });
    director.send({ type: "hint", ready: true });
    at(2 * HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(true);
  });

  test("a new step starts its own Not yet count", () => {
    const { director, at, send } = onStep();
    at(1000);
    send(notYet);
    director.send({ type: "step", step: "b-1:1" });
    director.send({ type: "hint", ready: true });
    at(2000);
    send(notYet);
    at(10_000);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
  });

  test("opening the hint ends the offer", () => {
    const { director, at } = onStep();
    at(HINT_UNUSED_MS);
    director.send({ type: "tick" });
    director.send({ type: "hint", ready: false });
    expect(director.helpShowing()).toBe(false);
  });

  test("opening a hint rung closes the offer, even with another rung ready", () => {
    const { director, at } = onStep();
    at(HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(true);
    director.send({ type: "hintOpened" });
    director.send({ type: "hint", ready: true });
    expect(director.helpShowing()).toBe(false);
  });

  test("opening a hint rung restarts the 45 s clock from that moment", () => {
    const { director, at } = onStep();
    at(30_000);
    director.send({ type: "hintOpened" });
    // The next rung is ready at once, as at a multi-rung step.
    director.send({ type: "hint", ready: true });
    expect(director.nextWakeAt()).toBe(30_000 + HINT_UNUSED_MS);
    at(30_000 + HINT_UNUSED_MS - 1);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
    at(30_000 + HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(true);
  });

  test("told again that the hint is ready, the 45 s clock keeps running from the first time", () => {
    const { director, at } = onStep();
    at(30_000);
    director.send({ type: "hint", ready: true });
    at(HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(true);
  });

  test("told the same step again, the step keeps its clock and its count", () => {
    const { director, at, send } = onStep();
    at(1000);
    send(notYet);
    at(30_000);
    director.send({ type: "step", step: "b-1:0" });
    at(HINT_UNUSED_MS);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(true);
    // The pure rule, too: the same step returns the same state.
    const h = director.state().help;
    expect(helpStep(h, "b-1:0")).toBe(h);
  });

  test("off the step, Not yets count for nothing", () => {
    const { director, at, send } = setup({ screen: "intro" });
    send(notYet);
    at(1000);
    send(notYet);
    director.send({ type: "step", step: "b-1:0" });
    director.send({ type: "hint", ready: true });
    at(10_000);
    director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(false);
  });

  test("under reduced motion the offer still shows, with no turn", () => {
    const { director, at } = onStep(0, { reducedMotion: true });
    at(HINT_UNUSED_MS);
    const model = director.send({ type: "tick" });
    expect(director.helpShowing()).toBe(true);
    expect(model.gaze).toEqual(REST);
  });

  test.each<[string, DirectorInput, DirectorInput]>([
    [
      "a Panel makes the page inert",
      { type: "pageInert", inert: true },
      { type: "pageInert", inert: false },
    ],
    [
      "the lesson page panel is open",
      { type: "pagePanel", open: true },
      { type: "pagePanel", open: false },
    ],
    [
      "the page is hidden",
      { type: "visibility", hidden: true },
      { type: "visibility", hidden: false },
    ],
    [
      "Pip is off-screen",
      { type: "onScreen", visible: false },
      { type: "onScreen", visible: true },
    ],
  ])(
    "while %s the offer waits, unspent, and shows on return, once",
    (_, away, back) => {
      const { director, at } = onStep();
      at(1000);
      director.send(away);
      at(HINT_UNUSED_MS);
      director.send({ type: "tick" });
      at(3 * HINT_UNUSED_MS);
      director.send({ type: "tick" });
      expect(director.helpShowing()).toBe(false);
      expect(director.state().help.spent).toEqual([]);
      expect(director.nextWakeAt()).not.toBeLessThanOrEqual(3 * HINT_UNUSED_MS);
      at(3 * HINT_UNUSED_MS + 10);
      const model = director.send(back);
      expect(director.helpShowing()).toBe(true);
      // Pip turns to the Learner as it shows, now that he can be seen.
      expect(model.reaction).toMatchObject({
        kind: "explaining",
        intensity: OFFER_INTENSITY,
      });
      director.send({ type: "helpDismissed" });
      director.send(away);
      director.send(back);
      expect(director.helpShowing()).toBe(false);
    },
  );
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
        "progress",
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
