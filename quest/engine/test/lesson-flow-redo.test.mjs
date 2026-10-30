// learn-flow's tests from the same answer after a redo (ticket 192) to the
// r27 engine fixes, driven by actions and results (ticket 208): the back
// line and step.revisit, parts and Tear down steps, optional steps, long
// waits and the warm-up asked while a run works, choices and their when
// lines, git probes, head-moved, git-unchanged and file globs.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  answerKey,
  b1Item,
  backOffered,
  beatOf,
  beatShown,
  course,
  courseWith,
  DEMO_B2,
  driver,
  EFFECT_TYPES,
  FACTS,
  finished,
  finishedBefore,
  IDLE_MS,
  isLastBeat,
  judge,
  longWait,
  onReading,
  OWN_PARTS,
  parseLesson,
  pending,
  playUntil,
  ruleTiers,
  rungsOf,
  save,
  snapshot,
  statusStamp,
  stepOf,
  tearDownLeft,
  tierOf,
  tryNow,
  watching,
  whileRunsOf,
  whileRunsOpen,
} from "./drive.mjs";
// The app's words a beat's fail hint or evidence is built from (status.mjs
// and holds.mjs pick them), and the text measures E2 and E14 test.
import { at, atStep, b1Done, missing, reopen } from "./flow-places.mjs";
import { C } from "../src/copy.mjs";
import { inline, width, wrapRuns } from "../src/text.ts";

// ---- ways out when a check keeps failing for an earlier reason (ticket 192) --
const AFTER = ".practice/b-2-after.txt";
const b2Item = course.find((l) => l.id === "b-2").items[1];
const afterSays = (hint) => [{ index: 1, text: b2Item, pass: false, hint }];
// b-2 on W7's last beat, the after snapshot, with the steps before it done
// and their fresh stamps saved.
const W7_STAMPS = { "W6.1": "S1", "W6.2": "S2", "W7.4": "S3" };
const onAfter = (extra = {}) => {
  const d = driver({
    course,
    saved: save({
      lessons: {
        ...finishedBefore("b-2"),
        "b-2": {
          step: "W7",
          beat: 4,
          warm: ["R1", "R2"],
          done: ["R1", "R2", "W1", "W2", "W3", "W4", "W5", "W6"],
          stamps: { ...W7_STAMPS },
          ...extra,
        },
      },
    }),
  });
  d.open();
  assert.deepEqual([stepOf(d.state).id, d.state.pos.beat], ["W7", 4]);
  return d;
};
// A result for the after item: its message, and the after file's state.
const says = (d, hint, stamp, extra = {}) => {
  d.send({
    type: "check",
    lesson: "b-2",
    items: afterSays(hint),
    path: AFTER,
    stamp,
    ...extra,
  });
  return d.state.beat;
};
// The first answer, then a FAIL on screen.
const failing = (d) => {
  says(d, "After Claude finishes the edits, run it.", "");
  assert.equal(says(d, "It lists no changed file yet.", "a").status, "fail");
  return d;
};

test("the same answer after a redo: the note follows the second identical FAIL with the file changed between them (192)", () => {
  // was learn-flow:2443
  const d = failing(onAfter());
  assert.equal(Boolean(d.state.beat.same), false, "never at the first FAIL");
  assert.equal(
    Boolean(says(d, "It lists no changed file yet.", "a").same),
    false,
    "a poll with the file as it was is no redo",
  );
  d.run();
  assert.equal(
    Boolean(
      says(d, "It lists no changed file yet.", "a", {
        asked: d.state.beat.asked,
      }).same,
    ),
    false,
    "nor is r on the same file",
  );
  assert.equal(
    says(d, "It lists no changed file yet.", "b").same,
    true,
    "saved again, and the check says the same",
  );
  assert.equal(d.state.beat.status, "fail");
  assert.equal(
    says(d, "It lists no changed file yet.", "c").same,
    true,
    "it stays while the check says the same",
  );
  assert.equal(
    Boolean(says(d, "Changed but not in the plan: src/a.js.", "d").same),
    false,
    "a new message takes it away",
  );
  assert.equal(
    Boolean(says(d, "Changed but not in the plan: src/a.js.", "e").same),
    false,
    "once a beat visit",
  );
  // A new visit of the beat starts over.
  d.back();
  d.markDone();
  assert.deepEqual([stepOf(d.state).id, d.state.pos.beat], ["W7", 4]);
  failing(d);
  assert.equal(says(d, "It lists no changed file yet.", "b").same, true);
});

test("the same answer after a redo: not when the message changes, nor before a FAIL is on screen, nor with no file state (192)", () => {
  // was learn-flow:2462
  const d = failing(onAfter());
  assert.equal(
    Boolean(says(d, "Changed but not in the plan: src/a.js.", "b").same),
    false,
  );
  // The first answer repeated with the file changed is still no "not yet",
  // so no note either: the learner never saw it.
  const quiet = onAfter();
  says(quiet, "It lists no changed file yet.", "");
  assert.equal(
    says(quiet, "It lists no changed file yet.", "a").status,
    "waiting",
  );
  assert.equal(Boolean(quiet.state.beat.same), false);
  // A check beat that names no evidence file can't tell a redo from a poll.
  const b1 = at("W3");
  b1.send({ type: "check", lesson: "b-1", items: [missing] });
  b1.run();
  b1.send({
    type: "check",
    lesson: "b-1",
    items: [missing],
    asked: b1.state.beat.asked,
  });
  b1.send({ type: "check", lesson: "b-1", items: [missing] });
  assert.deepEqual(
    [b1.state.beat.status, Boolean(b1.state.beat.same)],
    ["fail", false],
  );
});

test("the same answer after a redo: on a beat that reads its file too, with no back line to offer (192)", () => {
  // was learn-flow:2480
  const path = ".practice/b-2-plan.txt";
  const d = onReading(`match ${path} ^src/`);
  assert.equal(
    tryNow(d, path, null, "").fail.hint,
    `${path} is not there yet.`,
  );
  d.send({ type: "file", path, read: null, stamp: "" });
  assert.equal(
    Boolean(d.state.beat.same),
    false,
    "still not there: nothing was redone",
  );
  d.send({ type: "file", path, read: Buffer.from(""), stamp: "x1" });
  assert.equal(Boolean(d.state.beat.same), false, "a new message");
  d.send({ type: "file", path, read: Buffer.from("lib/a.js\n"), stamp: "x2" });
  assert.equal(d.state.beat.fail.hint, `${path} has no line like that yet.`);
  assert.equal(d.state.beat.same, true);
  assert.equal(
    backOffered(d.state),
    null,
    "the demo lesson names no step to go back to",
  );
  const before = { ...d.state.pos };
  d.refused("step.revisit");
  assert.deepEqual(
    d.state.pos,
    before,
    "step.revisit does nothing where nothing is offered",
  );
});

test("the back key: the note offers the step b-2's ladder names, and e goes there with every tick kept (192)", () => {
  // was learn-flow:2497
  const d = failing(onAfter());
  assert.equal(backOffered(d.state), null, "not before the note");
  d.refused("step.revisit");
  assert.deepEqual(
    [stepOf(d.state).id, d.state.pos.beat],
    ["W7", 4],
    "step.revisit does nothing before it is offered",
  );
  says(d, "It lists no changed file yet.", "b");
  const back = backOffered(d.state);
  assert.deepEqual(
    [back.step, back.at, back.title, back.quoted],
    ["W2", 3, "Switch to plan mode", false],
  );
  const done = [...d.state.progress["b-2"].done];
  const from = d.effects.length;
  d.revisit();
  // dropped: T-view view === 'step' (asserted as a step card instead)
  assert.equal(d.state.phase, "playing");
  assert.deepEqual(
    [stepOf(d.state).id, d.state.pos],
    ["W2", { step: 3, beat: 0 }],
  );
  assert.deepEqual(d.state.progress["b-2"].done, done, "every done tick stays");
  assert.equal(d.state.progress["b-2"].step, "W2", "the place is saved there");
  assert.deepEqual(
    d.state.progress["b-2"].stamps,
    {},
    "the fresh checks from W2 on lose their stamps",
  );
  const out = d.effects.slice(from);
  assert.ok(out.some((e) => e.type === "save"));
  // The old list also allowed flow's `later`, which is no engine effect.
  assert.ok(
    out.every(
      (e) =>
        EFFECT_TYPES.includes(e.type) &&
        ["save", "stamp", "check", "file", "git"].includes(e.type),
    ),
    "the app touches no file: every .practice/ file stays",
  );
});

test("the back key: the hint ladder's last rung offers it too, and only from the part it names (192)", () => {
  // was learn-flow:2518
  const d = failing(onAfter());
  assert.equal(d.state.beat.rung, -1);
  for (let i = 0; i < 6 && !d.state.beat.confirm; i++) {
    d.hint();
    if (!d.state.beat.confirm)
      assert.equal(
        backOffered(d.state),
        null,
        `rung ${d.state.beat.rung} is not the last`,
      );
    // dropped: T-time HINT_LOCK_MS tick between presses
  }
  assert.equal(backOffered(d.state), null, "not on the y/n");
  d.exact(true);
  assert.equal(d.state.beat.rung, rungsOf(d.state).length - 1);
  assert.equal(backOffered(d.state)?.step, "W2");
  d.revisit();
  assert.equal(stepOf(d.state).id, "W2");
  // Your turn redoes the example on its own: the after item's back line
  // names a Worked example step, so Y5 offers none.
  const y5 = driver({
    course,
    saved: save({
      lessons: {
        ...finishedBefore("b-2"),
        "b-2": {
          step: "Y5",
          beat: 3,
          warm: ["R1", "R2"],
          stamps: { "Y5.3": "S" },
        },
      },
    }),
  });
  y5.open();
  failing(y5);
  assert.equal(says(y5, "It lists no changed file yet.", "b").same, true);
  assert.equal(backOffered(y5.state), null);
});

test("the back key: with the note up, the y/n offers no e and e waits for its answer (192)", () => {
  // was learn-flow:2541
  const d = failing(onAfter());
  says(d, "It lists no changed file yet.", "b");
  assert.equal(backOffered(d.state)?.step, "W2", "the note offers it");
  for (let i = 0; i < 6 && !d.state.beat.confirm; i++) {
    d.hint();
    // dropped: T-time HINT_LOCK_MS tick between presses
  }
  assert.equal(d.state.beat.confirm, true);
  assert.equal(d.state.beat.same, true, "the note is still up");
  assert.equal(backOffered(d.state), null, "not on the y/n");
  d.refused("step.revisit");
  assert.deepEqual(
    [stepOf(d.state).id, d.state.pos.beat, d.state.beat.confirm],
    ["W7", 4, true],
    "step.revisit does nothing on the y/n",
  );
  d.exact(false);
  assert.equal(
    backOffered(d.state)?.step,
    "W2",
    "after n the note offers it again",
  );
  d.revisit();
  assert.equal(stepOf(d.state).id, "W2");
});

test("the back key: the steps from there on check again as they are met, and a quit mid-way resumes there (192)", () => {
  // was learn-flow:2560
  const d = failing(onAfter());
  says(d, "It lists no changed file yet.", "b");
  d.revisit();
  playUntil(d, atStep("W4"));
  const r = reopen(d);
  assert.equal(
    stepOf(r.state).id,
    "W4",
    "the quit mid-way resumes where the learner was",
  );
  assert.deepEqual(r.state.progress["b-2"].stamps, {});
  assert.deepEqual(r.state.progress["b-2"].done, [
    "R1",
    "R2",
    "W1",
    "W2",
    "W3",
    "W4",
    "W5",
    "W6",
  ]);
  playUntil(r, (s) => atStep("W6")(s) && s.pos.beat === 1);
  // W6 stamps its snapshot again as it opens, so the one the first pass
  // saved counts for nothing: the check waits for a new save.
  const stamp = r.effects.find((e) => e.type === "stamp" && e.key === "W6.1");
  assert.deepEqual(stamp, {
    type: "stamp",
    key: "W6.1",
    path: ".practice/b-2-before.txt",
    dir: FACTS.root,
  });
  r.send({ type: "stamp", key: "W6.1", stamp: "OLD", dir: FACTS.root });
  const pass = [
    {
      index: 0,
      text: course.find((l) => l.id === "b-2").items[0],
      pass: true,
      hint: "",
    },
  ];
  r.send({
    type: "check",
    lesson: "b-2",
    items: pass,
    path: ".practice/b-2-before.txt",
    stamp: "OLD",
  });
  assert.deepEqual(
    [r.state.beat.status, r.state.beat.stale],
    ["waiting", true],
    "the snapshot from before the back waits",
  );
  r.send({
    type: "check",
    lesson: "b-2",
    items: pass,
    path: ".practice/b-2-before.txt",
    stamp: "NEW",
  });
  assert.equal(r.state.beat.status, "done", "a new snapshot passes");
});

// ---- Your turn parts, Tear down steps and optional steps (ticket 102) -------
// DEMO_B2 with its Your turn in two parts, the second optional, and two Tear
// down steps after the Check, the last of which completes the lesson.
const PARTS_B2 = DEMO_B2.replace("next: b-3\n", "next: b-3\nbadge: Tidy\n")
  .replace(
    "### Y1 | Your turn step 1 of 1 | Save it again",
    "### Y1 | Your turn part 1 of 2 | Save it again",
  )
  .replace(
    "### C | Check | Check",
    `### Y2 | Your turn part 2 of 2 | Look around
- tier: challenge
- skill: look-around
- where: terminal
- optional: Skip this part in the cheap variant.
- beat: do
- verify: self
- done-label: it's done
- goal: "Look around."

### C | Check | Check`,
  ).concat(`
### D1 | Tear down step 1 of 2 | Remove the snapshot
- tier: challenge
- skill: tear-down
- where: shell
- beat: do
- verify: self
- done-label: it's gone
- goal: "Remove the snapshot."

### D2 | Tear down step 2 of 2 | Check once more
- tier: challenge
- skill: tear-down
- where: terminal
- optional: Skip this step if the check already ran.
- beat: do
- verify: self
- done-label: it still passes
- goal: "Run the check once more."
`);
const partsCourse = () => courseWith({ "b-2": PARTS_B2 });
const b2Saved = (extra = {}) =>
  save({
    lessons: {
      "b-1": b1Done,
      "b-2": { done: ["W1", "Y1", "Y2"], step: "C", beat: 0, ...extra },
    },
  });
const onPartsB2 = (step, extra = {}) => {
  const d = driver({
    course: partsCourse(),
    saved: b2Saved({ step, ...extra }),
  });
  d.open();
  if (!d.state.beat || stepOf(d.state).id !== step)
    throw new Error(`onPartsB2: on ${d.state.phase}, not ${step}`);
  return d;
};

test("parts and Tear down: the headings parse, a part is own work, and D steps only follow the Check (102)", () => {
  // was learn-flow:2639
  const l = parseLesson(PARTS_B2, "b-2.md");
  assert.deepEqual(
    l.steps.map((s) => [s.id, s.part, s.unit, s.n, s.of]),
    [
      ["W1", "Worked example", "step", 1, 1],
      ["Y1", "Your turn", "part", 1, 2],
      ["Y2", "Your turn", "part", 2, 2],
      ["C", "Check", null, null, null],
      ["D1", "Tear down", "step", 1, 2],
      ["D2", "Tear down", "step", 2, 2],
    ],
  );
  assert.ok(OWN_PARTS.has(l.steps[1].part), "a part is own work");
  const bad = (from, to) =>
    assert.throws(
      () => parseLesson(PARTS_B2.replace(from, to), "b-2.md"),
      Error,
      `${to}`,
    );
  bad(
    "### W1 | Worked example step 1 of 1",
    "### W1 | Worked example part 1 of 1",
  );
  bad("### D1 | Tear down step 1 of 2", "### D1 | Tear down part 1 of 2");
  bad("### D1 | Tear down step 1 of 2", "### Y3 | Tear down step 1 of 2");
  bad("### Y2 | Your turn part 2 of 2", "### D9 | Your turn part 2 of 2");
  // A Tear down step before the Check, or a step after a Tear down step.
  const early = DEMO_B2.replace(
    "### C | Check | Check",
    "### D1 | Tear down step 1 of 1 | Early\n- tier: challenge\n- skill: x\n- where: shell\n- beat: do\n- verify: self\n\n### C | Check | Check",
  );
  assert.throws(
    () => parseLesson(early, "b-2.md"),
    /a Tear down step only follows the Check/,
  );
  const after = `${PARTS_B2}\n### Y3 | Your turn part 3 of 3 | Late\n- tier: challenge\n- skill: x\n- where: shell\n- beat: do\n- verify: self\n`;
  assert.throws(
    () => parseLesson(after, "b-2.md"),
    /only Tear down steps follow the Check/,
  );
});

test("parts and Tear down: a D id works wherever a step id does (102)", () => {
  // was learn-flow:2658
  const fresh = parseLesson(
    PARTS_B2.replace(
      "- done-label: it's gone\n",
      "- verify: file .practice/gone.txt fresh since D1\n",
    ).replace(
      "- beat: do\n- verify: self\n- verify: file",
      "- beat: do\n- verify: file",
    ),
    "b-2.md",
  );
  assert.equal(
    fresh.steps.find((s) => s.id === "D1").beats[0].verify.since,
    "D1",
  );
  const back = parseLesson(
    PARTS_B2.replace(
      '- goal: "Run the check once more."',
      '- goal: "Run the check once more."\n- back: D1 Remove it first.',
    ),
    "b-2.md",
  );
  assert.equal(back.steps.find((s) => s.id === "D2").beats[0].back.step, "D1");
  const saved = snapshot({
    welcomed: true,
    eased: [],
    missed: [],
    progress: {
      "b-2": {
        step: "D2",
        bottomAt: "D1",
        moreHelpAt: "D2",
        done: ["D1"],
      },
    },
  });
  assert.deepEqual(
    [
      saved.lessons["b-2"].step,
      saved.lessons["b-2"].bottomAt,
      saved.lessons["b-2"].moreHelpAt,
    ],
    ["D2", "D1", "D2"],
  );
  const d = onPartsB2("D2", { done: ["W1", "Y1", "Y2", "C", "D1"] });
  assert.equal(stepOf(d.state).id, "D2", "a saved D step resumes");
});

// spec: verify.value.check-all
test("parts and Tear down: the Check runs check all, and the lesson completes, badge and all, only after its last D step (102)", () => {
  // was learn-flow:2669
  const d = onPartsB2("C");
  assert.deepEqual(
    d.effects.find((e) => e.type === "check"),
    {
      type: "check",
      lesson: "b-2",
      items: null,
      evidence: null,
      dir: FACTS.root,
    },
  );
  playUntil(d, atStep("D1"));
  const p = d.state.progress["b-2"];
  assert.ok(p.done.includes("C"));
  assert.equal(
    p.complete,
    false,
    "the Check passing does not complete the lesson",
  );
  d.markDone();
  assert.equal(stepOf(d.state).id, "D2");
  assert.equal(d.state.progress["b-2"].complete, false);
  // dropped: T-render no badge line on D2's screen
  d.markDone();
  assert.equal(d.state.phase, "complete");
  assert.equal(d.state.progress["b-2"].complete, true);
  assert.deepEqual(d.state.progress["b-2"].done.slice(-3), ["C", "D1", "D2"]);
  // dropped: T-render the badge line on the complete screen
});

test("parts and Tear down: the map and the resume screen say the tear down is still to do (102)", () => {
  // was learn-flow:2687
  const d = driver({
    course: partsCourse(),
    saved: b2Saved({ step: "D1", done: ["W1", "Y1", "Y2", "C"] }),
  });
  assert.ok(d.state.phase === "playing" && !d.state.beat, "a resume");
  assert.ok(tearDownLeft(d.state, "b-2"));
  // dropped: T-render the resume screen's C.tearDownLeft line, fitsBoth
  // dropped: T-view m opens the map; T-render its C.mapTearDown row
  // Before the Check passes, and once the lesson is complete, it says nothing of it.
  assert.equal(
    tearDownLeft(
      driver({ course: partsCourse(), saved: b2Saved() }).state,
      "b-2",
    ),
    false,
  );
  assert.equal(
    tearDownLeft(
      driver({
        course: partsCourse(),
        saved: b2Saved({ complete: true, step: null }),
      }).state,
      "b-2",
    ),
    false,
  );
});

test("optional steps: the card says when to skip, x skips, and skipping changes no eased or missed state (102)", () => {
  // was learn-flow:2709
  const l = parseLesson(PARTS_B2, "b-2.md");
  assert.equal(
    l.steps.find((s) => s.id === "Y2").optional,
    "Skip this part in the cheap variant.",
  );
  assert.throws(
    () =>
      parseLesson(
        PARTS_B2.replace(
          "- optional: Skip this part in the cheap variant.",
          '- optional: "Skip this part."',
        ),
        "b-2.md",
      ),
    /optional holds the app's own words/,
  );
  // The look-around skill waits to be eased, so Y2 opens eased.
  const d = driver({
    course: partsCourse(),
    saved: {
      ...b2Saved({ step: "Y2", done: ["W1", "Y1"] }),
      eased: ["look-around"],
      missed: ["look-around"],
    },
  });
  d.open();
  assert.equal(stepOf(d.state).id, "Y2");
  assert.equal(
    d.state.progress["b-2"].easedSteps.Y2,
    true,
    "the ease landed on Y2",
  );
  // dropped: T-render the card's C.optional line, the key bar's x, fitsBoth
  d.skip();
  assert.equal(stepOf(d.state).id, "C", "step.skip goes on to the next step");
  const p = d.state.progress["b-2"];
  assert.ok(!p.done.includes("Y2"), "a skipped step is not done");
  assert.equal(p.easedSteps.Y2, undefined, "the ease it took waits again");
  assert.deepEqual(
    [d.state.eased, d.state.missed],
    [["look-around"], ["look-around"]],
  );
  // step.skip does nothing on a step that is not optional.
  d.refused("step.skip");
  assert.equal(stepOf(d.state).id, "C");
  // Skipping the last step completes the lesson.
  const last = onPartsB2("D2", { done: ["W1", "Y1", "Y2", "C", "D1"] });
  last.skip();
  assert.equal(last.state.phase, "complete");
  assert.equal(last.state.progress["b-2"].complete, true);
  assert.ok(!last.state.progress["b-2"].done.includes("D2"));
});

test("optional steps: ruleTiers never counts an optional step's skill (102)", () => {
  // was learn-flow:2741
  const contents = partsCourse().map((x) => x.content);
  const later = parseLesson(
    PARTS_B2.replace("lesson: b-2", "lesson: b-3").replace(
      "### W1 | Worked example step 1 of 1 | Save the list\n- tier: guided\n- skill: snapshot",
      "### W1 | Worked example step 1 of 1 | Save the list\n- tier: guided\n- skill: look-around",
    ),
    "b-3.md",
  );
  const at = contents.findIndex((c) => c?.lesson === "b-2") + 1;
  contents[at] = later;
  assert.equal(
    ruleTiers(contents, at)[0],
    "guided",
    "the optional Y2 of b-2 does not count toward look-around",
  );
  const counted = [...contents];
  counted[at - 1] = parseLesson(
    PARTS_B2.replace("- optional: Skip this part in the cheap variant.\n", ""),
    "b-2.md",
  );
  assert.equal(
    ruleTiers(counted, at)[0],
    "hinted",
    "a step that is not optional counts",
  );
});

// ---- a second session, the browser and long waits (ticket 103) ---------------
// DEMO_B2 with its terminals numbered as a page numbers them, and a Your
// turn step 2 that opens a run in the browser, then waits on it in the
// second Claude Code session until a local file says it ended.
const WAIT_B2 = DEMO_B2.replace(
  "next: b-3\n",
  "next: b-3\nterminals: [terminal claude, claude-2, shell]\n",
)
  .replace(
    "### Y1 | Your turn step 1 of 1 | Save it again",
    "### Y1 | Your turn step 1 of 2 | Save it again",
  )
  .replace(
    "### C | Check | Check",
    `### Y2 | Your turn step 2 of 2 | Watch the run
- tier: challenge
- skill: long-run
- beat: do
- where: browser
- verify: none
- do: "Open the run."
- beat: do
- where: claude-2
- verify: file .practice/run.txt
- wait: long
- goal: "Wait for the run to finish."

### C | Check | Check`,
  );
const onWaitB2 = (step, beat = 0, text = WAIT_B2) => {
  const d = driver({
    course: courseWith({ "b-2": text }),
    saved: save({
      lessons: {
        "b-1": b1Done,
        "b-2": {
          done: ["W1", "Y1"].slice(0, ["W1", "Y1", "Y2"].indexOf(step)),
          step,
          beat,
        },
      },
    }),
  });
  d.open();
  if (!d.state.beat || stepOf(d.state).id !== step || d.state.pos.beat !== beat)
    throw new Error(`onWaitB2: on ${d.state.phase}, not ${step} beat ${beat}`);
  return d;
};

// spec: where.terminals
test("a second session, the browser and long waits: the grammar (103)", () => {
  // was learn-flow:2781
  const l = parseLesson(WAIT_B2, "b-2.md");
  assert.deepEqual(l.terminals, {
    terminal: 1,
    claude: 1,
    "claude-2": 2,
    shell: 3,
  });
  const y2 = l.steps.find((s) => s.id === "Y2");
  assert.deepEqual(
    y2.beats.map((b) => [b.where, b.verify.kind, b.wait ?? null]),
    [
      ["browser", "none", null],
      ["claude-2", "file", { text: null }],
    ],
  );
  assert.equal(
    parseLesson(DEMO_B2, "b-2.md").terminals,
    null,
    "without the key, nothing is numbered",
  );
  const quoted = parseLesson(
    WAIT_B2.replace(
      "- wait: long",
      '- wait: "The run can take several minutes."',
    ),
    "b-2.md",
  );
  assert.deepEqual(quoted.steps.find((s) => s.id === "Y2").beats[1].wait, {
    text: "The run can take several minutes.",
  });
  const bad = (from, to, re) =>
    assert.throws(() => parseLesson(WAIT_B2.replace(from, to), "b-2.md"), re);
  bad(
    "- wait: long",
    "- wait: a few minutes",
    /wait: long, or the page's words in quotes/,
  );
  bad("- wait: long", "- wait: long\n- wait: long", /a second wait line/);
  bad(
    "terminals: [terminal claude, claude-2, shell]",
    "terminals: [terminal claude, claude-2, editor]",
    /editor is none of terminal, claude, claude-2, shell/,
  );
  bad(
    "terminals: [terminal claude, claude-2, shell]",
    "terminals: [terminal claude, claude claude-2, shell]",
    /terminals names claude twice/,
  );
  bad(
    "terminals: [terminal claude, claude-2, shell]",
    "terminals: [terminal claude, claude-2]",
    /where shell, which terminals doesn't number/,
  );
  // A browser beat: self, or none with a later beat of its step that reads a local file.
  bad(
    "- verify: file .practice/run.txt\n",
    "- verify: self\n",
    /a browser beat verifies with self, or with none and a later beat/,
  );
  bad(
    "- where: browser\n- verify: none",
    "- where: browser\n- verify: check 0",
    /a browser beat verifies with self/,
  );
  assert.doesNotThrow(() =>
    parseLesson(
      WAIT_B2.replace(
        "- where: browser\n- verify: none",
        "- where: browser\n- verify: self",
      ),
      "b-2.md",
    ),
  );
  // A later git probe (105) reads only local refs: it may verify for the browser.
  assert.doesNotThrow(() =>
    parseLesson(
      WAIT_B2.replace(
        "- verify: file .practice/run.txt\n",
        "- verify: probe pushed\n",
      ),
      "b-2.md",
    ),
  );
  // The later beat must show whenever the browser beat does (104): not one
  // a when line may hide, unless the browser beat has the same when.
  const choiceFirst = (browserWhen, laterWhen) =>
    WAIT_B2.replace(
      "- skill: long-run\n- beat: do\n- where: browser",
      `- skill: long-run\n- beat: ask\n- ask: Which run?\n- option: CI\n- option: Local\n- beat: do${browserWhen}\n- where: browser`,
    ).replace("- where: claude-2\n", `- where: claude-2${laterWhen}\n`);
  assert.throws(
    () => parseLesson(choiceFirst("", "\n- when: Y2.0=CI"), "b-2.md"),
    /a browser beat verifies with self, or with none and a later beat/,
  );
  assert.throws(
    () =>
      parseLesson(
        choiceFirst("\n- when: Y2.0=Local", "\n- when: Y2.0=CI"),
        "b-2.md",
      ),
    /a browser beat verifies with self, or with none and a later beat/,
  );
  assert.doesNotThrow(() =>
    parseLesson(
      choiceFirst("\n- when: Y2.0=CI", "\n- when: Y2.0=CI"),
      "b-2.md",
    ),
  );
  assert.doesNotThrow(() =>
    parseLesson(choiceFirst("\n- when: Y2.0=CI", ""), "b-2.md"),
  );
  // Only a do or self beat waits.
  assert.throws(
    () =>
      parseLesson(
        DEMO_B2.replace(
          '- because: "Usage is something else."',
          '- because: "Usage is something else."\n- wait: long',
        ),
        "b-2.md",
      ),
    /a wait line on the ask beat/,
  );
});

test("a second session, the browser and long waits: a long wait claims nothing the app cannot see (103)", () => {
  // was learn-flow:2832
  const d = onWaitB2("Y2", 1);
  // The app's own look at the file, which finds nothing yet.
  d.send({ type: "file", path: ".practice/run.txt", read: null, stamp: "A" });
  assert.equal(d.state.beat.status, "waiting");
  assert.equal(longWait(d.state), true);
  // dropped: T-render the card's C.waitLong line
  // The box's question answered (150).
  d.waitAnswer(0);
  // Ten quiet minutes: no idle offer, no CHALLENGE unlock.
  for (let k = 0; k < 10; k++) d.tick(60_000);
  assert.equal(d.state.beat.idle, false);
  assert.equal(d.state.beat.unlocked, false);
  // dropped: T-motion cardMood, phases().spinner, pipGates().motion, nextChange, fitsBoth
  // The file the run leaves ends the wait like any other file beat.
  d.send({
    type: "file",
    path: ".practice/run.txt",
    read: Buffer.from("ok"),
    stamp: "B",
  });
  assert.equal(d.state.beat.status, "done");
  assert.equal(longWait(d.state), false);
  // A beat with no wait goes idle as before.
  const w = onWaitB2("Y2", 1, WAIT_B2.replace("- wait: long\n", ""));
  w.send({ type: "file", path: ".practice/run.txt", read: null, stamp: "A" });
  w.tick(IDLE_MS + 1_000);
  assert.equal(longWait(w.state), false);
  assert.equal(w.state.beat.idle, true);
  // dropped: T-motion pipGates().motion
});

// ---- choices and the beats that depend on them (ticket 104) -----------------
// DEMO_B2 with its Your turn opening on a choice: Y1.1 shows for everyone,
// Y1.2 only for a key and Y1.3 only for a token, the step's last beat.
const CHOICE_B2 = DEMO_B2.replace(
  `- beat: do
- verify: check 0 fresh
- watching: .practice/b-2-before.txt
- evidence: .practice/b-2-before.txt
- goal: "Save it again."`,
  `- beat: ask
- ask: Which credential do you use?
- option: An API key
- option: A token
- beat: do
- verify: self
- done-label: it's saved
- goal: "Save it again."
- beat: do
- when: Y1.0=An API key
- verify: self
- done-label: it's set
- goal: "Add the key."
- beat: do
- when: Y1.0=A token
- verify: self
- done-label: it's set
- goal: "Add the token."`,
);
const onChoice = (extra = {}) => {
  const d = driver({
    course: courseWith({ "b-2": CHOICE_B2 }),
    saved: save({
      lessons: {
        "b-1": b1Done,
        "b-2": { done: ["W1"], step: "Y1", beat: 0, ...extra },
      },
    }),
  });
  d.open();
  if (!d.state.beat || stepOf(d.state).id !== "Y1")
    throw new Error(`onChoice: on ${d.state.phase}, not Y1`);
  return d;
};
// The step and beat on the card, or the phase off it.
const spot = (d) =>
  d.state.phase === "playing" && d.state.beat
    ? `${stepOf(d.state).id}.${d.state.pos.beat}`
    : d.state.phase;

test("choices: a pick on a choice is saved as a guess is, and never counts as missed (104)", () => {
  // was learn-flow:2902
  const d = onChoice();
  assert.equal(spot(d), "Y1.0");
  assert.equal(answerKey(d.state), "Y1.0");
  const missed = [...d.state.missed];
  d.pick(1);
  assert.equal(d.state.beat.status, "done");
  assert.equal(d.state.progress["b-2"].answers["Y1.0"], "A token");
  assert.deepEqual(d.state.missed, missed, "no pick on a choice is missed");
  assert.ok(d.effects.some((e) => e.type === "save"));
  assert.deepEqual(
    snapshot(d.state).lessons["b-2"].answers,
    { "Y1.0": "A token" },
    "the pick is in the saved file",
  );
  // dropped: T-render fitsBoth
  // A right pick on a graded question is saved too.
  const w = driver({
    course: courseWith({ "b-2": DEMO_B2 }),
    saved: save({
      lessons: {
        "b-1": b1Done,
        "b-2": { step: "R1", beat: 0, warm: ["R1"] },
      },
    }),
  });
  w.open();
  assert.equal(spot(w), "R1.0");
  w.pick(0);
  assert.equal(w.state.progress["b-2"].answers["R1.0"], "`/status`");
});

test("choices: on and back pass over the beats whose when does not match, and a changed pick re-decides them (104)", () => {
  // was learn-flow:2922
  const d = onChoice();
  d.pick(1);
  d.cont();
  assert.equal(spot(d), "Y1.1");
  assert.equal(isLastBeat(d.state), false);
  d.markDone();
  assert.equal(spot(d), "Y1.3", "a token skips the key beat");
  assert.equal(isLastBeat(d.state), true);
  d.back();
  assert.equal(spot(d), "Y1.1", "back skips it too");
  d.back();
  assert.equal(spot(d), "Y1.0");
  // The choice opens again: a new pick replaces the saved one.
  d.pick(0);
  assert.equal(d.state.progress["b-2"].answers["Y1.0"], "An API key");
  d.cont();
  d.markDone();
  assert.equal(spot(d), "Y1.2", "a key shows the key beat");
  assert.equal(
    isLastBeat(d.state),
    true,
    "the token beat after it does not show",
  );
  d.markDone();
  assert.equal(
    stepOf(d.state).id,
    "C",
    "the step ends at its last beat that shows",
  );
  if (d.state.phase === "step-down") d.accept();
  assert.ok(d.state.progress["b-2"].done.includes("Y1"));
  d.back();
  assert.equal(
    spot(d),
    "Y1.2",
    "back from the next step lands on the last beat that shows",
  );
  // Before any pick, no beat with a when shows.
  const p = { answers: {} };
  const beats = parseLesson(CHOICE_B2, "b-2.md").steps.find(
    (x) => x.id === "Y1",
  ).beats;
  assert.deepEqual(
    beats.map((b) => beatShown(p, b)),
    [true, true, false, false],
  );
});

test("choices: a saved place on a beat that no longer shows resumes on the one before it (104)", () => {
  // was learn-flow:2954
  const d = onChoice({ beat: 3, answers: { "Y1.0": "An API key" } });
  assert.equal(spot(d), "Y1.2");
  const t = onChoice({ beat: 3, answers: { "Y1.0": "A token" } });
  assert.equal(spot(t), "Y1.3");
});

test("choices: a pick longer than the 200 characters the store keeps shows its beats before and after a restart (104)", () => {
  // was learn-flow:2961
  const long = `An API key ${"that lives in a secret store ".repeat(8)}`.trim();
  assert.ok(long.length > 200);
  const text = CHOICE_B2.replaceAll("An API key", long);
  const d = driver({
    course: courseWith({ "b-2": text }),
    saved: save({
      lessons: {
        "b-1": b1Done,
        "b-2": { done: ["W1"], step: "Y1", beat: 0 },
      },
    }),
  });
  d.open();
  d.pick(0);
  d.cont();
  d.markDone();
  assert.equal(spot(d), "Y1.2", "the key beat shows in this sitting");
  const again = driver({
    course: courseWith({ "b-2": text }),
    saved: snapshot(d.state),
  });
  again.open();
  assert.equal(spot(again), "Y1.2", "and after a restart");
});

// ---- git probes, head-moved and git-unchanged (ticket 105) ------------------
// The same, but entered from W1, so Y1's opening stamps what it compares with.
const intoY1 = (verify) => {
  const d = driver({
    course: courseWith({
      "b-2": DEMO_B2.replace(
        "- verify: check 0 fresh\n",
        `- verify: ${verify}\n`,
      ),
    }),
    saved: save({
      lessons: {
        "b-1": b1Done,
        "b-2": {
          warm: ["R1", "R2", "R3"],
          done: ["R1", "R2", "R3"],
          step: "W1",
          beat: 0,
        },
      },
    }),
  });
  d.open();
  d.send({
    type: "check",
    lesson: "b-2",
    items: [{ index: 0, text: "x", pass: true, hint: "" }],
  });
  d.cont();
  if (d.state.phase === "step-down") d.accept();
  if (!d.state.beat || stepOf(d.state).id !== "Y1")
    throw new Error(`intoY1: on ${d.state.phase}, not Y1`);
  return d;
};
// A probe's answer, as main sends it.
const probeResult = (name, args, pass, state, extra = {}) => ({
  type: "probe",
  name,
  args,
  pass,
  state,
  hint: pass ? "" : `No ${name} yet.`,
  evidence: pass ? `${name} found` : null,
  dir: FACTS.root,
  ...extra,
});
// The play reaches b-2's Check.
const atCheck = (s) => s.lesson === "b-2" && stepOf(s)?.id === "C";

test("probes: the verify line names a probe and its arguments; branch-ahead is always fresh; a bad one fails to parse (105)", () => {
  // was learn-flow:3002
  const v = (line) => beatOf(onReading(line).state);
  assert.deepEqual(v("probe worktrees 2").verify, {
    kind: "probe",
    name: "worktrees",
    args: ["2"],
  });
  assert.equal(
    v("probe worktrees 2").watching,
    "git worktree list",
    "the card watches what the probe reads",
  );
  assert.equal(
    v("probe worktrees 2\n- watching: the worktrees").watching,
    "the worktrees",
  );
  assert.deepEqual(v("probe branch-ahead docs-pass").verify, {
    kind: "probe",
    name: "branch-ahead",
    args: ["docs-pass"],
    fresh: true,
    since: null,
  });
  assert.deepEqual(
    v("probe merged docs-pass test-pass fresh since W1").verify,
    {
      kind: "probe",
      name: "merged",
      args: ["docs-pass", "test-pass"],
      fresh: true,
      since: "W1",
    },
  );
  assert.deepEqual(v("probe pushed").verify, {
    kind: "probe",
    name: "pushed",
    args: [],
  });
  assert.deepEqual(v("head-moved since W1").verify, {
    kind: "head-moved",
    since: "W1",
  });
  assert.deepEqual(v("git-unchanged").verify, {
    kind: "git-unchanged",
    since: null,
  });
  const bad = (line, error) =>
    assert.throws(
      () =>
        parseLesson(
          DEMO_B2.replace("- verify: check 0 fresh\n", `- verify: ${line}\n`),
          "b-2.md",
        ),
      error,
      line,
    );
  bad("probe nope", /unknown probe nope/);
  bad("probe worktrees", /probe worktrees takes <n>/);
  bad("probe gone ../x", /probe gone takes <path>, not \.\.\/x/);
  bad("probe pushed origin", /probe pushed takes no arguments/);
  bad("head-moved since later", /head-moved since a step id/);
  bad("git-unchanged fresh", /only a check, a file or a probe can be fresh/);
});

// spec: verify.value.probe
test("probes: the beat runs its probe in the work folder, on r too, and passes, fails or breaks as it answers (105)", () => {
  // was learn-flow:3021
  const d = onReading("probe worktrees 2");
  assert.deepEqual(d.effects.filter((e) => e.type === "probe").at(-1), {
    type: "probe",
    name: "worktrees",
    args: ["2"],
    dir: FACTS.root,
  });
  assert.deepEqual(watching(d.state), {
    probe: { name: "worktrees", args: ["2"] },
    dir: FACTS.root,
  });
  assert.equal(tierOf(d.state), "challenge", "a probe beat counts as checked");
  d.send(probeResult("worktrees", ["2"], false, "a"));
  assert.equal(
    d.state.beat.status,
    "waiting",
    "the first answer is where the learner starts",
  );
  d.run();
  assert.deepEqual(pending(d, "probe"), {
    type: "probe",
    asked: d.state.beat.asked,
    name: "worktrees",
    args: ["2"],
    dir: FACTS.root,
  });
  d.send(
    probeResult("worktrees", ["2"], false, "a", { asked: d.state.beat.asked }),
  );
  assert.deepEqual(
    [d.state.beat.status, d.state.beat.fail.hint],
    ["fail", "No worktrees yet."],
  );
  // dropped: T-render fitsBoth
  // Another probe's answer, or one from another folder, decides nothing.
  d.send(probeResult("gone", ["x"], true, "b"));
  d.send(probeResult("worktrees", ["2"], true, "b", { dir: "/elsewhere" }));
  assert.equal(d.state.beat.status, "fail");
  d.send(probeResult("worktrees", ["2"], true, "b"));
  assert.deepEqual(
    [d.state.beat.status, d.state.beat.evidence],
    ["done", "worktrees found"],
  );
  // dropped: T-render fitsBoth
  const broken = onReading("probe pushed");
  broken.send({
    type: "probe-error",
    message: "The probe could not run: git is not installed",
    dir: FACTS.root,
  });
  assert.deepEqual(
    [broken.state.beat.status, broken.state.beat.error],
    ["broken", "The probe could not run: git is not installed"],
  );
  playUntil(onReading("probe merged docs-pass"), atCheck);
});

// spec: verify.value.fresh
test("probes: a fresh probe stamps its state as its step opens, and passes only once that changed (105)", () => {
  // was learn-flow:3046
  const d = intoY1("probe branch-ahead docs-pass");
  assert.deepEqual(
    d.effects.find((e) => e.type === "stamp"),
    {
      type: "stamp",
      key: "Y1.0",
      probe: { name: "branch-ahead", args: ["docs-pass"] },
      dir: FACTS.root,
    },
  );
  d.send({ type: "stamp", key: "Y1.0", stamp: "sha-1", dir: FACTS.root });
  d.send(probeResult("branch-ahead", ["docs-pass"], true, "sha-1"));
  assert.deepEqual(
    [d.state.beat.status, d.state.beat.stale],
    ["waiting", true],
    "the branch is there, but has not moved",
  );
  d.send(probeResult("branch-ahead", ["docs-pass"], true, "sha-2"));
  assert.equal(d.state.beat.status, "done");
});

// spec: verify.value.head-moved
test("head-moved: HEAD another commit than when its step opened, with git status listing nothing (105)", () => {
  // was learn-flow:3056
  const d = intoY1("head-moved");
  assert.deepEqual(
    d.effects.find((e) => e.type === "stamp"),
    { type: "stamp", key: "Y1.0", git: "head", dir: FACTS.root },
  );
  assert.deepEqual(d.effects.filter((e) => e.type === "git").at(-1), {
    type: "git",
    dir: FACTS.root,
    head: true,
  });
  d.send({ type: "stamp", key: "Y1.0", stamp: "aaaaaaa1", dir: FACTS.root });
  // A result that doesn't say where HEAD is decides nothing.
  d.send({ type: "git", paths: [] });
  assert.equal(d.state.beat.status, "opening");
  d.send({ type: "git", paths: [], head: "aaaaaaa1" });
  assert.equal(d.state.beat.status, "waiting");
  d.run();
  d.send({
    type: "git",
    paths: [],
    head: "aaaaaaa1",
    asked: d.state.beat.asked,
  });
  assert.equal(d.state.beat.fail.hint, C.headSame(5));
  d.send({ type: "git", paths: ["src/a.js"], head: "bbbbbbb2" });
  assert.equal(d.state.beat.fail.hint, C.headDirty(1, "src/a.js", 0));
  // dropped: T-render fitsBoth
  d.send({ type: "git", paths: [], head: "bbbbbbb2" });
  assert.deepEqual(
    [d.state.beat.status, d.state.beat.evidence],
    ["done", C.headMoved("bbbbbbb")],
  );
  // dropped: T-render fitsBoth
  assert.equal(
    d.state.progress["b-2"].stamps["Y1.0"],
    "aaaaaaa1",
    "the stamp is saved",
  );
  playUntil(onReading("head-moved since W1"), atCheck);
});

// spec: verify.value.git-unchanged
test("git-unchanged: git status lists the same paths as when the step it names opened; that step stamps them (105)", () => {
  // was learn-flow:3079
  const text = DEMO_B2.replace(
    "- verify: check 0 fresh\n",
    "- verify: git-unchanged since W1\n",
  );
  const atW1 = driver({
    course: courseWith({ "b-2": text }),
    saved: save({
      lessons: {
        "b-1": b1Done,
        "b-2": { warm: ["R1"], step: "R1", beat: 0 },
      },
    }),
  });
  atW1.open();
  atW1.pick(0);
  const out = atW1.cont().effects;
  assert.equal(stepOf(atW1.state).id, "W1");
  assert.deepEqual(
    out.find((e) => e.type === "stamp"),
    { type: "stamp", key: "Y1.0", git: "status", dir: FACTS.root },
  );
  const d = onReading("git-unchanged since W1", {
    stamps: { "Y1.0": statusStamp(["notes.md"]) },
  });
  assert.deepEqual(
    watching(d.state),
    { git: true, dir: FACTS.root },
    "the whole tree, as git status shows it",
  );
  d.send({ type: "git", paths: ["notes.md", "src/a.js"] });
  assert.deepEqual(
    [d.state.beat.status, d.state.beat.fail.hint],
    ["fail", C.changedSince(4, 2, "notes.md, src/a.js", 0)],
    "a change is a not yet at once",
  );
  // dropped: T-render fitsBoth
  d.send({ type: "git", paths: ["notes.md"] });
  assert.deepEqual(
    [d.state.beat.status, d.state.beat.evidence],
    ["done", C.unchanged(4)],
  );
  // dropped: T-render fitsBoth
  assert.equal(
    statusStamp(["b", "a", "a"]),
    statusStamp(["a", "b"]),
    "the stamp is the same for the same paths",
  );
  playUntil(onReading("git-unchanged"), atCheck);
});

// A file whose name Claude picks: the beat names a glob, and the card shows
// the file it matched (106).
const GLOB_B2 = DEMO_B2.replace(
  "- verify: check 0 fresh\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt",
  "- verify: file .practice/plans/*.txt fresh",
);

// spec: verify.value.file
test("file globs: a file check takes a glob in its last part, and shows the path it matched (106)", () => {
  // was learn-flow:3103
  const beat = parseLesson(GLOB_B2, "demo").steps[1].beats[0];
  assert.deepEqual(beat.verify, {
    kind: "file",
    path: ".practice/plans/*.txt",
    fresh: true,
    since: null,
  });
  assert.equal(beat.evidence, ".practice/plans/*.txt");
  assert.throws(
    () =>
      parseLesson(
        GLOB_B2.replace(".practice/plans/*.txt", ".practice/*/plan.txt"),
        "demo",
      ),
    /a glob goes in the file name only/,
  );
  const d = driver({
    course: courseWith({ "b-2": GLOB_B2 }),
    saved: save({
      lessons: {
        "b-1": b1Done,
        "b-2": {
          warm: ["R1", "R2"],
          done: ["R1", "R2", "W1"],
          step: "Y1",
          beat: 0,
        },
      },
    }),
  });
  assert.ok(
    d
      .open()
      .effects.some(
        (e) => e.type === "file" && e.path === ".practice/plans/*.txt",
      ),
  );
  d.send({ type: "stamp", key: "Y1.0", stamp: "" });
  d.run();
  d.send({
    type: "file",
    path: ".practice/plans/*.txt",
    read: null,
    stamp: "",
    found: null,
    asked: d.state.beat.asked,
  });
  assert.equal(d.state.beat.status, "fail");
  assert.equal(d.state.beat.fail.hint, C.noMatch(".practice/plans/*.txt"));
  d.send({
    type: "file",
    path: ".practice/plans/*.txt",
    read: Buffer.from("src/config.js\n"),
    stamp: "C",
    found: ".practice/plans/review-plan.txt",
  });
  assert.equal(d.state.beat.status, "done");
  assert.equal(d.state.beat.found, ".practice/plans/review-plan.txt");
  // dropped: T-render the card shows review-plan.txt and not the glob, fitsBoth
});

test("a lesson done in the app whose check now fails: the map keeps it done, and plain output says a later lesson may have changed it (106)", () => {
  // was learn-flow:3126
  const b1 = course.find((l) => l.id === "b-1");
  const failing = {
    items: b1.items.map((text, index) => ({
      index,
      text,
      pass: index !== 0,
      hint: "",
    })),
  };
  // dropped: T-plain plainProgress's C.plainChanged line (rehome)
  const d = driver({ course, saved: save({ lessons: { "b-1": b1Done } }) });
  // dropped: T-view m opens the map
  d.send({ type: "check", lesson: "b-1", ...failing });
  assert.equal(
    d.state.progress["b-1"].complete,
    true,
    "a failing check never takes back a finished lesson",
  );
  // dropped: T-render the map's B1 row keeps C.mapDone
});

// ---- recall while a long run works (ticket 150) ------------------------------
// WAIT_B2's long wait, with `extra` saved: the learner's missed skills and
// the lesson's warm-ups, as a play that chose them saved them.
const onWaitWith = ({ missed = [], warm = [] } = {}, text = WAIT_B2) => {
  const d = driver({
    course: courseWith({ "b-2": text }),
    saved: save({
      missed,
      lessons: {
        "b-1": b1Done,
        "b-2": { done: ["W1", "Y1"], step: "Y2", beat: 1, warm },
      },
    }),
  });
  d.open();
  if (!d.state.beat || stepOf(d.state).id !== "Y2" || d.state.pos.beat !== 1)
    throw new Error(`onWaitWith: on ${d.state.phase}, not Y2 beat 1`);
  return d;
};

// spec: warmups.while-runs
test("recall while a long run works: one unshown warm-up, missed skills first, the same every time (150)", () => {
  // was learn-flow:3155
  // Nothing missed and no warm-up shown: the pool's first question with
  // options, R1 (R2 is typed from memory, which the box never asks).
  const d = onWaitWith();
  assert.equal(whileRunsOf(d.state).step.id, "R1");
  // dropped: T-render the card's C.whileItRuns line and R1's question, fitsBoth
  // R1 shown as the lesson's warm-up, and exit and status missed: R3, the
  // unshown one on a missed skill, comes before nothing else.
  const m = onWaitWith({ missed: ["status", "exit"], warm: ["R1"] });
  assert.equal(whileRunsOf(m.state).step.id, "R3");
  assert.equal(
    onWaitWith({ missed: ["status", "exit"], warm: ["R1"] }).state.beat
      .whileRuns.id,
    "R3",
    "the same choice every time",
  );
  // A missed skill wins over the file order.
  assert.equal(
    whileRunsOf(onWaitWith({ missed: ["exit"] }).state).step.id,
    "R3",
  );
  // Every question with options shown: no box.
  const none = onWaitWith(
    { missed: [], warm: ["R1"] },
    WAIT_B2.replace(/### R3[\s\S]*?(?=## steps)/, ""),
  );
  assert.equal(whileRunsOf(none.state), null);
  // dropped: T-render no C.whileItRuns line
  // A choice (104) has no right answer to recall: the box passes it by.
  const CHOICE_R1 = WAIT_B2.replace(
    '- right: "`/status`"\n- wrong: "`/usage`"\n- because: "Usage is something else."',
    '- option: "`/status`"\n- option: "`/usage`"',
  );
  assert.notEqual(CHOICE_R1, WAIT_B2);
  const choice = onWaitWith({}, CHOICE_R1);
  assert.equal(whileRunsOf(choice.state).step.id, "R3");
  // A beat with no wait never offers one.
  const plain = onWaitB2("Y2", 1, WAIT_B2.replace("- wait: long\n", ""));
  assert.equal(whileRunsOf(plain.state), null);
  // dropped: T-render no C.whileItRuns line
});

// spec: warmups.while-runs
test("recall while a long run works: never scored, still, and dropped when the result lands (150)", () => {
  // was learn-flow:3188
  const d = onWaitWith({ missed: ["exit"] });
  d.send({ type: "file", path: ".practice/run.txt", read: null, stamp: "A" });
  const scored = (s) =>
    JSON.stringify([
      s.missed,
      s.eased,
      s.progress["b-2"].recalled,
      s.progress["b-2"].answers,
      s.missedNow,
    ]);
  const before = scored(d.state);
  d.tick(60_000);
  // dropped: T-motion pipGates().ambient, phases().spinner, render frames
  // A wrong answer: shown, never scored.
  d.waitAnswer(1);
  assert.equal(d.state.beat.whileRuns.answer, 1);
  assert.equal(
    d.state.beat.status,
    "waiting",
    "the beat still waits on the run",
  );
  assert.equal(
    scored(d.state),
    before,
    "missed, eased and recalled are untouched",
  );
  assert.equal(whileRunsOpen(d.state), false);
  // dropped: T-render the answer stays on the card, fitsBoth
  // dropped: T-motion pipGates().ambient once answered
  // A right answer is not scored either: a skill it recalls stays missed.
  const r = onWaitWith({ missed: ["exit"] });
  r.waitAnswer(0);
  assert.deepEqual(
    [r.state.missed, r.state.eased, r.state.progress["b-2"].recalled],
    [["exit"], [], []],
  );
  // The result lands with a question still open: it goes quietly, and the
  // green result never waited for it.
  const open = onWaitWith({ missed: ["exit"] });
  assert.equal(whileRunsOpen(open.state), true);
  open.send({
    type: "file",
    path: ".practice/run.txt",
    read: null,
    stamp: "A",
  });
  open.send({
    type: "file",
    path: ".practice/run.txt",
    read: Buffer.from("ok"),
    stamp: "B",
  });
  assert.equal(open.state.beat.status, "done");
  assert.equal(whileRunsOpen(open.state), false);
  // dropped: T-render no C.whileItRuns line; T-toast no toast
  assert.deepEqual([open.state.missed, open.state.eased], [["exit"], []]);
  // An answer after the result is no answer.
  open.refused("waitQuestion.answer", { option: 0 });
  assert.equal(open.state.beat.whileRuns.answer, null);
});

// ---- r27 engine fixes (findings/r27/TRIAGE.md section 3) ---------------------
// DEMO_B2 with W1 reading a log a session writes, its command a cat of that
// log, as i-2's W4.3 does.
const LOG_B2 = DEMO_B2.replace(
  '- verify: check 0\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt\n- run: "git status --porcelain > .practice/b-2-before.txt"',
  '- verify: match .practice/log.txt ^include\\s\n- run: "cat .practice/log.txt"',
);
const onB2At = (text, extra = {}) => {
  const d = driver({
    course: courseWith({ "b-2": text }),
    saved: save({
      lessons: {
        "b-1": b1Done,
        "b-2": {
          warm: ["R1", "R2", "R3"],
          done: ["R1", "R2", "R3"],
          step: "W1",
          beat: 0,
          ...extra,
        },
      },
    }),
  });
  d.open();
  if (!d.state.beat || stepOf(d.state).id !== "W1" || d.state.pos.beat !== 0)
    throw new Error(`onB2At: on ${d.state.phase}, not W1 beat 0`);
  return d;
};
// The log as main reads it: null when it isn't there.
const sendLog = (d, text, stamp) =>
  d.send({
    type: "file",
    path: ".practice/log.txt",
    read: text === null ? null : Buffer.from(text),
    stamp,
  });

// spec: verify.value.match
// spec: verify.value.no-match
test("r27 E2: a matched line too long for its row ends in …, and a hint that quotes it holds no escape", () => {
  // was learn-flow:3246
  const line =
    "- Use `node:test` and `node:assert/strict`; no other test library, and no snapshot files.";
  assert.ok(line.length > 60);
  const match = onReading("match notes.md node:test");
  const evidence = tryNow(match, "notes.md", `${line}\n`).evidence;
  assert.equal(evidence, `${line.slice(0, 59)}…`);
  assert.equal(width(evidence), 60);
  const no = onReading("no-match notes.md node:test");
  const hint = tryNow(no, "notes.md", `${line}\n`).fail.hint;
  assert.equal(hint, `notes.md still has: ${line.slice(0, 59)}…`);
  assert.ok(
    !hint.includes("\u001b"),
    "cut's reset goes: the row sits inside a sentence",
  );
  const fits = "x".repeat(60);
  assert.equal(
    tryNow(onReading("match notes.md x"), "notes.md", `${fits}\n`).evidence,
    fits,
    "a row that fits stays whole",
  );
});

// spec: verify.value.self
// spec: verify.beat.self
// spec: verify.value.none
test("r27 E3: only space ticks a self beat, so the enter that goes on from a step ticks nothing unread; enter still goes on from a none beat", () => {
  // was learn-flow:3261
  const text = DEMO_B2.replace(
    "- where: shell\n- beat: do\n- verify: check 0\n",
    '- where: shell\n- beat: do\n- verify: self\n- goal: "Read the log."\n- beat: do\n- verify: none\n- goal: "Look around."\n- beat: do\n- verify: check 0\n',
  );
  const d = onB2At(text);
  assert.equal(beatOf(d.state).verify.kind, "self");
  // The enter that goes on from a step: no step.continue on an unticked beat.
  d.refused("step.continue");
  assert.deepEqual(
    [stepOf(d.state).id, d.state.pos.beat, d.state.beat.status],
    ["W1", 0, "waiting"],
    "step.continue leaves a self beat unticked",
  );
  d.markDone();
  assert.deepEqual(
    [d.state.pos.beat, beatOf(d.state).verify.kind],
    [1, "none"],
    "step.markDone ticks it",
  );
  // Enter on a none beat with no done-label is step.markDone.
  d.markDone();
  assert.deepEqual(
    [stepOf(d.state).id, d.state.pos.beat],
    ["W1", 2],
    "step.markDone goes on from a none beat",
  );
});

test("r27 E4: a beat done before it opened shows no tick beside its command; one done while it was open does", () => {
  // was learn-flow:3273
  const already = onB2At(LOG_B2);
  sendLog(already, "include CLAUDE.md\n", "A");
  assert.equal(already.state.beat.status, "already");
  // dropped: T-render the cat row shows no tick
  const done = onB2At(LOG_B2);
  sendLog(done, null, "A");
  sendLog(done, "include CLAUDE.md\n", "B");
  assert.equal(done.state.beat.status, "done");
  // dropped: T-render the cat row ends in a tick
});

test("r27 E5: an eased step says so on its first beat when that beat was already done as it opened, and not once a beat is done", () => {
  // was learn-flow:3286
  const already = onB2At(LOG_B2, { easedSteps: { W1: true } });
  assert.equal(already.state.beat.eased, true);
  // dropped: T-render C.eased while it waits
  sendLog(already, "include CLAUDE.md\n", "A");
  assert.equal(already.state.beat.status, "already");
  // dropped: T-render C.eased on an already beat
  const done = onB2At(LOG_B2, { easedSteps: { W1: true } });
  sendLog(done, null, "A");
  sendLog(done, "include CLAUDE.md\n", "B");
  assert.equal(done.state.beat.status, "done");
  // dropped: T-render no C.eased once done
});

test('r27 E6: a watch that sees an earlier step\'s state says it turns green once that changes, not "make it again"', () => {
  // was learn-flow:3300
  // dropped: T-render C.staleWatch's words
  const d = intoY1("probe branch-ahead docs-pass");
  d.send({ type: "stamp", key: "Y1.0", stamp: "sha-1", dir: FACTS.root });
  d.send(probeResult("branch-ahead", ["docs-pass"], true, "sha-1"));
  assert.deepEqual(
    [d.state.beat.status, d.state.beat.stale],
    ["waiting", true],
  );
  // dropped: T-render the card's stale line, and no "make it again"
});

test("r27 E9: a beat whose check includes a slow item says to press r from the start, never \"I'll turn green the moment it's right\"", () => {
  // was learn-flow:3326
  const d = onB2At(
    DEMO_B2.replace(
      "- where: shell\n- beat: do\n- verify: check 0\n",
      "- where: shell\n- beat: do\n- verify: check 0 2\n",
    ),
  );
  // b-2's item 2 is slow; item 0, which runs on every poll, fails.
  d.send({
    type: "check",
    lesson: "b-2",
    items: [
      { index: 0, text: "x", pass: false, hint: "not yet" },
      { index: 2, text: "y", pass: false, slow: true, hint: "" },
    ],
  });
  assert.deepEqual(
    [d.state.beat.status, d.state.beat.slowWait],
    ["waiting", false],
  );
  // dropped: T-render C.slowWait on the card, not the watch line
  // A beat with no slow item still watches.
  const fast = onB2At(DEMO_B2);
  fast.send({
    type: "check",
    lesson: "b-2",
    items: [{ index: 0, text: "x", pass: false, hint: "not yet" }],
  });
  assert.equal(fast.state.beat.status, "waiting");
  // dropped: T-render the watch line, not C.slowWait
});

// spec: verify.value.json
test("r27 E12: a json verify's evidence names its key; a matched line drops a trailing comma", () => {
  // was learn-flow:3361
  const settings = Buffer.from(
    '{\n  "sandbox": {"enabled": true},\n  "permissions": {"deny": [\n    "Read(./.env)",\n    "Read(./.env.*)"\n  ]}\n}\n',
  );
  assert.deepEqual(
    judge(
      {
        kind: "json",
        path: ".claude/settings.json",
        key: "sandbox.enabled",
        value: "true",
      },
      settings,
    ),
    { pass: true, evidence: "sandbox.enabled = true" },
  );
  assert.deepEqual(
    judge(
      {
        kind: "json",
        path: ".claude/settings.json",
        key: "permissions.deny.0",
        value: null,
      },
      settings,
    ),
    { pass: true, evidence: "permissions.deny.0 = Read(./.env)" },
  );
  assert.deepEqual(
    judge(
      {
        kind: "match",
        path: ".claude/settings.json",
        regex: "Read\\(\\./\\.env\\)",
      },
      settings,
    ),
    { pass: true, evidence: '"Read(./.env)"' },
  );
  // A line with no comma at its end keeps what it has.
  assert.deepEqual(
    judge(
      { kind: "match", path: ".claude/settings.json", regex: "env\\.\\*" },
      settings,
    ),
    { pass: true, evidence: '"Read(./.env.*)"' },
  );
});

test("r27 E14: a code span wider than the line breaks at a space where one fits, and mid-word where none does or where the space costs a row", () => {
  // was learn-flow:3386
  const cmd =
    "claude plugin install claude-code-setup@claude-plugins-official --scope project";
  const words = (lines) => lines.map((l) => l.map((r) => r.text).join(""));
  const lines = words(
    wrapRuns(
      inline(
        `I installed the plugin with \`${cmd}\`, as a teammate does after pulling the settings.`,
      ),
      72,
    ),
  );
  assert.ok(
    lines.every((l) => width(l) <= 72),
    lines.join("\n"),
  );
  assert.ok(
    lines.some((l) => l.endsWith("--scope")) &&
      lines.some((l) => l.startsWith("project,")),
    lines.join("\n"),
  );
  assert.ok(!lines.some((l) => /pr$/.test(l)), lines.join("\n"));
  // No space in reach: the old split, at the line's width.
  assert.deepEqual(
    words(wrapRuns([{ text: "a".repeat(25), code: true }], 10)),
    ["a".repeat(10), "a".repeat(10), "a".repeat(5)],
  );
  // A break at the space would cost a row a 60x20 card can't spare: the old split.
  assert.deepEqual(
    words(wrapRuns([{ text: "a bcdefghijklmnopqrs", code: true }], 10)),
    ["a bcdefghi", "jklmnopqrs"],
  );
  // dropped: T-render the i-capstone self-check's screen at 100 columns
});

test("r27 E16: a fresh push beat that sees an earlier push says everything is pushed and it waits for the next push", () => {
  // was learn-flow:3420
  // dropped: T-render C.stalePush's words
  const d = intoY1("probe pushed fresh");
  d.send({ type: "stamp", key: "Y1.0", stamp: "pushed-1", dir: FACTS.root });
  d.send(probeResult("pushed", [], true, "pushed-1"));
  assert.deepEqual(
    [d.state.beat.status, d.state.beat.stale],
    ["waiting", true],
  );
  // dropped: T-render the push line, not the earlier-step one
  // Another stale probe keeps its line.
  const other = intoY1("probe branch-ahead docs-pass");
  other.send({ type: "stamp", key: "Y1.0", stamp: "sha-1", dir: FACTS.root });
  other.send(probeResult("branch-ahead", ["docs-pass"], true, "sha-1"));
  assert.deepEqual(
    [other.state.beat.status, other.state.beat.stale],
    ["waiting", true],
  );
  // dropped: T-render the earlier-step line
});

// Ticket 27's verify pass (pattern E): a beat with a done-label waits for
// the learner's own word, whatever it verifies. The terminal's enter goes on
// from a step, so it must not give that word: a git-clean beat would look at
// the tree before the learner ran git status. Only session.ended or
// step.markDone answers it; enter is step.markDone only on a none beat with
// nothing to confirm.
// spec: verify.value.git-clean
test("r27 E3, done-labels: only space answers a beat with a done-label, a git-clean beat or a none beat; enter still goes on from a none beat without one", () => {
  // was learn-flow:3444
  const text = DEMO_B2.replace(
    "- where: shell\n- beat: do\n- verify: check 0\n",
    '- where: shell\n- beat: do\n- verify: self\n- goal: "Read the plan."\n- beat: do\n- verify: git-clean\n- done-label: it says nothing to commit\n- run: "git status"\n- beat: do\n- verify: none\n- done-label: it\'s closed\n- goal: "Close the dialog."\n- beat: do\n- verify: none\n- goal: "Look around."\n- beat: do\n- verify: check 0\n',
  );
  const d = onB2At(text);
  d.markDone();
  assert.deepEqual(
    [d.state.pos.beat, beatOf(d.state).verify.kind, beatOf(d.state).doneLabel],
    [1, "git-clean", "it says nothing to commit"],
  );
  // The git-clean beat: neither going on nor a tick ends it or asks git.
  let n = d.effects.length;
  d.refused("step.continue");
  d.refused("step.markDone");
  assert.ok(!d.state.beat.ended, "no word on a done-label beat");
  assert.deepEqual(
    d.effects.slice(n).filter((e) => e.type === "git"),
    [],
    "no look at the tree",
  );
  d.send({ type: "git", paths: [] });
  assert.deepEqual(
    [d.state.pos.beat, d.state.beat.status],
    [1, "waiting"],
    "a clean tree decides nothing before the learner says so",
  );
  // dropped: T-render the key bar offers space
  n = d.effects.length;
  d.ended();
  assert.ok(d.state.beat.ended);
  assert.deepEqual(
    d.effects.slice(n).filter((e) => e.type === "git").length,
    1,
    "session.ended asks git",
  );
  d.send({ type: "git", paths: [] });
  assert.equal(d.state.beat.status, "done");
  d.cont();
  // A none beat with a done-label: the same.
  assert.deepEqual(
    [d.state.pos.beat, beatOf(d.state).verify.kind],
    [2, "none"],
  );
  // dropped: T-render the key bar offers space
  // dropped: T-input enter sends no step.markDone on a none beat with a done-label (flow's key map)
  d.refused("step.continue");
  assert.deepEqual(
    [d.state.pos.beat, d.state.beat.status],
    [2, "waiting"],
    "step.continue leaves a none beat with a done-label unticked",
  );
  d.markDone();
  assert.equal(d.state.pos.beat, 3, "step.markDone ticks it");
  // A none beat with nothing to confirm: enter is step.markDone, and goes on.
  d.markDone();
  assert.equal(
    d.state.pos.beat,
    4,
    "step.markDone goes on from a none beat without a done-label",
  );
});
