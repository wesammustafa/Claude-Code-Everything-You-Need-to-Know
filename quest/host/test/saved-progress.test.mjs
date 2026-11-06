// Saved progress in the host (ticket 213): a save the store could not read
// is a notice that stays pending until a tab shows it, and each input
// carries the wall clock a finished step's help is saved with.
import { test } from "vitest";
import assert from "node:assert/strict";
import { fakeClock } from "../src/fake.ts";
import { course } from "../../engine/test/drive.mjs";
import { fakeHost } from "./scripted.mjs";

// POSIX only: these need symlinks, file modes, POSIX paths, signals or a bash
// script that native Windows lacks, so they are skipped there.
const posix = test.skipIf(process.platform === "win32");

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
  posix(
    `a save the store ${unreadable === "moved" ? "moved aside" : "could not move"} is a notice in the first snapshot, kept past a lesson's start until a tab shows it`,
    async () => {
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
    },
  );
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

// Rehoming row 174: reading Your card is reading the snapshot, which writes
// nothing; only a finished step's save carries the tick its entry reads.
test("reading Your card writes no save; a finished step's save carries its done tick (rehoming row 174)", async () => {
  const { host, adapters } = fakeHost({
    instance: "i1",
    course,
    saved: AT_END,
  });
  await host.open();
  const saves = adapters.store.saves;
  const before = saves.length;
  const reads = [1, 2, 3].map(() => host.snapshot().learner.card);
  assert.deepEqual(reads[1], reads[0]);
  assert.deepEqual(reads[2], reads[0]);
  assert.equal(saves.length, before);
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  // Opening the lesson may write a place save; it carries no new tick.
  const opened = saves.length;
  for (const save of saves.slice(before))
    assert.ok(!(save.lessons["b-1"]?.done ?? []).includes("C"));
  assert.deepEqual(host.snapshot().learner.card, reads[0]);
  host.dispatch({ type: "step.markDone" });
  assert.ok(saves.length > opened);
  assert.ok(saves.at(-1).lessons["b-1"].done.includes("C"));
  const grown = host.snapshot().learner.card;
  // C's skill (check) has no card line, so its tick adds no entry: the
  // card is the same read after the finish. The engine test pins growth.
  const skill = b1.content.steps.find((x) => x.id === "C").skill;
  assert.ok(!b1.content.card.some((e) => e.skill === skill));
  assert.deepEqual(grown, reads[0]);
  const after = saves.length;
  const later = [1, 2].map(() => host.snapshot().learner.card);
  assert.deepEqual(later, [grown, grown]);
  assert.equal(saves.length, after);
});
