// The hint ladders against real failures (moved from the Checks' tests in
// ticket 210: learn-ladders' rule and learn-check-says' engine half). Every
// way a lesson's check can fail is produced from a practice copy by a
// scenario in practice-template/checks/test/ladders/<id>.mjs. Each FAIL
// message gets one narrow question of its own, the first hint a Learner
// sees after "Not yet"; and at every check beat that checks its item, a
// resumed play reaches the "The check says:" rung with that message.
import { test } from "vitest";
import assert from "node:assert/strict";
import { chmodSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLesson } from "../src/course.mjs";
import { lessons } from "../../../practice-template/checks/lessons/index.mjs";
import { openRepo } from "../../../practice-template/checks/repo.mjs";
import {
  commit,
  repo,
  withRepo,
  write,
} from "../../../practice-template/checks/test/helpers.mjs";
import {
  driver,
  finishedBefore,
  liveCourse,
  rungsOf,
  stepOf,
} from "./drive.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const manifest = JSON.parse(
  readFileSync(join(root, "course/manifest.json"), "utf8"),
);

// The places an item's check can return something other than a pass.
const failReturns = (check) =>
  (check.toString().match(/\breturn\s+(?!true\b)/g) ?? []).length;

// What the scenario's practice copy makes the item's check return.
function failure(id, sc) {
  return withRepo(
    () => repo(),
    (dir) => {
      if (sc.files) write(dir, sc.files);
      if (sc.setup) sc.setup(dir, { write, commit });
      if (sc.command) {
        write(dir, { "bin/claude": sc.command });
        chmodSync(join(dir, "bin/claude"), 0o755);
      }
      const previous = process.env.PATH;
      try {
        if (sc.path) process.env.PATH = join(dir, sc.path);
        return lessons[id].items[sc.item].check(openRepo(dir));
      } finally {
        if (previous === undefined) delete process.env.PATH;
        else process.env.PATH = previous;
      }
    },
  );
}

// A save on the check beat, resumed, failing with `hint`: the hint ladder
// climbed until its "The check says:" rung opens, or 8 rungs pass.
function climbToCheck(lesson, step, index, targets, sc, hint) {
  const d = driver({
    course: liveCourse,
    saved: {
      format: 1,
      welcomed: true,
      folders: { [lesson.level]: "/work/project", [lesson.id]: "/work/copy" },
      lessons: {
        ...finishedBefore(lesson.id, liveCourse),
        [lesson.id]: {
          step: step.id,
          beat: index,
          warm: [],
          levels: ["hinted", "challenge"],
        },
      },
    },
  });
  d.open(lesson.id);
  assert.equal(stepOf(d.state).id, step.id, "resume reaches the check step");
  assert.equal(d.state.pos.beat, index, "resume reaches the check beat");
  const items = targets.map((i) => ({
    index: i,
    text: lesson.items[i],
    pass: i !== sc.item,
    hint: i === sc.item ? hint : "",
  }));
  const result = {
    type: "check",
    lesson: lesson.id,
    items,
    path: step.beats[index].evidence ?? null,
    stamp: "a",
  };
  d.send(result);
  d.run();
  d.send({ ...result, asked: d.state.beat.asked });
  for (
    let n = 0;
    n < 8 && rungsOf(d.state)[d.state.beat.rung]?.kind !== "check";
    n++
  )
    d.hint();
  return rungsOf(d.state)[d.state.beat.rung];
}

for (const { id, steps } of manifest.lessons) {
  test(
    `${id}: every FAIL message has its own first hint, and real failures reach "The check says:" at every check beat`,
    { timeout: 1_800_000 },
    async () => {
      // The step file, and the template's learn/lessons copy that loadCourse
      // still parses for a Learner's copy.
      const sources = [steps, `practice-template/learn/lessons/${id}.md`].map(
        (file) => ({
          file,
          content: parseLesson(readFileSync(join(root, file), "utf8"), file),
        }),
      );
      const { scenarios } = await import(
        `../../../practice-template/checks/test/ladders/${id}.mjs`
      );
      // Each scenario runs once.
      const hints = new Map(scenarios.map((sc) => [sc, failure(id, sc)]));
      for (const [sc, hint] of hints)
        assert.equal(
          typeof hint,
          "string",
          `${id} item ${sc.item}, ${sc.name}: the check passed`,
        );

      // Every FAIL message has its own first hint, in each source.
      for (const { file, content } of sources)
        for (const [index, item] of lessons[id].items.entries()) {
          const ladder = content.ladder.find((l) => l.item === item.text);
          assert.ok(ladder, `${file}: no ladder for "${item.text}"`);
          for (const n of ladder.narrow)
            assert.match(
              n.question,
              /\?$/,
              `${file}: "${n.question}" is a question`,
            );
          const mine = scenarios.filter((x) => x.item === index);
          assert.ok(
            mine.length >= failReturns(item.check),
            `${id} item ${index}: ${mine.length} scenarios for ${failReturns(item.check)} ways to fail`,
          );
          for (const sc of mine) {
            const hint = hints.get(sc);
            const matched = ladder.narrow.filter((n) => hint.includes(n.part));
            assert.equal(
              matched.length,
              1,
              `${file} item ${index}, ${sc.name}: ${matched.length} narrow questions for: ${hint}`,
            );
          }
        }

      // Real failures at every check beat that checks their item.
      const lesson = liveCourse.find((l) => l.id === id);
      const checkBeats = lesson.content.steps.flatMap((step) =>
        step.beats.flatMap((beat, index) =>
          beat.verify.kind === "check" ? [{ step, beat, index }] : [],
        ),
      );
      assert.ok(checkBeats.length, `${id}: the lesson has check beats`);
      const covered = new Set();
      for (const { step, beat, index } of checkBeats) {
        const targets = beat.verify.all
          ? lesson.items.map((_, i) => i)
          : beat.verify.items;
        const candidates = scenarios.filter((sc) => targets.includes(sc.item));
        assert.ok(
          candidates.length,
          `${id} ${step.id}.${index}: no real failure scenarios`,
        );
        for (const sc of candidates) {
          covered.add(sc);
          const rung = climbToCheck(
            lesson,
            step,
            index,
            targets,
            sc,
            hints.get(sc),
          );
          assert.equal(
            rung?.kind,
            "check",
            `${id} ${step.id}.${index}, ${sc.name}: the real failure rung opens`,
          );
        }
      }
      assert.equal(
        covered.size,
        scenarios.length,
        `${id}: every real failure scenario reaches a check beat`,
      );
    },
  );
}
