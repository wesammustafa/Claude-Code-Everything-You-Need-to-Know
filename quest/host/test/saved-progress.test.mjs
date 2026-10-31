// Saved progress in the host (ticket 213): a save the store could not read
// is a notice that stays pending until a tab shows it, and each input
// carries the wall clock a finished step's help is saved with.
import { test } from "vitest";
import assert from "node:assert/strict";
import { fakeClock } from "../src/fake.ts";
import { course } from "../../engine/test/drive.mjs";
import { fakeHost } from "./scripted.mjs";

const b1 = course.find((l) => l.id === "b-1");
// b-1 saved at its last beat, a self beat: one step.markDone finishes it.
const AT_END = {
  format: 1,
  welcomed: true,
  lessons: {
    "b-1": {
      step: "C",
      beat: 2,
      done: b1.content.steps.map((x) => x.id).filter((id) => id !== "C"),
    },
  },
};
const notices = (snap) =>
  snap.milestones.filter((m) => m.type === "notice").map((m) => m.kind);

for (const [unreadable, kind] of [
  ["moved", "unreadable"],
  ["kept", "unreadable-kept"],
]) {
  test(`a save the store ${unreadable === "moved" ? "moved aside" : "could not move"} is a notice in the first snapshot, kept past a lesson's start until a tab shows it`, async () => {
    const { host, adapters } = fakeHost({
      instance: "i1",
      saved: { unreadable },
    });
    const first = await host.open();
    assert.equal(first.revision, 2);
    assert.deepEqual(notices(first), [kind]);
    // A save left in place is never written over: the snapshot says so.
    assert.equal(first.learner.saving, unreadable === "moved");
    assert.equal(first.learner.welcomed, false, "the app starts fresh");
    host.dispatch({ type: "welcome.finish" });
    host.dispatch({ type: "lesson.start", help: "planned" });
    const playing = host.snapshot();
    assert.equal(playing.lesson.phase, "playing");
    assert.deepEqual(notices(playing), [kind]);
    const [id] = playing.milestones.map((m) => m.id);
    host.dispatch({ type: "milestone.shown", id });
    assert.deepEqual(host.snapshot().milestones, []);
    // The marker is never saved: what is saved is the fresh place. A save
    // left in place gets no save at all, whatever the store would do.
    assert.ok(adapters.store.saves.every((s) => !("unreadable" in s)));
    if (unreadable === "kept") assert.deepEqual(adapters.store.saves, []);
    else assert.ok(adapters.store.saves.length > 0);
  });
}

test("a readable save, or none, opens with no notice at revision 1", async () => {
  for (const saved of [null, AT_END]) {
    const { host } = fakeHost({ instance: "i1", saved });
    const first = await host.open();
    assert.equal(first.revision, 1);
    assert.deepEqual(first.milestones, []);
  }
});

test("each input carries the host's wall clock: a finished step's Mastery is saved at it", async () => {
  const { host, adapters, clock } = fakeHost({
    instance: "i1",
    course,
    saved: AT_END,
    clock: fakeClock(1_000_000, 1e12),
  });
  await host.open();
  assert.deepEqual(host.snapshot().learner.mastery, {});
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  host.dispatch({ type: "step.markDone" });
  const mastery = host.snapshot().learner.mastery;
  const skill = b1.content.steps.find((x) => x.id === "C").skill;
  assert.deepEqual(Object.keys(mastery), [skill]);
  assert.ok(mastery[skill].at >= 1e12);
  assert.equal(mastery[skill].at, clock.epoch());
  assert.deepEqual(
    adapters.store.saves.at(-1).lessons["b-1"].help.C,
    mastery[skill],
  );
});
