// A real Terminal app save (ticket 213's mid-lesson fixture, from the
// template commit 0e90e55) against the course the server really loads: the
// compiled course.json through courseFrom (server/src/main.ts), which carries
// the legacy fingerprints from course/legacy-fingerprints.json (ticket 256).
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadState } from "../src/store.ts";
import { project } from "../src/engine.ts";
import { PROBES, probeError } from "../src/probes.ts";
import { courseFrom } from "../../engine/src/course.ts";
import { compileCourse, fingerprint } from "../../engine/src/content.ts";
import { lessons } from "../../../practice-template/checks/lessons/index.mjs";
import { fakeHost } from "./scripted.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const data = JSON.parse(read("course/legacy-fingerprints.json"));
const ORACLE = JSON.parse(
  readFileSync(
    new URL("./fixtures/terminal-saves/oracle.json", import.meta.url),
    "utf8",
  ),
)["mid-lesson"];

// The fixture, loaded by the real store from a temporary copy's `.practice/`.
function load() {
  const dir = mkdtempSync(join(tmpdir(), "legacy-save-"));
  try {
    mkdirSync(join(dir, ".practice"));
    writeFileSync(
      join(dir, ".practice", "learn.json"),
      readFileSync(
        new URL("./fixtures/terminal-saves/mid-lesson.json", import.meta.url),
        "utf8",
      ).replaceAll("@WORK@", join(dir, "work").replaceAll("\\", "\\\\")),
    );
    return loadState(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// The course as compiled with the given legacy fingerprints.
function compiled(legacy) {
  const manifest = JSON.parse(read("course/manifest.json"));
  const files = (paths) =>
    Object.fromEntries(paths.map((path) => [path, read(path)]));
  return courseFrom(
    compileCourse(
      manifest,
      files(manifest.lessons.map((l) => l.steps)),
      files([
        ...manifest.lessons.map((l) => l.page),
        ...manifest.levels.map((l) => l.index),
      ]),
      { lessons, probes: { PROBES, probeError }, legacy },
    ),
  );
}

test("a Terminal app save mid-Lesson in an unchanged Lesson resumes at the saved place", async () => {
  const course = courseFrom(JSON.parse(read("quest/engine/dist/course.json")));
  const b2 = course.find((l) => l.id === "b-2");
  assert.equal(b2.legacyFingerprint, data.lessons["b-2"]);
  assert.equal(b2.legacyFingerprint, fingerprint(b2.content));
  const saved = load();
  const { host, state } = fakeHost({ course, saved });
  await host.open();
  const s = state();
  assert.deepEqual(
    [s.lesson, s.phase, s.progress["b-2"].step, s.progress["b-2"].beat],
    [ORACLE.lesson, "playing", ORACLE.step, ORACLE.beat],
  );
  assert.deepEqual(s.changed, []);
});

test("a save mid-Lesson in a changed Lesson restarts at the overview with the calm note", async () => {
  const course = compiled({
    ...data,
    lessons: { ...data.lessons, "b-2": "0".repeat(64) },
  });
  const saved = load();
  const kept = fakeHost({ course: compiled(data), saved: load() });
  await kept.host.open();
  const { host, state } = fakeHost({ course, saved });
  const first = await host.open();
  const s = state();
  assert.deepEqual(
    [s.lesson, s.phase, s.changed],
    ["b-2", "overview", ["b-2"]],
  );
  assert.equal(s.progress["b-2"].step, null);
  assert.deepEqual(project(s).lesson.notes[0], { kind: "changed" });
  assert.equal(s.progress["b-1"].complete, true);
  // The Work folders and Badges (completed Lessons) are kept as an unchanged save keeps them.
  assert.deepEqual(
    first.learner.workFolders,
    project(kept.state()).learner.workFolders,
  );
  const badges = (view) =>
    view.course.levels.flatMap((l) => l.lessons).map((l) => l.complete);
  assert.deepEqual(badges(first), badges(project(kept.state())));
  assert.deepEqual(s.folders, kept.state().folders);
  host.dispatch({ type: "lesson.start", help: "planned" });
  const started = state();
  assert.deepEqual(started.changed, []);
  assert.equal(
    started.progress["b-2"].fingerprint,
    fingerprint(course.find((l) => l.id === "b-2").content),
  );
});
