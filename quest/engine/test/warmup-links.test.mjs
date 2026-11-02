// Row 120 (ticket 254): a relative link inside an index warm-up's quoted
// `because` resolves against the index page's folder, docs/<level>/, so
// `01-first-skill.md` opens docs/beginner/01-first-skill.md, not a file at
// the repository root.
import { test } from "vitest";
import assert from "node:assert/strict";
import { course, driver, finished, save, stepOf } from "./drive.mjs";
import { project } from "../src/index.ts";

const lesson = (id) => course.find((l) => l.id === id);

// b-2's warm-up R2, rehomed onto the Beginner index, with a relative link
// in a wrong answer's because and in its reveal.
function indexWarmup() {
  const b2 = lesson("b-2");
  const content = structuredClone(b2.content);
  const warm = content.warmup.find((w) => w.id === "R2");
  warm.from = "beginner-index";
  const beat = warm.beats[0];
  const wrong = beat.options.findIndex((o) => o.kind !== "right");
  beat.options[wrong].because =
    "Read [the first lesson](01-first-skill.md#why) and [the guide](../README.md) first.";
  beat.reveal = "See [the first lesson](./01-first-skill.md).";
  const right = beat.options.findIndex((o) => o.kind === "right");
  return {
    course: course.map((l) => (l.id === "b-2" ? { ...l, content } : l)),
    wrong,
    right,
  };
}

test("a relative link in an index warm-up's quoted because resolves against docs/<level>/", () => {
  const { course: rehomed, wrong, right } = indexWarmup();
  const d = driver({
    course: rehomed,
    saved: save({
      missed: ["status"],
      lessons: { "b-1": finished(lesson("b-1")) },
    }),
  });
  d.open("b-2");
  d.start();
  assert.equal(stepOf(d.state).id, "R2");
  d.pick(wrong);
  const beat = project(d.state).lesson.beat;
  const expected =
    "Read [the first lesson](docs/beginner/01-first-skill.md#why) and [the guide](docs/README.md) first.";
  assert.equal(beat.answer.because, expected);
  assert.equal(beat.options[wrong].because, expected);
  d.pick(right);
  assert.equal(
    project(d.state).lesson.beat.answer.reveal,
    "See [the first lesson](docs/beginner/01-first-skill.md).",
  );
});
