// Real Terminal app saves (ticket 213), as the Terminal app at the Phase 1
// input (practice-203, 0e90e55) wrote them: the welcome only, mid-Lesson,
// Beginner completed, a Work folder set, and the old `keepGuided` field from
// before 43295ea. Each loads through the real store and the real course and
// resumes where the Terminal app did. The fixtures and oracle.json come from
// a generator that drove the Terminal app's own loadCourse, initialState
// and reduce (.scratch/claude-code-quest/213/terminal-saves.mjs, not
// committed). The Terminal app's screens map to the phases here:
// - `welcome` and `intro`: `overview` (the welcome is learner.welcomed false);
// - `resume`: `playing` with no beat open, until `lesson.open`;
// - `step`, after its enter on the resume: `playing` on that step and beat.
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
import { loadState } from "../src/store.ts";
import { project } from "../src/engine.ts";
import {
  driver,
  liveCourse,
  playUntil,
  stepOf,
} from "../../engine/test/drive.mjs";
import { fakeHost } from "./scripted.mjs";

const fixture = (name) =>
  readFileSync(
    new URL(`./fixtures/terminal-saves/${name}`, import.meta.url),
    "utf8",
  );
const ORACLE = JSON.parse(fixture("oracle.json"));
const VIEWS = { welcome: "overview", intro: "overview", resume: "playing" };

// The fixture, written into a temporary copy's `.practice/` with its Work
// folder placeholder set to a real absolute path, and loaded by the store.
function load(name) {
  const dir = mkdtempSync(join(tmpdir(), "terminal-save-"));
  try {
    const work = join(dir, "work");
    mkdirSync(join(dir, ".practice"));
    writeFileSync(
      join(dir, ".practice", "learn.json"),
      fixture(`${name}.json`).replaceAll(
        "@WORK@",
        work.replaceAll("\\", "\\\\"),
      ),
    );
    return { saved: loadState(dir), work };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const [name, place] of Object.entries(ORACLE)) {
  test(`a Terminal app save, ${name}, resumes where the Terminal app did`, async () => {
    const { saved } = load(name);
    assert.ok(saved && !saved.unreadable, "the store reads it");
    const { host, state } = fakeHost({ course: liveCourse, saved });
    const first = await host.open();
    const s = state();
    assert.deepEqual(
      [s.lesson, s.phase, s.progress[s.lesson].step, s.progress[s.lesson].beat],
      [place.lesson, VIEWS[place.view], place.step, place.beat],
    );
    assert.deepEqual(s.changed, [], "no lesson changed");
    assert.deepEqual(first.milestones, []);
    if (place.opened) {
      host.dispatch({ type: "lesson.open", lesson: place.lesson });
      const o = state();
      assert.deepEqual(
        [o.phase, stepOf(o).id, o.pos.beat],
        ["playing", place.opened.step, place.opened.beat],
      );
    }
    // Completion shows at once; no Mastery until a step finishes.
    for (const [id, p] of Object.entries(saved.lessons))
      assert.equal(
        first.course.levels.flatMap((l) => l.lessons).find((l) => l.id === id)
          .complete,
        p.complete,
        id,
      );
    assert.deepEqual(first.learner.mastery, {});
  });
}

test("a Terminal app save's Work folder shows, and an old keepGuided becomes more help from the saved step", async () => {
  const { saved, work } = load("folders");
  const { host } = fakeHost({ course: liveCourse, saved });
  assert.deepEqual((await host.open()).learner.workFolders, [
    { key: "intermediate", path: work },
  ]);
  const kept = load("keep-guided").saved;
  const k = fakeHost({ course: liveCourse, saved: kept });
  await k.host.open();
  assert.equal(
    k.state().progress["b-2"].moreHelpAt,
    ORACLE["keep-guided"].moreHelpAt,
  );
});

test("after a Terminal app save, one finished step shows its skill's Mastery and no other", () => {
  const { saved } = load("mid-lesson");
  const d = driver({ course: liveCourse, saved });
  d.open("b-2");
  const step = stepOf(d.state);
  playUntil(d, (s) => s.progress["b-2"].help !== undefined);
  assert.deepEqual(Object.keys(d.state.progress["b-2"].help), [step.id]);
  assert.deepEqual(Object.keys(project(d.state).learner.mastery), [step.skill]);
});
