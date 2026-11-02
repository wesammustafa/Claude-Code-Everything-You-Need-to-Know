// What decides a beat, and where its last result ran (ticket 285): the
// snapshot's decidedBy names the one place that takes the beat, and the
// markDone and session.ended guards accept exactly the beats it names.
// ranIn is the Work folder the beat's last result ran in.
import { test } from "vitest";
import assert from "node:assert/strict";
import { decidedBy } from "../src/content.ts";
import { project } from "../src/index.ts";
import {
  beatOf,
  checkResult,
  course,
  courseWith,
  DEMO_B2,
  DEMO_I1,
  driver,
  finished,
  finishedBefore,
  NEW_COPY,
  NEW_PROJECT,
  onReading,
  playUntil,
  PROJECT,
  save,
  stepOf,
  threeLevels,
  watching,
  where,
  keyOf,
} from "./drive.mjs";

const view = (d) => project(d.state).lesson.beat;
const Y1 =
  "- beat: do\n- verify: check 0 fresh\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt";
// DEMO_B2's Your turn step as another beat, with the learner on it.
const onY1 = (beat) => {
  const d = driver({
    course: courseWith({ "b-2": DEMO_B2.replace(Y1, beat) }),
    saved: save({
      lessons: {
        "b-1": finished(course.find((l) => l.id === "b-1")),
        "b-2": {
          warm: ["R1", "R2", "R3"],
          done: ["R1", "R2", "R3", "W1"],
          step: "Y1",
          beat: 0,
        },
      },
    }),
  });
  d.open("b-2");
  assert.equal(stepOf(d.state).id, "Y1");
  return d;
};
const ASK =
  '- ask: Which file did it save?\n- right: "the list"\n- wrong: "the log"\n- because: "It saves the list."';

// [name, open a fresh driver on the beat, what decides it]
const ROWS = [
  ["check all", () => onReading("check all"), "check"],
  ["check 1", () => onReading("check 1"), "check"],
  ["file", () => onReading("file .practice/notes.txt"), "watch"],
  ["json", () => onReading("json .practice/a.json name=x"), "watch"],
  ["match", () => onReading("match .practice/a.txt ^x"), "watch"],
  ["no-match", () => onReading("no-match .practice/a.txt TODO"), "watch"],
  ["git-changed", () => onReading("git-changed src/"), "watch"],
  ["git-only", () => onReading("git-only src/"), "watch"],
  ["git-staged", () => onReading("git-staged"), "watch"],
  ["head-moved", () => onReading("head-moved"), "watch"],
  ["git-unchanged", () => onReading("git-unchanged"), "watch"],
  ["probe", () => onReading("probe worktrees 2"), "watch"],
  [
    "fresh file",
    () =>
      onReading(
        "file .practice/b-2-before.txt fresh\n- evidence: .practice/b-2-before.txt",
      ),
    "watch",
  ],
  ["git-clean", () => onReading("git-clean"), "watch"],
  [
    "git-clean with a done-label",
    () => onReading("git-clean\n- done-label: It ended"),
    "session",
  ],
  ["none", () => onReading("none"), "learner"],
  [
    "none with a done-label",
    () => onReading("none\n- done-label: Done"),
    "learner",
  ],
  ["self", () => onY1('- beat: self\n- self: "Saved it."'), "learner"],
  ["ask", () => onY1(`- beat: ask\n${ASK}`), "answer"],
];

// Whether an action took: it changed the state or asked for effects.
const takes = (d, type) => {
  const r = d.act(type);
  return r.changed || r.effects.length > 0;
};

test("each beat projects the one place that decides it", () => {
  for (const [name, open, want] of ROWS) {
    const d = open();
    assert.equal(view(d).decidedBy, want, name);
    assert.equal(decidedBy(beatOf(d.state)), want, name);
  }
});

test("a do beat can't take verify: answer (305)", () => {
  assert.throws(
    () => onY1(`- beat: do\n- verify: answer\n${ASK}`),
    /verify: answer is only for an ask beat/,
  );
  // Without a verify line it is a learner beat whose question waits for its
  // answer before markDone takes (spec-gaps covers that).
  assert.equal(decidedBy(beatOf(onY1(`- beat: do\n${ASK}`).state)), "learner");
});

test("step.markDone takes only a learner beat, session.ended only a session beat", () => {
  for (const [name, open, want] of ROWS) {
    assert.equal(takes(open(), "step.markDone"), want === "learner", name);
    const d = open();
    d.act("session.ended");
    assert.equal(
      d.last.effects.some((e) => e.type === "git"),
      want === "session",
      name,
    );
  }
  // An answer beat: its own answer decides it, never markDone.
  const d = onY1(`- beat: do\n${ASK}`);
  d.refused("step.markDone");
  d.pick(beatOf(d.state).options.findIndex((o) => o.kind === "right"));
  assert.equal(d.state.beat.status, "done");
  d.refused("step.markDone");
});

test("every beat of the course: the guards agree with decidedBy, and every kind is reached", () => {
  const seen = new Set();
  for (const l of course) {
    if (!l.content) continue;
    for (const step of l.content.steps)
      step.beats.forEach((_, beat) => {
        const at = () => {
          const d = driver({
            saved: save({
              lessons: {
                ...finishedBefore(l.id),
                [l.id]: { step: step.id, beat },
              },
            }),
            course,
          });
          d.open(l.id);
          const w = where(d.state);
          const ok =
            d.state.phase === "playing" &&
            d.state.beat &&
            w.step === step.id &&
            w.beat === beat &&
            w.status !== "done" &&
            !d.state.beat.confirm &&
            // A question still open refuses markDone on any beat: an
            // answer beat keeps its row, a learner beat that asks first
            // waits for its answer (spec-gaps covers it).
            !(beatOf(d.state).ask && decidedBy(beatOf(d.state)) !== "answer");
          return ok ? d : null;
        };
        const d = at();
        if (!d) return;
        const want = decidedBy(beatOf(d.state));
        const name = `${l.id} ${step.id}.${beat}`;
        assert.equal(view(d).decidedBy, want, name);
        seen.add(want);
        assert.equal(takes(at(), "step.markDone"), want === "learner", name);
        const open = at();
        open.act("session.ended");
        assert.equal(
          open.last.effects.some((e) => e.type === "git"),
          want === "session",
          name,
        );
      });
  }
  assert.deepEqual([...seen].sort(), [
    "answer",
    "check",
    "learner",
    "session",
    "watch",
  ]);
});

const lastOf = (effects, type) => effects.filter((e) => e.type === type).at(-1);

test("ranIn: null in the Practice copy and before a run", () => {
  const d = driver();
  playUntil(d, (s) => Boolean(s.beat) && beatOf(s).verify.kind === "check");
  assert.equal(view(d).ranIn, null);
  const eff = lastOf(d.effects, "check");
  assert.equal(eff.dir, PROJECT);
  d.send(checkResult(eff, []));
  assert.equal(d.state.beat.ranIn, PROJECT, "recorded");
  assert.equal(view(d).ranIn, null, "but the copy is no Work folder");
});

test("ranIn: the saved Work folder a result ran in, per beat", () => {
  const MINE = "/home/sam/code/my-app";
  const lessons = threeLevels({ "i-1": DEMO_I1 });
  const d = driver({
    course: lessons,
    saved: save({
      lessons: finishedBefore("i-1", lessons),
      folders: { intermediate: MINE },
    }),
  });
  playUntil(d, (s) => where(s).step === "W1");
  assert.equal(watching(d.state).dir, MINE);
  assert.equal(view(d).ranIn, null, "before any result");
  const eff = lastOf(d.effects, "check");
  d.send(checkResult({ ...eff, dir: "/home/sam/elsewhere" }, []));
  assert.equal(view(d).ranIn, null, "a stale result leaves it");
  d.send(checkResult(eff, []));
  assert.equal(view(d).ranIn, MINE);
  d.send(checkResult({ ...eff, dir: "/home/sam/elsewhere" }, []));
  assert.equal(view(d).ranIn, MINE, "a stale one changes nothing");
  const at = where(d.state);
  d.open("i-1");
  assert.deepEqual(where(d.state), at, "reopened at the same beat");
  assert.equal(view(d).ranIn, null, "a reopen resets it");
  d.send(checkResult(lastOf(d.effects, "check"), []));
  assert.equal(view(d).ranIn, MINE);
  d.act("check.run", { beat: keyOf(d.state) });
  const late = lastOf(d.effects, "check");
  assert.ok(late.asked, "r numbers its run");
  d.send(checkResult(late, []));
  playUntil(
    d,
    (s) =>
      Boolean(s.beat) &&
      (where(s).step !== at.step || where(s).beat !== at.beat),
  );
  assert.equal(view(d).ranIn, null, "the next beat opens with none");
  d.send(checkResult(late, []));
  assert.equal(view(d).ranIn, null, "a late result of the last beat's r");
});

test("ranIn: a new copy is a Work folder", () => {
  const lessons = threeLevels();
  const d = driver({
    course: lessons,
    saved: save({
      lessons: finishedBefore("a-5", lessons),
      folders: { "a-5": NEW_COPY },
    }),
  });
  d.open("a-5");
  playUntil(
    d,
    (s) =>
      Boolean(s.beat) &&
      beatOf(s).verify.kind === "check" &&
      watching(s)?.dir === NEW_PROJECT,
  );
  d.send(checkResult(lastOf(d.effects, "check"), []));
  assert.equal(view(d).ranIn, NEW_PROJECT);
});
