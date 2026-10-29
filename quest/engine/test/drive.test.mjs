// The action driver's own tests (ticket 208): its fixtures are the key
// driver's, it plays every Beginner fixture lesson by actions, and its
// refusal check tells a no-op from a change.
import { test } from "vitest";
import assert from "node:assert/strict";
import * as keys from "../../../practice-template/checks/test/learn-drive.mjs";
import {
  ACTION_TYPES,
  EFFECT_TYPES,
  IDLE_MS,
  bareExit,
  checkResult,
  course,
  DEMO_B2,
  DEMO_I1,
  DEMO_I1_INDEX,
  driver,
  fileResult,
  onReading,
  pending,
  playUntil,
  respond,
  save,
  stateAt,
  struggles,
  where,
  withCode,
} from "./drive.mjs";

test("the fixtures are the key driver's", () => {
  assert.equal(DEMO_B2, keys.DEMO_B2);
  assert.equal(DEMO_I1, keys.DEMO_I1);
  assert.equal(DEMO_I1_INDEX, keys.DEMO_I1_INDEX);
  const lines = ["```bash", "git status", "```"];
  assert.equal(withCode(lines), keys.withCode(lines));
  assert.deepEqual(course, keys.course);
  assert.deepEqual(bareExit, keys.bareExit);
});

const beginner = course.filter((l) => l.level === "beginner");
const allDone = (s) => beginner.every((l) => s.progress[l.id].complete);

test("playUntil finishes every Beginner fixture lesson, and every effect is the engine's", () => {
  for (const todo of [new Set(), struggles()]) {
    const d = driver({ course, saved: null });
    const seen = new Set();
    playUntil(d, allDone, { todo, look: (s) => seen.add(s.lesson) });
    assert.ok(allDone(d.state));
    assert.deepEqual(
      beginner.map((l) => l.id).filter((id) => !seen.has(id)),
      [],
    );
    assert.deepEqual(
      d.effects.filter((e) => !EFFECT_TYPES.includes(e.type)),
      [],
    );
  }
});

test("refused passes on a no-op and fails on a change", () => {
  const d = driver();
  assert.equal(d.state.phase, "overview");
  d.refused("step.continue");
  d.refused("answer.pick", { option: 0 });
  assert.throws(() => d.refused("lesson.start"), /changed the state/);
  assert.equal(d.state.phase, "playing");
  assert.throws(() => d.act("key", { name: "enter" }), /not an action/);
  assert.equal(ACTION_TYPES.length, 24);
});

test("the clock moves only on wait, and tick needs a time", () => {
  const d = driver({
    saved: save({ lessons: { "b-1": { step: "W3", beat: 0 } } }),
  });
  d.open();
  assert.equal(where(d.state).step, "W3");
  const at = d.now;
  d.hint();
  d.hint();
  assert.equal(d.now, at);
  assert.throws(() => d.tick(), /tick takes the time/);
  d.tick(IDLE_MS + 1_000);
  assert.equal(d.now, at + IDLE_MS + 1_000);
  assert.equal(d.state.now, d.now);
});

test("respond answers an effect with its asked and dir, and pending finds it", () => {
  const d = driver({
    saved: save({ lessons: { "b-1": { step: "W3", beat: 0 } } }),
  });
  d.open();
  d.run();
  const eff = pending(d, "check");
  assert.ok(eff.asked > 0);
  assert.equal(checkResult(eff, []).asked, eff.asked);
  assert.equal(checkResult(eff, []).dir, eff.dir);
  respond(d, eff, { pass: false });
  assert.equal(d.state.beat.status, "fail");
  assert.equal(d.state.beat.asked, 0);
});

test("onReading opens DEMO_B2's Your turn step on its file", () => {
  const d = onReading("file .practice/notes.txt");
  assert.deepEqual(where(d.state), {
    lesson: "b-2",
    phase: "playing",
    step: "Y1",
    beat: 0,
    status: "opening",
  });
  respond(d, pending(d, "file"), { text: "a note\n" });
  assert.equal(d.state.beat.status, "already");
  assert.equal(fileResult({ path: "a" }, null).found, null);
});

test("stateAt folds inputs from a saved place", () => {
  const s = stateAt(save(), [{ type: "lesson.start", help: "less" }]);
  assert.equal(s.phase, "playing");
  assert.equal(s.progress["b-1"].lessHelp, true);
});
