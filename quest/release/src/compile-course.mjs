import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileCourse, generateCheckIndex } from "../../engine/src/content.ts";
import { lessons } from "../../../practice-template/checks/lessons/index.mjs";
import { PROBES, probeError } from "../../host/src/probes.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const manifest = JSON.parse(
  readFileSync(join(root, "course/manifest.json"), "utf8"),
);
const legacy = JSON.parse(
  readFileSync(join(root, "course/legacy-fingerprints.json"), "utf8"),
);
const stepFiles = Object.fromEntries(
  manifest.lessons.map((lesson) => [
    lesson.steps,
    readFileSync(join(root, lesson.steps), "utf8"),
  ]),
);
const pages = Object.fromEntries(
  [
    ...manifest.lessons.map((lesson) => lesson.page),
    ...manifest.levels.map((level) => level.index),
  ].map((page) => [page, readFileSync(join(root, page), "utf8")]),
);
const course = compileCourse(manifest, stepFiles, pages, {
  lessons,
  probes: { PROBES, probeError },
  legacy,
});
const output = join(root, "quest/engine/dist/course.json");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(course, null, 2)}\n`);
writeFileSync(
  join(root, "practice-template/checks/lessons/index.mjs"),
  generateCheckIndex(manifest),
);
console.log(
  `Compiled ${course.lessons.length} Lessons to quest/engine/dist/course.json`,
);
