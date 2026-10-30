// Saved progress (ticket 213): the fingerprint each lesson was started
// under, which starts an unfinished lesson again where its steps changed;
// the help each finished step used; and each skill's Mastery from it.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  course,
  driver,
  finished,
  finishedBefore,
  IDLE_MS,
  playUntil,
  rungsOf,
  save,
  snapshot as toSave,
  stepOf,
} from "./drive.mjs";
import { fingerprint } from "../src/content.ts";
import { HELP_USED } from "../src/index.mjs";
import { project } from "../src/project.ts";

const OLD = "0".repeat(64);
const lesson = (id) => course.find((l) => l.id === id);
const printOf = (id) => fingerprint(lesson(id).content);
// The course as the course file gives it: each lesson with its fingerprint,
// and a legacy one, `legacy` where given, else one no step matches, so a
// save with no fingerprint is from other steps.
const printed = (legacy = {}) =>
  course.map((l) =>
    l.content
      ? {
          ...l,
          fingerprint: fingerprint(l.content),
          legacyFingerprint: legacy[l.id] ?? OLD,
        }
      : l,
  );
const notes = (d) => project(d.state).lesson.notes;
const learner = (d) => project(d.state).learner;
const summaryOf = (d, id) =>
  project(d.state)
    .course.levels.flatMap((x) => x.lessons)
    .find((x) => x.id === id);

// ---- fingerprints ------------------------------------------------------------
test("a lesson saved mid-play with no fingerprint, under other steps, starts again at its overview with a note, and the app opens there", () => {
  const d = driver({
    course: printed({ "b-1": printOf("b-1") }),
    saved: save({
      lessons: {
        "b-1": { step: "Y3", beat: 0, done: ["W1"] },
        "b-2": { step: "W2", beat: 1, done: ["R1", "W1"], warm: ["R1"] },
      },
    }),
  });
  // b-1's steps are the Terminal app's, so it resumes; b-2's changed.
  assert.equal(d.state.progress["b-1"].step, "Y3");
  assert.deepEqual(
    [d.state.lesson, d.state.phase, d.state.changed],
    ["b-2", "overview", ["b-2"]],
  );
  const p = d.state.progress["b-2"];
  assert.deepEqual(
    [p.step, p.beat, p.done, p.warm, p.complete],
    [null, 0, [], [], false],
  );
  assert.deepEqual(notes(d)[0], { kind: "changed" });
  // Another lesson's overview has no note.
  d.open("b-1");
  d.open("b-3");
  assert.equal(
    notes(d).some((n) => n.kind === "changed"),
    false,
  );
});

test("a save with no fingerprint resumes where the course file's legacy fingerprint is the steps' own", () => {
  const d = driver({
    course: printed({ "b-1": printOf("b-1") }),
    saved: save({ lessons: { "b-1": { step: "Y3", beat: 0, done: ["W1"] } } }),
  });
  assert.deepEqual(d.state.changed, []);
  d.open("b-1");
  assert.equal(stepOf(d.state).id, "Y3");
});

test("a saved fingerprint that is the steps' own resumes, whatever the legacy one", () => {
  const d = driver({
    course: printed(),
    saved: save({
      lessons: {
        "b-1": {
          step: "Y3",
          beat: 0,
          done: ["W1"],
          fingerprint: printOf("b-1"),
        },
      },
    }),
  });
  assert.deepEqual(d.state.changed, []);
  d.open("b-1");
  assert.equal(stepOf(d.state).id, "Y3");
  // A saved fingerprint of other steps starts it again, even where the
  // legacy one matches.
  const other = driver({
    course: printed({ "b-1": printOf("b-1") }),
    saved: save({
      lessons: { "b-1": { step: "Y3", fingerprint: "1".repeat(64) } },
    }),
  });
  assert.deepEqual(other.state.changed, ["b-1"]);
});

test("a finished lesson whose steps changed keeps its Badge, the ticks of the steps it still has, its help and the work folders; with only its ticks it says nothing", () => {
  const help = { W1: { used: "commands", at: 5 } };
  const done = finished(lesson("b-1")).done;
  const saved = save({
    lessons: {
      "b-1": { ...finished(lesson("b-1")), done: [...done, "Y99"], help },
    },
    folders: { intermediate: "/home/sam/mine" },
  });
  const d = driver({ course: printed(), saved });
  const p = d.state.progress["b-1"];
  assert.deepEqual([p.complete, p.done, p.help], [true, done, help]);
  // The card, and the help that fades after the lesson, are as under its
  // own steps.
  const same = driver({
    course: printed({ "b-1": printOf("b-1") }),
    saved,
  });
  assert.ok(learner(d).card.length > 0);
  assert.deepEqual(learner(d).card, learner(same).card);
  d.open("b-2");
  same.open("b-2");
  assert.deepEqual(
    project(d.state).lesson.steps,
    project(same.state).lesson.steps,
  );
  assert.deepEqual(d.state.changed, []);
  assert.equal(summaryOf(d, "b-1").complete, true);
  assert.equal(summaryOf(d, "b-1").badge, lesson("b-1").content.badge);
  assert.deepEqual(learner(d).workFolders, [
    { key: "intermediate", path: "/home/sam/mine" },
  ]);
  assert.deepEqual(learner(d).mastery, { install: help.W1 });
  // The app opens at the next lesson, as for any finished one.
  assert.equal(d.state.lesson, "b-2");
});

test("a finished lesson saved in a replay, under other steps, keeps its Badge and gets the note; it is not where the app opens", () => {
  const d = driver({
    course: printed(),
    saved: save({
      lessons: {
        "b-1": { ...finished(lesson("b-1")), step: "Y2", beat: 0 },
      },
    }),
  });
  assert.deepEqual(d.state.changed, ["b-1"]);
  assert.equal(d.state.progress["b-1"].complete, true);
  assert.equal(d.state.progress["b-1"].step, null);
  assert.equal(d.state.lesson, "b-2");
  d.open("b-1");
  assert.deepEqual(notes(d)[0], { kind: "changed" });
});

test("a lesson never started gets no note, whatever its fingerprint", () => {
  const d = driver({
    course: printed(),
    saved: save({
      lessons: {
        "b-1": { step: null, done: [], fingerprint: "1".repeat(64) },
        "b-2": { lessHelp: true },
      },
    }),
  });
  assert.deepEqual(d.state.changed, []);
  assert.equal(d.state.progress["b-1"].fingerprint, "1".repeat(64));
});

test("lesson.start saves the fingerprint the lesson is played under and clears the note; a resume writes none", () => {
  const d = driver({
    course: printed(),
    saved: save({ lessons: { "b-1": { step: "Y3", beat: 0, done: ["W1"] } } }),
  });
  assert.deepEqual(d.state.changed, ["b-1"]);
  d.start();
  assert.deepEqual(d.state.changed, []);
  assert.equal(d.state.progress["b-1"].fingerprint, printOf("b-1"));
  assert.equal(toSave(d.state).lessons["b-1"].fingerprint, printOf("b-1"));
  // Saved and loaded again: it resumes.
  d.cont();
  const again = driver({ course: printed(), saved: toSave(d.state) });
  assert.deepEqual(again.state.changed, []);
  assert.equal(again.state.progress["b-1"].step, d.state.progress["b-1"].step);
  again.open("b-1");
  assert.equal(again.state.progress["b-1"].fingerprint, printOf("b-1"));
  // A resume of a save with none writes none.
  const old = driver({
    course: printed({ "b-1": printOf("b-1") }),
    saved: save({ lessons: { "b-1": { step: "Y3", beat: 0 } } }),
  });
  old.open("b-1");
  assert.equal(old.state.progress["b-1"].fingerprint, undefined);
});

test("lesson.restart keeps the Badge and the help, drops the fingerprint and clears the note", () => {
  const help = { W1: { used: "own", at: 3 } };
  const d = driver({
    course: printed(),
    saved: save({
      lessons: {
        "b-1": {
          ...finished(lesson("b-1")),
          step: "Y2",
          help,
          fingerprint: "1".repeat(64),
        },
      },
    }),
  });
  d.restart("b-1");
  const p = d.state.progress["b-1"];
  assert.deepEqual(
    [p.complete, p.help, "fingerprint" in p, d.state.changed],
    [true, help, false, []],
  );
});

// ---- the help each finished step used ------------------------------------------
// b-1 of the fixture course: W1-W7 Guided, Y1-Y3 Hinted, Y4 and C Challenge.
const before = (id) => {
  const ids = lesson("b-1").content.steps.map((x) => x.id);
  return ids.slice(0, ids.indexOf(id));
};
function atStep(id, extra = {}, lessons = course) {
  const d = driver({
    course: lessons,
    saved: save({
      lessons: { "b-1": { step: id, beat: 0, done: before(id), ...extra } },
    }),
  });
  d.send({ type: "tick", epoch: 1_000 });
  d.open("b-1");
  return d;
}
const finishStep = (d, id) =>
  playUntil(d, (s) => s.progress["b-1"].help?.[id] !== undefined);
const helpOf = (d, id) => d.state.progress["b-1"].help[id];
// A Challenge step's hints open after an idle wait.
const unlock = (d) => d.tick(IDLE_MS);

test("a Challenge step finished with no hint saves own, with the input's wall clock", () => {
  const d = atStep("Y4");
  finishStep(d, "Y4");
  assert.deepEqual(helpOf(d, "Y4"), { used: "own", at: 1_000 });
  assert.deepEqual(learner(d).mastery.ask, { used: "own", at: 1_000 });
});

test("a hint opened saves hints; the exact command taken saves commands; a confirm alone adds nothing", () => {
  const d = atStep("Y4");
  unlock(d);
  d.hint();
  assert.equal(d.state.beat.rung, 0);
  finishStep(d, "Y4");
  assert.equal(helpOf(d, "Y4").used, "hints");

  const e = atStep("Y4");
  unlock(e);
  e.hint();
  e.hint();
  assert.equal(e.state.beat.confirm, true);
  e.exact(true);
  finishStep(e, "Y4");
  assert.equal(helpOf(e, "Y4").used, "commands");

  // Y4 with no hints of its own: its one rung is the exact command, so
  // the first hint asks the y/n, and a no opens nothing.
  const bare = course.map((l) =>
    l.id === "b-1"
      ? {
          ...l,
          content: {
            ...l.content,
            steps: l.content.steps.map((x) =>
              x.id === "Y4"
                ? { ...x, beats: x.beats.map((bt) => ({ ...bt, hints: [] })) }
                : x,
            ),
          },
        }
      : l,
  );
  const c = atStep("Y4", {}, bare);
  unlock(c);
  assert.deepEqual(
    rungsOf(c.state).map((r) => r.kind),
    ["bottom"],
  );
  c.hint();
  assert.equal(c.state.beat.confirm, true);
  c.exact(false);
  assert.equal(c.state.beat.rung, -1);
  finishStep(c, "Y4");
  assert.equal(helpOf(c, "Y4").used, "own");
});

test("a Guided step saves commands, a Hinted one hints, and a step resumed after its exact command was taken saves commands", () => {
  const d = atStep("W1");
  finishStep(d, "W1");
  assert.equal(helpOf(d, "W1").used, "commands");
  const y = atStep("Y2");
  finishStep(y, "Y2");
  assert.equal(helpOf(y, "Y2").used, "hints");
  const b = atStep("Y4", { bottomAt: "Y4" });
  finishStep(b, "Y4");
  assert.equal(helpOf(b, "Y4").used, "commands");
});

test("a step's help holds through back and other steps in one play, a replay saves over the last; across lessons the latest time is a skill's Mastery", () => {
  // A hint opened on Y4, back to Y3 and on again: Y4 still used hints.
  const d = atStep("Y4");
  unlock(d);
  d.hint();
  d.back();
  assert.equal(stepOf(d.state).id, "Y3");
  finishStep(d, "Y4");
  assert.deepEqual(helpOf(d, "Y4"), { used: "hints", at: 1_000 });
  // Back from C to Y4 and its last beat again: Y4 keeps its hints.
  playUntil(d, (s) => s.beat && stepOf(s).id === "C");
  d.send({ type: "tick", epoch: 2_000 });
  playUntil(d, (s) => s.beat && stepOf(s).id === "Y4", {
    todo: new Set(["step.back"]),
  });
  playUntil(d, (s) => s.progress["b-1"].help.Y4.at === 2_000);
  assert.deepEqual(helpOf(d, "Y4"), { used: "hints", at: 2_000 });
  // A replay starts its help again: Y4 on its own saves own.
  playUntil(d, (s) => s.phase === "complete");
  d.restart("b-1");
  d.start();
  d.send({ type: "tick", epoch: 3_000 });
  playUntil(d, (s) => s.progress["b-1"].help.Y4.at === 3_000);
  assert.deepEqual(helpOf(d, "Y4"), { used: "own", at: 3_000 });

  // `start` in b-1 Y2 and b-2 W1: the later time wins, and on a tie the
  // later step in course order. A step the lesson no longer has counts
  // for nothing.
  const mastery = (b1, b2) =>
    learner(
      driver({
        course,
        saved: save({
          lessons: {
            "b-1": { ...finished(lesson("b-1")), help: { Y2: b1 } },
            "b-2": { help: { W1: b2, W99: { used: "own", at: 9 } } },
          },
        }),
      }),
    ).mastery;
  const own = (at) => ({ used: "own", at });
  const all = (at) => ({ used: "commands", at });
  assert.deepEqual(mastery(own(10), all(5)), { start: own(10) });
  assert.deepEqual(mastery(own(5), all(10)), { start: all(10) });
  assert.deepEqual(mastery(own(5), all(5)), { start: all(5) });
});

test("a warm-up and a skipped step save no help", () => {
  const d = driver({
    course,
    saved: save({
      lessons: {
        ...finishedBefore("b-2"),
        "b-2": { step: "R1", beat: 0, warm: ["R1"] },
      },
    }),
  });
  d.open("b-2");
  playUntil(d, (s) => s.beat && stepOf(s).id === "W1");
  assert.equal(d.state.progress["b-2"].help, undefined);

  const optional = course.map((l) =>
    l.id === "b-1"
      ? {
          ...l,
          content: {
            ...l.content,
            steps: l.content.steps.map((x) =>
              x.id === "W2" ? { ...x, optional: "Skip it." } : x,
            ),
          },
        }
      : l,
  );
  const o = driver({
    course: optional,
    saved: save({ lessons: { "b-1": { step: "W2", beat: 0, done: ["W1"] } } }),
  });
  o.open("b-1");
  o.skip();
  assert.equal(stepOf(o.state).id, "W3");
  assert.equal(o.state.progress["b-1"].help, undefined);
});

test("a save from before shows completion at once and no Mastery; a finished step shows its own skill's", () => {
  const d = driver({
    course,
    saved: save({ lessons: finishedBefore("b-3") }),
  });
  assert.equal(summaryOf(d, "b-1").complete, true);
  assert.equal(summaryOf(d, "b-2").complete, true);
  assert.deepEqual(learner(d).mastery, {});
  d.send({ type: "tick", epoch: 7 });
  d.open("b-3");
  playUntil(d, (s) => s.progress["b-3"].help !== undefined);
  assert.deepEqual(Object.keys(learner(d).mastery), [
    lesson("b-3").content.steps.find(
      (x) => x.id in d.state.progress["b-3"].help,
    ).skill,
  ]);
  assert.ok(HELP_USED.includes(Object.values(learner(d).mastery)[0].used));
});

test("Lesson complete fills each skill practised with its Mastery", () => {
  const d = atStep("Y4");
  playUntil(d, (s) => s.phase === "complete");
  const v = project(d.state).lesson;
  const ask = v.practised.find((x) => x.skill === "ask");
  assert.deepEqual(ask.mastery, { used: "own", at: 1_000 });
  // Skills finished before help was saved have none.
  assert.equal(v.practised.find((x) => x.skill === "install").mastery, null);
});

test("learner.saving follows root .practice/, and its coming saves the place", () => {
  const d = driver({ course, facts: { practiceDir: false } });
  assert.equal(learner(d).saving, false);
  const effects = d.send({ type: "facts", facts: { practiceDir: true } });
  assert.deepEqual(effects, [{ type: "save" }]);
  assert.equal(learner(d).saving, true);
  assert.deepEqual(d.send({ type: "facts", facts: { practiceDir: true } }), []);
  assert.deepEqual(
    d.send({ type: "facts", facts: { practiceDir: false } }),
    [],
  );
  assert.equal(learner(d).saving, false);
  // A save left in place unread is never written over.
  const kept = driver({
    course,
    facts: { practiceDir: true, saveKept: true },
  });
  assert.equal(learner(kept).saving, false);
});
