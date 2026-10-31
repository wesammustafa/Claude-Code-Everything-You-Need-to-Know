import type { QuestEventType } from "@quest/contract";
import { describe, expect, test } from "vitest";
import { PIP_REACTIONS, type PipReactionKind } from "../../pip/contract";
import type { StageClock } from "../pip/stage";
import type { PipModel } from "../../pip/contract";
import { reactionFor } from "../pip/reactions";
import {
  createPlaygroundDriver,
  durationText,
  pipModelFor,
  type LogEntry,
} from "./driver";
import { EVENT_GROUPS, SCENARIOS, type Scenario } from "./scenarios";

/** A clock whose time moves only when the test says, running timers as it passes them. */
function fakeClock() {
  let time = 1000;
  let next = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const clock: StageClock = {
    now: () => time,
    setTimeout(run, ms) {
      next += 1;
      timers.set(next, { at: time + ms, run });
      return next;
    },
    clearTimeout(handle) {
      timers.delete(handle as number);
    },
  };
  const advance = (ms: number) => {
    const end = time + ms;
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, t]) => t.at <= end)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (due === undefined) break;
      timers.delete(due[0]);
      time = Math.max(time, due[1].at);
      due[1].run();
    }
    time = end;
  };
  return { clock, advance };
}

const scenario = (id: string): Scenario => {
  const found = SCENARIOS.find((s) => s.id === id);
  if (found === undefined) throw new Error(`no scenario ${id}`);
  return found;
};

/** Plays a scenario to its end and returns its log, oldest first. */
function played(id: string): Pick<LogEntry, "input" | "outcome" | "result">[] {
  const { clock, advance } = fakeClock();
  const driver = createPlaygroundDriver(clock, { screen: "step" });
  driver.play(scenario(id), {});
  advance(10_000);
  expect(driver.snapshot().playing).toBeNull();
  return driver
    .snapshot()
    .log.toReversed()
    .map(({ input, outcome, result }) => ({ input, outcome, result }));
}

describe("the Playground's scenarios through the director", () => {
  test("a Check: Thinking until its result, then Success", () => {
    expect(played("check")).toEqual([
      { input: "Page load", outcome: "none", result: "No Reaction" },
      {
        input: "check.started",
        outcome: "none",
        result: "No Reaction; mode thinking",
      },
      { input: "check.progress", outcome: "none", result: "No Reaction" },
      { input: "check.progress", outcome: "none", result: "No Reaction" },
      {
        input: "check.passed",
        outcome: "plays",
        result: "Success plays at 1; mode idle",
      },
    ]);
  });

  test("a Retry replaces a Success at once", () => {
    expect(played("retry-during-success").slice(1)).toEqual([
      { input: "check.passed", outcome: "plays", result: "Success plays at 1" },
      { input: "check.notYet", outcome: "plays", result: "Retry plays at 0.5" },
    ]);
  });

  test("a Success waits out a Celebration's first second", () => {
    expect(played("celebration-floor").slice(1)).toEqual([
      {
        input: "lesson.completed",
        outcome: "plays",
        result: "Celebration plays at 0.7",
      },
      {
        input: "answer.right",
        outcome: "waits",
        result: "Success waits for the Celebration's first second",
      },
      {
        input: "Time passes",
        outcome: "plays",
        result: "The waiting Success plays at 1",
      },
    ]);
  });

  test("only the newest waits", () => {
    const log = played("newest-waits").slice(1);
    expect(log.map((e) => e.outcome)).toEqual([
      "plays",
      "waits",
      "waits",
      "plays",
    ]);
    expect(log.at(-1)?.result).toBe("The waiting Explaining plays at 1");
  });

  test("a stronger Celebration replaces one at once, in full", () => {
    expect(played("celebration-replaces").slice(1)).toEqual([
      {
        input: "lesson.completed",
        outcome: "plays",
        result: "Celebration plays at 0.7",
      },
      {
        input: "level.completed",
        outcome: "plays",
        result: "Celebration plays at 0.9",
      },
    ]);
  });

  test("the nod within 3 s, and a full play after the window", () => {
    expect(
      played("nod")
        .slice(1)
        .map((e) => e.result),
    ).toEqual([
      "Success plays at 1",
      "Success as a nod, at 0.2",
      "Success plays at 1",
    ]);
  });

  test("a step that passed before only nods", () => {
    expect(played("passed-again").at(-1)).toEqual({
      input: "check.passed",
      outcome: "nod",
      result: "Success as a nod, at 0.2; mode idle",
    });
  });

  test("the glance throttle, and a glance again after the jump", () => {
    expect(
      played("glance")
        .slice(1)
        .map((e) => e.result),
    ).toEqual([
      "Curious plays at 0.4",
      `No glance: one at most every ${durationText(20_000)}`,
      "No Reaction",
      "Curious plays at 0.4",
    ]);
  });

  test("one revision plays only its highest-ranked Reaction", () => {
    expect(played("one-revision").at(-1)?.result).toBe("Success plays at 1");
  });

  test("a Lesson, its Level and the course together celebrate at 1", () => {
    expect(played("course").at(-1)?.result).toBe("Celebration plays at 1");
  });

  test("Greeting plays once a page load", () => {
    expect(played("greeting")).toEqual([
      { input: "Page load", outcome: "plays", result: "Greeting plays at 1" },
      { input: "Screen: step", outcome: "none", result: "No Reaction" },
      { input: "Screen: welcome", outcome: "none", result: "No Reaction" },
    ]);
  });

  test("a hidden page rests Pip and drops the Reaction", () => {
    expect(played("unseen").slice(1)).toEqual([
      {
        input: "Page hidden",
        outcome: "none",
        result: "No Reaction; mode rest",
      },
      {
        input: "check.notYet",
        outcome: "dropped",
        result: "Retry is dropped: Pip can't be seen",
      },
      {
        input: "Page shown",
        outcome: "none",
        result: "No Reaction; mode idle",
      },
    ]);
  });

  test("5 minutes without input rest Pip; input wakes him", () => {
    expect(played("rest").slice(1)).toEqual([
      {
        input: "The clock jumps 5 min ahead",
        outcome: "none",
        result: "No Reaction; mode rest",
      },
      {
        input: "The Learner types",
        outcome: "none",
        result: "No Reaction; mode idle",
      },
    ]);
  });
});

describe("the Playground's driver", () => {
  test("a new page load on Welcome greets again", () => {
    const { clock } = fakeClock();
    const driver = createPlaygroundDriver(clock, { screen: "welcome" });
    const first = driver.snapshot();
    expect(first.model.reaction?.kind).toBe("greeting");
    driver.reload({ screen: "welcome" });
    const second = driver.snapshot();
    expect(second.load).toBe(first.load + 1);
    expect(second.model.reaction?.kind).toBe("greeting");
  });

  test("a scenario plays until the Reaction waiting on a Celebration has played", () => {
    const { clock, advance } = fakeClock();
    const driver = createPlaygroundDriver(clock, { screen: "step" });
    driver.play(scenario("celebration-floor"), {});
    advance(600);
    expect(driver.snapshot().state.waiting).not.toBeNull();
    expect(driver.snapshot().playing).toBe("celebration-floor");
    advance(500);
    expect(driver.snapshot().state.waiting).toBeNull();
    expect(driver.snapshot().playing).toBeNull();
  });

  test("gaze targets survive a page load and steer Explaining", () => {
    const { clock } = fakeClock();
    const driver = createPlaygroundDriver(clock, { screen: "step" });
    driver.setTargets({ x: 0.5, y: -0.25 });
    driver.reload({ screen: "step" });
    driver.events([{ type: "hint.shown", rung: 1 }]);
    expect(driver.snapshot().model.gaze).toEqual({ x: 0.5, y: -0.25 });
  });

  test("a new scenario stops the one playing", () => {
    const { clock, advance } = fakeClock();
    const driver = createPlaygroundDriver(clock, { screen: "step" });
    driver.play(scenario("nod"), {});
    driver.play(scenario("course"), {});
    advance(10_000);
    expect(driver.snapshot().log.map((e) => e.input)).toEqual([
      "lesson.completed + level.completed + course.completed",
      "Page load",
    ]);
  });

  test("dispose stops every timer, and the scenario reads as stopped", () => {
    const { clock, advance } = fakeClock();
    const driver = createPlaygroundDriver(clock, { screen: "step" });
    driver.play(scenario("check"), {});
    driver.dispose();
    expect(driver.snapshot().playing).toBeNull();
    advance(10_000);
    expect(driver.snapshot().log).toHaveLength(1);
  });

  test("each Pip, mount and page load draws a Reaction under an ID of its own", () => {
    const model: PipModel = {
      mode: "idle",
      reaction: { id: "greeting", kind: "greeting", intensity: 1 },
      gaze: null,
      restingGaze: { x: 0, y: 0 },
      reducedMotion: false,
      size: "hero",
    };
    const ids = [
      ["live", "1.1"],
      ["poster", "1.1"],
      ["live", "1.2"],
      ["live", "2.1"],
    ].map(
      ([pip = "", scope = ""]) => pipModelFor(model, pip, scope).reaction?.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    const still = { ...model, reaction: null };
    expect(pipModelFor(still, "live", "1.1")).toBe(still);
  });
});

describe("the Playground's event buttons", () => {
  test("cover every engine event and every Reaction an event earns", () => {
    const types = new Set<QuestEventType>(
      EVENT_GROUPS.flatMap((g) => g.choices.map((c) => c.event.type)),
    );
    const all: Record<QuestEventType, true> = {
      "check.started": true,
      "check.progress": true,
      "check.passed": true,
      "check.notYet": true,
      "check.broken": true,
      "check.ended": true,
      "answer.right": true,
      "answer.wrong": true,
      "hint.shown": true,
      "warmup.recalled": true,
      "warmup.missed": true,
      "step.completed": true,
      "stepDown.reached": true,
      "lesson.completed": true,
      "level.completed": true,
      "course.completed": true,
      "work.changed": true,
      "help.offered": true,
      notice: true,
    };
    expect([...types].sort()).toEqual(Object.keys(all).sort());
    // Each group's events earn the group's Reaction (Greeting comes from the
    // browser, through the Greeting scenario).
    const earned = new Set<PipReactionKind>();
    for (const group of EVENT_GROUPS) {
      for (const choice of group.choices) {
        const reaction = reactionFor(
          [{ id: choice.id, revision: 0, serverTime: 0, ...choice.event }],
          { glanceReady: true },
        );
        const kind = group.kind === "thinking" ? null : group.kind;
        expect(reaction?.kind ?? null, choice.id).toBe(kind);
        if (reaction !== null) earned.add(reaction.kind);
      }
    }
    expect([...earned].sort()).toEqual(
      PIP_REACTIONS.filter((k) => k !== "greeting").sort(),
    );
    const ids = EVENT_GROUPS.flatMap((g) => g.choices.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
