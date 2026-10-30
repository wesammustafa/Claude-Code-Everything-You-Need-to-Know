// One run at a time (guards.9-single-flight), ported from learn-io: what r
// asked for stays owed per lesson, and a burst of asks runs twice.
import { test } from "vitest";
import assert from "node:assert/strict";
import { owing, singleFlight } from "../src/flight.mjs";

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
