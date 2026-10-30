// The stale-result guards the host keeps (ticket 209): a check runs again
// when its evidence changed while it ran (guard 8), and runs wait in line
// with what r asked for kept (guard 9).
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  DEMO_I1,
  finishedBefore,
  threeLevels,
} from "../../engine/test/drive.mjs";
import {
  AT_W3,
  fakeHost,
  ROOT,
  scripted,
  turn,
  VERSION,
  w3,
} from "./scripted.mjs";

const results = (heard) =>
  heard.filter((h) => h.input.type === "check").map((h) => h.input);

// spec: guards.8-rerun
test("a check whose evidence changed while it ran runs again, and only the second run's result, with the new stamp, is sent", async () => {
  const { host, adapters, heard } = fakeHost({ saved: AT_W3 });
  await host.open();
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  await turn();
  const [first] = adapters.checks.calls;
  assert.equal(first.items[0], 0);
  // The Learner writes the file while the check reads the folder.
  adapters.files.write(`${ROOT}/${VERSION}`, "2.1.285 (Claude Code)\n");
  first.resolve(w3(false));
  await turn();
  assert.deepEqual(results(heard), [], "the first run's result is dropped");
  assert.equal(adapters.checks.calls.length, 2, "and the check runs again");
  adapters.checks.calls[1].resolve(w3(true));
  await turn();
  const [only] = results(heard);
  assert.equal(only.stamp, adapters.files.stamp(ROOT, VERSION));
  assert.notEqual(only.stamp, "");
  assert.equal(only.items[0].pass, true);
});

// spec: guards.8-rerun
test("a check whose evidence did not change runs once", async () => {
  const { host, adapters, heard } = fakeHost({ saved: AT_W3 });
  adapters.files.write(`${ROOT}/${VERSION}`, "2.1.285 (Claude Code)\n");
  await host.open();
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  await turn();
  adapters.checks.calls[0].resolve(w3(true));
  await turn();
  assert.equal(adapters.checks.calls.length, 1);
  assert.equal(results(heard).length, 1);
});

// spec: guards.9-single-flight
test("r's run waits behind a poll's and keeps its slow items and number when another poll asks again (learn-io 971's host half)", async () => {
  const { host, adapters, heard, clock } = fakeHost({ saved: AT_W3 });
  await host.open();
  host.start();
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  await turn();
  // The beat's opening run is held; r, then a poll, ask while it runs.
  host.dispatch({ type: "check.run" });
  // Past the save's quiet window, so the watcher's change counts.
  clock.spend(400);
  adapters.fire(ROOT);
  await turn();
  assert.ok(
    heard.some((h) => h.input.type === "activity"),
    "the poll asked",
  );
  assert.equal(adapters.checks.calls.length, 1, "one child at a time");
  adapters.checks.calls[0].resolve(w3(false));
  await turn();
  assert.equal(adapters.checks.calls.length, 2);
  const r = adapters.checks.calls[1];
  assert.equal(r.slow, true, "the queued request kept r's slow flag");
  r.resolve(w3(false));
  await turn();
  assert.deepEqual(
    results(heard).map((x) => x.asked),
    [0, 1],
    "r's result carries r's number",
  );
});

// spec: guards.9-single-flight
test("prerequisite asks wait in line, and the latest takes the place of one waiting (FO:1225)", async () => {
  const i1 = DEMO_I1.replace(
    "next: i-2\n---",
    "next: i-2\nrequires: [b-5 check 0]\n---",
  );
  const course = threeLevels({ "i-1": i1 });
  const { engine } = scripted({
    effects: {
      "waitQuestion.answer": (s, input) => [
        {
          type: "prereqs",
          lesson: "i-1",
          dir: "/home/sam/mine",
          requires: s.course.find((l) => l.id === "i-1").content.requires,
          asked: input.asked,
        },
      ],
    },
  });
  const { host, adapters, heard } = fakeHost({
    course,
    engine,
    saved: {
      format: 1,
      welcomed: true,
      lessons: finishedBefore("i-1", course),
      folders: { intermediate: "/home/sam/mine" },
    },
  });
  await host.open();
  const b5 = () => adapters.checks.calls.filter((c) => c.lesson === "b-5");
  for (const asked of [1, 2, 3])
    host.dispatch({ type: "waitQuestion.answer", asked });
  await turn();
  assert.equal(b5().length, 1, "a second check child ran beside the first");
  b5()[0].resolve({ items: [{ index: 0, pass: false, hint: "not yet" }] });
  await turn();
  assert.equal(b5().length, 2, "the ask waiting in line ran");
  b5()[1].resolve({ items: [{ index: 0, pass: true }] });
  await turn();
  assert.equal(b5().length, 2, "once");
  assert.deepEqual(
    heard
      .filter((h) => h.input.type === "prereq")
      .map((h) => [h.input.asked, h.input.pass]),
    [
      [1, false],
      [3, true],
    ],
    "the latest ask took the place of the one waiting",
  );
});
