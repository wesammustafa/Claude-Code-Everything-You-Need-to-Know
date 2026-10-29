// The work folder (ticket 86), driven by actions (ticket 208): each later
// level practises in a folder the Learner picks, the practice copy by
// default, while progress stays in the copy. Some lessons pin theirs:
// i-capstone to the copy, and a-5 and the Advanced capstone to the new copy
// each asks for. Ported from practice-template/checks/test/learn-folder.test.mjs;
// its store, render and main() tests stay there until 209 and 210.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  asksFolder,
  asksHere,
  beatOf,
  checkOnly,
  course,
  DEMO_I1,
  driver,
  FACTS,
  finishedBefore,
  folderHere,
  folderKey,
  folderOf,
  folderOptions,
  folderProblem,
  gitLists,
  introAsks,
  introNotes,
  introOptions,
  isDone,
  lessonNumber,
  lessonOf,
  levelFolder,
  loadCourse,
  parseLesson,
  PATH,
  pending,
  playUntil,
  probed,
  save,
  snapshot,
  stepOf,
  threeLevels,
  watching,
  where,
} from "./drive.mjs";

const MINE = "/home/sam/code/my-app";
const COPY = FACTS.root;
// The course with DEMO_I1 as i-1, and i-5, i-capstone, a-1, a-5 and
// a-capstone shown through their checks: every lesson has a file, and these
// tests need a check-only lesson that practises in the level's folder, one
// pinned to the copy, one in the Advanced folder and the two that run in a
// new copy.
const CHECK_ONLY = new Set(["i-5", "i-capstone", "a-1", "a-5", "a-capstone"]);
const withI1 = () =>
  threeLevels({ "i-1": DEMO_I1 }).map((l) =>
    CHECK_ONLY.has(l.id) ? { ...l, content: null } : l,
  );
// A Learner past Beginner, on i-1's overview, with these folders saved.
const atI1 = (folders, lessons = withI1()) =>
  driver({
    course: lessons,
    saved: save({
      lessons: finishedBefore("i-1", lessons),
      ...(folders ? { folders } : {}),
    }),
  });
const lastOf = (effects, type) => effects.filter((e) => e.type === type).at(-1);
const stepIs = (id) => (s) => where(s).step === id;
// Plays i-1 on to W1, its first check beat, as a Learner who needs no help.
const toW1 = (d) => playUntil(d, stepIs("W1"));
// The folder answer's ask goes out as an effect; the host answers with what
// it found.
const answer = (d, found = {}) =>
  d.send(probed(lastOf(d.effects, "folder"), found));
// Another folder for `key`, given and found: the answer opened, the path
// chosen, the host's look.
const giveFolder = (d, key, path, found = {}) => {
  d.folderAsk(key);
  d.folderChoose(key, { path });
  answer(d, { path, ...found });
};

// spec: folders.default
test("the default work folder is the practice copy: every check, file and git effect names it", () => {
  // was learn-folder:78
  const b = driver({ course: threeLevels() });
  playUntil(b, (s) => Boolean(s.beat) && beatOf(s).verify.kind === "check");
  assert.equal(lastOf(b.effects, "check").dir, COPY);
  playUntil(b, (s) => Boolean(s.beat) && beatOf(s).verify.kind === "git-clean");
  assert.equal(lastOf(b.effects, "git").dir, COPY);
  const d = atI1(null);
  toW1(d);
  assert.equal(lastOf(d.effects, "check").dir, COPY);
  assert.equal(watching(d.state).dir, COPY);
});

// spec: folders.picked
test("a saved work folder is where its level's checks run; Beginner stays in the copy whatever is saved", () => {
  // was learn-folder:90
  const folders = { intermediate: MINE, advanced: "/home/sam/code/other" };
  const d = atI1(folders);
  toW1(d);
  assert.equal(lastOf(d.effects, "check").dir, MINE);
  assert.equal(watching(d.state).dir, MINE);
  d.run();
  assert.equal(lastOf(d.effects, "check").dir, MINE, "r's run too");
  // Beginner: a lesson there runs in the copy.
  const b = driver({
    course: withI1(),
    saved: save({ lessons: {}, folders }),
  });
  playUntil(b, (s) => Boolean(s.beat) && beatOf(s).verify.kind === "check");
  assert.equal(lastOf(b.effects, "check").dir, COPY);
  // A check-only lesson of each later level: its own level's folder.
  for (const [id, dir] of [
    ["i-5", MINE],
    ["a-1", "/home/sam/code/other"],
  ]) {
    const c = driver({
      course: withI1(),
      saved: save({ lessons: {}, folders }),
    });
    c.open(id);
    assert.ok(checkOnly(c.state), id);
    assert.equal(lastOf(c.effects, "check").dir, dir, id);
    assert.equal(watching(c.state).dir, dir, id);
  }
});

// spec: guards.2-folder-match
test("a result from another folder than the lesson's decides nothing", () => {
  // was learn-folder:114
  const d = atI1({ intermediate: MINE });
  toW1(d);
  const items = [{ index: 0, text: "x", pass: true, hint: "" }];
  d.send({ type: "check", lesson: "i-1", items, dir: COPY });
  assert.equal(
    d.state.beat.status,
    "opening",
    "a result from the copy is not about this folder",
  );
  d.send({ type: "check", lesson: "i-1", items, dir: MINE });
  assert.equal(d.state.beat.status, "already");
});

// spec: guards.2-folder-match
test("a beat that reads a file (json, match, no-match) reads it in the work folder: on opening, on r, and only a result from there decides", () => {
  // was learn-folder:124
  const path = ".claude/skills/tdd/SKILL.md";
  for (const verify of [
    `json ${path}`,
    `match ${path} ^name: tdd$`,
    `no-match ${path} TODO`,
  ]) {
    const d = atI1(
      { intermediate: MINE },
      threeLevels({
        "i-1": DEMO_I1.replace("- verify: check 0\n", `- verify: ${verify}\n`),
      }),
    );
    toW1(d);
    assert.equal(d.state.beat.status, "opening", verify);
    assert.deepEqual(
      lastOf(d.effects, "file"),
      { type: "file", path, dir: MINE },
      verify,
    );
    assert.deepEqual(watching(d.state), { file: path, dir: MINE }, verify);
    d.run();
    assert.deepEqual(
      lastOf(d.effects, "file"),
      { type: "file", path, asked: d.state.asks, dir: MINE },
      `${verify}: r's read too`,
    );
    const read = Buffer.from(
      verify.startsWith("json") ? '{"name": "tdd"}' : "name: tdd\n",
    );
    d.send({
      type: "file",
      path,
      read,
      stamp: "a",
      asked: d.state.beat.asked,
      dir: COPY,
    });
    assert.equal(
      d.state.beat.status,
      "opening",
      `${verify}: a read of the copy is not about this folder`,
    );
    d.send({
      type: "file",
      path,
      read,
      stamp: "a",
      asked: d.state.beat.asked,
      dir: MINE,
    });
    assert.ok(
      ["done", "already"].includes(d.state.beat.status),
      `${verify}: ${d.state.beat.status}`,
    );
  }
});

// ---- the question at a level's first overview ----------------------------------

// spec: folders.asked-first-overview
test("Intermediate's first intro asks where to practise: this practice copy, or another folder; Beginner's first intro asks nothing", () => {
  // was learn-folder:160
  const d = atI1(null);
  assert.deepEqual([d.state.phase, d.state.lesson], ["overview", "i-1"]);
  assert.ok(asksFolder(d.state));
  assert.deepEqual(folderOptions(d.state), ["copy", "other"]);
  // The start waits for the answer.
  d.refused("lesson.start", { help: "planned" });
  // dropped: T-render the question's rows and the key bar at 60x20 and 80x24
  const b = driver({ course: withI1(), saved: save({ lessons: {} }) });
  assert.deepEqual([b.state.phase, b.state.lesson], ["overview", "b-1"]);
  assert.ok(!asksFolder(b.state) && !asksHere(b.state));
  assert.equal(introOptions(b.state)[0], "start");
  // An answer saved, or given with --dir, is an answer: the start is offered.
  const answered = atI1({ intermediate: MINE });
  assert.ok(!asksFolder(answered.state));
  assert.equal(introOptions(answered.state)[0], "start");
});

// spec: folders.picked
test('"this practice copy" saves the copy as the level\'s work folder and nothing else, then the intro offers the start', () => {
  // was learn-folder:179
  const d = atI1(null);
  d.folderChoose("intermediate", "practice-copy");
  assert.equal(d.state.folders.intermediate, COPY);
  assert.deepEqual(snapshot(d.state).folders, { intermediate: COPY });
  assert.ok(d.last.effects.some((e) => e.type === "save"));
  assert.equal(d.state.phase, "overview");
  assert.ok(!asksFolder(d.state));
  assert.equal(introOptions(d.state)[0], "start");
  // The overview that took the answer shows it: this copy.
  assert.ok(asksHere(d.state));
  assert.equal(folderOf(d.state), COPY);
  // dropped: T-render the "Work folder: this practice copy" row
  d.start();
  assert.equal(d.state.phase, "playing", "the start now starts the lesson");
  assert.ok(d.state.beat);
});

// spec: folders.another-folder
test('"another folder" opens the path prompt: a typed path goes to main to look at, and the folder it finds is saved and used', () => {
  // was learn-folder:192
  const d = atI1(null);
  d.folderAsk("intermediate");
  assert.equal(d.state.folderAsk.key, "intermediate");
  // dropped: T-overlay T-input the prompt and the typed path on screen
  d.folderChoose("intermediate", { path: "~/code/my-app" });
  assert.deepEqual(lastOf(d.effects, "folder"), {
    type: "folder",
    key: "intermediate",
    text: "~/code/my-app",
    asked: d.state.folderAsk.asked,
  });
  // dropped: T-render "Checking" while the host looks
  answer(d, { path: MINE });
  assert.equal(d.state.folderAsk, null);
  assert.equal(d.state.folders.intermediate, MINE);
  assert.deepEqual(
    snapshot(d.state).folders,
    { intermediate: MINE },
    "only the folder is saved: no reason, no goal",
  );
  assert.ok(asksHere(d.state) && !asksFolder(d.state));
  assert.equal(folderOf(d.state), MINE);
  // dropped: T-cursor the cursor back on the start
  // Asked again on the overview, then dropped: the folder stays.
  d.folderAsk("intermediate");
  assert.equal(d.state.folderAsk?.key, "intermediate");
  d.folderCancel();
  assert.equal(d.state.folders.intermediate, MINE);
  toW1(d);
  assert.equal(lastOf(d.effects, "check").dir, MINE);
});

// spec: folders.asked-first-overview
test("the level's first intro the learner opens asks, whichever lesson it is; the intro that took the answer shows it", () => {
  // was learn-folder:218
  const i3 = DEMO_I1.replace("lesson: i-1", "lesson: i-3").replace(
    "next: i-2",
    "next: i-4",
  );
  const lessons = threeLevels({ "i-1": DEMO_I1, "i-3": i3 });
  const d = atI1(null, lessons);
  d.open("i-3");
  assert.deepEqual([d.state.phase, d.state.lesson], ["overview", "i-3"]);
  assert.ok(asksFolder(d.state));
  d.folderChoose("intermediate", "practice-copy");
  assert.equal(d.state.folders.intermediate, COPY);
  assert.ok(asksHere(d.state) && !asksFolder(d.state));
  assert.equal(introOptions(d.state)[0], "start");
  assert.equal(lessonNumber(d.state), 3);
  // dropped: T-render fitsAll on the answered i-3 overview
  // i-1, the level's first lesson, shows the answer; it no longer asks.
  d.open("i-1");
  assert.ok(asksHere(d.state) && !asksFolder(d.state));
  assert.equal(introOptions(d.state)[0], "start");
  // A later lesson's overview, once the level has its answer, neither asks
  // nor shows it.
  const later = atI1({ intermediate: COPY }, lessons);
  later.open("i-3");
  assert.equal(later.state.lesson, "i-3");
  assert.ok(!asksHere(later.state) && !asksFolder(later.state));
});

// spec: folders.another-folder
test("a missing folder keeps the prompt open and says so; Esc leaves it, and a late answer for it changes nothing", () => {
  // was learn-folder:281
  const d = atI1(null);
  d.folderAsk("intermediate");
  d.folderChoose("intermediate", { path: "/nope" });
  answer(d, { path: "/nope", missing: true, git: false, practice: false });
  assert.equal(d.state.folderAsk.key, "intermediate");
  assert.equal(d.state.folderAsk.missing, "/nope");
  assert.equal(d.state.folders.intermediate, undefined);
  // Editing the answer again clears the note.
  d.folderAsk("intermediate");
  assert.equal(d.state.folderAsk.missing, null);
  d.folderChoose("intermediate", { path: "/nope" });
  d.folderCancel();
  assert.equal(d.state.folderAsk, null);
  answer(d, { path: "/nope" });
  assert.equal(
    d.state.folders.intermediate,
    undefined,
    "the answer came after it was dropped",
  );
  assert.ok(asksFolder(d.state), "the question is still open");
});

// ---- where the Learner is sent ---------------------------------------------------

test("when the work folder isn't the copy, the header names it on every lesson screen of its level, and nowhere else", () => {
  // was learn-folder:319
  // dropped: T-render the header row and fitsAll; the folder it names is folderHere
  const d = atI1({ intermediate: MINE });
  assert.equal(folderHere(d.state), MINE, "overview");
  toW1(d);
  assert.equal(folderHere(d.state), MINE, "W1");
  playUntil(d, stepIs("C"));
  assert.equal(folderHere(d.state), MINE, "C");
  // Beginner, and a level whose folder is the copy, name none.
  const b = driver({
    course: withI1(),
    saved: save({ lessons: {}, folders: { intermediate: MINE } }),
  });
  assert.equal(folderHere(b.state), COPY);
  assert.equal(folderHere(atI1({ intermediate: COPY }).state), COPY);
  // A check-only lesson of the level names it too.
  const c = atI1({ intermediate: MINE });
  c.open("i-5");
  assert.ok(checkOnly(c.state));
  assert.equal(folderHere(c.state), MINE);
});

// spec: newcopy.i-capstone-pinned
test("every line that sends the learner to another terminal says which folder: the card's place, the check-only card's and the stray-command note", () => {
  // was learn-folder:348
  // dropped: T-render each place line and run line; the folder each names is folderHere
  const d = atI1({ intermediate: MINE });
  playUntil(d, stepIs("W2"));
  assert.equal(folderHere(d.state), MINE);
  // dropped: T-input the stray-command note for a pasted command
  playUntil(d, stepIs("C"));
  assert.equal(folderHere(d.state), MINE);
  // The Check passes in the work folder.
  const items = lessonOf(d.state).items.map((text, index) => ({
    index,
    text,
    pass: true,
    hint: "",
  }));
  d.send({ type: "check", lesson: "i-1", items, dir: MINE });
  assert.ok(isDone(d.state.beat), d.state.beat.status);
  // dropped: T-render the check command with --dir and "Run it in your practice copy too"
  // In the copy, every step is there.
  const copy = atI1({ intermediate: COPY });
  playUntil(copy, stepIs("C"));
  assert.equal(folderHere(copy.state), COPY);
  // A check-only card: its place is the work folder, or the copy for
  // i-capstone, pinned there.
  const c = atI1({ intermediate: MINE });
  c.open("i-5");
  assert.equal(folderHere(c.state), MINE);
  c.open("i-capstone");
  assert.equal(c.state.lesson, "i-capstone");
  assert.equal(
    lastOf(c.effects, "check").dir,
    COPY,
    "i-capstone checks in the copy",
  );
  assert.equal(folderHere(c.state), COPY);
});

// ---- the map's folder rows: an answer given away from the overview -------------

test("the map shows each later level's work folder, and f there changes it; Beginner's page has none", () => {
  // was learn-folder:425
  // dropped: T-view T-render the map's folder rows; each is levelFolder
  const d = atI1(null);
  const at = where(d.state);
  assert.equal(levelFolder(d.state, "intermediate"), COPY);
  d.folderAsk("intermediate");
  assert.equal(d.state.folderAsk.key, "intermediate");
  d.folderChoose("intermediate", { path: MINE });
  answer(d);
  assert.deepEqual(where(d.state), at, "the Learner stays where they were");
  assert.deepEqual(d.state.folders, { intermediate: MINE });
  assert.equal(levelFolder(d.state, "intermediate"), MINE);
  // Advanced has its own, the copy until it is changed.
  assert.equal(levelFolder(d.state, "advanced"), COPY);
  d.folderAsk("advanced");
  assert.equal(d.state.folderAsk.key, "advanced");
  // An empty line is this practice copy.
  d.folderChoose("advanced", "practice-copy");
  assert.deepEqual(d.state.folders, { intermediate: MINE, advanced: COPY });
  // Beginner: no folder, and asking for one does nothing.
  d.refused("folder.ask", { key: "beginner" });
  // dropped: T-render fitsAll on the map at b-1, i-1 and a-1
});

test("f on a check-only card changes its level's folder; i-capstone, pinned to the copy, has no f", () => {
  // was learn-folder:480
  const d = atI1(null);
  d.open("i-5");
  // dropped: T-render "f folder" on the key bar
  assert.equal(folderKey(d.state), "intermediate", "f answers i-5's level");
  giveFolder(d, "intermediate", MINE);
  assert.ok(checkOnly(d.state));
  assert.equal(
    pending(d, "check").dir,
    MINE,
    "the card checks the new folder at once",
  );
  d.open("i-capstone");
  assert.equal(folderKey(d.state), null);
  d.refused("folder.ask", { key: "i-capstone" });
});

// ---- pinned folders --------------------------------------------------------------
const ACTIONS = "/home/sam/claude-actions-practice";
const checkOnlyAt = (id, folders) => {
  const d = atI1(folders);
  d.open(id);
  assert.ok(checkOnly(d.state));
  assert.equal(d.state.lesson, id);
  return d;
};

// spec: newcopy.by-lesson-id
// spec: newcopy.no-check
// spec: newcopy.copy-refused
test("a-5's check-only view asks for its new copy and runs no check until it has one; then its check runs there, for a-5 only", () => {
  // was learn-folder:559
  const d = checkOnlyAt("a-5");
  assert.equal(lastOf(d.effects, "check"), undefined);
  assert.equal(watching(d.state), null);
  assert.equal(folderKey(d.state), "a-5");
  assert.deepEqual(folderOptions(d.state), ["other"]);
  // dropped: T-render the new-copy words and "f give its folder"
  d.folderAsk("a-5");
  assert.equal(d.state.folderAsk.key, "a-5");
  // An empty line is no answer here: the copy is not where a-5 runs.
  d.refused("folder.choose", { key: "a-5", to: "practice-copy" });
  d.refused("folder.choose", { key: "a-5", to: { path: "" } });
  assert.equal(d.state.folders["a-5"], undefined);
  // Nor is the copy given as a path, relative or in full: a new copy is
  // another folder.
  for (const text of [".", COPY]) {
    d.folderChoose("a-5", { path: text });
    answer(d, { path: COPY });
    assert.equal(d.state.folderAsk?.key, "a-5", text);
    assert.equal(d.state.folderAsk.isCopy, true, text);
    assert.equal(d.state.folders["a-5"], undefined, text);
    assert.equal(lastOf(d.effects, "check"), undefined, text);
    // dropped: T-render fitsAll with the note
    d.folderAsk("a-5");
    assert.equal(
      d.state.folderAsk.isCopy,
      false,
      "editing the answer clears the note",
    );
  }
  d.folderChoose("a-5", { path: ACTIONS });
  answer(d);
  assert.deepEqual(d.state.folders, { "a-5": ACTIONS });
  assert.deepEqual(snapshot(d.state).folders, { "a-5": ACTIONS });
  assert.deepEqual(lastOf(d.effects, "check"), {
    type: "check",
    lesson: "a-5",
    items: null,
    dir: ACTIONS,
  });
  assert.equal(watching(d.state).dir, ACTIONS);
  assert.equal(folderHere(d.state), ACTIONS);
  // dropped: T-render the header and "r check now" on the key bar
  // Its folder is a-5's alone: the Advanced capstone still asks, and a-1
  // runs in the copy.
  const checks = d.effects.filter((e) => e.type === "check").length;
  d.open("a-capstone");
  assert.equal(folderOf(d.state), null);
  assert.equal(watching(d.state), null);
  assert.equal(
    d.effects.filter((e) => e.type === "check").length,
    checks,
    "nothing runs yet, so no item waits for r",
  );
  // Given its new copy, the capstone's slow items wait for r there, as any
  // lesson's do (render's unchecked condition: a folder and slow items).
  const cap = checkOnlyAt("a-capstone", {
    "a-capstone": "/home/sam/ci-review",
  });
  assert.equal(folderOf(cap.state), "/home/sam/ci-review");
  assert.ok(lessonOf(cap.state).slow.length > 0);
  assert.deepEqual(lastOf(cap.effects, "check"), {
    type: "check",
    lesson: "a-capstone",
    items: null,
    dir: "/home/sam/ci-review",
  });
  // dropped: T-render fitsAll with the new copy
  d.open("a-1");
  assert.equal(lastOf(d.effects, "check").dir, COPY);
});

test("a lesson file can pin its folder in its front matter: copy, or new copy; anything else is an error", () => {
  // was learn-folder:618
  const pinned = (value) =>
    parseLesson(
      DEMO_I1.replace("next: i-2", `next: i-2\nfolder: ${value}`),
      "i-1.md",
    );
  assert.equal(pinned("copy").folder, "copy");
  assert.equal(pinned("new copy").folder, "new copy");
  assert.equal(parseLesson(DEMO_I1, "i-1.md").folder, undefined);
  assert.throws(() => pinned("mine"), /i-1\.md: .*folder/);
  // i-1 pinned to the copy: its check runs there, whatever Intermediate's
  // folder is.
  const lessons = threeLevels({
    "i-1": DEMO_I1.replace("next: i-2", "next: i-2\nfolder: copy"),
  });
  const d = atI1({ intermediate: MINE }, lessons);
  toW1(d);
  assert.equal(lastOf(d.effects, "check").dir, COPY);
});

test("a lesson file of a-5 asks for its new copy at its intro, with that answer alone", () => {
  // was learn-folder:631
  const text = DEMO_I1.replace("lesson: i-1", "lesson: a-5").replace(
    "next: i-2",
    "next: a-6",
  );
  const lessons = threeLevels({ "i-1": DEMO_I1, "a-5": text });
  const d = driver({
    course: lessons,
    saved: save({ lessons: finishedBefore("a-5", lessons) }),
  });
  d.open("a-5");
  assert.deepEqual([d.state.phase, d.state.lesson], ["overview", "a-5"]);
  assert.ok(asksFolder(d.state));
  assert.deepEqual(folderOptions(d.state), ["other"]);
  // dropped: T-render the new-copy question and its one option
  d.folderAsk("a-5");
  assert.equal(d.state.folderAsk.key, "a-5");
  d.folderChoose("a-5", { path: ACTIONS });
  answer(d);
  assert.ok(asksHere(d.state) && !asksFolder(d.state));
  assert.equal(folderOf(d.state), ACTIONS);
  assert.equal(introOptions(d.state)[0], "start");
  assert.equal(lessonNumber(d.state), 5);
});

// spec: folders.change-drops
test("switching folders: what the old folder's check found goes, a run still out for it decides nothing, and the next look is in the new one", () => {
  // was learn-folder:652
  const OTHER = "/home/sam/code/other-app";
  const d = atI1({ intermediate: MINE });
  d.open("i-5");
  assert.equal(lastOf(d.effects, "check").dir, MINE);
  const items = lessonOf(d.state).items.map((text, index) => ({
    index,
    text,
    pass: true,
    hint: "",
  }));
  d.folderAsk("intermediate");
  d.folderChoose("intermediate", { path: OTHER });
  // MINE's run lands while the host looks: it is still the folder.
  d.send({
    type: "check",
    lesson: "i-5",
    items: items.map((it) => ({ ...it, pass: false, hint: "no" })),
    dir: MINE,
  });
  assert.ok(d.state.checks["i-5"]);
  answer(d, { path: OTHER });
  assert.equal(d.state.checks["i-5"], undefined, "the old folder's marks go");
  assert.equal(lastOf(d.effects, "check").dir, OTHER);
  // A run of MINE that was still out lands now: it would complete the
  // lesson there.
  d.send({ type: "check", lesson: "i-5", items, dir: MINE });
  assert.equal(d.state.progress["i-5"].complete, false);
  assert.equal(d.state.checks["i-5"], undefined);
  d.send({ type: "check", lesson: "i-5", items, dir: OTHER });
  assert.equal(d.state.progress["i-5"].complete, true);
  // dropped: T-render the header naming other-app
  assert.equal(folderHere(d.state), OTHER);
});

// spec: folders.change-drops
test("switching folders: a fresh step compares its file with how it is in the new folder, not the old one", () => {
  // was learn-folder:676
  const EVIDENCE = ".claude/skills/tdd/SKILL.md";
  const lessons = threeLevels({
    "i-1": DEMO_I1.replace(
      "- verify: check 0\n",
      `- verify: check 0 fresh\n- evidence: ${EVIDENCE}\n`,
    ),
  });
  const OTHER = "/home/sam/code/other-app";
  const d = atI1({ intermediate: MINE }, lessons);
  toW1(d);
  const items = [{ index: 0, text: "x", pass: true, hint: "" }];
  d.send({
    type: "check",
    lesson: "i-1",
    items,
    path: EVIDENCE,
    stamp: "mine-1",
    dir: MINE,
  });
  assert.equal(
    d.state.beat.status,
    "waiting",
    "the file in MINE has not changed yet",
  );
  // The folder changes with the step card open (D2): the engine asks
  // nothing again, the watch moves to the new folder and the host's next
  // poll there answers it.
  giveFolder(d, "intermediate", OTHER);
  assert.deepEqual(
    d.state.progress["i-1"].stamps,
    {},
    "the old folder's file states go",
  );
  const w = watching(d.state);
  assert.equal(w.dir, OTHER);
  const poll = (stamp) =>
    d.send({
      type: "check",
      lesson: w.check.lesson,
      items,
      path: EVIDENCE,
      stamp,
      dir: w.dir,
    });
  // OTHER's file as it is now is the start: unchanged, the step waits.
  poll("other-1");
  assert.deepEqual(
    [stepOf(d.state).id, d.state.beat.status],
    ["W1", "waiting"],
  );
  poll("other-1");
  assert.equal(d.state.beat.status, "waiting");
  // Changed there: done.
  poll("other-2");
  assert.ok(
    ["done", "already"].includes(d.state.beat.status),
    d.state.beat.status,
  );
  // Picking the same folder again keeps what the app knows of it.
  const same = atI1({ intermediate: MINE }, lessons);
  toW1(same);
  same.send({
    type: "check",
    lesson: "i-1",
    items,
    path: EVIDENCE,
    stamp: "mine-1",
    dir: MINE,
  });
  giveFolder(same, "intermediate", MINE);
  assert.deepEqual(same.state.progress["i-1"].stamps, { "W1.0": "mine-1" });
});

// ---- notes before the first step -----------------------------------------------
const PROBLEMS = [
  [
    "not a git repository",
    { missing: false, git: false, practice: false },
    "notGit",
  ],
  [
    "no git-ignored .practice/",
    { missing: false, git: true, practice: false },
    "noPractice",
  ],
  ["gone", { missing: true, git: false, practice: false }, "missing"],
  // git could not say: the note says why, not that the folder is no repository.
  [
    "git not installed",
    {
      missing: false,
      git: false,
      gitBroken: "git is not installed",
      practice: false,
    },
    "gitBroken",
  ],
];

// spec: folders.health
test("a work folder that isn't a git repository, has no git-ignored .practice/, or is gone gets a note before the first step", () => {
  // was learn-folder:722
  // dropped: T-render each note's words, its rows and fitsAll; the note is folderProblem
  for (const [label, found, problem] of PROBLEMS) {
    // The overview that asked, the overview of a later lesson, and another
    // lesson of the level opened.
    const i1 = atI1({ intermediate: MINE });
    const i2 = driver({
      course: threeLevels({
        "i-1": DEMO_I1,
        "i-2": DEMO_I1.replace("lesson: i-1", "lesson: i-2"),
      }),
      saved: save({
        lessons: {
          ...finishedBefore("i-1", withI1()),
          "i-1": { complete: true },
        },
        folders: { intermediate: MINE },
      }),
    });
    const i3 = atI1({ intermediate: MINE });
    i3.open("i-3");
    for (const [at, d] of [
      ["i-1 intro", i1],
      ["i-2 intro", i2],
      ["i-3 opened", i3],
    ]) {
      assert.equal(
        folderProblem(d.state),
        null,
        `${at}: no note before main has looked`,
      );
      d.send({ type: "probed", path: MINE, ...found });
      assert.equal(folderProblem(d.state), problem, `${label}, ${at}`);
      assert.ok(introNotes(d.state).includes("folder"), `${label}, ${at}`);
    }
  }
  const broken = atI1({ intermediate: MINE });
  broken.send({
    type: "probed",
    path: MINE,
    missing: false,
    git: false,
    gitBroken: "git is not installed",
    practice: false,
  });
  assert.notEqual(
    folderProblem(broken.state),
    "notGit",
    'git not installed is not "not a git repository"',
  );
  // A folder that is all three, and the copy, get none; a look that finds
  // it set right takes the note away.
  const ok = atI1({ intermediate: MINE });
  ok.send({
    type: "probed",
    path: MINE,
    missing: false,
    git: true,
    practice: false,
  });
  assert.equal(folderProblem(ok.state), "noPractice");
  ok.send({
    type: "probed",
    path: MINE,
    missing: false,
    git: true,
    practice: true,
  });
  const copy = atI1({ intermediate: COPY });
  for (const d of [ok, copy]) {
    assert.equal(folderProblem(d.state), null);
    assert.ok(!introNotes(d.state).includes("folder"));
  }
});

// ---- a Worked example in the practice copy (ticket 183) ------------------------
// A made-up i-1 whose page runs its Worked example "In your practice copy:"
// and its Your turn in the Learner's repository, as i-4's does: W and Y
// steps that read the same file, a check, git status, a run line for each
// folder, a fresh stamp one step takes for another, and a prerequisite.
const SETTINGS = ".claude/settings.json";
const WORKED = `---
lesson: i-1
title: "Demo"
stamp: "Verified against Claude Code v2.1.308 (stable) on 2026-10-25"
next: i-2
worked: copy
requires: [b-5 check 0]
---

## intro
- minutes: "about 20 minutes"
- can: "do it"
- need-repo: "One of your own repositories with a test command, for Your turn; or use the template copy for both."

## steps

### W1 | Worked example step 1 of 3 | Save the rules
- tier: guided
- skill: edit-settings
- where: editor
- beat: do
- verify: json ${SETTINGS} permissions.deny.0 fresh
- do: "Save the team's rules as \`${SETTINGS}\`."

### W2 | Worked example step 2 of 3 | Check the copy
- tier: guided
- skill: run-check
- where: shell
- beat: do
- verify: check 0
- run: "cd <your practice copy>"

### W3 | Worked example step 3 of 3 | See the change
- tier: guided
- skill: see-change
- where: shell
- beat: do
- verify: git-changed .claude/
- run: "git status"

### Y1 | Your turn step 1 of 3 | Your rules
- tier: hinted
- skill: edit-settings
- where: editor
- beat: do
- verify: json ${SETTINGS} permissions.allow.0 fresh since W1
- goal: "Save this partial file as \`${SETTINGS}\`."
- beat: do
- verify: no-match ${SETTINGS} TODO
- goal: "Replace each \`TODO\` with a rule."
- hint: "Allow only the one command that runs your tests"

### Y2 | Your turn step 2 of 3 | Check your repository
- tier: challenge
- skill: run-check
- where: shell
- beat: do
- verify: check 0
- goal: "Commit it"

### Y3 | Your turn step 3 of 3 | A clean tree
- tier: challenge
- skill: see-change
- where: shell
- beat: do
- verify: git-clean
- goal: "Commit everything."

### C | Check | Check
- tier: challenge
- skill: check
- where: shell
- beat: do
- verify: check all
- run: "npm run check -- i-1 --dir <your repo>"
`;
const worked = () => threeLevels({ "i-1": WORKED });
// A Learner past Beginner, on i-1's overview (or where `lessons` puts
// them), with these folders saved.
const atWorked = (folders, lessons = {}) => {
  const c = worked();
  return driver({
    course: c,
    saved: save({
      lessons: { ...finishedBefore("i-1", c), ...lessons },
      ...(folders ? { folders } : {}),
    }),
  });
};
// The settings file as the Learner saves it: it passes every beat that
// reads it.
const RULES = Buffer.from(
  '{"permissions": {"allow": ["Bash(npm test)"], "deny": ["Read(./.env)"]}}',
);
// Passes the beat on the card with results from `dir`, then goes on: a
// fresh file changes after its first read.
function passHere(d, dir) {
  const v = beatOf(d.state).verify;
  const lesson = lessonOf(d.state);
  if (v.kind === "check") {
    const items = (v.all ? lesson.items.map((_, i) => i) : v.items).map(
      (index) => ({ index, text: lesson.items[index], pass: true, hint: "" }),
    );
    d.send({ type: "check", lesson: "i-1", items, dir });
  } else if (v.path && v.kind.startsWith("git-"))
    d.send(gitLists([`${v.path}settings.json`], [], { dir }));
  else if (v.kind === "git-clean") d.send({ type: "git", paths: [], dir });
  else {
    d.send({ type: "file", path: v.path, read: RULES, stamp: "first", dir });
    if (v.fresh)
      d.send({
        type: "file",
        path: v.path,
        read: RULES,
        stamp: "changed",
        dir,
      });
  }
  assert.ok(
    isDone(d.state.beat),
    `${stepOf(d.state).id}: ${d.state.beat.status}`,
  );
  d.cont();
  if (d.state.phase === "step-down") d.accept();
}
// The folder the effect that opened the beat on the card names: its check,
// file read or git status.
const askedIn = (d) => {
  const v = beatOf(d.state).verify;
  return lastOf(
    d.effects,
    v.kind === "check" ? "check" : v.kind.startsWith("git-") ? "git" : "file",
  ).dir;
};
const stampsAsked = (d) =>
  d.effects.filter((e) => e.type === "stamp").map((e) => [e.key, e.dir]);

test("worked: copy, the key for a Worked example in the practice copy, parses; it is refused beside folder: copy or new copy, and on a lesson its PATH entry pins", () => {
  // was learn-folder:1377
  assert.equal(parseLesson(WORKED, "i-1.md").worked, "copy");
  assert.equal(parseLesson(DEMO_I1, "i-1.md").worked, undefined);
  assert.throws(
    () => parseLesson(WORKED.replace("worked: copy", "worked: mine"), "i-1.md"),
    /i-1\.md: worked is copy, not mine/,
  );
  for (const folder of ["copy", "new copy"]) {
    assert.throws(
      () =>
        parseLesson(
          WORKED.replace("worked: copy", `worked: copy\nfolder: ${folder}`),
          "i-1.md",
        ),
      new RegExp(
        `i-1\\.md: worked: copy with folder: ${folder}, which already places every step`,
      ),
    );
  }
  // i-capstone is pinned to the copy, and a-5 to a new copy, on PATH.
  const dir = mkdtempSync(join(tmpdir(), "learn-worked-"));
  try {
    mkdirSync(join(dir, "learn", "lessons"), { recursive: true });
    for (const [id, words] of [
      ["i-capstone", "the practice copy"],
      ["a-5", "its new copy"],
    ]) {
      writeFileSync(
        join(dir, "learn", "lessons", `${id}.md`),
        WORKED.replace("lesson: i-1", `lesson: ${id}`).replace(
          "requires: [b-5 check 0]\n",
          "",
        ),
      );
      assert.throws(
        () =>
          loadCourse(
            dir,
            PATH.filter((p) => p.id === id),
          ),
        new RegExp(
          `learn/lessons/${id}\\.md: worked: copy, but ${id} runs every step in ${words}`,
        ),
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// spec: folders.worked-copy
test("worked: copy reads each Worked example step in the practice copy, every verify kind, and Your turn, the Check and the prerequisites in the work folder", () => {
  // was learn-folder:1397
  const d = atWorked({ intermediate: MINE });
  assert.equal(
    introAsks(d.state).find((e) => e.type === "prereqs").dir,
    MINE,
    "the prerequisites are looked at in the work folder",
  );
  d.start();
  assert.equal(stepOf(d.state).id, "W1");
  // The fresh stamps: W1's in the copy, and Y1's, taken as W1 opens, in the
  // work folder.
  assert.deepEqual(stampsAsked(d), [
    ["W1.0", COPY],
    ["Y1.0", MINE],
  ]);
  // A stamp from the other folder is not about its file.
  d.send({ type: "stamp", key: "W1.0", stamp: "mine", dir: MINE });
  d.send({ type: "stamp", key: "Y1.0", stamp: "copy", dir: COPY });
  assert.deepEqual(d.state.progress["i-1"].stamps, {});
  d.send({ type: "stamp", key: "W1.0", stamp: "first", dir: COPY });
  d.send({ type: "stamp", key: "Y1.0", stamp: "first", dir: MINE });
  assert.deepEqual(d.state.progress["i-1"].stamps, {
    "W1.0": "first",
    "Y1.0": "first",
  });
  // W1 reads its file in the copy: on opening, on r, and only a read from
  // there decides.
  assert.deepEqual(lastOf(d.effects, "file"), {
    type: "file",
    path: SETTINGS,
    dir: COPY,
  });
  assert.deepEqual(watching(d.state), { file: SETTINGS, dir: COPY });
  assert.equal(folderHere(d.state), COPY);
  d.run();
  assert.equal(lastOf(d.effects, "file").dir, COPY, "r's read too");
  d.send({
    type: "file",
    path: SETTINGS,
    read: RULES,
    stamp: "changed",
    asked: d.state.beat.asked,
    dir: MINE,
  });
  assert.equal(
    d.state.beat.status,
    "opening",
    "a read of the work folder is not about this step",
  );
  // Unchanged in the copy since its stamp there, it waits; changed, it
  // passes.
  d.send({
    type: "file",
    path: SETTINGS,
    read: RULES,
    stamp: "first",
    asked: d.state.beat.asked,
    dir: COPY,
  });
  assert.equal(d.state.beat.status, "waiting");
  d.send({
    type: "file",
    path: SETTINGS,
    read: RULES,
    stamp: "changed",
    dir: COPY,
  });
  assert.equal(d.state.beat.status, "done");
  d.cont();
  // W2's check, in the copy; a result from the work folder decides nothing.
  assert.equal(stepOf(d.state).id, "W2");
  assert.equal(askedIn(d), COPY);
  d.run();
  assert.equal(lastOf(d.effects, "check").dir, COPY, "r's run too");
  const items = [
    { index: 0, text: lessonOf(d.state).items[0], pass: true, hint: "" },
  ];
  d.send({
    type: "check",
    lesson: "i-1",
    items,
    asked: d.state.beat.asked,
    dir: MINE,
  });
  assert.equal(d.state.beat.status, "opening");
  passHere(d, COPY);
  // W3's git status, in the copy.
  assert.equal(stepOf(d.state).id, "W3");
  assert.deepEqual(lastOf(d.effects, "git"), {
    type: "git",
    dir: COPY,
    files: true,
  });
  d.send(gitLists([".claude/settings.json"], [], { dir: MINE }));
  assert.equal(d.state.beat.status, "opening");
  passHere(d, COPY);
  // Your turn: every verify in the work folder.
  for (const [id, beat] of [
    ["Y1", 0],
    ["Y1", 1],
    ["Y2", 0],
    ["Y3", 0],
    ["C", 0],
  ]) {
    assert.deepEqual([stepOf(d.state).id, d.state.pos.beat], [id, beat]);
    assert.equal(askedIn(d), MINE, `${id}.${beat}`);
    assert.equal(watching(d.state).dir, MINE, `${id}.${beat}`);
    if (id === "C") break;
    passHere(d, MINE);
  }
  // Y1's fresh beat compared the work folder's file with its stamp from
  // there.
  assert.equal(d.state.progress["i-1"].stamps["Y1.0"], "first");
});

// spec: folders.worked-copy
test("worked: copy keeps each step in its own folder through back and forward, a resume, a restart and a replay", () => {
  // was learn-folder:1452
  const d = atWorked(
    { intermediate: MINE },
    {
      "i-1": {
        step: "Y1",
        beat: 0,
        done: ["W1", "W2", "W3"],
        levels: ["hinted"],
      },
    },
  );
  assert.deepEqual([d.state.phase, d.state.beat], ["playing", null]);
  assert.equal(folderHere(d.state), MINE);
  d.open();
  assert.equal(askedIn(d), MINE);
  // Back to W3, its last beat: git status in the copy; on again, the work
  // folder.
  d.back();
  assert.equal(stepOf(d.state).id, "W3");
  assert.equal(askedIn(d), COPY);
  assert.equal(watching(d.state).dir, COPY);
  passHere(d, COPY);
  assert.equal(stepOf(d.state).id, "Y1");
  assert.equal(askedIn(d), MINE);
  // A resume on a Worked example step: the copy.
  for (const [step, dir] of [
    ["W1", COPY],
    ["W2", COPY],
    ["Y2", MINE],
    ["C", MINE],
  ]) {
    const r = atWorked(
      { intermediate: MINE },
      { "i-1": { step, beat: 0, levels: ["hinted", "challenge"] } },
    );
    assert.equal(folderHere(r.state), dir, `resume at ${step}`);
    r.open();
    assert.equal(askedIn(r), dir, `resumed at ${step}`);
  }
  // A restart from the resume starts over in the copy.
  const x = atWorked(
    { intermediate: MINE },
    {
      "i-1": {
        step: "Y2",
        beat: 0,
        levels: ["hinted", "challenge"],
        stamps: { "W1.0": "old", "Y1.0": "old" },
      },
    },
  );
  x.restart("i-1");
  assert.equal(x.state.phase, "overview");
  assert.equal(lastOf(x.effects, "prereqs").dir, MINE);
  x.start();
  assert.deepEqual([stepOf(x.state).id, askedIn(x)], ["W1", COPY]);
  assert.deepEqual(stampsAsked(x), [
    ["W1.0", COPY],
    ["Y1.0", MINE],
  ]);
  // A finished lesson played again: the same.
  const again = atWorked(
    { intermediate: MINE },
    {
      "i-1": {
        complete: true,
        done: ["W1", "W2", "W3", "Y1", "Y2", "Y3", "C"],
      },
    },
  );
  // The app opens on the lesson after it, i-2.
  assert.deepEqual(
    [again.state.phase, again.state.lesson],
    ["overview", "i-2"],
  );
  again.open("i-1");
  assert.equal(again.state.phase, "overview");
  again.start();
  assert.deepEqual([stepOf(again.state).id, askedIn(again)], ["W1", COPY]);
});

test("r27 E15: a lesson in a new copy shows the page's check command, without --dir, and says to run it in the new copy; a level folder keeps --dir", () => {
  // was learn-folder:1494
  // dropped: T-render the check command, --dir and the "run it too" line; the engine facts are where the Check ran and that it passed
  const passAll = (d, id, dir) =>
    d.send({
      type: "check",
      lesson: id,
      items: lessonOf(d.state).items.map((text, index) => ({
        index,
        text,
        pass: true,
        hint: "",
      })),
      dir,
    });
  const a5 = driver({
    course,
    saved: save({
      lessons: {
        ...finishedBefore("a-5"),
        "a-5": { step: "C", beat: 0, warm: [], levels: ["challenge"] },
      },
      folders: { "a-5": ACTIONS },
    }),
  });
  a5.open();
  assert.deepEqual(
    [a5.state.lesson, stepOf(a5.state).id, folderHere(a5.state)],
    ["a-5", "C", ACTIONS],
  );
  assert.equal(lastOf(a5.effects, "check").dir, ACTIONS);
  passAll(a5, "a-5", ACTIONS);
  assert.ok(isDone(a5.state.beat), a5.state.beat.status);
  // The Learner's own repository: its Check runs there.
  const mine = atWorked(
    { intermediate: MINE },
    {
      "i-1": {
        step: "C",
        beat: 0,
        done: ["W1", "W2", "W3", "Y1", "Y2", "Y3"],
        levels: ["hinted", "challenge"],
      },
    },
  );
  mine.open();
  assert.equal(stepOf(mine.state).id, "C");
  assert.equal(folderHere(mine.state), MINE);
  passAll(mine, "i-1", MINE);
  assert.ok(isDone(mine.state.beat), mine.state.beat.status);
});

test("r27 E10: a clean tree is named for where it is: the learner's repository in a work folder, the practice copy in the copy", () => {
  // was learn-folder:1517
  // dropped: T-render C.cleanRepo and C.cleanCopy; the engine fact is the folder the clean tree was read in
  for (const [folders, dir] of [
    [{ intermediate: MINE }, MINE],
    [{ intermediate: COPY }, COPY],
  ]) {
    const d = atWorked(folders, {
      "i-1": {
        step: "Y3",
        beat: 0,
        done: ["W1", "W2", "W3", "Y1", "Y2"],
        levels: ["hinted", "challenge"],
      },
    });
    d.open();
    assert.deepEqual(
      [stepOf(d.state).id, beatOf(d.state).verify.kind, askedIn(d)],
      ["Y3", "git-clean", dir],
    );
    assert.equal(folderHere(d.state), dir);
    d.send({ type: "git", paths: ["src/a.js"], dir });
    d.send({ type: "git", paths: [], dir });
    assert.equal(d.state.beat.status, "done");
  }
});

// spec: folders.worked-copy
test("worked: copy where the work folder is the practice copy itself, or not chosen yet, runs every step in the copy, as before", () => {
  // was learn-folder:1536
  for (const folders of [{ intermediate: COPY }, null]) {
    const d = atWorked(folders);
    if (!folders) d.folderChoose("intermediate", "practice-copy");
    assert.equal(
      introAsks(d.state).find((e) => e.type === "prereqs").dir,
      COPY,
    );
    d.start();
    const dirs = [];
    for (let i = 0; i < 8 && stepOf(d.state).id !== "C"; i++) {
      dirs.push(askedIn(d), watching(d.state).dir, folderHere(d.state));
      // dropped: T-render the header naming no folder
      passHere(d, COPY);
    }
    assert.deepEqual([...new Set(dirs)], [COPY]);
    assert.equal(askedIn(d), COPY);
  }
});

// spec: folders.change-drops
test("switching folders keeps what a Worked example step in the copy compares its file with, and drops the old work folder's", () => {
  // was learn-folder:1556
  const OTHER = "/home/sam/code/other-app";
  const d = atWorked({ intermediate: MINE });
  d.start();
  d.send({ type: "stamp", key: "W1.0", stamp: "copy-1", dir: COPY });
  d.send({ type: "stamp", key: "Y1.0", stamp: "mine-1", dir: MINE });
  // The folder changes with the step card open (D2): the engine asks
  // nothing again; W1 still watches the copy, and the host's next poll
  // there answers it.
  giveFolder(d, "intermediate", OTHER);
  assert.deepEqual(d.state.progress["i-1"].stamps, { "W1.0": "copy-1" });
  const w = watching(d.state);
  assert.deepEqual([stepOf(d.state).id, w.dir], ["W1", COPY]);
  // The file in the copy, unchanged since its stamp: W1 still waits for the
  // change.
  d.send({
    type: "file",
    path: w.file,
    read: RULES,
    stamp: "copy-1",
    dir: w.dir,
  });
  assert.equal(d.state.beat.status, "waiting");
});

test("the header says where each step happens: in your practice copy on a Worked example step, the work folder's name elsewhere, and each card's place and run line agree", () => {
  // was learn-folder:1575
  // dropped: T-render the header rows, the place lines, the run lines, fitsAll and the stray-command note; the folder each names is folderHere
  const d = atWorked({ intermediate: MINE });
  const here = (label, want) => assert.equal(folderHere(d.state), want, label);
  here("intro", MINE);
  d.start();
  here("W1", COPY);
  passHere(d, COPY);
  here("W2", COPY);
  passHere(d, COPY);
  passHere(d, COPY);
  assert.equal(stepOf(d.state).id, "Y1");
  here("Y1", MINE);
  passHere(d, MINE);
  passHere(d, MINE);
  assert.equal(stepOf(d.state).id, "Y2");
  here("Y2", MINE);
  passHere(d, MINE);
  passHere(d, MINE);
  assert.equal(stepOf(d.state).id, "C");
  here("C", MINE);
  // The resume of a Worked example step: the copy.
  const r = atWorked(
    { intermediate: MINE },
    { "i-1": { step: "W3", beat: 0, levels: [] } },
  );
  assert.deepEqual([r.state.phase, r.state.beat], ["playing", null]);
  assert.equal(folderHere(r.state), COPY);
});

test("a check all on a Worked example step names no --dir: it runs in the copy itself", () => {
  // was learn-folder:1613
  const text = WORKED.replace(
    '- verify: check 0\n- run: "cd <your practice copy>"',
    '- verify: check all\n- run: "cd <your practice copy>"',
  );
  const c = threeLevels({ "i-1": text });
  const d = driver({
    course: c,
    saved: save({
      lessons: { ...finishedBefore("i-1", c), "i-1": { step: "W2", beat: 0 } },
      folders: { intermediate: MINE },
    }),
  });
  d.open();
  assert.equal(lastOf(d.effects, "check").dir, COPY);
  const items = lessonOf(d.state).items.map((t, index) => ({
    index,
    text: t,
    pass: true,
    hint: "",
  }));
  d.send({ type: "check", lesson: "i-1", items, dir: COPY });
  assert.ok(isDone(d.state.beat), d.state.beat.status);
  // dropped: T-render "npm run check -- i-1 passes" with no --dir, and fitsAll
});
