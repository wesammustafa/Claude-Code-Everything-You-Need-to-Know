// The lesson engine on its own (tickets 207 and 210): Learner actions in,
// effects out, with nothing outside quest/engine/src in reach but the
// Checks and the compiled course, and none of the old terminal's state.
// The script plays lessons by actions through the action driver, and the
// tests below read every state, effect and input it met.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTION_TYPES,
  EFFECT_TYPES,
  ENGINE_FIELDS,
  FACTS,
  asksFolder,
  backOffered,
  beatOf,
  course,
  driver,
  finished,
  finishedBefore,
  hintAvailable,
  initialState,
  liveCourse,
  b1Only,
  playUntil,
  reduce,
  save,
  stateAt,
  stepOf,
  struggles,
  watching,
  whileRunsOf,
} from "./drive.mjs";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const at = (path) => join(ROOT, path);
const SRC = at("quest/engine/src");
const ENGINE = join(SRC, "engine.mjs");
// What the engine may reach besides its own folder: the Checks it parses
// the course with, and the course files it reads.
const OUTSIDE = [
  at("practice-template/checks"),
  at("course"),
  at("quest/engine/dist"),
];

// The fields the old terminal's translator owned, which no engine state
// holds; `away` went with the translator in 210.
const REMOVED = [
  "view",
  "overlay",
  "cursor",
  "mapCursor",
  "cardAt",
  "itemsAt",
  "toast",
  "held",
  "swallowUntil",
  "confirmRestart",
  "fx",
  "mapReturn",
  "checkOnlyRun",
  "away",
];
const REMOVED_INSIDE = ["typed", "lockUntil"];

// ---- the script ------------------------------------------------------------------
// Every state, effect and input type the script met.
const seen = { states: [], effects: [], inputs: new Set() };
const drivers = [];

// The action driver, recording what each of its calls did.
function watched(options) {
  const d = driver({ course, ...options });
  drivers.push(d);
  seen.states.push(d.state);
  return new Proxy(d, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (typeof value !== "function") return value;
      return (...args) => {
        const out = value(...args);
        seen.states.push(target.state);
        if (target.last) seen.inputs.add(target.last.input.type);
        return out;
      };
    },
  });
}

function script() {
  // A first sitting: the welcome, lesson 1 with less help, struggling once
  // at each kind of beat, on to lesson 2.
  const d = watched();
  assert.equal(d.state.welcomed, false);
  d.finishWelcome();
  assert.deepEqual(
    [d.state.welcomed, d.state.phase, d.state.lesson],
    [true, "overview", "b-1"],
  );
  d.start("less");
  assert.equal(d.state.progress["b-1"].lessHelp, true);
  const todo = struggles();
  playUntil(d, (s) => s.phase === "complete", { todo });
  assert.deepEqual([...todo], [], "the play struggled once at each");
  assert.equal(d.state.progress["b-1"].complete, true);
  d.next();
  assert.deepEqual([d.state.lesson, d.state.phase], ["b-2", "overview"]);
  d.start("planned");
  assert.equal(d.state.progress["b-2"].lessHelp, false);
  // Restart: the lesson's place goes, and its overview shows.
  d.restart("b-1");
  assert.deepEqual(
    [d.state.lesson, d.state.phase, d.state.progress["b-1"].complete],
    ["b-1", "overview", false],
  );

  // The level's work folder: a folder that isn't there, then one that is;
  // an answer dropped before the host looked says nothing when it lands.
  const f = watched({ saved: save({ lessons: finishedBefore("i-1") }) });
  f.open("i-1");
  assert.ok(asksFolder(f.state));
  let out = f.folderChoose("intermediate", { path: "/home/sam/gone" }).effects;
  assert.deepEqual(
    out.filter((e) => e.type === "folder"),
    [
      {
        type: "folder",
        key: "intermediate",
        text: "/home/sam/gone",
        asked: f.state.asks,
      },
    ],
  );
  f.send({
    type: "probed",
    key: "intermediate",
    asked: f.state.folderAsk.asked,
    path: "/home/sam/gone",
    missing: true,
  });
  assert.deepEqual(
    [f.state.folderAsk.missing, f.state.folderAsk.asked],
    ["/home/sam/gone", 0],
  );
  // Editing the answer clears the note about the last one.
  f.folderAsk("intermediate");
  assert.deepEqual(f.state.folderAsk, {
    key: "intermediate",
    missing: null,
    isCopy: false,
    asked: 0,
  });
  f.folderChoose("intermediate", { path: "/home/sam/work" });
  f.send({
    type: "probed",
    key: "intermediate",
    asked: f.state.folderAsk.asked,
    path: "/home/sam/work",
    missing: false,
    git: true,
    practice: true,
  });
  assert.deepEqual(
    [f.state.folders.intermediate, f.state.folderAsk, asksFolder(f.state)],
    ["/home/sam/work", null, false],
  );
  f.folderChoose("intermediate", { path: "/home/sam/other" });
  const asked = f.state.folderAsk.asked;
  f.folderCancel();
  out = f.send({
    type: "probed",
    key: "intermediate",
    asked,
    path: "/home/sam/other",
    missing: false,
    git: true,
    practice: true,
  });
  assert.deepEqual(
    [f.state.folders.intermediate, f.state.folderAsk, out],
    ["/home/sam/work", null, []],
    "a late answer to a dropped ask sets nothing",
  );
  f.folderChoose("intermediate", "practice-copy");
  assert.equal(f.state.folders.intermediate, FACTS.root);
  // On through i-1 to its back line: the last rung offers the step it names.
  playUntil(
    f,
    (s) =>
      s.phase === "playing" &&
      Boolean(s.beat) &&
      stepOf(s).id === "Y3" &&
      s.pos.beat === 1,
  );
  if (watching(f.state)) f.run();
  for (
    let i = 0;
    i < 10 && hintAvailable(f.state) && !f.state.beat.confirm;
    i++
  )
    f.hint();
  if (f.state.beat.confirm) f.exact(true);
  const back = backOffered(f.state);
  assert.ok(back, "Y3 offers its back line");
  f.revisit();
  assert.equal(f.state.pos.step, back.at);

  // A lesson with no lesson file: its check runs as it opens, and a run
  // asked for carries its number where the lesson has a slow item.
  const c = watched({
    course: b1Only,
    saved: save({ lessons: { "b-1": finished(b1Only[0]) } }),
  });
  out = c.open("b-2").effects;
  assert.deepEqual(
    [c.state.phase, out.map((e) => e.type)],
    ["overview", ["check"]],
  );
  out = c.run().effects;
  assert.deepEqual(out, [
    { type: "check", lesson: "b-2", items: null, slow: true, dir: FACTS.root },
  ]);
  c.open("b-3");
  out = c.run().effects;
  assert.deepEqual(out, [
    {
      type: "check",
      lesson: "b-3",
      items: null,
      slow: true,
      asked: c.state.asks,
      dir: FACTS.root,
    },
  ]);

  // An optional step: skipped, it is not done.
  const optional = course.map((l) =>
    l.id === "b-1"
      ? {
          ...l,
          content: {
            ...l.content,
            steps: l.content.steps.map((x) =>
              x.id === "W2" ? { ...x, optional: "Skip it." } : x,
            ),
          },
        }
      : l,
  );
  const o = watched({
    course: optional,
    saved: save({ lessons: { "b-1": { step: "W2", beat: 0, done: ["W1"] } } }),
  });
  o.open("b-1");
  o.skip();
  assert.equal(stepOf(o.state).id, "W3");
  assert.ok(!o.state.progress["b-1"].done.includes("W2"));

  // A long wait's question: answered once.
  const w = watched({
    saved: save({
      lessons: {
        ...finishedBefore("a-2"),
        "a-2": { step: "W3", beat: 1, done: ["W1", "W2"], warm: [] },
      },
    }),
  });
  w.open("a-2");
  const box = whileRunsOf(w.state);
  assert.ok(box, "a-2 W3 offers a question while it runs");
  w.waitAnswer(0);
  assert.equal(whileRunsOf(w.state).answer, 0);
  assert.deepEqual(w.state.whileShown, [`a-2.${box.step.id}`]);

  for (const each of drivers) {
    seen.effects.push(...each.effects);
    assert.deepEqual(each.events, [], "no moments yet (ticket 212)");
  }
}
script();

// ---- the tests ---------------------------------------------------------------------
// Every relative module a file reaches, as absolute paths: through an
// import, a re-export, a bare import or a dynamic import().
const RELATIVE =
  /^(?:import|export)\s[^;]*?from\s+['"](\.{1,2}\/[^'"]+)['"]|^import\s+['"](\.{1,2}\/[^'"]+)['"]|\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]/gms;
const relativeOf = (text) =>
  [...text.matchAll(RELATIVE)].map((m) => m[1] ?? m[2] ?? m[3]);
function reached(file, out = new Set()) {
  if (out.has(file)) return out;
  out.add(file);
  for (const to of relativeOf(readFileSync(file, "utf8")))
    reached(resolve(dirname(file), to), out);
  return out;
}
const inside = (file, dir) => !relative(dir, file).startsWith("..");

test("the import walk sees every way a module reaches another", () => {
  const text =
    "import { a } from './a.mjs';\nimport * as b from \"../b.mjs\";\nexport { c } from './c.mjs';\nexport * from './d.mjs';\nimport './e.mjs';\nconst f = await import('./f.mjs');\nexport const g = 1;\n";
  assert.deepEqual(relativeOf(text), [
    "./a.mjs",
    "../b.mjs",
    "./c.mjs",
    "./d.mjs",
    "./e.mjs",
    "./f.mjs",
  ]);
});

test("the engine reaches nothing outside quest/engine/src but the Checks and the course, reaches the package's text module, and reads no clock and picks nothing at random", () => {
  const files = reached(ENGINE);
  for (const file of files)
    assert.ok(
      [SRC, ...OUTSIDE].some((dir) => inside(file, dir)),
      `engine.mjs reaches ${relative(ROOT, file)}`,
    );
  assert.ok(
    files.has(join(SRC, "text.mjs")),
    "holds.mjs reads text through text.mjs",
  );
  for (const file of [...files].filter((f) => inside(f, SRC)))
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /Date\.now|performance\.now|new Date|Math\.random/,
      relative(ROOT, file),
    );
});

test("the engine's state holds none of the terminal's fields: from every save, and after every input of the script", () => {
  const saves = [
    null,
    save({ lessons: { "b-1": { step: "W3", beat: 0 } } }),
    save({
      lessons: Object.fromEntries(
        course.filter((l) => l.content).map((l) => [l.id, finished(l)]),
      ),
    }),
    save({ welcomed: false, lessons: { "b-1": { step: "W2", beat: 0 } } }),
  ];
  const states = [...seen.states];
  for (const lessons of [course, liveCourse])
    for (const saved of saves)
      states.push(
        initialState({ course: lessons, saved, facts: FACTS, now: 0 }),
      );
  assert.ok(states.length > 100, `${states.length} states`);
  for (const s of states) {
    for (const k of Object.keys(s))
      assert.ok(ENGINE_FIELDS.includes(k), `the engine's state holds ${k}`);
    for (const k of REMOVED) assert.ok(!(k in s), k);
    for (const inner of [s.beat, s.folderAsk])
      for (const k of REMOVED_INSIDE) assert.ok(!(k in (inner ?? {})), k);
  }
  // Read, written or set as a key.
  const fields = [...REMOVED, ...REMOVED_INSIDE].join("|");
  const source = readFileSync(ENGINE, "utf8");
  assert.doesNotMatch(source, new RegExp(`\\.(${fields})\\b`));
  assert.doesNotMatch(
    source,
    new RegExp(`[{,]\\s*['"]?(${fields})['"]?\\s*[:,}]`),
  );
});

test("the engine asks for only its nine effects, and the script sends every action", () => {
  assert.deepEqual(EFFECT_TYPES, [
    "save",
    "check",
    "file",
    "git",
    "probe",
    "stamp",
    "folder",
    "prereqs",
    "commands",
  ]);
  for (const e of seen.effects)
    assert.ok(EFFECT_TYPES.includes(e.type), e.type);
  assert.deepEqual(
    ACTION_TYPES.filter((t) => !seen.inputs.has(t)),
    [],
    "every action is played",
  );
  // Every type the engine's source names is one of its effects, or `stale`,
  // the input a result about another folder becomes.
  const named = new Set(
    [
      ...readFileSync(ENGINE, "utf8").matchAll(/\btype:\s*['"]([^'"]+)['"]/g),
    ].map((m) => m[1]),
  );
  assert.deepEqual(
    [...named].filter((t) => !EFFECT_TYPES.includes(t) && t !== "stale"),
    [],
  );
});

test("an action whose guard fails changes nothing: on a fresh overview, nothing of a step acts", () => {
  const s = initialState({ course, saved: null, facts: FACTS, now: 0 });
  for (const type of [
    "step.continue",
    "step.back",
    "step.skip",
    "step.revisit",
    "answer.pick",
    "answer.reveal",
    "answer.type",
    "step.markDone",
    "session.ended",
    "check.run",
    "hint.next",
    "hint.takeExact",
    "waitQuestion.answer",
    "stepDown.accept",
    "stepDown.moreHelp",
    "stepDown.back",
    "lesson.next",
  ]) {
    const r = reduce(s, { type, option: 0, text: "x", take: true });
    assert.deepEqual([r.state, r.effects], [s, []], type);
  }
  assert.deepEqual(reduce(s, { type: "lesson.open", lesson: "nope" }).state, s);
  for (const key of ["b-1", "beginner", "nope"]) {
    for (const input of [
      { type: "folder.choose", key, to: "practice-copy" },
      { type: "folder.choose", key, to: { path: "/home/sam/work" } },
      { type: "folder.ask", key },
    ]) {
      const r = reduce(s, input);
      assert.deepEqual([r.state, r.effects], [s, []], `${input.type} ${key}`);
    }
  }
});

test("an overview with its folder question open starts nothing: no check runs before the answer", () => {
  for (const id of ["i-1", "a-5"]) {
    const s = stateAt(
      save({ lessons: finishedBefore(id) }),
      [{ type: "lesson.open", lesson: id }],
      { course },
    );
    assert.ok(asksFolder(s), id);
    for (const help of ["planned", "less"]) {
      const r = reduce(s, { type: "lesson.start", help });
      assert.deepEqual([r.state, r.effects], [s, []], `${id} ${help}`);
    }
  }
});

test("a typed-answer beat takes no pick and shows no answer: its options are its known wrong answers", () => {
  const s = stateAt(
    save({ lessons: { "b-1": { step: "C", beat: 1 } } }),
    [{ type: "lesson.open", lesson: "b-1" }],
    { course },
  );
  assert.deepEqual(
    [beatOf(s).kind, beatOf(s).options.length > 0],
    ["type", true],
  );
  for (const input of [
    { type: "answer.pick", option: 0 },
    { type: "answer.reveal" },
  ]) {
    const r = reduce(s, input);
    assert.deepEqual([r.state, r.effects], [s, []], input.type);
  }
});

test("the package's main export is the engine: reduce and initialState from @quest/engine", async () => {
  const engine = await import("@quest/engine");
  assert.equal(typeof engine.reduce, "function");
  assert.equal(typeof engine.initialState, "function");
  assert.equal(engine.reduce, reduce);
});
