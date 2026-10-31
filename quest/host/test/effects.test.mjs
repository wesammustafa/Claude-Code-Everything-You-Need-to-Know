// Each effect the host runs, on fake adapters (ticket 209): the adapter it
// calls and the input it sends back.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  DEMO_I1,
  finishedBefore,
  threeLevels,
} from "../../engine/test/drive.mjs";
import { statusStamp } from "../src/engine.ts";
import {
  AT_W3,
  fakeHost,
  ROOT,
  scripted,
  turn,
  typesOf,
  VERSION,
  w3,
  WORK,
} from "./scripted.mjs";

const MINE = "/home/sam/mine";
const inputs = (heard, type) =>
  heard.filter((h) => h.input.type === type).map((h) => h.input);
// A host whose `waitQuestion.answer` asks for `effects`: the way in for an
// effect the test writes itself. With no beat open the engine refuses the
// action, so the effects are the test's alone.
async function asking(effects, opts = {}) {
  const { engine } = scripted({ effects: { "waitQuestion.answer": effects } });
  const made = fakeHost({ saved: AT_W3, engine, ...opts });
  await made.host.open();
  made.ask = () => made.host.dispatch({ type: "waitQuestion.answer" });
  return made;
}

test("a check: run-start when the child really starts, a run asked during another waits for it, and the result carries the folder and the evidence", async () => {
  const { host, adapters, heard } = fakeHost({ saved: AT_W3 });
  adapters.files.write(`${WORK}/${VERSION}`, "2.1.285 (Claude Code)\n");
  await host.open();
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  await turn();
  assert.deepEqual(typesOf(heard), ["lesson.open", "run-start"]);
  const [first] = adapters.checks.calls;
  assert.deepEqual(
    [first.dir, first.lesson, first.items, first.slow],
    [WORK, "b-1", [0], false],
  );
  // r while the first runs: it waits, and starts no child yet.
  host.dispatch({ type: "check.run" });
  await turn();
  assert.equal(adapters.checks.calls.length, 1);
  assert.equal(inputs(heard, "run-start").length, 1);
  first.resolve(w3(false));
  await turn();
  assert.equal(adapters.checks.calls.length, 2);
  assert.equal(inputs(heard, "run-start").length, 2, "r's own start");
  const [result] = inputs(heard, "check");
  assert.deepEqual(
    { ...result, read: result.read?.toString() },
    {
      type: "check",
      lesson: "b-1",
      items: w3(false).items,
      read: "2.1.285 (Claude Code)\n",
      path: ".practice/version.txt",
      found: ".practice/version.txt",
      stamp: adapters.files.stamp(WORK, VERSION),
      asked: 0,
      dir: WORK,
    },
  );
  // r's run: its slow items and number, on its report and its result.
  const r = adapters.checks.calls[1];
  assert.deepEqual([r.slow, r.items], [true, [0]]);
  r.onRunning(1, 1);
  assert.deepEqual(inputs(heard, "running").at(-1), {
    type: "running",
    lesson: "b-1",
    items: [0],
    n: 1,
    m: 1,
    asked: 1,
  });
  r.resolve({ error: "it took too long" });
  await turn();
  assert.deepEqual(inputs(heard, "check-error"), [
    {
      type: "check-error",
      lesson: "b-1",
      message: "it took too long",
      asked: 1,
      dir: WORK,
    },
  ]);
});

test("git and a probe: each asks its adapter in the folder, and its answer or error comes back with that folder", async () => {
  const { ask, adapters, heard } = await asking([
    { type: "git", dir: MINE, files: true, head: true, asked: 2 },
    { type: "probe", dir: MINE, name: "todos", args: ["2"], asked: 3 },
  ]);
  ask();
  await turn();
  assert.deepEqual(
    adapters.git.calls.map((c) => [c.dir, c.opts]),
    [[MINE, { files: true, head: true }]],
  );
  assert.deepEqual(
    adapters.probes.calls.map((c) => [c.dir, c.name, c.args]),
    [[MINE, "todos", ["2"]]],
  );
  adapters.git.calls[0].resolve({ paths: ["a"], staged: [], head: "abc" });
  adapters.probes.calls[0].resolve({
    pass: true,
    hint: "",
    evidence: "TODO in src/",
    state: "s1",
  });
  await turn();
  assert.deepEqual(inputs(heard, "git"), [
    {
      type: "git",
      paths: ["a"],
      staged: [],
      files: true,
      head: "abc",
      asked: 2,
      dir: MINE,
    },
  ]);
  assert.deepEqual(inputs(heard, "probe"), [
    {
      type: "probe",
      name: "todos",
      args: ["2"],
      pass: true,
      hint: "",
      evidence: "TODO in src/",
      state: "s1",
      asked: 3,
      dir: MINE,
    },
  ]);
  ask();
  await turn();
  adapters.git.calls[1].resolve({ error: "not a git repository" });
  adapters.probes.calls[1].resolve({ error: "unknown probe" });
  await turn();
  assert.deepEqual(inputs(heard, "git-error"), [
    { type: "git-error", message: "not a git repository", asked: 2, dir: MINE },
  ]);
  assert.deepEqual(inputs(heard, "probe-error"), [
    { type: "probe-error", message: "unknown probe", asked: 3, dir: MINE },
  ]);
});

test("a stamp from each of its four sources, and null where it can't be known", async () => {
  const { ask, adapters, heard } = await asking([
    { type: "stamp", key: "W3.0", dir: ROOT, path: "notes.md" },
    { type: "stamp", key: "W4.0", dir: ROOT, git: "head" },
    { type: "stamp", key: "W5.0", dir: ROOT, git: "status" },
    {
      type: "stamp",
      key: "W6.0",
      dir: ROOT,
      probe: { name: "todos", args: ["2"] },
    },
  ]);
  adapters.files.write(`${ROOT}/notes.md`, "n\n", 5_000);
  ask();
  await turn();
  const [head, status] = adapters.git.calls;
  assert.deepEqual([head.opts, status.opts], [{ head: true }, { head: false }]);
  head.resolve({ paths: [], staged: [], head: null });
  status.resolve({ paths: ["b", "a", "a"], staged: [] });
  adapters.probes.calls[0].resolve({ pass: false, hint: "", state: "p1" });
  await turn();
  const stamps = Object.fromEntries(
    inputs(heard, "stamp").map((i) => [i.key, i.stamp]),
  );
  assert.deepEqual(stamps, {
    "W3.0": adapters.files.stamp(ROOT, "notes.md"),
    "W4.0": "",
    "W5.0": statusStamp(["a", "b"]),
    "W6.0": "p1",
  });
  assert.equal(stamps["W3.0"].startsWith("5000:2:"), true);
  adapters.files.fail(`${ROOT}/notes.md`, "EACCES");
  ask();
  await turn();
  adapters.git.calls[2].resolve({ error: "x" });
  adapters.git.calls[3].resolve({ error: "x" });
  adapters.probes.calls[1].resolve({ error: "x" });
  await turn();
  assert.deepEqual(
    inputs(heard, "stamp")
      .slice(4)
      .map((i) => [i.key, i.stamp, i.dir]),
    [
      ["W3.0", null, ROOT],
      ["W4.0", null, ROOT],
      ["W5.0", null, ROOT],
      ["W6.0", null, ROOT],
    ],
  );
});

test("a file read: after the input that asked, the glob's match, its bytes and stamp, and asked 0 by default", async () => {
  const { ask, adapters, heard } = await asking([
    { type: "file", path: "wf/*.js", dir: ROOT },
    { type: "file", path: "gone.md", dir: ROOT, asked: 4 },
  ]);
  adapters.files.write(`${ROOT}/wf/a.js`, "a\n", 2_000);
  ask();
  assert.deepEqual(
    inputs(heard, "file"),
    [],
    "not inside the input that asked",
  );
  await turn();
  const [glob, gone] = inputs(heard, "file");
  assert.deepEqual(
    { ...glob, read: glob.read.toString() },
    {
      type: "file",
      path: "wf/*.js",
      found: "wf/a.js",
      read: "a\n",
      stamp: adapters.files.stamp(ROOT, "wf/a.js"),
      asked: 0,
      dir: ROOT,
    },
  );
  assert.deepEqual(gone, {
    type: "file",
    path: "gone.md",
    found: "gone.md",
    read: null,
    stamp: "",
    asked: 4,
    dir: ROOT,
  });
});

test("a folder answer: the typed path read from home or the copy, looked at, and the look sent with its key and ask", async () => {
  const { ask, adapters, heard } = await asking([
    { type: "folder", key: "intermediate", text: " '~/mine' ", asked: 3 },
    { type: "folder", key: "intermediate", text: "project", asked: 4 },
  ]);
  ask();
  await turn();
  assert.deepEqual(adapters.folders.looked, [MINE, `${ROOT}/project`]);
  assert.deepEqual(
    inputs(heard, "probed").map((i) => [i.key, i.asked, i.path, i.missing]),
    [
      ["intermediate", 3, MINE, true],
      ["intermediate", 4, `${ROOT}/project`, true],
    ],
  );
});

test("prerequisites of each kind, in the lesson's folder: a check item through the check child, a file read with no process, a probe", async () => {
  const skill = ".claude/skills/five-whys/SKILL.md";
  const i1 = DEMO_I1.replace(
    "next: i-2\n---",
    `next: i-2\nrequires: [b-5 check 0, b-4 file ${skill}, probe todos 2]\n---`,
  );
  const course = threeLevels({ "i-1": i1 });
  const { host, adapters, heard } = fakeHost({
    course,
    saved: {
      format: 1,
      welcomed: true,
      lessons: finishedBefore("i-1", course),
      folders: { intermediate: MINE },
    },
    checks: () => ({
      items: [{ index: 0, text: "b-5 item", pass: true, hint: "" }],
    }),
    probes: () => ({ pass: false, hint: "1 folder", state: "t" }),
  });
  adapters.files.write(`${MINE}/${skill}`, "---\nname: five-whys\n---\n");
  await host.open();
  assert.equal(host.snapshot().lesson.id, "i-1");
  host.firstLook();
  await turn();
  assert.deepEqual(
    adapters.checks.calls.map((c) => [c.dir, c.lesson, c.items]),
    [
      [MINE, "i-1", null],
      [MINE, "b-5", [0]],
    ],
    "the overview's first look, then the one check child for the item",
  );
  assert.deepEqual(
    adapters.probes.calls.map((c) => [c.dir, c.name, c.args]),
    [[MINE, "todos", ["2"]]],
  );
  const got = inputs(heard, "prereq");
  assert.deepEqual(
    got.map(({ read, ...i }) => ({ ...i, read: read?.toString() })),
    [
      {
        type: "prereq",
        lesson: "i-1",
        dir: MINE,
        at: 0,
        asked: undefined,
        pass: true,
        read: undefined,
      },
      {
        type: "prereq",
        lesson: "i-1",
        dir: MINE,
        at: 1,
        asked: undefined,
        read: "---\nname: five-whys\n---\n",
      },
      {
        type: "prereq",
        lesson: "i-1",
        dir: MINE,
        at: 2,
        asked: undefined,
        pass: false,
        hint: "1 folder",
        read: undefined,
      },
    ],
  );
});

test("commands: each name looked up on the PATH adapter, sent after the input that asked", async () => {
  const { ask, heard } = await asking(
    [{ type: "commands", names: ["jq", "bwrap"] }],
    {
      commands: ["jq"],
    },
  );
  ask();
  assert.deepEqual(inputs(heard, "commands"), []);
  await turn();
  assert.deepEqual(inputs(heard, "commands"), [
    { type: "commands", found: { jq: true, bwrap: false } },
  ]);
});

test("a save that fails sends one notice for each new reason, and a save that works resets it", async () => {
  const { ask, adapters, heard } = await asking([{ type: "save" }]);
  const notices = () => inputs(heard, "notice").map((n) => n.message);
  adapters.store.fail("EACCES");
  ask();
  ask();
  await turn();
  assert.deepEqual(notices(), ["EACCES"]);
  adapters.store.fail("EROFS");
  ask();
  await turn();
  assert.deepEqual(notices(), ["EACCES", "EROFS"]);
  adapters.store.fail(null);
  ask();
  adapters.store.fail("EROFS");
  ask();
  await turn();
  assert.deepEqual(notices(), ["EACCES", "EROFS", "EROFS"]);
  assert.deepEqual(inputs(heard, "notice")[0], {
    type: "notice",
    kind: "save",
    message: "EACCES",
  });
  assert.equal(adapters.store.saves.length, 1);
});
