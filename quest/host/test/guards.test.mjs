// The stale-result guards the host keeps (ticket 209): a check runs again
// when its evidence changed while it ran (guard 8), and runs wait in line
// with what r asked for kept (guard 9), one Check child at a time, and an
// r the running check answers joins it (ticket 211).
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  b1Only,
  courseWith,
  DEMO_B2,
  DEMO_I1,
  finished,
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
  WORK,
  checkRun,
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
  adapters.files.write(`${WORK}/${VERSION}`, "2.1.285 (Claude Code)\n");
  first.resolve(w3(false));
  await turn();
  assert.deepEqual(results(heard), [], "the first run's result is dropped");
  assert.equal(adapters.checks.calls.length, 2, "and the check runs again");
  adapters.checks.calls[1].resolve(w3(true));
  await turn();
  const [only] = results(heard);
  assert.equal(only.stamp, adapters.files.stamp(WORK, VERSION));
  assert.notEqual(only.stamp, "");
  assert.equal(only.items[0].pass, true);
});

// spec: guards.8-rerun
test("r's check whose evidence changed while it ran runs again, and that run carries r's number", async () => {
  const { host, adapters, heard } = fakeHost({ saved: AT_W3 });
  await host.open();
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  await turn();
  adapters.checks.calls[0].resolve(w3(false));
  await turn();
  host.dispatch(checkRun(host));
  await turn();
  assert.equal(adapters.checks.calls.length, 2, "r's run");
  adapters.files.write(`${WORK}/${VERSION}`, "2.1.285 (Claude Code)\n");
  adapters.checks.calls[1].resolve(w3(false));
  await turn();
  assert.equal(
    adapters.checks.calls.length,
    3,
    "the ask again does not join the run that asked it",
  );
  adapters.checks.calls[2].resolve(w3(true));
  await turn();
  assert.deepEqual(
    results(heard).map((x) => x.asked),
    [0, 1],
    "r's number comes back",
  );
});

// spec: guards.8-rerun
test("a check whose evidence did not change runs once", async () => {
  const { host, adapters, heard } = fakeHost({ saved: AT_W3 });
  adapters.files.write(`${WORK}/${VERSION}`, "2.1.285 (Claude Code)\n");
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
  host.dispatch(checkRun(host));
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
          dir: "/home/ali/mine",
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
      folders: { intermediate: "/home/ali/mine" },
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

// spec: guards.9-single-flight
test("r pressed again while r's run runs joins it", async () => {
  const { host, adapters, heard } = fakeHost({ saved: AT_W3 });
  await host.open();
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  await turn();
  adapters.checks.calls[0].resolve(w3(false));
  await turn();
  host.dispatch(checkRun(host));
  await turn();
  assert.equal(adapters.checks.calls.length, 2, "r's run");
  host.dispatch(checkRun(host));
  await turn();
  assert.equal(adapters.checks.calls.length, 2, "the second r joined it");
  adapters.checks.calls[1].resolve(w3(false));
  await turn();
  assert.equal(adapters.checks.calls.length, 2, "and nothing waited in line");
  assert.deepEqual(
    results(heard).map((x) => x.asked),
    [0, 2],
    "the run carries the second r's number",
  );
});

// spec: guards.9-single-flight
test("a probe, a stamp probe and a prerequisite check wait while a check child runs", async () => {
  const dir = ROOT;
  const { engine } = scripted({
    effects: {
      "waitQuestion.answer": [
        { type: "probe", name: "worktrees", args: [], asked: 1, dir },
        {
          type: "stamp",
          key: "x",
          probe: { name: "branch", args: ["main"] },
          dir,
        },
        {
          type: "prereqs",
          lesson: "b-1",
          dir,
          requires: [{ lesson: "b-1", item: 1 }],
          asked: 1,
        },
      ],
    },
  });
  const { host, adapters } = fakeHost({ saved: AT_W3, engine });
  await host.open();
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  await turn();
  host.dispatch({ type: "waitQuestion.answer", asked: 1 });
  await turn();
  assert.equal(adapters.probes.calls.length, 0, "no probe beside the check");
  assert.equal(adapters.checks.calls.length, 1, "no second check child");
  adapters.checks.calls[0].resolve(w3(false));
  await turn();
  // Then each in turn, in the order asked.
  assert.deepEqual(
    adapters.probes.calls.map((c) => c.name),
    ["worktrees"],
  );
  adapters.probes.calls[0].resolve({ pass: true, state: "a" });
  await turn();
  assert.deepEqual(
    adapters.probes.calls.map((c) => c.name),
    ["worktrees", "branch"],
  );
  assert.equal(adapters.checks.calls.length, 1);
  adapters.probes.calls[1].resolve({ pass: true, state: "b" });
  await turn();
  assert.equal(adapters.checks.calls.length, 2, "the prerequisite's check");
  assert.deepEqual(adapters.checks.calls[1].items, [1]);
});

// Ticket 292: a Check again pressed on a beat that passed before it arrived.
test("a late Check again for a passed beat changes nothing on the beat after it", async () => {
  const course = courseWith({ "b-2": DEMO_B2 });
  const lesson = course.find((l) => l.id === "b-2");
  const { host, adapters } = fakeHost({
    course,
    saved: {
      format: 1,
      welcomed: true,
      lessons: {
        "b-1": finished(b1Only[0]),
        "b-2": {
          warm: ["R1", "R2", "R3"],
          done: ["R1", "R2", "R3"],
          levels: ["challenge"],
          step: "W1",
          beat: 0,
        },
      },
    },
  });
  await host.open();
  host.dispatch({ type: "lesson.open", lesson: "b-2" });
  await turn();
  const item = (pass) => ({
    items: [{ index: 0, text: lesson.items[0], pass, hint: pass ? "" : "x" }],
  });
  adapters.checks.calls[0].resolve(item(false));
  await turn();
  const late = checkRun(host);
  host.dispatch(late);
  await turn();
  adapters.checks.calls[1].resolve(item(true));
  await turn();
  assert.equal(host.snapshot().lesson.beat.status, "done");
  host.dispatch({ type: "step.continue" });
  await turn();
  assert.equal(host.snapshot().lesson.step.id, "Y1");
  adapters.checks.calls.at(-1).resolve(item(false));
  await turn();
  assert.notEqual(host.snapshot().lesson.beat.status, "opening");
  const before = host.snapshot().lesson.beat;
  const calls = adapters.checks.calls.length;
  host.dispatch(late);
  await turn();
  assert.deepEqual(
    host.snapshot().lesson.beat,
    before,
    "the beat is untouched",
  );
  assert.equal(adapters.checks.calls.length, calls, "no check ran");
});
