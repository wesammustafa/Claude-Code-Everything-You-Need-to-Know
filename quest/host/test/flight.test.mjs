// One run at a time (guards.9-single-flight), ported from learn-io: what r
// asked for stays owed per lesson, and a burst of asks runs twice. And
// ticket 211's: an r that the running run answers joins it, and one lane
// runs one Check child at a time.
import { test } from "vitest";
import assert from "node:assert/strict";
import { oneAtATime, owing, singleFlight } from "../src/flight.ts";

const settle = (ms = 5) => new Promise((r) => setTimeout(r, ms));

// spec: guards.9-single-flight
test("what r asked for goes with the next run of its lesson, and not with another lesson's", async () => {
  const runs = [];
  let release;
  const ask = owing(async (flags, lesson) => {
    runs.push([lesson, flags.slow, flags.asked]);
    await new Promise((r) => {
      release = r;
    });
  });
  // A poll runs; r waits behind it, and a later poll of its lesson takes
  // its place: r's slow items and number stay.
  ask({}, "i-5", null);
  ask({ slow: true, asked: 3 }, "i-5", null);
  ask({}, "i-5", null);
  release();
  await settle();
  // r waits again, and another lesson's run takes its place: that run is
  // not r's.
  ask({ slow: true, asked: 4 }, "i-5", null);
  ask({}, "b-3", [0]);
  release();
  await settle();
  release();
  await settle();
  assert.deepEqual(runs, [
    ["i-5", false, 0],
    ["i-5", true, 3],
    ["b-3", false, 0],
  ]);
});

// spec: guards.9-single-flight
test("a burst of asks during a run makes exactly one more run", async () => {
  let runs = 0;
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const go = singleFlight(async () => {
    runs += 1;
    await gate;
  });
  go();
  go();
  go();
  go();
  release();
  await settle(20);
  assert.equal(runs, 2, "a run, then exactly one more");
});

// spec: guards.9-single-flight
test("the lane runs one at a time, in the order asked, at once when idle, and goes on after one fails", async () => {
  const lane = oneAtATime();
  const log = [];
  const releases = [];
  const job = (name, fail) => () => {
    log.push(`start ${name}`);
    return new Promise((resolve, reject) => {
      releases.push(() => {
        log.push(`end ${name}`);
        (fail ? reject : resolve)(new Error(name));
      });
    });
  };
  const a = lane(job("a", true));
  assert.deepEqual(log, ["start a"], "an idle lane starts at once");
  const b = lane(job("b"));
  const c = lane(job("c"));
  await settle();
  assert.deepEqual(log, ["start a"], "b and c wait for a");
  releases.shift()();
  await assert.rejects(a, /a/);
  await settle();
  assert.deepEqual(log, ["start a", "end a", "start b"]);
  releases.shift()();
  await b;
  await settle();
  releases.shift()();
  await c;
  assert.deepEqual(log, [
    "start a",
    "end a",
    "start b",
    "end b",
    "start c",
    "end c",
  ]);
});

// The covers rule of a check: the same lesson, every item asked for, and
// slow items when the ask wants them.
const sameCheck = ([lesson, items], flags, ask, { slow }) =>
  ask[0] === lesson &&
  (items == null ||
    (ask[1] != null && ask[1].every((i) => items.includes(i)))) &&
  (flags.slow || !slow);

function joined() {
  const runs = [];
  const releases = [];
  const ask = owing(
    async (flags, lesson, items) => {
      const run = { lesson, items, slow: flags.slow };
      runs.push(run);
      await new Promise((r) => releases.push(r));
      // The number is read as the run reports, not as it starts.
      run.asked = flags.report();
      return run;
    },
    { covers: sameCheck },
  );
  const release = async () => {
    releases.shift()();
    await settle();
  };
  return { ask, runs, release };
}

// spec: guards.9-single-flight
test("an r that the running run answers joins it: one run, and its result carries the later number", async () => {
  const { ask, runs, release } = joined();
  const first = ask({ asked: 1 }, "b-3", [0, 2]);
  const again = ask({ asked: 2 }, "b-3", [2]);
  await release();
  assert.equal(runs.length, 1, "nothing waited in line");
  assert.equal(await again, await first, "the r gets the running run back");
  assert.equal((await first).asked, 2);
  // A poll's run (number 0) answers r too.
  const poll = ask({}, "b-3", null);
  const r = ask({ asked: 3 }, "b-3", [1]);
  await release();
  assert.equal(await r, await poll);
  assert.equal(runs.length, 2);
  assert.equal(runs[1].asked, 3);
});

// spec: guards.9-single-flight
test("a poll, another set of items, or a slow r during a run that leaves slow items out each wait in line", async () => {
  const { ask, runs, release } = joined();
  ask({ asked: 1 }, "b-3", [2]);
  ask({}, "b-3", [2]);
  await release();
  await release();
  assert.deepEqual(
    runs.map((r) => [r.items, r.asked]),
    [
      [[2], 1],
      [[2], 0],
    ],
    "a poll runs again",
  );
  ask({ asked: 2 }, "b-3", [2]);
  ask({ asked: 3 }, "b-3", [0, 2]);
  await release();
  await release();
  assert.deepEqual(
    runs.slice(2).map((r) => [r.items, r.asked]),
    [
      [[2], 2],
      [[0, 2], 3],
    ],
    "items the run leaves out wait",
  );
  ask({ asked: 4 }, "b-3", null);
  ask({ slow: true, asked: 5 }, "b-3", null);
  await release();
  await release();
  assert.deepEqual(
    runs.slice(4).map((r) => [r.slow, r.asked]),
    [
      [false, 4],
      [true, 5],
    ],
    "a slow r waits for a run without slow items",
  );
  // A slow run answers an r without them.
  const slow = ask({ slow: true, asked: 6 }, "b-3", null);
  const plain = ask({ asked: 7 }, "b-3", null);
  await release();
  assert.equal(await plain, await slow);
  assert.equal(runs.length, 7);
  assert.equal(runs[6].asked, 7);
});

// spec: guards.9-single-flight
test("an r after the running run has reported waits in line, even before that run ends", async () => {
  const runs = [];
  const ask = owing(
    async (flags, lesson) => {
      await settle();
      runs.push(flags.report());
      // An r that comes as the result goes out, before this run ends.
      if (runs.length === 1) ask({ asked: 2 }, lesson, null);
    },
    { covers: sameCheck },
  );
  await ask({ asked: 1 }, "b-3", null);
  await settle(20);
  assert.deepEqual(runs, [1, 2], "r got a run of its own");
});
