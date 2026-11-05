// Row 120 (tickets 254 and 326): a relative link inside an index warm-up's
// quoted `because` is the index page's, so the compile step resolves it
// against docs/<level>/: `02-...md` opens docs/beginner/02-...md, not a file
// at the repository root, and the app shows it as compiled.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import assert from "node:assert/strict";
import { course, driver, finished, save, stepOf } from "./drive.mjs";
import { guideIndex } from "../../release/src/guide-index.mjs";
import { parseManifest, resolveLinks } from "../src/content.ts";
import { project } from "../src/index.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const manifest = parseManifest(
  JSON.parse(readFileSync(`${root}course/manifest.json`, "utf8")),
);
const guide = guideIndex(root);
const lesson = (id) => course.find((l) => l.id === id);

// b-2's warm-up R2, rehomed onto the Beginner index, with relative links in
// a wrong answer's because and in its reveal, resolved as compileCourse does.
function indexWarmup() {
  const b2 = lesson("b-2");
  const content = structuredClone(b2.content);
  const warm = content.warmup.find((w) => w.id === "R2");
  warm.from = "beginner-index";
  const beat = warm.beats[0];
  const wrong = beat.options.findIndex((o) => o.kind !== "right");
  beat.options[wrong].because =
    "Read [the lesson](02-permission-modes-and-plan-mode.md#worked-example) and [the next Level](../intermediate/README.md) first.";
  beat.reveal =
    "See [the lesson](./03-first-change.md) and [this page](#beginner).";
  const right = beat.options.findIndex((o) => o.kind === "right");
  const resolved = resolveLinks(content, {
    file: "course/steps/b-2.md",
    text: "",
    page: "docs/beginner/02-permission-modes-and-plan-mode.md",
    manifest,
    guide,
  });
  return {
    course: course.map((l) =>
      l.id === "b-2" ? { ...l, content: { ...l.content, ...resolved } } : l,
    ),
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
    "Read [the lesson](docs/beginner/02-permission-modes-and-plan-mode.md#worked-example) and [the next Level](docs/intermediate/README.md) first.";
  assert.equal(beat.answer.because, expected);
  assert.equal(beat.options[wrong].because, expected);
  d.pick(right);
  assert.equal(
    project(d.state).lesson.beat.answer.reveal,
    "See [the lesson](docs/beginner/03-first-change.md) and [this page](docs/beginner/README.md#beginner).",
  );
});
