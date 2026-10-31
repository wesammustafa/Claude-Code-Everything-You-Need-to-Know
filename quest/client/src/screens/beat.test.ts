import { describe, expect, test } from "vitest";
import type { BeatView } from "@quest/contract";
import { playing } from "../../e2e/snapshots";
import {
  WATCH_FALLBACK,
  checkLines,
  decidedByOf,
  isTearDown,
  primaryAction,
  ranInOf,
  statusOf,
} from "./beat";

const base = playing.beat as BeatView;
const doneWhen = {
  kind: "do" as const,
  text: "Done when `notes.md` exists",
  doneWhen: true,
};

/** A beat: the fixture's, waiting with no result, changed by `over`. */
function beat(over: Partial<BeatView>): BeatView {
  return {
    ...base,
    decidedBy: "learner",
    ranIn: null,
    status: "waiting",
    verification: [],
    fail: null,
    lines: [],
    ...over,
  };
}

describe("decidedByOf", () => {
  test("reads the snapshot's field", () => {
    for (const by of [
      "check",
      "watch",
      "learner",
      "session",
      "answer",
    ] as const)
      expect(decidedByOf(beat({ decidedBy: by }))).toBe(by);
  });
});

describe("primaryAction", () => {
  test.each<[string, Partial<BeatView>, string | null, string | null]>([
    [
      "done",
      { status: "done", decidedBy: "watch" },
      "step.continue",
      "Next step",
    ],
    [
      "already done",
      { status: "already", decidedBy: "check" },
      "step.continue",
      "Next step",
    ],
    ["asking", { kind: "predict", options: [{ text: "a" }] }, null, null],
    ["a checked beat", { decidedBy: "check" }, "check.run", "Check again"],
    [
      "a watched beat before the first look",
      { decidedBy: "watch" },
      "check.run",
      "Check again",
    ],
    [
      "a watched beat that failed",
      { decidedBy: "watch", status: "fail" },
      "check.run",
      "Check again",
    ],
    [
      "the Learner's beat",
      { decidedBy: "learner" },
      "step.markDone",
      "I've done it",
    ],
    [
      "the Learner's beat with its label",
      { decidedBy: "learner", doneLabel: "I've read it" },
      "step.markDone",
      "I've read it",
    ],
    [
      "a session",
      { decidedBy: "session", doneLabel: "The session has ended" },
      "session.ended",
      "The session has ended",
    ],
    [
      "a session with no label",
      { decidedBy: "session" },
      "session.ended",
      "The session has ended",
    ],
    ["an answered question", { decidedBy: "answer", kind: "ask" }, null, null],
    [
      "a watched do beat with a done-label (the field wins over the label)",
      { decidedBy: "watch", doneLabel: "It says nothing to commit" },
      "check.run",
      "Check again",
    ],
    [
      "a checked beat",
      { decidedBy: "check", verification: [{ text: "x", pass: false }] },
      "check.run",
      "Check again",
    ],
  ])("%s", (_name, over, type, label) => {
    const action = primaryAction(beat(over));
    expect(action?.type ?? null).toBe(type);
    expect(action?.label ?? null).toBe(label);
  });

  test("Check again is secondary; every other action is primary", () => {
    expect(primaryAction(beat({ decidedBy: "watch" }))?.variant).toBe(
      "secondary",
    );
    expect(primaryAction(beat({ decidedBy: "learner" }))?.variant).toBe(
      "primary",
    );
    expect(primaryAction(beat({ status: "done" }))?.variant).toBe("primary");
  });
});

describe("statusOf", () => {
  test.each<[string, Partial<BeatView>, string, string]>([
    [
      "timeout",
      { status: "broken", broken: "timeout", same: true },
      "broken",
      "The check took too long this time.",
    ],
    [
      "unreadable output",
      { status: "broken", broken: "output" },
      "broken",
      "The check's answer could not be read this time.",
    ],
    [
      "a crash",
      { status: "broken", broken: "crashed" },
      "broken",
      "The check stopped before it finished.",
    ],
    [
      "the same again",
      { status: "fail", same: true, stale: true },
      "notYet",
      "The check saw the same as last time. The cause may be in an earlier step.",
    ],
    [
      "nothing changed",
      { status: "fail", stale: true },
      "notYet",
      "Nothing has changed there since this step opened.",
    ],
    [
      "a slow item",
      { status: "waiting", slowWait: true },
      "watching",
      "Everything else passes. Check again runs the slow part.",
    ],
    [
      "checking a path",
      { status: "checking", checking: "notes.md" },
      "checking",
      "Checking notes.md…",
    ],
    ["checking", { status: "checking" }, "checking", "Checking…"],
    [
      "checking items",
      { status: "checking", running: { n: 2, m: 5 } },
      "checking",
      "Checking item 2 of 5…",
    ],
    [
      "waiting",
      { status: "waiting" },
      "watching",
      "Watching your Practice copy.",
    ],
    [
      "waiting for a session",
      { status: "waiting", decidedBy: "session" },
      "watching",
      "Waiting for the session to end.",
    ],
    [
      "already done",
      { status: "already" },
      "passed",
      "Already done, so this step counts.",
    ],
    ["done", { status: "done" }, "passed", "That step is done."],
    [
      "not yet",
      { status: "fail" },
      "notYet",
      "Not yet. The lines below say what the check saw.",
    ],
  ])("%s", (_name, over, tone, words) => {
    const said = statusOf(beat(over));
    expect(said.tone).toBe(tone);
    expect(said.words).toBe(words);
  });

  test("the key changes with the variant and the running item, not with anything else", () => {
    const one = statusOf(beat({ status: "checking", running: { n: 1, m: 3 } }));
    const two = statusOf(beat({ status: "checking", running: { n: 2, m: 3 } }));
    expect(one.key).not.toBe(two.key);
    expect(statusOf(beat({ status: "fail", fail: "a" })).key).toBe(
      statusOf(beat({ status: "fail", fail: "b" })).key,
    );
    expect(statusOf(beat({ status: "fail" })).key).not.toBe(
      statusOf(beat({ status: "fail", stale: true })).key,
    );
  });
});

describe("checkLines", () => {
  const items = [
    { text: "one", pass: true },
    { text: "two", pass: false },
    { text: "three", pass: false },
  ];

  test("a checked beat: Not yet under the first item not met", () => {
    expect(
      checkLines(
        beat({
          decidedBy: "check",
          verification: items,
          status: "fail",
          fail: "Not there",
        }),
      ),
    ).toEqual([
      { text: "one", state: "pass" },
      { text: "two", state: "notYet", fail: "Not there" },
      { text: "three", state: "notYet" },
    ]);
  });

  test("a checked beat: waiting while it runs, evidence under the passed group", () => {
    expect(
      checkLines(
        beat({
          decidedBy: "check",
          verification: items,
          status: "checking",
          fail: "x",
        }),
      ).map((line) => line.state),
    ).toEqual(["waiting", "waiting", "waiting"]);
    expect(
      checkLines(
        beat({
          decidedBy: "check",
          verification: [
            { text: "one", pass: true },
            { text: "two", pass: true },
          ],
          status: "done",
          evidence: "seen",
        }),
      ),
    ).toEqual([
      { text: "one", state: "pass" },
      { text: "two", state: "pass", evidence: "seen" },
    ]);
  });

  test("a checked beat that could not run: its unmet items are broken", () => {
    expect(
      checkLines(
        beat({ decidedBy: "check", verification: items, status: "broken" }),
      ).map((line) => line.state),
    ).toEqual(["pass", "broken", "broken"]);
  });

  test("a watched beat: one line from its Done when words, through each state", () => {
    const watched = { lines: [doneWhen], decidedBy: "watch" as const };
    expect(checkLines(beat(watched))).toEqual([
      { text: doneWhen.text, state: "waiting" },
    ]);
    expect(checkLines(beat({ ...watched, status: "checking" }))).toEqual([
      { text: doneWhen.text, state: "waiting" },
    ]);
    expect(
      checkLines(beat({ ...watched, status: "fail", fail: "Not there yet" })),
    ).toEqual([
      { text: doneWhen.text, state: "notYet", fail: "Not there yet" },
    ]);
    expect(
      checkLines(
        beat({
          ...watched,
          status: "done",
          found: "notes.md",
          evidence: "# Notes",
        }),
      ),
    ).toEqual([
      {
        text: doneWhen.text,
        state: "pass",
        found: "notes.md",
        evidence: "# Notes",
      },
    ]);
    expect(checkLines(beat({ ...watched, status: "broken" }))).toEqual([
      { text: doneWhen.text, state: "broken" },
    ]);
  });

  test("a watched beat with no Done when line says what the step asks for", () => {
    expect(checkLines(beat({ decidedBy: "watch" }))[0]?.text).toBe(
      WATCH_FALLBACK,
    );
  });

  test("the Learner's beats, a session and a question show no line", () => {
    for (const by of ["learner", "session", "answer"] as const)
      expect(
        checkLines(
          beat({ decidedBy: by, verification: items, status: "fail" }),
        ),
      ).toEqual([]);
  });
});

describe("ranInOf and isTearDown", () => {
  test("returns the snapshot's ranIn", () => {
    expect(ranInOf(beat({}))).toBeNull();
    expect(ranInOf(beat({ ranIn: "/home/sam/work" }))).toBe("/home/sam/work");
  });

  test("a Tear down step is told by its part", () => {
    expect(isTearDown({ part: "Tear down" })).toBe(true);
    expect(isTearDown({ part: "Check" })).toBe(false);
  });
});
