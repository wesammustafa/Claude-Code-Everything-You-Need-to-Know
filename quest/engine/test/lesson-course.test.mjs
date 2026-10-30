// Every lesson of the guide in the app (ticket 83), driven by actions (ticket
// 208): the 23 lessons on PATH in course order. The map, the card's rows,
// motion and plain output were the terminal's, and went with it in ticket
// 210; the check-only screen for a lesson with no lesson file went in 212.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PATH,
  SLOW,
  course,
  driver,
  finishedBefore,
  lessonOf,
  levelLessons,
  liveCourse,
  nextLessonOf,
  parseLesson,
  playUntil,
  probed,
  pending,
  root,
  save,
  snapshot,
  toFinish,
  watching,
  where,
} from "./drive.mjs";

// A lesson's overview, opened by the Learner.
const onOverview = (id, saved = {}) => {
  const d = driver({ course, saved: save({ lessons: saved }) });
  d.open(id);
  assert.deepEqual([d.state.phase, d.state.lesson], ["overview", id]);
  return d;
};
// A lesson's check items, as text.
const itemsOf = (id) => liveCourse.find((l) => l.id === id).items;
// A result for every item of a lesson: `pass(i)` says which pass, and the
// slow ones a poll leaves out come back unrun.
const result = (id, pass = () => false, { slow = true } = {}) => ({
  type: "check",
  lesson: id,
  items: itemsOf(id).map((text, index) =>
    slow && (SLOW[id] ?? []).includes(index)
      ? { index, text, pass: false, slow: true, hint: "" }
      : {
          index,
          text,
          pass: pass(index),
          hint: pass(index)
            ? ""
            : `${text} is not there yet: do the step, then look again.`,
        },
  ),
});
// The lesson the map marks next: the first one the Learner can still finish
// (render.mjs), or none.
const nextMarked = (s) => s.course.find((l) => toFinish(s, l))?.id;
// Where the map lands on a level: its first lesson to finish, else its first
// (flow.mjs's left and right).
const landsOn = (s, level) => {
  const lessons = levelLessons(s, level);
  return (lessons.find((l) => toFinish(s, l)) ?? lessons[0]).id;
};

// The guide's pages and the time each page's header line gives.
const PAGES = [
  ["b-1", "beginner", "01-install-and-look-around", "about 20 minutes"],
  ["b-2", "beginner", "02-permission-modes-and-plan-mode", "about 25 minutes"],
  ["b-3", "beginner", "03-first-change", "about 20 minutes"],
  ["b-4", "beginner", "04-keep-a-session-on-track", "about 25 minutes"],
  ["b-5", "beginner", "05-project-memory", "about 20 minutes"],
  ["b-capstone", "beginner", "capstone", "30 to 60 minutes"],
  ["i-1", "intermediate", "01-first-skill", "about 20 minutes"],
  ["i-2", "intermediate", "02-organize-memory", "about 20 minutes"],
  ["i-3", "intermediate", "03-model-and-effort", "about 20 minutes"],
  ["i-4", "intermediate", "04-permissions-and-sandbox", "about 20 minutes"],
  ["i-5", "intermediate", "05-hooks", "about 20 minutes"],
  ["i-6", "intermediate", "06-subagents", "about 25 minutes"],
  ["i-7", "intermediate", "07-mcp", "about 25 minutes"],
  ["i-8", "intermediate", "08-plugins", "about 25 minutes"],
  ["i-capstone", "intermediate", "capstone", "30 to 60 minutes"],
  ["a-1", "advanced", "01-parallel-sessions", "about 20 minutes"],
  ["a-2", "advanced", "02-orchestration-patterns", "about 20 minutes"],
  [
    "a-3",
    "advanced",
    "03-dynamic-workflows",
    "about 20 minutes, plus run time",
  ],
  ["a-4", "advanced", "04-headless", "about 20 minutes"],
  ["a-5", "advanced", "05-github-actions", "about 20 minutes, plus run time"],
  ["a-6", "advanced", "06-share-your-setup", "about 20 minutes"],
  ["a-7", "advanced", "07-bounded-runs", "about 20 minutes, plus run time"],
  ["a-capstone", "advanced", "capstone", "60 to 90 minutes, plus run time"],
];

// was learn-course:77
test("PATH lists all 23 lessons in course order, each with its page, its level and the minutes its page's header line gives", () => {
  assert.deepEqual(
    PATH.map(({ id, level, page, minutes }) => ({ id, level, page, minutes })),
    PAGES.map(([id, level, page, minutes]) => ({
      id,
      level,
      page: `docs/${level}/${page}.md`,
      minutes,
    })),
  );
  // The checks' own list, read as text: the lesson tests import nothing
  // from the checks but through drive.mjs.
  const index = readFileSync(
    join(root, "checks", "lessons", "index.mjs"),
    "utf8",
  );
  const listed = index
    .match(/export const lessons = \{([^}]*)\}/)[1]
    .match(/'[^']+'(?=:)/g)
    .map((k) => k.slice(1, -1));
  assert.deepEqual(
    PATH.map((p) => p.id),
    listed,
    "every lesson with a check, in the checks' order",
  );
});

// Measured on the solutions branch, each item alone: the items that start a
// process (stub runs, hooks, npm test).
// was learn-course:85
test("SLOW holds every item that starts a process, so a poll or a file event never runs one", () => {
  assert.deepEqual(SLOW, {
    "b-1": [0],
    "b-2": [2, 3],
    "b-3": [0, 1, 2, 4],
    "b-4": [3],
    "b-capstone": [2, 3, 4],
    "i-5": [2],
    "i-7": [2],
    "i-capstone": [1, 9, 11],
    "a-4": [1, 2, 3],
    "a-7": [0, 1, 2, 3, 4],
    "a-capstone": [4, 5, 6, 11],
  });
});

// Every Beginner lesson finished, the way a learner leaves them.
const beginnerDone = () => finishedBefore("i-1");
// Every lesson before Advanced complete: Beginner and Intermediate.
const throughIntermediate = () => ({
  ...finishedBefore("a-1"),
  ...Object.fromEntries(
    PATH.filter((p) => p.level === "intermediate").map((p) => [
      p.id,
      { complete: true },
    ]),
  ),
});

// The Beginner capstone names i-1 as next. Help fades within a level, and
// i-1 opens its level with more help than the capstone gives (ticket 85), so
// the next screen shows neither i-1's bar nor "a notch harder". A next
// lesson with no lesson file is none: the check-only screen went in 212.
// was learn-course:218
test("next may name the next level's first lesson: lesson.next opens its overview, and is refused where it has no lesson file", () => {
  assert.equal(
    parseLesson(
      readFileSync(join(root, "learn", "lessons", "b-capstone.md"), "utf8"),
      "b-capstone.md",
    ).next,
    "i-1",
  );
  const noI1 = course.map((l) =>
    l.id === "i-1" ? { ...l, content: null } : l,
  );
  for (const [lessons, fileless] of [
    [course, false],
    [noI1, true],
  ]) {
    const d = driver({
      course: lessons,
      saved: save({ lessons: finishedBefore("b-capstone") }),
    });
    playUntil(d, (s) => s.phase === "complete" && s.lesson === "b-capstone");
    // dropped: T-render the next screen's key bar, "Next up" row, "a notch
    // harder" and tier bar at 60x20 and 80x24
    assert.equal(nextLessonOf(d.state).id, "i-1");
    if (fileless) {
      d.refused("lesson.next");
      assert.deepEqual(
        [d.state.lesson, d.state.phase],
        ["b-capstone", "complete"],
      );
      d.refused("lesson.open", { lesson: "i-1" });
      continue;
    }
    d.next();
    assert.equal(d.state.lesson, "i-1");
    assert.equal(d.state.phase, "overview");
  }
});

// was learn-course:238
test("a-5 and a-capstone run in a new copy of the template: PATH says so, and in the practice copy their overview runs no check", () => {
  assert.deepEqual(
    PATH.filter((p) => p.newCopy).map((p) => p.id),
    ["a-5", "a-capstone"],
  );
  for (const id of ["a-5", "a-capstone"]) {
    const d = onOverview(id);
    assert.ok(
      !d.effects.some((e) => e.type === "check" && e.lesson === id),
      `${id}: a check ran`,
    );
    assert.equal(
      watching(d.state),
      null,
      `${id}: the polls and the watcher ask for nothing`,
    );
    d.refused("check.run");
    // dropped: T-render the card's new-copy words, and no "check now" on
    // the key bar
  }
  // dropped: T-plain main()'s plain output, which runs no check for them and says why
});

// was learn-course:261
test("a learner who starts at Intermediate or Advanced reaches its first lesson from the map in two keys", () => {
  // i-1 and a-1 open on their overviews.
  for (const id of ["i-1", "a-1"]) {
    // A new learner: the app opens on the first lesson with a lesson file.
    const d = driver({ course });
    d.finishWelcome();
    assert.deepEqual([d.state.phase, d.state.lesson], ["overview", "b-1"]);
    // dropped: T-view T-cursor the map and its left and right; the Learner opens the lesson
    d.open(id);
    assert.deepEqual([d.state.phase, d.state.lesson], ["overview", id]);
  }
  // Every Beginner lesson done: the app opens on the next level's first
  // lesson, on its overview since it has a lesson file.
  const done = driver({ course, saved: save({ lessons: beginnerDone() }) });
  assert.deepEqual([done.state.phase, done.state.lesson], ["overview", "i-1"]);
  // Every lesson before Advanced done: the app opens on a-1's overview, as
  // it does on i-1's.
  const advanced = driver({
    course,
    saved: save({ lessons: throughIntermediate() }),
  });
  assert.deepEqual(
    [advanced.state.phase, advanced.state.lesson],
    ["overview", "a-1"],
  );
});

const done = (ids) =>
  Object.fromEntries(ids.map((id) => [id, { complete: true }]));
// Every lesson before a-5 complete.
const throughA4 = () => ({
  ...beginnerDone(),
  ...done([
    "i-1",
    "i-2",
    "i-3",
    "i-4",
    "i-5",
    "i-6",
    "i-7",
    "i-8",
    "i-capstone",
    "a-1",
    "a-2",
    "a-3",
    "a-4",
  ]),
});

// was learn-course:554
// The app opens on the first unfinished lesson with a lesson file
// (initialState), which since every lesson has one is a-5 here, on its
// overview's folder question; the next marker and the map pass over it.
test("until a-5's and a-capstone's new copy folder is saved, the next lesson passes over them: the map marks a-6, and left and right land there", () => {
  // The Advanced level's own folder, or a-capstone's new copy, is not a-5's.
  const ADVANCED = "/home/sam/advanced-work";
  for (const folders of [
    {},
    { advanced: ADVANCED },
    { advanced: ADVANCED, "a-capstone": "/home/sam/ci-review" },
  ]) {
    const at = `saved: ${Object.keys(folders).join(", ") || "no folder"}`;
    const d = driver({
      course,
      saved: save({ lessons: throughA4(), folders }),
    });
    // dropped: T-view the map view
    assert.deepEqual(
      [d.state.lesson, d.state.phase],
      ["a-5", "overview"],
      `${at}: the app opens on a-5's overview`,
    );
    // dropped: T-render A6's "next" row and A5's row without it
    assert.equal(nextMarked(d.state), "a-6", at);
    assert.equal(toFinish(d.state, lessonOf(d.state, "a-5")), false, at);
    // dropped: T-cursor right and left; where they land on Advanced
    assert.equal(landsOn(d.state, "advanced"), "a-6", `${at}: at a-6`);
    if (folders["a-capstone"]) continue;
    // Only they are left: the app opens on a-5, which no marker names.
    const rest = driver({
      course,
      saved: save({
        lessons: { ...throughA4(), ...done(["a-6", "a-7"]) },
        folders,
      }),
    });
    assert.equal(rest.state.lesson, "a-5", at);
    assert.equal(nextMarked(rest.state), undefined, at);
  }
});

// Ticket 172: since 86 a-5 and a-capstone run their check in the new copy
// the learner gives, so once its folder is saved each is a lesson to finish.
// was learn-course:577
test("once a-5 or a-capstone has its new copy saved, it is the next lesson where it is the first unfinished one: the map marks it, and left and right land there", () => {
  const cases = [
    {
      id: "a-5",
      lessons: throughA4(),
      folders: { "a-5": "/home/sam/claude-actions-practice" },
    },
    {
      id: "a-capstone",
      lessons: { ...throughA4(), ...done(["a-6", "a-7"]) },
      folders: { "a-capstone": "/home/sam/ci-review" },
    },
  ];
  for (const { id, lessons, folders } of cases) {
    const d = driver({
      course,
      saved: save({ lessons, folders }),
    });
    // dropped: T-view the map view; the app opens on the first unfinished
    // lesson with a lesson file, a-5 (see the test above)
    assert.equal(d.state.lesson, "a-5", `${id}: the app opens on a-5`);
    // dropped: T-render its "next" row, the row after it without one, and
    // the map fitting at 60x20 and 80x24, full and ASCII
    assert.equal(nextMarked(d.state), id);
    // dropped: T-cursor right and left; where they land on Advanced
    assert.equal(
      landsOn(d.state, "advanced"),
      id,
      `back on Advanced, at ${id}`,
    );
  }
});

// was learn-course:597
test("a-5's new copy given in the session makes it the next lesson at once, and after a restart", () => {
  const A5COPY = "/home/sam/claude-actions-practice";
  const d = driver({
    course,
    saved: save({ lessons: throughA4() }),
  });
  // dropped: T-cursor the map's cursor moved to a-5
  d.open("a-5");
  assert.deepEqual([d.state.lesson, d.state.phase], ["a-5", "overview"]);
  // dropped: T-input the path typed key by key; the Learner gives it whole
  d.folderAsk("a-5");
  d.folderChoose("a-5", { path: A5COPY });
  d.send(probed(pending(d, "folder")));
  assert.deepEqual(d.state.folders, { "a-5": A5COPY });
  // dropped: T-view T-render the map's A5 "next" row, A6 without one, and
  // the map fitting at 60x20 and 80x24
  assert.equal(nextMarked(d.state), "a-5");
  // dropped: T-cursor right onto Advanced; where it lands
  assert.equal(
    landsOn(d.state, "advanced"),
    "a-5",
    "right onto Advanced lands at a-5",
  );
  const again = driver({
    course,
    saved: snapshot(d.state),
  });
  assert.equal(again.state.lesson, "a-5", "a restart opens at a-5");
});

// was learn-course:788
// spec: verify.value.check-all
// spec: guards.3-full-coverage
test("a passed Check step counts the run that passed it: a later poll that leaves the slow items out changes no count (r27)", () => {
  // Lessons with slow items whose Check step opens on the whole check.
  const ids = course
    .filter(
      (l) =>
        l.content &&
        SLOW[l.id] &&
        l.content.steps.find((st) => st.id === "C")?.beats[0].verify.all,
    )
    .map((l) => l.id);
  assert.ok(ids.length >= 8, ids.join(" "));
  // The items the card counts for a passed whole check (render.mjs).
  const counted = (s) => s.beat.passed ?? s.checks[s.lesson].items;
  for (const id of ids) {
    const d = driver({
      course,
      saved: save({
        lessons: {
          ...finishedBefore(id),
          [id]: { step: "C", beat: 0, warm: [] },
        },
      }),
    });
    d.open(id);
    assert.deepEqual([where(d.state).lesson, where(d.state).step], [id, "C"]);
    const asked = d.run().effects.find((e) => e.type === "check")?.asked;
    assert.ok(asked, id);
    const m = itemsOf(id).length;
    d.send({ ...result(id, () => true, { slow: false }), asked });
    assert.ok(
      ["done", "already"].includes(d.state.beat.status),
      `${id}: ${d.state.beat.status}`,
    );
    // dropped: T-render the "passes: m of m items." line; the count it reads follows
    assert.deepEqual(
      [counted(d.state).filter((x) => x.pass).length, counted(d.state).length],
      [m, m],
      id,
    );
    // The watcher's next poll runs only the fast items.
    d.send(result(id, () => true, { slow: true }));
    assert.deepEqual(
      [counted(d.state).filter((x) => x.pass).length, counted(d.state).length],
      [m, m],
      `${id} after a poll`,
    );
  }
});
