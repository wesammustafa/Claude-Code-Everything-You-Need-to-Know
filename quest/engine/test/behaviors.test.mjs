// Engine inputs the ported lesson tests never send (ticket 208's
// completeness pass): the key driver reached them through keys whose
// tests were cut, or not at all. Each test here drives them by actions.
import { test } from "vitest";
import assert from "node:assert/strict";
import { at } from "./flow-places.mjs";
import {
  beatOf,
  DEMO_I1,
  driver,
  finishedBefore,
  hintAvailable,
  IDLE_MS,
  missingNeeds,
  save,
  stepOf,
  threeLevels,
  where,
} from "./drive.mjs";

// Lesson 1's W7 git step, passed with W1 to W6 done: going on shows the
// level-up to HINTED before Y1.
const toLevelUp = () => {
  const d = at("W7", { beat: 2, done: ["W1", "W2", "W3", "W4", "W5", "W6"] });
  d.send({ type: "git", paths: [] });
  d.cont();
  assert.deepEqual([d.state.phase, d.state.levelTo], ["step-down", "hinted"]);
  return d;
};

test("the level-up's back returns to the step before it, and its tier joins nothing", () => {
  const d = toLevelUp();
  // The level-up is no card: step.back is for a card, the level-up has its own.
  d.refused("step.back");
  d.refused("step.continue");
  d.stepBack();
  assert.deepEqual(
    [where(d.state).phase, where(d.state).step, where(d.state).beat],
    ["playing", "W7", 2],
  );
  assert.deepEqual(d.state.progress["b-1"].levels, []);
  assert.ok(
    d.last.effects.some((e) => e.type === "git"),
    "the step it goes back to looks again",
  );
  // Off the level-up, its three answers do nothing.
  for (const type of ["stepDown.back", "stepDown.accept", "stepDown.moreHelp"])
    d.refused(type);
  // Going on again shows it again, as it was never accepted.
  d.send({ type: "git", paths: [] });
  d.cont();
  assert.equal(d.state.phase, "step-down");
});

// The enter half of learn-flow:1691, whose test was cut as T-time.
// spec: tiers.more-help
test("accepting the level-up asks for no more help", () => {
  const d = toLevelUp();
  d.accept();
  assert.deepEqual(
    [where(d.state).phase, stepOf(d.state).id],
    ["playing", "Y1"],
  );
  assert.equal(d.state.progress["b-1"].moreHelpAt, null);
  assert.ok(d.state.progress["b-1"].levels.includes("hinted"));
});

// spec: tiers.idle
test("activity restarts the two quiet minutes, and clears an idle beat", () => {
  const d = at("W3");
  assert.equal(d.state.beat.status, "opening");
  d.tick(IDLE_MS - 1_000);
  assert.deepEqual([d.state.beat.idle, d.state.beat.unlocked], [false, false]);
  // A file changed: the Learner is working, so the quiet starts again.
  d.activity();
  d.tick(2_000);
  assert.equal(d.state.beat.unlocked, false, "not two quiet minutes since");
  d.tick(IDLE_MS);
  assert.deepEqual([d.state.beat.idle, d.state.beat.unlocked], [true, true]);
  d.activity();
  assert.equal(d.state.beat.idle, false, "no stuck offer once work shows");
  assert.equal(d.state.beat.unlocked, true, "what the quiet unlocked stays");
});

// spec: needs.needs-commands
test("facts main sends later count: a Linux-only need is missing once the facts say Linux", () => {
  const SANDBOX =
    "On Linux and WSL 2, the sandbox needs `bubblewrap` and `socat`";
  const lessons = threeLevels({
    "i-1": DEMO_I1.replace(
      "next: i-2\n---",
      "next: i-2\nneeds: [bwrap socat on linux]\n---",
    ).replace('- can: "do it"\n', `- can: "do it"\n- need: "${SANDBOX}"\n`),
  });
  const d = driver({
    course: lessons,
    facts: { linux: false },
    saved: save({
      lessons: finishedBefore("i-1", lessons),
      folders: { intermediate: "/home/sam/code/my-app" },
    }),
  });
  assert.deepEqual([d.state.phase, d.state.lesson], ["overview", "i-1"]);
  d.send({ type: "commands", found: { bwrap: false, socat: true } });
  assert.deepEqual(missingNeeds(d.state), [], "not Linux: not needed here");
  d.send({ type: "facts", facts: { linux: true } });
  assert.equal(d.state.facts.linux, true);
  assert.deepEqual(missingNeeds(d.state), [
    { quote: SANDBOX, names: ["bwrap"] },
  ]);
});

test("the welcome finishes once, and is saved", () => {
  const d = driver({ saved: { format: 1, welcomed: false } });
  assert.equal(d.state.welcomed, false);
  d.finishWelcome();
  assert.deepEqual([d.state.welcomed, d.state.phase], [true, "overview"]);
  assert.deepEqual(d.last.effects, [{ type: "save" }]);
  d.refused("welcome.finish");
});

// spec: verify.beat.type
test("a typed-answer beat has no hints, before a try or after one", () => {
  const d = at("C", { beat: 1 });
  assert.equal(beatOf(d.state).kind, "type");
  assert.equal(hintAvailable(d.state), false);
  d.refused("hint.next");
  d.type("/usage");
  assert.equal(d.state.beat.typedWrong, 1);
  assert.equal(hintAvailable(d.state), false);
  d.refused("hint.next");
});
