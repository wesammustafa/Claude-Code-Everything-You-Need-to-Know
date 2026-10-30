// The action driver (ticket 208): the lesson engine driven by Learner
// actions, results and ticks. It is the lesson tests' way into the engine's
// modules in ../src: nothing here knows a key, a view or a screen.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import {
  ACTION_TYPES,
  EFFECT_TYPES,
  IDLE_MS,
  asksFolder,
  beatOf,
  folderKey,
  folderOf,
  folderOptions,
  hintAvailable,
  initialState,
  isDone,
  lessonOf,
  nextLessonOf,
  reduce,
  stepOf,
  stepsOf,
} from "../src/engine.ts";
import { loadCourse, parseLesson, WORK_LEVELS } from "../src/course.ts";
import { versionSaved } from "./fixtures/saved-version.mjs";
import { openRepo } from "../../../practice-template/checks/repo.mjs";
import {
  repo,
  withRepo,
  write,
} from "../../../practice-template/checks/test/helpers.mjs";
import { DEMO_B2 } from "./fixtures/course.mjs";

export {
  ACTION_TYPES,
  EFFECT_TYPES,
  ENGINE_FIELDS,
  EVENT_TYPES,
  IDLE_MS,
  RESULTS,
  TYPED_MAX,
  WARMUPS,
  answerKey,
  answersGit,
  asStarted,
  asksFolder,
  asksHere,
  authoredTier,
  backOffered,
  backTo,
  beatOf,
  beatShown,
  cardOf,
  contentOf,
  doneBefore,
  easeLands,
  folderKey,
  folderOf,
  folderOptions,
  folderProblem,
  hidesRuns,
  hintAvailable,
  hintStatus,
  initialState,
  introAsks,
  introNotes,
  introOptions,
  isDone,
  isLastBeat,
  lessonNumber,
  lessonOf,
  levelFolder,
  levelKey,
  levelLessons,
  levelOf,
  levelsOf,
  longWait,
  missingNeeds,
  moreHelpGives,
  nextLessonOf,
  normalize,
  offered,
  pickWarmups,
  pinOf,
  readFrom,
  recallOf,
  reduce,
  repoNeed,
  rungsOf,
  sameJson,
  stepNote,
  stepOf,
  stepsOf,
  tearDownLeft,
  tierOf,
  tiersOf,
  toFinish,
  tryFirst,
  unmet,
  watching,
  whileRunsOf,
  whileRunsOpen,
} from "../src/engine.ts";
export { GIT, OWN_PARTS, READS } from "../src/content.ts";
export {
  loadCourse,
  parseLesson,
  PATH,
  SLOW,
  WORK_LEVELS,
} from "../src/course.ts";
// The store's format lives with the host since ticket 209.
export { FORMAT, sanitize, snapshot } from "../../host/src/store.mjs";
export { judge, stampFor } from "../src/holds.ts";
export { statusStamp } from "../src/status.ts";
export { mix, ruleTiers, TIERS } from "../src/tiers.ts";
export {
  DEMO_B2,
  DEMO_I1,
  DEMO_I1_INDEX,
  withCode,
} from "./fixtures/course.mjs";

// ---- fixtures ------------------------------------------------------------------
export const root = fileURLToPath(
  new URL("../../../practice-template/", import.meta.url),
);
// The Beginner fixture course: stable step files for tests of generic
// behavior, so they don't follow the live course's editorial changes.
export const REDUCER_COURSE = fileURLToPath(
  new URL("./fixtures/reducer-course/", import.meta.url),
);
const fixture = (id) => readFileSync(join(REDUCER_COURSE, `${id}.md`), "utf8");

// Stable synthetic course for the lesson tests: the live course with each
// Beginner lesson's content taken from the fixture course, so tests of
// generic behavior don't follow editorial step numbering.
export const liveCourse = loadCourse(root);
export const course = liveCourse.map((l) => {
  if (l.level !== "beginner") return l;
  const content = parseLesson(fixture(l.id), `fixture/${l.id}.md`);
  const slow = l.id === "b-3" ? [1] : l.id === "b-capstone" ? [3, 4] : [];
  return { ...l, items: content.ladder.map((r) => r.item), slow, content };
});
// The course with b-4's /exit warm-up (R2) holding no hint of its own, so a
// wrong answer it doesn't list gets the app's own line (ticket 187).
export const bareExit = course.map((l) =>
  l.id === "b-4"
    ? {
        ...l,
        content: parseLesson(
          fixture("b-4").replace(
            '- hint: "End the session with `/exit`."\n',
            "",
          ),
          "fixture/b-4.md",
        ),
      }
    : l,
);
// The folder a learner gives for a lesson that runs in a new copy of the
// template.
export const NEW_COPY = "/home/sam/claude-actions-practice";
export const FACTS = {
  root: "/home/sam/claude-code-practice",
  name: "Sam",
  gitError: null,
  practiceDir: true,
  codespace: false,
  win32: false,
};

// The b-1 item's real result for a version.txt holding `text` (null: no file).
export function b1Item(text) {
  return withRepo(
    () => repo(),
    (dir) => {
      if (text !== null) write(dir, { ".practice/version.txt": text });
      const outcome = versionSaved.check(openRepo(dir));
      return {
        index: 0,
        text: versionSaved.text,
        pass: outcome === true,
        hint: outcome === true ? "" : outcome.replace(dir, FACTS.root),
      };
    },
  );
}

// The course with lesson 1 as the only lesson with content, so a test of
// lesson 1 alone stays put.
export const b1Only = course.map((l) =>
  l.id === "b-1" ? l : { ...l, content: null },
);
// That course, with made-up content files for some lessons, { id: text }.
export const courseWith = (texts) =>
  b1Only.map((l) =>
    texts[l.id] ? { ...l, content: parseLesson(texts[l.id], `${l.id}.md`) } : l,
  );
// The course of all three levels, with made-up content files for some
// lessons, { id: text }, in place of their own.
export const threeLevels = (texts = {}) =>
  course.map((l) =>
    texts[l.id] ? { ...l, content: parseLesson(texts[l.id], `${l.id}.md`) } : l,
  );

// A lesson finished on the path: complete, with every one of its own steps
// done. Help fades only for what the learner did, so a seed without `done`
// is a learner who skipped the lesson.
export const finished = (l) => ({
  complete: true,
  done: l.content.steps.map((x) => x.id),
});
// The last lesson a learner reaches by playing the lessons in order from
// `from` (the first lesson by default): the one before the next lesson with
// no lesson file.
export const lastInOrder = (lessons = course, from = lessons[0].id) => {
  const start = lessons.findIndex((l) => l.id === from);
  const gap = lessons.findIndex((l, i) => i > start && !l.content);
  return lessons[(gap < 0 ? lessons.length : gap) - 1].id;
};
// Every lesson in the app before `id`, finished.
export const finishedBefore = (id, lessons = course) =>
  Object.fromEntries(
    lessons
      .slice(
        0,
        lessons.findIndex((l) => l.id === id),
      )
      .filter((l) => l.content)
      .map((l) => [l.id, finished(l)]),
  );

// A saved file, as the store keeps it: the welcome seen.
export const save = (fields = {}) => ({ format: 1, welcomed: true, ...fields });

// ---- the driver -----------------------------------------------------------------
// Every input costs no time unless it carries `wait`, so the clock moves
// only where a test says so: idle is the time since the beat opened, a FAIL
// or `activity`, never since the last action.
export function driver({
  saved = null,
  facts: given = {},
  course: lessons = b1Only,
  now: start = 1_000,
} = {}) {
  let now = start;
  let state = initialState({
    course: lessons,
    saved,
    facts: { ...FACTS, ...given },
    now,
  });
  const effects = [];
  const events = [];
  let last = null;
  const send = (input) => {
    const { wait = 0, ...rest } = input;
    now += wait;
    const prev = state;
    const r = reduce(prev, { ...rest, now });
    state = r.state;
    effects.push(...r.effects);
    events.push(...r.events);
    last = {
      input: rest,
      effects: r.effects,
      events: r.events,
      changed: !isDeepStrictEqual(prev, r.state),
    };
    return r.effects;
  };
  const act = (type, fields = {}) => {
    assert.ok(ACTION_TYPES.includes(type), `${type} is not an action`);
    send({ type, ...fields });
    return last;
  };
  const refused = (type, fields = {}) => {
    act(type, fields);
    assert.equal(last.changed, false, `${type} changed the state`);
    assert.deepEqual(last.effects, [], `${type} asked for effects`);
    assert.deepEqual(last.events, [], `${type} marked a moment`);
    return last;
  };
  return {
    get state() {
      return state;
    },
    get now() {
      return now;
    },
    get last() {
      return last;
    },
    effects,
    events,
    send,
    act,
    refused,
    tick(ms) {
      assert.equal(typeof ms, "number", "tick takes the time that passes");
      return send({ type: "tick", wait: ms });
    },
    activity: () => send({ type: "activity" }),
    finishWelcome: () => act("welcome.finish"),
    open: (lesson = state.lesson) => act("lesson.open", { lesson }),
    start: (help = "planned") => act("lesson.start", { help }),
    restart: (lesson = state.lesson) => act("lesson.restart", { lesson }),
    next: () => act("lesson.next"),
    cont: () => act("step.continue"),
    back: () => act("step.back"),
    skip: () => act("step.skip"),
    revisit: () => act("step.revisit"),
    pick: (option) => act("answer.pick", { option }),
    reveal: () => act("answer.reveal"),
    type: (text) => act("answer.type", { text }),
    markDone: () => act("step.markDone"),
    ended: () => act("session.ended"),
    run: () => act("check.run"),
    hint: () => act("hint.next"),
    exact: (take = true) => act("hint.takeExact", { take }),
    waitAnswer: (option) => act("waitQuestion.answer", { option }),
    accept: () => act("stepDown.accept"),
    moreHelp: () => act("stepDown.moreHelp"),
    stepBack: () => act("stepDown.back"),
    folderAsk: (key) => act("folder.ask", { key }),
    folderChoose: (key, to) => act("folder.choose", { key, to }),
    folderCancel: () => act("folder.cancel"),
  };
}

// The state after `inputs` from a saved place, for one-line guard tests.
export function stateAt(
  saved,
  inputs,
  { course: lessons = b1Only, facts = {} } = {},
) {
  let s = initialState({
    course: lessons,
    saved,
    facts: { ...FACTS, ...facts },
    now: 1_000,
  });
  for (const { wait = 0, ...input } of inputs) {
    s = reduce(s, { ...input, now: s.now + wait }).state;
  }
  return s;
}

// ---- where the Learner is ----------------------------------------------------------
// What the old views were: an intro is `overview`, a step card is `playing`
// with a beat, a resume `playing` with none, a level-up `step-down`, the
// lesson's end and next screen `complete`.
export const where = (s) => ({
  lesson: s.lesson,
  phase: s.phase,
  step: s.beat ? stepOf(s).id : null,
  beat: s.beat ? s.pos.beat : null,
  status: s.beat?.status ?? null,
});
// The step a resume opens on, before the beat is open.
const resumeStep = (s) =>
  stepsOf(s).find((x) => x.id === s.progress[s.lesson].step) ?? null;
// The folder the step on screen, or the one a resume opens, runs in.
export const folderHere = (s) =>
  folderOf(s, s.lesson, s.beat ? stepOf(s) : resumeStep(s));
// Whether the card offers "A little more help": an eased step, not done, on
// its first beat.
export const showsMoreHelp = (s) =>
  Boolean(s.beat?.eased) && !isDone(s.beat) && s.pos.beat === 0;

// ---- results ---------------------------------------------------------------------
// Each answers the effect it is given, as the host answers it: `asked` and
// `dir` come from the effect unless a test overrides them.
const from = (eff) => ({
  ...(eff.asked !== undefined ? { asked: eff.asked } : {}),
  ...(eff.dir !== undefined ? { dir: eff.dir } : {}),
});
const asBytes = (x) => (typeof x === "string" ? Buffer.from(x) : x);

export const checkResult = (
  eff,
  items,
  {
    read = null,
    path = eff.evidence ?? null,
    found = null,
    stamp = "x",
    ...rest
  } = {},
) => ({
  type: "check",
  lesson: eff.lesson,
  items,
  read: asBytes(read),
  path,
  found,
  stamp,
  ...from(eff),
  ...rest,
});
export const checkError = (eff, message, rest = {}) => ({
  type: "check-error",
  lesson: eff.lesson,
  message,
  ...from(eff),
  ...rest,
});
// The check child starts its nth item of m.
export const running = (eff, n, m, rest = {}) => ({
  type: "running",
  lesson: eff.lesson,
  items: eff.items,
  n,
  m,
  ...(eff.asked !== undefined ? { asked: eff.asked } : {}),
  ...rest,
});
// A file read now: null when it isn't there.
export const fileResult = (eff, text, { stamp, found, ...rest } = {}) => ({
  type: "file",
  path: eff.path,
  found: found ?? (text === null ? null : eff.path),
  read: text === null ? null : asBytes(text),
  stamp: stamp ?? (text === null ? "" : "x"),
  asked: eff.asked ?? 0,
  ...(eff.dir !== undefined ? { dir: eff.dir } : {}),
  ...rest,
});
export const gitResult = (
  eff,
  { paths = [], staged = [], head = null, ...rest } = {},
) => ({
  type: "git",
  paths,
  staged,
  files: Boolean(eff.files),
  ...(eff.head ? { head } : {}),
  ...from(eff),
  ...rest,
});
export const gitError = (message, eff = {}) => ({
  type: "git-error",
  message,
  ...from(eff),
});
export const probeResult = (
  eff,
  { pass = false, hint = "", evidence = null, state = "", ...rest } = {},
) => ({
  type: "probe",
  name: eff.name,
  args: eff.args,
  pass,
  hint,
  evidence,
  state,
  ...from(eff),
  ...rest,
});
export const probeError = (message, eff = {}) => ({
  type: "probe-error",
  message,
  ...from(eff),
});
export const stampResult = (eff, stamp) => ({
  type: "stamp",
  key: eff.key,
  stamp,
  ...(eff.dir !== undefined ? { dir: eff.dir } : {}),
});
// What main found at the folder a `folder` effect asked about: by default a
// git repository holding .practice/ at the path the Learner gave.
export const probed = (
  eff,
  {
    path = eff.text,
    missing = false,
    git = !missing,
    gitBroken = null,
    practice = !missing,
    ...rest
  } = {},
) => ({
  type: "probed",
  key: eff.key,
  asked: eff.asked,
  path,
  missing,
  git,
  gitBroken,
  practice,
  ...rest,
});
// One prerequisite of a `prereqs` effect, at index `at`: { pass } for a
// check item or a probe, { read } (text or bytes) for a file, { hint }.
export const prereq = (eff, at, found = {}) => ({
  type: "prereq",
  lesson: eff.lesson,
  dir: eff.dir,
  at,
  ...(eff.asked !== undefined ? { asked: eff.asked } : {}),
  ...found,
  ...("read" in found ? { read: asBytes(found.read) } : {}),
});
export const commands = (found) => ({ type: "commands", found });
export const facts = (f) => ({ type: "facts", facts: f });

// The latest effect of `type`: from the last input, else from the whole run.
export const pending = (d, type) =>
  d.last?.effects.findLast((e) => e.type === type) ??
  d.effects.findLast((e) => e.type === type);

// Sends the result `eff` asks for, built by its builder with `overrides`,
// and returns the effects it caused. A check's items default to every item
// it ran, passing as `overrides.pass` says (false by default); a file's
// text is `overrides.text` (null by default); a `prereqs` effect gets one
// answer per prerequisite; a `commands` effect finds every name unless
// `overrides.found` says otherwise. `save` asks for nothing back.
export function respond(d, eff, overrides = {}) {
  switch (eff.type) {
    case "check": {
      const { pass = false, items, ...rest } = overrides;
      const l = lessonOf(d.state, eff.lesson);
      const all =
        items ??
        (eff.items ?? l.items.map((_, k) => k)).map((index) => ({
          index,
          text: l.items[index],
          pass,
          hint: pass ? "" : `${l.items[index]} is not there yet.`,
        }));
      return d.send(checkResult(eff, all, rest));
    }
    case "file": {
      const { text = null, ...rest } = overrides;
      return d.send(fileResult(eff, text, rest));
    }
    case "git":
      return d.send(gitResult(eff, overrides));
    case "probe":
      return d.send(probeResult(eff, overrides));
    case "stamp":
      return d.send(stampResult(eff, overrides.stamp ?? "x"));
    case "folder":
      return d.send(probed(eff, overrides));
    case "prereqs":
      return eff.requires.flatMap((_, at) =>
        d.send(prereq(eff, at, overrides)),
      );
    case "commands":
      return d.send(
        commands(
          Object.fromEntries(
            eff.names.map((n) => [n, overrides.found?.[n] ?? true]),
          ),
        ),
      );
    case "save":
      return [];
    default:
      throw new Error(`respond: no result answers a ${eff.type} effect`);
  }
}

// ---- results built from what the step reads ------------------------------------------
// What git status lists, as main reads it for a beat on part of the tree
// (ticket 88): every untracked file on its own line (`files`), and the paths
// whose index column says staged.
export const gitLists = (paths, staged = [], extra = {}) => ({
  type: "git",
  files: true,
  paths,
  staged,
  ...extra,
});

// A line that a lesson's match regex matches, built from the regex itself:
// its first branch of every group, one of every class or wildcard, a
// quantified part once. Enough for the plain regexes lesson files hold
// (app words, no lookaround or backreference); a test fails loudly where one
// is beyond it.
export function lineFor(regex) {
  // A literal fixture for the description's minimum-length predicate. It is
  // input for screen traversal; the scoped test verifies the real boundary.
  if (regex === "^description:(?!.*\\bTODO\\b)\\s*(?:\\S+\\s+){7}\\S")
    return "description: Reports untested functions when a review needs coverage gaps.";
  const ESCAPES = { s: " ", S: "x", w: "x", W: "-", d: "1", D: "x", b: "" };
  let i = 0;
  const branch = () => {
    let out = "";
    while (i < regex.length && regex[i] !== "|" && regex[i] !== ")") {
      const c = regex[i++];
      let part;
      if (c === "^" || c === "$") part = "";
      else if (c === "\\") {
        part = ESCAPES[regex[i]] ?? regex[i];
        i++;
      } else if (c === ".") part = "x";
      else if (c === "[") {
        const end = regex.indexOf("]", i + 1);
        const set = regex.slice(i, end);
        i = end + 1;
        part = set[0] === "\\" ? (ESCAPES[set[1]] ?? set[1]) : set[0];
      } else if (c === "(") {
        if (regex.startsWith("?:", i)) i += 2;
        part = branch();
        while (regex[i] === "|") {
          i++;
          branch();
        }
        i++;
      } else part = c;
      const q = regex[i];
      if (q === "*" || q === "?") {
        i++;
        part = "";
      } else if (q === "+") i++;
      if (regex[i] === "?") i++;
      out += part;
    }
    return out;
  };
  const line = branch();
  if (!new RegExp(regex).test(line))
    throw new Error(`lineFor: no line made for /${regex}/ (made "${line}")`);
  return line;
}

// A JSON file that holds the key path a json beat reads, with its value
// (text, as the beat compares it) or any value: an array at each index part.
export function jsonFor(key, value) {
  if (!key) return "{}";
  const parts = key.split(".");
  const make = (k) => {
    if (k === parts.length) return value ?? "x";
    const inner = make(k + 1);
    if (!/^\d+$/.test(parts[k])) return { [parts[k]]: inner };
    return [...Array.from({ length: Number(parts[k]) }, () => "x"), inner];
  };
  return JSON.stringify(make(0));
}

// What a file holds once the step's work is done, for a beat that reads it.
export const readsRight = (v) =>
  v.kind === "json"
    ? jsonFor(v.key, v.value)
    : v.kind === "match"
      ? `${lineFor(v.regex)}\n`
      : v.kind === "no-match"
        ? "a line\n"
        : "src/config.js";

// A file's bytes, as main reads them.
export const bytes = (text) => Buffer.from(text);

// ---- beats -------------------------------------------------------------------------
// DEMO_B2 with its Your turn step verified by reading a file: `verify` is the
// value of its verify line. The learner is on that step.
const reading = (verify) =>
  DEMO_B2.replace(
    "- verify: check 0 fresh\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt",
    `- verify: ${verify}`,
  );
export function onReading(verify, extra = {}) {
  const d = driver({
    course: courseWith({ "b-2": reading(verify) }),
    saved: save({
      lessons: {
        "b-1": finished(course.find((l) => l.id === "b-1")),
        "b-2": {
          warm: ["R1", "R2", "R3"],
          done: ["R1", "R2", "R3", "W1"],
          step: "Y1",
          beat: 0,
          ...extra,
        },
      },
    }),
  });
  d.open("b-2");
  if (!d.state.beat || stepOf(d.state).id !== "Y1")
    throw new Error(`onReading: on ${JSON.stringify(where(d.state))}, not Y1`);
  return d;
}
// r, then the file as it is now (null: no file): the beat's state after.
export function tryNow(d, path, text, stamp = "x") {
  d.run();
  d.send({
    type: "file",
    path,
    read: text === null ? null : bytes(text),
    stamp,
    asked: d.state.beat.asked,
  });
  return d.state.beat;
}

// The result a check beat's run gives: every item failing, or passing.
export function checkItems(s, pass) {
  const v = beatOf(s).verify;
  const l = lessonOf(s);
  return (v.all ? l.items.map((_, k) => k) : v.items).map((index) => ({
    index,
    text: l.items[index],
    pass,
    hint: pass ? "" : `${l.items[index]} is not there yet.`,
  }));
}

// A check beat on the card FAILs, and FAILs again on r: the second result
// is r's own run's.
export function failCheck(d) {
  if (beatOf(d.state).verify.kind !== "check") return;
  const items = checkItems(d.state, false);
  d.send({ type: "check", lesson: d.state.lesson, items });
  d.run();
  d.send({
    type: "check",
    lesson: d.state.lesson,
    items,
    asked: d.state.beat.asked,
  });
}

// Climbs the hints on the beat on the card to the exact command and takes
// it. A check beat fails first, so its ladder's rungs are there too; where
// a CHALLENGE beat keeps its hints for a try, two quiet minutes open them.
export function bottomRung(d) {
  failCheck(d);
  if (!hintAvailable(d.state)) d.tick(IDLE_MS + 1_000);
  for (let i = 0; i < 8 && !d.state.beat.confirm; i++) d.hint();
  d.exact(true);
}

// Climbs every rung to the y/n, says no, opens it again and takes the exact
// command.
export function climbHints(d) {
  for (
    let i = 0;
    i < 10 && hintAvailable(d.state) && !d.state.beat.confirm;
    i++
  )
    d.hint();
  if (!d.state.beat.confirm) return;
  d.exact(false);
  assert.equal(d.state.beat.confirm, false);
  d.hint();
  assert.equal(d.state.beat.confirm, true, "the y/n opens again");
  d.exact(true);
  assert.equal(d.state.progress[d.state.lesson].bottomAt, stepOf(d.state).id);
}

// ---- playing on ----------------------------------------------------------------------
// The first time a play meets each of these, it struggles: a check fails,
// r runs it, the hints climb to the y/n, which says no and then yes; a
// wrong pick, then the answer shown; a wrong answer typed, then the right
// one; the first step-down goes back, the next takes more help; one step
// goes back a beat.
export const struggles = () =>
  new Set([
    "check",
    "pick",
    "type",
    "stepDown.back",
    "stepDown.moreHelp",
    "step.back",
  ]);

// Each driver's count of plays that need a new commit or probe state, so
// every one differs from every one before it.
const moves = new WeakMap();
let drivers = 0;
const nextMove = (d) => {
  if (!moves.has(d)) moves.set(d, { id: ++drivers, n: 0 });
  const m = moves.get(d);
  m.n += 1;
  return `${m.id}-${m.n}`;
};

const stuck = (s) =>
  `${s.lesson} ${s.phase}${s.beat ? ` ${stepOf(s).id}.${s.pos.beat}` : ""}`;

// Plays on as a learner who needs no help, until `stop(state)` holds: the
// right pick, the answer typed, every check failing once then passing, a
// file that reads wrong once then right, a clean tree or the change git
// status should list, past every step-down and lesson end. `todo` (see
// `struggles`) makes it struggle once at each thing it names; `look(state)`
// runs on every state it acts on.
export function playUntil(d, stop, { todo = new Set(), look } = {}) {
  for (let i = 0; !stop(d.state); i++) {
    if (i === 3_000)
      throw new Error(
        `playUntil: 3000 moves and no stop, at ${stuck(d.state)}`,
      );
    const s = d.state;
    look?.(s);
    if (!s.welcomed) {
      d.finishWelcome();
      continue;
    }
    if (s.phase === "overview") {
      if (asksFolder(s)) {
        const key = folderKey(s);
        if (WORK_LEVELS.includes(key) && folderOptions(s)[0] === "copy")
          d.folderChoose(key, "practice-copy");
        else if (s.folderAsk?.asked)
          d.send({
            type: "probed",
            key,
            asked: s.folderAsk.asked,
            path: NEW_COPY,
            missing: false,
            git: true,
            practice: true,
          });
        else d.folderChoose(key, { path: NEW_COPY });
      } else d.start();
      continue;
    }
    if (s.phase === "step-down") {
      if (todo.delete("stepDown.back")) d.stepBack();
      else if (todo.delete("stepDown.moreHelp")) d.moreHelp();
      else d.accept();
      continue;
    }
    if (s.phase === "complete") {
      if (!nextLessonOf(s)) break;
      d.next();
      continue;
    }
    if (!s.beat) {
      d.open(s.lesson);
      continue;
    }
    const beat = beatOf(s);
    const v = beat.verify;
    // Every result comes from the folder the beat is watched in, so the
    // engine's folder guard takes each one.
    const dir = folderHere(s);
    if (isDone(s.beat)) {
      if ((s.pos.beat > 0 || s.pos.step > 0) && todo.delete("step.back"))
        d.back();
      else d.cont();
    } else if (beat.kind === "type") {
      d.type(todo.delete("type") ? "not it" : beat.accept[0]);
    } else if (beat.ask && beat.options.length) {
      const wrong = beat.options.findIndex((o) => o.kind === "wrong");
      if (
        beat.kind !== "predict" &&
        wrong >= 0 &&
        beat.options.some((o) => o.kind === "right") &&
        todo.delete("pick")
      ) {
        d.pick(wrong);
        if (!isDone(d.state.beat)) d.reveal();
        assert.equal(d.state.beat.answer.kind, "revealed");
      } else
        d.pick(
          beat.options.findIndex(
            (o) =>
              beat.kind === "predict" ||
              ["right", "option", "other"].includes(o.kind),
          ),
        );
    } else if (v.kind === "check") {
      const path = beat.evidence ?? null;
      const lesson = s.lesson;
      d.send({
        type: "check",
        lesson,
        items: checkItems(s, false),
        path,
        stamp: "a",
        dir,
      });
      if (todo.delete("check")) {
        d.run();
        d.send({
          type: "check",
          lesson,
          items: checkItems(s, false),
          path,
          stamp: "a",
          asked: d.state.beat.asked,
          dir,
        });
        climbHints(d);
      }
      d.send({
        type: "check",
        lesson,
        items: checkItems(s, true),
        path,
        stamp: "b",
        dir,
      });
    } else if (["file", "json", "match", "no-match"].includes(v.kind)) {
      const wrong =
        v.kind === "json"
          ? "{"
          : v.kind === "no-match"
            ? `${lineFor(v.regex)}\n`
            : null;
      d.send({
        type: "file",
        path: v.path,
        read: wrong === null ? null : bytes(wrong),
        stamp: "a",
        dir,
      });
      d.send({
        type: "file",
        path: v.path,
        read: bytes(readsRight(v)),
        stamp: "b",
        dir,
      });
    } else if (v.kind === "git-clean") {
      if (beat.doneLabel) d.ended();
      d.send(
        v.paths ? gitLists([], [], { dir }) : { type: "git", paths: [], dir },
      );
    } else if (v.kind === "git-staged")
      d.send(gitLists(["a.txt"], ["a.txt"], { dir }));
    else if (["git-changed", "git-only"].includes(v.kind))
      d.send(gitLists([`${v.path.replace(/\/+$/, "")}/new.txt`], [], { dir }));
    else if (v.kind === "head-moved")
      d.send({ type: "git", paths: [], head: `new-${nextMove(d)}`, dir });
    else if (v.kind === "git-unchanged")
      d.send({ type: "git", paths: [], dir });
    else if (v.kind === "probe") {
      const m = nextMove(d);
      d.send({
        type: "probe",
        name: v.name,
        args: v.args,
        pass: false,
        hint: "Not yet.",
        state: `a${m}`,
        dir,
      });
      d.send({
        type: "probe",
        name: v.name,
        args: v.args,
        pass: true,
        hint: "",
        evidence: "Found.",
        state: `b${m}`,
        dir,
      });
    } else d.markDone();
  }
  if (!stop(d.state)) throw new Error(`playUntil: stuck at ${stuck(d.state)}`);
}
