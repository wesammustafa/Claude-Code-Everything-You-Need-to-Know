// Ported from learn-flow.test.mjs 1757-2417 (ticket 208): r's runs and the
// asked number that ties a result to them, recall on the lesson's end, the
// beats that read a file (file, json, match, no-match, fresh stamps) and the
// beats that read git status for part of the tree. Driven by actions and
// results, not keys.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  beatOf,
  course,
  courseWith,
  DEMO_B2,
  driver,
  finishedBefore,
  gitLists,
  hintAvailable,
  nextLessonOf,
  onReading,
  pending,
  playUntil,
  PROJECT,
  recallOf,
  rungsOf,
  save,
  stampFor,
  stepOf,
  tierOf,
  tryFirst,
  tryNow,
  watching,
  where,
} from "./drive.mjs";
import { at, b1Done, empty, midway, missing, passed } from "./flow-places.mjs";

// Truthful waits: r shows the run it asked for, and only that run's result ends it.
const ofType = (effects, type) => effects.filter((e) => e.type === type);

// spec: guards.1-ask-numbers
test("r shows the checking state on every checked beat, and its check, file and git effects carry its flag", () => {
  // was learn-flow:1763
  const d = at("W3");
  d.send({ type: "check", lesson: "b-1", items: [missing] });
  assert.equal(d.state.beat.status, "waiting");
  const out = d.run().effects;
  assert.equal(
    d.state.beat.status,
    "opening",
    "an ordinary check beat, with no slow item",
  );
  assert.deepEqual(ofType(out, "check"), [
    {
      type: "check",
      lesson: "b-1",
      items: [0],
      evidence: ".practice/version.txt",
      slow: true,
      asked: d.state.asks,
      dir: PROJECT,
    },
  ]);
  d.send({
    type: "check",
    lesson: "b-1",
    items: [missing],
    asked: d.state.beat.asked,
  });
  assert.equal(d.state.beat.status, "fail");
  d.run();
  assert.equal(
    d.state.beat.status,
    "opening",
    'r on a "Not yet" shows the run too',
  );
  const f = midway("b-2", "W6", { beat: 2 });
  assert.equal(beatOf(f.state).verify.kind, "file");
  f.send({
    type: "file",
    path: ".practice/b-2-plan.txt",
    read: null,
    stamp: "a",
  });
  assert.notEqual(f.state.beat.status, "opening");
  const fileOut = f.run().effects;
  assert.equal(f.state.beat.status, "opening", "a file beat");
  assert.deepEqual(ofType(fileOut, "file"), [
    {
      type: "file",
      path: ".practice/b-2-plan.txt",
      asked: f.state.asks,
      dir: PROJECT,
    },
  ]);
  const g = at("W7", { beat: 2 });
  g.send({ type: "git", paths: ["notes.md"] });
  assert.equal(g.state.beat.status, "fail");
  const gitOut = g.run().effects;
  assert.equal(g.state.beat.status, "opening", "a git beat");
  assert.deepEqual(ofType(gitOut, "git"), [
    { type: "git", asked: g.state.asks, dir: PROJECT },
  ]);
});

// spec: guards.1-ask-numbers
test('opening set by r ends only on r\'s own result: a poll result that lands first neither clears it nor says "press r"', () => {
  // was learn-flow:1789
  // A slow beat: the poll's run comes back with the slow item skipped.
  const d = at("C", { levels: ["hinted", "challenge"] });
  const placeholder = {
    index: 0,
    text: passed.text,
    pass: false,
    slow: true,
    hint: "",
  };
  const slowFail = {
    ...passed,
    pass: false,
    hint: "The tool exited with code 0, not 2.",
  };
  d.send({ type: "check", lesson: "b-1", items: [placeholder] });
  assert.equal(d.state.beat.slowWait, true);
  d.run();
  d.send({ type: "check", lesson: "b-1", items: [placeholder] });
  assert.equal(
    d.state.beat.status,
    "opening",
    "the poll ran first, while r's run waited",
  );
  assert.equal(
    d.state.beat.slowWait,
    false,
    'no "press r when you are ready" while r\'s run goes',
  );
  d.send({
    type: "check",
    lesson: "b-1",
    items: [slowFail],
    asked: d.state.beat.asked,
  });
  assert.equal(d.state.beat.status, "fail");
  assert.equal(d.state.beat.fail.hint, slowFail.hint);
  // An ordinary check beat.
  const w = at("W3");
  w.send({ type: "check", lesson: "b-1", items: [missing] });
  w.run();
  w.send({ type: "check", lesson: "b-1", items: [empty] });
  assert.equal(w.state.beat.status, "opening");
  w.send({ type: "check-error", lesson: "b-1", message: "it took too long" });
  assert.equal(
    w.state.beat.status,
    "opening",
    "a poll's error is not r's result either",
  );
  w.send({
    type: "check",
    lesson: "b-1",
    items: [empty],
    asked: w.state.beat.asked,
  });
  assert.equal(w.state.beat.status, "fail");
  w.run();
  w.send({
    type: "check-error",
    lesson: "b-1",
    message: "it took too long",
    asked: w.state.beat.asked,
  });
  assert.equal(w.state.beat.status, "broken");
  // After r's result, a poll's result counts as before.
  w.send({
    type: "check",
    lesson: "b-1",
    items: [passed],
    read: Buffer.from("2.1.285 (Claude Code)\n"),
  });
  assert.equal(w.state.beat.status, "done");
  // A file beat and a git beat.
  const f = midway("b-2", "W6", { beat: 2 });
  f.send({
    type: "file",
    path: ".practice/b-2-plan.txt",
    read: null,
    stamp: "a",
  });
  f.run();
  f.send({
    type: "file",
    path: ".practice/b-2-plan.txt",
    read: Buffer.from("src/config.js"),
    stamp: "b",
  });
  assert.equal(f.state.beat.status, "opening");
  f.send({
    type: "file",
    path: ".practice/b-2-plan.txt",
    read: Buffer.from("src/config.js"),
    stamp: "b",
    asked: f.state.beat.asked,
  });
  assert.equal(f.state.beat.status, "done");
  const g = at("W7", { beat: 2 });
  g.send({ type: "git", paths: ["notes.md"] });
  g.run();
  g.send({ type: "git", paths: [] });
  assert.equal(g.state.beat.status, "opening");
  g.send({ type: "git-error", message: "git is busy" });
  assert.equal(g.state.beat.status, "opening");
  g.send({ type: "git", paths: [], asked: g.state.beat.asked });
  assert.equal(g.state.beat.status, "done");
});

// dropped: learn-flow:1838 (T-away), the map hides the card between r and
// its result; r correlation stays covered by learn-flow:1789 and :1854 here.

// spec: guards.1-ask-numbers
test("r pressed twice: only the later r's result ends \"Checking\", not the earlier run's", () => {
  // was learn-flow:1854
  const d = at("W3");
  d.send({ type: "check", lesson: "b-1", items: [missing] });
  d.run();
  const first = d.state.beat.asked;
  d.run();
  const second = d.state.beat.asked;
  assert.ok(second > first);
  d.send({ type: "check", lesson: "b-1", items: [missing], asked: first });
  assert.equal(
    d.state.beat.status,
    "opening",
    "the earlier run saw the files before the later r",
  );
  d.send({
    type: "check",
    lesson: "b-1",
    items: [passed],
    read: Buffer.from("2.1.285 (Claude Code)\n"),
    asked: second,
  });
  assert.equal(d.state.beat.status, "done");
});

test('r over a "Not yet" keeps its hints: the open rung, the ladder h climbs and the y/n stay as they were while r\'s run goes', () => {
  // was learn-flow:1868
  const d = at("W3");
  d.send({ type: "check", lesson: "b-1", items: [missing] });
  d.run();
  d.send({
    type: "check",
    lesson: "b-1",
    items: [missing],
    asked: d.state.beat.asked,
  });
  assert.equal(d.state.beat.status, "fail");
  const ladder = rungsOf(d.state);
  assert.deepEqual(
    ladder.map((r) => r.kind),
    ["ask", "check", "quote", "bottom"],
  );
  d.hint();
  assert.equal(d.state.beat.rung, 0);
  d.run();
  d.run();
  assert.equal(d.state.beat.status, "opening");
  assert.deepEqual(
    rungsOf(d.state),
    ladder,
    "the same ladder, after a second r too",
  );
  assert.equal(d.state.beat.rung, 0, "the open rung stays");
  assert.ok(hintAvailable(d.state));
  d.hint();
  assert.equal(d.state.beat.rung, 1, "h climbs the same ladder");
  d.hint();
  d.hint();
  assert.equal(
    d.state.beat.confirm,
    true,
    "the y/n comes where the ladder's exact command is",
  );
  assert.equal(d.state.beat.rung, ladder.length - 2);
  d.exact(true);
  assert.equal(d.state.beat.rung, ladder.length - 1);
  assert.equal(rungsOf(d.state)[d.state.beat.rung].kind, "bottom");
  d.send({
    type: "check",
    lesson: "b-1",
    items: [missing],
    asked: d.state.beat.asked,
  });
  assert.equal(d.state.beat.status, "fail");
  assert.equal(
    d.state.beat.rung,
    ladder.length - 1,
    "the same FAIL keeps the exact command open",
  );
});

// Recall, then compare (152, design D8 (a)): the lesson's end asks for the
// lesson's card entries from memory (recallOf). Nothing is judged or saved,
// and lesson.next never waits for it. The comparison itself is the screen's.
const onNext = (id, lessons = course) => {
  const d = driver({
    course: lessons,
    saved: save({ lessons: finishedBefore(id, lessons) }),
  });
  playUntil(d, (s) => s.phase === "complete" && s.lesson === id);
  return d;
};

test("recall, then compare: space on the next screen shows the lesson's entries, and enter goes on with or without it", () => {
  // was learn-flow:1907
  const d = onNext("b-4");
  // dropped: T-overlay space opens and closes the comparison; that it saves
  // nothing is the screen's (no action exists for it).
  assert.ok(recallOf(d.state).length > 0, "the lesson has entries to recall");
  d.next();
  assert.deepEqual([d.state.lesson, d.state.phase], ["b-5", "overview"]);
  // lesson.next never waits: with no comparison, it goes on at once.
  const e = onNext("b-4");
  e.next();
  assert.deepEqual([e.state.lesson, e.state.phase], ["b-5", "overview"]);
});

// dropped: learn-flow:1939 (T-guard), a command typed into this window on
// the next screen; the stray-typing guard is flow.mjs's.

test("recall, then compare: escape goes back, the capstone's enter goes on as its next screen does, and a lesson with nothing on the card asks nothing", () => {
  // was learn-flow:1957
  // dropped: T-overlay escape closes the comparison.
  // The Beginner capstone's lesson.next goes to i-1, its next.
  const cap = onNext("b-capstone");
  assert.ok(recallOf(cap.state).length > 0);
  cap.next();
  assert.deepEqual([cap.state.phase, cap.state.lesson], ["overview", "i-1"]);
  // After a lesson with no next, nothing goes on (the map is the screen's).
  const last = course.map((l) =>
    l.id === "b-capstone"
      ? { ...l, content: { ...l.content, next: undefined } }
      : l,
  );
  const end = onNext("b-capstone", last);
  assert.ok(recallOf(end.state).length > 0);
  assert.equal(nextLessonOf(end.state), null);
  end.refused("lesson.next");
  assert.equal(end.state.phase, "complete");
  // dropped: T-view enter opens the map.
  // With no entry of this lesson's on the card, there is nothing to recall.
  const bare = course.map((l) =>
    l.id === "b-4" ? { ...l, content: { ...l.content, card: [] } } : l,
  );
  const e = onNext("b-4", bare);
  assert.deepEqual(recallOf(e.state), []);
  assert.equal(where(e.state).phase, "complete");
});

// ---- beats that read what a file holds (ticket 87) ---------------------------
const parseError = (text) => {
  try {
    JSON.parse(text);
  } catch (error) {
    return error.message;
  }
};

// spec: verify.value.json
test("json: done once the file parses and holds the key; the not-yet line names the parse error or the missing key; the evidence is the key and its value (r27 E12)", () => {
  // was learn-flow:1999
  const path = ".claude/settings.json";
  const d = onReading(`json ${path} permissions.deny`);
  assert.deepEqual(watching(d.state), { file: path, dir: PROJECT });
  assert.match(
    tryNow(d, path, null).fail.hint,
    /\.claude\/settings\.json is not there yet/,
  );
  const broken = '{"permissions": {"deny": [] ';
  const st = tryNow(d, path, broken);
  assert.equal(st.status, "fail");
  assert.ok(st.fail.hint.includes(parseError(broken)), st.fail.hint);
  assert.match(
    tryNow(d, path, '{"permissions": {"allow": []}}').fail.hint,
    /\.claude\/settings\.json has no permissions\.deny yet/,
  );
  const done = tryNow(
    d,
    path,
    '{\n  "permissions": {\n    "deny": ["Read(./.env)"]\n  }\n}\n',
  );
  assert.equal(done.status, "done");
  assert.equal(done.evidence, 'permissions.deny = ["Read(./.env)"]');
});

// spec: verify.value.json
test("json with a value: done once the key equals it, as text or as JSON; the not-yet line names the key and what it holds", () => {
  // was learn-flow:2014
  const path = ".practice/a-4-run.json";
  const d = onReading(`json ${path} subtype=success`);
  assert.equal(
    tryNow(d, path, '{"type": "result", "subtype": "error_max_turns"}').fail
      .hint,
    ".practice/a-4-run.json has subtype error_max_turns, not success, yet.",
  );
  const done = tryNow(d, path, '{"type": "result", "subtype": "success"}');
  assert.equal(done.status, "done");
  assert.equal(done.evidence, "subtype = success");
  const flag = onReading(`json ${path} is_error=false`);
  assert.equal(tryNow(flag, path, '{"is_error": true}').status, "fail");
  assert.equal(tryNow(flag, path, '{"is_error": false}').status, "done");
});

// spec: verify.value.fresh
// spec: verify.value.fresh-since
test("json, match and no-match take fresh and fresh since: what an earlier step left passes only once the file changes", () => {
  // was learn-flow:2026
  const path = ".claude/settings.json";
  const text = '{"permissions": {"deny": ["Read(./.env)"]}}';
  for (const verify of [
    `json ${path} permissions.deny fresh`,
    `match ${path} deny fresh since W1`,
    `no-match ${path} allow fresh since W1`,
  ]) {
    const d = onReading(verify, { stamps: { "Y1.0": "a" } });
    assert.equal(beatOf(d.state).verify.fresh, true, verify);
    const st = tryNow(d, path, text, "a");
    assert.equal(
      st.status,
      "waiting",
      `${verify}: the file as the step found it`,
    );
    assert.equal(st.stale, true, verify);
    assert.equal(
      tryNow(d, path, text, "b").status,
      "done",
      `${verify}: once it changed`,
    );
  }
  assert.equal(
    onReading(`match ${path} deny fresh since W1`)
      .state.course.find((l) => l.id === "b-2")
      .content.steps.find((x) => x.id === "Y1").beats[0].verify.since,
    "W1",
  );
});

// A file holding `text` as main reads it: its bytes and its stamp. The same
// text is the same file, left as it was, unless saved again at `mtime`.
const asRead = (text, mtime = 1000) => ({
  read: Buffer.from(text),
  stamp: stampFor(mtime, Buffer.from(text)),
});
const LOG = ".practice/i-2-loaded.txt";

// spec: verify.value.fresh
// spec: verify.value.match
test("fresh match on a log that only grew: a line an earlier attempt left passes nothing until this attempt appends one, and the evidence is that line", () => {
  // was learn-flow:2045
  const old = "loaded: CLAUDE.md\n";
  // Saved at the step's opening, so a restart mid-step judges the same way.
  const d = onReading(`match ${LOG} ^loaded: fresh`, {
    stamps: { "Y1.0": asRead(old).stamp },
  });
  const look = (text) => {
    d.send({ type: "file", path: LOG, ...asRead(text) });
    return d.state.beat;
  };
  assert.equal(look(old).status, "waiting");
  const started = `${old}session started\n`;
  assert.equal(
    look(started).status,
    "waiting",
    "the new session wrote its first line",
  );
  const done = look(`${started}loaded: .claude/rules/style.md\n`);
  assert.equal(done.status, "done");
  assert.equal(done.evidence, "loaded: .claude/rules/style.md");
});

// spec: verify.value.no-match
test("fresh match and no-match on a log that only grew: the not-yet line is about what was added", () => {
  // was learn-flow:2061
  const old = "loaded: CLAUDE.md\n";
  const started = `${old}session started\n`;
  const d = onReading(`match ${LOG} ^loaded: fresh`, {
    stamps: { "Y1.0": asRead(old).stamp },
  });
  assert.equal(
    tryNow(d, LOG, started, asRead(started).stamp).fail.hint,
    ".practice/i-2-loaded.txt has no new line like that yet.",
  );
  const no = onReading(`no-match ${LOG} ^loaded: fresh`, {
    stamps: { "Y1.0": asRead(old).stamp },
  });
  no.send({ type: "file", path: LOG, ...asRead(old) });
  assert.equal(no.state.beat.status, "waiting", "nothing added yet");
  assert.equal(
    tryNow(no, LOG, started, asRead(started).stamp).status,
    "done",
    "the line from before is not read",
  );
  const again = onReading(`no-match ${LOG} ^loaded: fresh`, {
    stamps: { "Y1.0": asRead(started).stamp },
  });
  const loaded = `${started}loaded: .claude/rules/style.md\n`;
  assert.equal(
    tryNow(again, LOG, loaded, asRead(loaded).stamp).fail.hint,
    ".practice/i-2-loaded.txt still has: loaded: .claude/rules/style.md",
  );
});

test("fresh match on a log that was rewritten: the whole file is read", () => {
  // was learn-flow:2075
  const old = "loaded: CLAUDE.md\nsession ended\n";
  // Longer than before but not starting with it, and shorter.
  for (const [now, line] of [
    [
      "loaded: AGENTS.md\nsession ended\nsession started\n",
      "loaded: AGENTS.md",
    ],
    ["loaded: CLAUDE.md\n", "loaded: CLAUDE.md"],
  ]) {
    const d = onReading(`match ${LOG} ^loaded: fresh`, {
      stamps: { "Y1.0": asRead(old).stamp },
    });
    d.send({ type: "file", path: LOG, ...asRead(old) });
    assert.equal(d.state.beat.status, "waiting");
    d.send({ type: "file", path: LOG, ...asRead(now) });
    assert.equal(d.state.beat.status, "done", JSON.stringify(now));
    assert.equal(d.state.beat.evidence, line);
  }
});

// spec: verify.value.fresh-since
test("fresh since a step on a log that only grew: what was added since that step opened is read", () => {
  // was learn-flow:2088
  const old = "loaded: CLAUDE.md\n";
  const grown = `${old}loaded: .claude/rules/style.md\n`;
  const onY1 = (fresh) => {
    const text = DEMO_B2.replace(
      "- verify: check 0\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt",
      `- verify: file ${LOG}`,
    ).replace(
      "- verify: check 0 fresh\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt",
      `- verify: match ${LOG} ^loaded: ${fresh}`,
    );
    const d = driver({
      course: courseWith({ "b-2": text }),
      saved: save({
        lessons: {
          "b-1": b1Done,
          "b-2": { warm: ["R1"], step: "R1", beat: 0 },
        },
      }),
    });
    d.open("b-2");
    d.pick(0);
    d.cont();
    assert.equal(stepOf(d.state).id, "W1");
    // Each step's opening stamps the log as it is then: W1's holds the old line.
    for (const e of d.effects.filter((x) => x.type === "stamp"))
      d.send({ type: "stamp", key: e.key, stamp: asRead(old).stamp });
    // During W1 the log grows.
    d.send({ type: "file", path: LOG, ...asRead(grown) });
    for (
      let i = 0;
      i < 3 && !(d.state.beat && stepOf(d.state).id === "Y1");
      i++
    ) {
      if (d.state.phase === "step-down") d.accept();
      else d.cont();
    }
    assert.equal(stepOf(d.state).id, "Y1");
    for (const e of d.effects.filter(
      (x) => x.type === "stamp" && !(x.key in d.state.progress["b-2"].stamps),
    ))
      d.send({ type: "stamp", key: e.key, stamp: asRead(grown).stamp });
    d.send({ type: "file", path: LOG, ...asRead(grown) });
    return d;
  };
  const since = onY1("fresh since W1").state.beat;
  assert.equal(since.status, "already", "the line came before Y1 opened");
  assert.equal(since.evidence, "loaded: .claude/rules/style.md");
  const plain = onY1("fresh");
  assert.equal(
    plain.state.beat.status,
    "waiting",
    "Y1 opened on the grown log: nothing added since",
  );
  const later = `${grown}session ended\n`;
  assert.equal(
    tryNow(plain, LOG, later, asRead(later).stamp).fail.hint,
    ".practice/i-2-loaded.txt has no new line like that yet.",
  );
});

// spec: guards.7-baseline
test("fresh match before its stamp lands: the read that sets the stamp is judged as every later one, and a look that turns done differs", () => {
  // was learn-flow:2118
  const old = "loaded: CLAUDE.md\n";
  // No stamp saved: the first read is the step's opening.
  const d = onReading(`match ${LOG} ^loaded: fresh`);
  d.send({ type: "file", path: LOG, ...asRead(old) });
  assert.equal(d.state.beat.status, "waiting");
  assert.equal(
    d.state.beat.baseline,
    ".practice/i-2-loaded.txt has no new line like that yet.",
  );
  const started = `${old}session started\n`;
  d.send({ type: "file", path: LOG, ...asRead(started) });
  assert.equal(
    d.state.beat.status,
    "waiting",
    'a line that does not match is no "not yet"',
  );
  // dropped: T-motion the look's changed flag stays false here.
  d.send({
    type: "file",
    path: LOG,
    ...asRead(`${started}loaded: .claude/rules/style.md\n`),
  });
  assert.equal(d.state.beat.status, "done");
  assert.equal(d.state.beat.evidence, "loaded: .claude/rules/style.md");
  // dropped: T-motion the look's changed flag turns true here.
});

// spec: verify.value.no-match
test("fresh no-match on a file saved with the same bytes: the line it forbids still counts", () => {
  // was learn-flow:2135
  const path = ".claude/settings.json";
  const kept = "deny: rm\n";
  const d = onReading(`no-match ${path} ^deny: fresh`, {
    stamps: { "Y1.0": asRead(kept).stamp },
  });
  d.send({ type: "file", path, ...asRead(kept) });
  assert.equal(d.state.beat.status, "waiting");
  const touched = tryNow(d, path, kept, asRead(kept, 2000).stamp);
  assert.equal(touched.status, "fail");
  assert.equal(touched.fail.hint, ".claude/settings.json still has: deny: rm");
});

// spec: verify.value.match
test("match: done once a line matches, front matter included, and the evidence is that line", () => {
  // was learn-flow:2146
  const path = ".claude/skills/tdd/SKILL.md";
  const d = onReading(`match ${path} ^disable-model-invocation: true$`);
  assert.deepEqual(watching(d.state), { file: path, dir: PROJECT });
  assert.equal(
    tryNow(d, path, null).fail.hint,
    ".claude/skills/tdd/SKILL.md is not there yet.",
  );
  assert.equal(
    tryNow(d, path, "---\nname: tdd\n---\n\nWrite the test first.\n").fail.hint,
    ".claude/skills/tdd/SKILL.md has no line like that yet.",
  );
  const done = tryNow(
    d,
    path,
    "---\nname: tdd\r\ndisable-model-invocation: true\r\n---\n\nWrite the test first.\n",
  );
  assert.equal(done.status, "done");
  assert.equal(done.evidence, "disable-model-invocation: true");
});

// spec: verify.value.no-match
test("no-match: done once the file is there and no line matches; the not-yet line names the line that does", () => {
  // was learn-flow:2157
  const path = ".claude/skills/tdd/SKILL.md";
  const d = onReading(`no-match ${path} \\bTODO\\b`);
  assert.equal(
    tryNow(d, path, null).fail.hint,
    ".claude/skills/tdd/SKILL.md is not there yet.",
    "a missing file is not done",
  );
  assert.equal(
    tryNow(d, path, "---\nname: tdd\n---\n\n  - TODO: write the steps\n").fail
      .hint,
    ".claude/skills/tdd/SKILL.md still has: - TODO: write the steps",
  );
  assert.equal(
    tryNow(
      d,
      path,
      "---\nname: tdd\n---\n\nTODOS are words, not a TODO-free line.\n",
    ).status,
    "fail",
    "TODO- still matches \\bTODO\\b",
  );
  assert.equal(
    tryNow(d, path, "---\nname: tdd\n---\n\nWrite the test first.\n").status,
    "done",
  );
});

// spec: verify.value.file
test("evidence skips a leading front matter block and lines that are only ---, { or [, for a file beat, a check and json", () => {
  // was learn-flow:2166
  const skill =
    "---\nname: tdd\ndescription: Test first.\n---\n\n# Test-driven development\n";
  const file = onReading("file .claude/agents/reviewer.md");
  tryNow(file, ".claude/agents/reviewer.md", null);
  // It shows the first line that says something, and counts every line.
  assert.equal(
    tryNow(
      file,
      ".claude/agents/reviewer.md",
      "---\nname: reviewer\n---\nReview the diff.\nThen say what is wrong.\n",
    ).evidence,
    "Review the diff. and 4 more lines",
  );
  // A check beat: the evidence is its evidence file's, as main read it.
  const check = driver({
    course: courseWith({ "b-2": DEMO_B2 }),
    saved: save({
      lessons: {
        "b-1": b1Done,
        "b-2": {
          warm: ["R1", "R2", "R3"],
          done: ["R1", "R2", "R3"],
          step: "W1",
          beat: 0,
        },
      },
    }),
  });
  check.open("b-2");
  assert.equal(stepOf(check.state).id, "W1");
  check.send({
    type: "check",
    lesson: "b-2",
    items: [{ index: 0, text: "x", pass: true, hint: "" }],
    read: Buffer.from(skill),
    path: ".practice/b-2-before.txt",
  });
  assert.equal(check.state.beat.evidence, "# Test-driven development");
  const json = onReading("json .mcp.json");
  tryNow(json, ".mcp.json", null);
  assert.equal(
    tryNow(json, ".mcp.json", '{\n  "mcpServers": {}\n}\n').evidence,
    '"mcpServers": {}',
  );
  const list = onReading("json .practice/list.json");
  tryNow(list, ".practice/list.json", null);
  assert.equal(
    tryNow(list, ".practice/list.json", '[\n  {\n    "id": 1\n  }\n]\n')
      .evidence,
    '"id": 1',
  );
  // With no closing line it is no front matter: only the --- line goes.
  const open = onReading("file notes.md");
  tryNow(open, "notes.md", null);
  assert.equal(
    tryNow(open, "notes.md", "---\nname: tdd\n").evidence,
    "name: tdd and 1 more line",
  );
});

// spec: verify.value.file
test("a file beat is done once its file holds any line, front matter or a lone --- included; a file that only opens a block shows that line", () => {
  // was learn-flow:2190
  const path = ".claude/skills/tdd/SKILL.md";
  const d = onReading(`file ${path}`);
  tryNow(d, path, null);
  const st = tryNow(d, path, "---\nname: tdd\ndescription: x\n---\n");
  assert.equal(st.status, "done");
  assert.equal(st.evidence, "name: tdd and 3 more lines");
  const lone = onReading("file notes.md");
  tryNow(lone, "notes.md", null);
  assert.equal(tryNow(lone, "notes.md", "\n---\n").evidence, "---");
  const blank = onReading("file notes.md");
  assert.equal(
    tryNow(blank, "notes.md", " \n\n").fail.hint,
    "notes.md has no line in it yet.",
  );
  // A missing file is not there yet, not a file with no line (r27 E1).
  const gone = onReading("file notes.md");
  assert.equal(
    tryNow(gone, "notes.md", null).fail.hint,
    "notes.md is not there yet.",
  );
});

test("a json key path follows an array only by its indexes: length is no key of one", () => {
  // was learn-flow:2207
  const path = ".claude/settings.json";
  const d = onReading(`json ${path} permissions.deny.length`);
  assert.equal(
    tryNow(d, path, '{"permissions": {"deny": []}}').fail.hint,
    ".claude/settings.json has no permissions.deny.length yet.",
  );
  const first = onReading(`json ${path} permissions.deny.0`);
  assert.equal(
    tryNow(first, path, '{"permissions": {"deny": []}}').status,
    "fail",
  );
  assert.equal(
    tryNow(first, path, '{"permissions": {"deny": ["Read(./.env)"]}}').evidence,
    "permissions.deny.0 = Read(./.env)",
  );
  const map = onReading(`json ${path} env.length`);
  assert.equal(
    tryNow(map, path, '{"env": {"length": "3"}}').evidence,
    "env.length = 3",
    "an object may hold a key named length",
  );
});

test("what the screen shows of a file is one row: no line break, tab or escape sequence, and one emoji at most", () => {
  // was learn-flow:2218
  const path = ".claude/settings.json";
  // V8's parse error quotes the file, line breaks and all.
  const broken = onReading(`json ${path} permissions.deny`);
  const hint = tryNow(broken, path, 'deny:\n{\n  "permissions": {}\n}\n').fail
    .hint;
  assert.match(hint, /^\.claude\/settings\.json does not parse as JSON yet \(/);
  assert.doesNotMatch(hint, /\p{Cc}/u, hint);
  const value = onReading("json .practice/i-2-hook.json prompt");
  assert.equal(
    tryNow(
      value,
      ".practice/i-2-hook.json",
      '{"prompt": "line one\\nline two\\tthree"}',
    ).evidence,
    "prompt = line one line two three",
  );
  const match = onReading("match notes.md TODO");
  assert.equal(
    tryNow(match, "notes.md", "a\tTODO \x1b[31mred\x1b[0m\r\n").evidence,
    "a TODO red",
  );
  const no = onReading("no-match notes.md TODO");
  assert.equal(
    tryNow(no, "notes.md", "TODO \x1b[2J\x07X 🚀 ship 🎉 it\n").fail.hint,
    "notes.md still has: TODO X 🚀 ship * it",
  );
  const file = onReading("file notes.md");
  tryNow(file, "notes.md", null);
  assert.equal(
    tryNow(
      file,
      "notes.md",
      "\x1b]8;;https://example.com\x07link\x1b]8;;\x07 text\n",
    ).evidence,
    "link text",
  );
});

// A PNG's first bytes: the signature, then its IHDR chunk, 800 by 600.
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000320000002580806000000",
  "hex",
);
test("json, match and no-match on a binary file: not yet, and the line names its kind and size, never its bytes", () => {
  // was learn-flow:2238
  const path = ".practice/i-7-page.png";
  const png = Buffer.concat([
    PNG,
    Buffer.from("TODO {}"),
    Buffer.alloc(3000, 7),
  ]);
  for (const verify of [
    `json ${path}`,
    `match ${path} PNG`,
    `no-match ${path} TODO`,
  ]) {
    const d = onReading(verify);
    d.run();
    d.send({
      type: "file",
      path,
      read: png,
      stamp: "b",
      asked: d.state.beat.asked,
    });
    assert.equal(d.state.beat.status, "fail", verify);
    assert.equal(
      d.state.beat.fail.hint,
      ".practice/i-7-page.png is not a text file yet: it holds a PNG image, 800 x 600.",
      verify,
    );
    assert.equal(d.state.beat.evidence ?? null, null, verify);
  }
});
test("a binary file's evidence is its kind and size, never its bytes: a PNG is an image and its size", () => {
  // was learn-flow:2250
  const path = ".practice/i-7-page.png";
  const d = onReading(`file ${path}`);
  tryNow(d, path, null);
  d.run();
  d.send({
    type: "file",
    path,
    read: Buffer.concat([PNG, Buffer.alloc(3000, 7)]),
    stamp: "b",
    asked: d.state.beat.asked,
  });
  assert.equal(d.state.beat.status, "done");
  assert.equal(d.state.beat.evidence, "a PNG image, 800 x 600");
  const other = onReading("file .practice/blob.bin");
  tryNow(other, ".practice/blob.bin", null);
  other.run();
  other.send({
    type: "file",
    path: ".practice/blob.bin",
    read: Buffer.concat([Buffer.from("\x00\x01text"), Buffer.alloc(2042, 0)]),
    stamp: "b",
    asked: other.state.beat.asked,
  });
  assert.equal(other.state.beat.evidence, "binary data, 2 KB");
  // A check's evidence file too.
  const check = driver({
    course: courseWith({ "b-2": DEMO_B2 }),
    saved: save({
      lessons: {
        "b-1": b1Done,
        "b-2": {
          warm: ["R1", "R2", "R3"],
          done: ["R1", "R2", "R3"],
          step: "W1",
          beat: 0,
        },
      },
    }),
  });
  check.open("b-2");
  check.send({
    type: "check",
    lesson: "b-2",
    items: [{ index: 0, text: "x", pass: true, hint: "" }],
    read: Buffer.from("\x00\x00\x00"),
    path: ".practice/b-2-before.txt",
  });
  assert.equal(check.state.beat.evidence, "binary data, 3 bytes");
});

// spec: tiers.counting
test("a Your turn step that json, match or no-match verifies counts as checked: the last one gets a notch less help, as a check step does", () => {
  // was learn-flow:2270
  assert.equal(tierOf(onReading("check 0").state), "challenge");
  for (const verify of [
    "json .mcp.json mcpServers",
    "match CLAUDE.md ^@",
    "no-match SKILL.md TODO",
  ]) {
    assert.equal(tierOf(onReading(verify).state), "challenge", verify);
  }
});

// spec: tiers.challenge-try
test("h at CHALLENGE: on a json, match or no-match beat, r is the try", () => {
  // was learn-flow:2277
  for (const verify of [
    "json .mcp.json mcpServers",
    "match CLAUDE.md ^@",
    "no-match SKILL.md TODO",
  ]) {
    const path = verify.split(" ")[1];
    const d = onReading(`${verify}\n- hint: "Open the file."`);
    assert.equal(tierOf(d.state), "challenge", verify);
    // The hintsLater toast's engine facts: no hint yet, and r is the try.
    assert.equal(hintAvailable(d.state), false, verify);
    assert.equal(tryFirst(d.state), "r", verify);
    d.refused("hint.next");
    assert.equal(
      d.state.beat.rung,
      -1,
      `${verify}: nothing opens before a try`,
    );
    tryNow(d, path, null);
    d.hint();
    assert.equal(d.state.beat.rung, 0, verify);
  }
});

test('a "Done when" in the app\'s words may stand on a json, match or no-match beat, as on a file beat', () => {
  // was learn-flow:2291
  for (const verify of [
    "json .mcp.json mcpServers",
    "match CLAUDE.md ^@",
    "no-match SKILL.md TODO",
  ]) {
    const d = onReading(`${verify}\n- say: Done when the file has it.`);
    assert.deepEqual(
      beatOf(d.state)
        .lines.filter((x) => x.doneWhen)
        .map((x) => x.text),
      ["Done when the file has it."],
      verify,
    );
  }
});

// ---- git status for part of the tree (ticket 88) -----------------------------
// spec: verify.value.git-clean
// spec: verify.value.git-clean-paths
test("git-clean with paths: done once git status lists nothing under them, whatever else it lists", () => {
  // was learn-flow:2299
  const d = onReading("git-clean secrets/ package-lock.json");
  assert.deepEqual(beatOf(d.state).verify, {
    kind: "git-clean",
    paths: ["secrets/", "package-lock.json"],
  });
  // It asks git for every untracked file, not just its folder.
  assert.deepEqual(pending(d, "git"), {
    type: "git",
    dir: PROJECT,
    files: true,
  });
  d.send(gitLists(["README.md", "secrets/key.txt", "package-lock.json"]));
  assert.equal(d.state.beat.status, "fail");
  assert.deepEqual(d.state.beat.fail.paths, [
    "secrets/key.txt",
    "package-lock.json",
  ]);
  // A name that only starts like a path is not under it.
  d.send(
    gitLists([
      "README.md",
      "secrets-old.txt",
      "package-lock.json.bak",
      ".claude/skills/five-whys/SKILL.md",
    ]),
  );
  assert.equal(d.state.beat.status, "done");
  // Without paths, it is the whole tree, as before.
  const whole = onReading("git-clean");
  assert.deepEqual(beatOf(whole.state).verify, { kind: "git-clean" });
  assert.deepEqual(pending(whole, "git"), { type: "git", dir: PROJECT });
  whole.send({ type: "git", paths: ["README.md"] });
  assert.equal(whole.state.beat.status, "fail");
});

// spec: verify.value.git-clean-paths
// spec: guards.4-watch-shape
test("git-clean with paths: a result that lists untracked folders whole decides nothing, nor does a whole-tree beat take one that lists each file", () => {
  // was learn-flow:2318
  const d = onReading("git-clean .claude/settings.local.json");
  // git lists the untracked .claude/ whole: whether the file is in it can't be told.
  d.send({ type: "git", paths: [".claude/"] });
  assert.equal(d.state.beat.status, "opening");
  d.send(gitLists([".claude/skills/five-whys/SKILL.md"]));
  assert.equal(d.state.beat.status, "done");
  const whole = onReading("git-clean");
  whole.send(gitLists([]));
  assert.equal(whole.state.beat.status, "opening");
  whole.send({ type: "git", paths: [] });
  assert.equal(whole.state.beat.status, "done");
});

// spec: verify.value.git-changed
test('git-changed: done once git status lists something under the path; the first answer is where the learner starts, with no "not yet"', () => {
  // was learn-flow:2332
  const d = onReading("git-changed src/");
  assert.deepEqual(beatOf(d.state).verify, {
    kind: "git-changed",
    path: "src/",
  });
  assert.deepEqual(pending(d, "git"), {
    type: "git",
    dir: PROJECT,
    files: true,
  });
  d.send(gitLists(["README.md", "srcs/a.js"]));
  assert.equal(d.state.beat.status, "waiting");
  d.run();
  d.send(gitLists(["README.md"], [], { asked: d.state.beat.asked }));
  assert.equal(d.state.beat.status, "fail");
  assert.equal(
    d.state.beat.fail.hint,
    "git status lists no change under src/ yet.",
  );
  d.send(gitLists(["README.md", "src/config.js", "src/new/"]));
  assert.equal(d.state.beat.status, "done");
  assert.equal(d.state.beat.evidence, "Changed: src/config.js, src/new/");
  // A change there already when the step opens counts, as a check that already passes does.
  const already = onReading("git-changed src");
  already.send(gitLists(["src/a.js", "src/b.js", "src/c.js", "src/d.js"]));
  assert.equal(already.state.beat.status, "already");
  assert.equal(
    already.state.beat.evidence,
    "Changed: src/a.js, src/b.js, src/c.js and 1 more",
  );
  // A whole-tree result decides nothing.
  const whole = onReading("git-changed src/");
  whole.send({ type: "git", paths: ["src/"] });
  assert.equal(whole.state.beat.status, "opening");
});

// spec: verify.value.git-only
test("git-only: done once git status lists something, all of it under the path; the not-yet line names what is outside", () => {
  // was learn-flow:2356
  const d = onReading("git-only .claude/");
  assert.deepEqual(beatOf(d.state).verify, {
    kind: "git-only",
    path: ".claude/",
  });
  d.send(gitLists([]));
  assert.equal(d.state.beat.status, "waiting");
  d.run();
  d.send(gitLists([], [], { asked: d.state.beat.asked }));
  assert.equal(d.state.beat.fail.hint, "git status lists no change yet.");
  d.send(
    gitLists([
      ".claude/skills/five-whys/SKILL.md",
      "README.md",
      ".claudeignore",
    ]),
  );
  assert.equal(d.state.beat.status, "fail");
  assert.equal(
    d.state.beat.fail.hint,
    "2 files changed outside .claude/: README.md, .claudeignore",
  );
  d.send(gitLists([".claude/skills/five-whys/SKILL.md", "notes.md"]));
  assert.equal(
    d.state.beat.fail.hint,
    "1 file changed outside .claude/: notes.md",
  );
  d.send(
    gitLists([
      ".claude/skills/five-whys/SKILL.md",
      ".claude/skills/five-whys/notes.md",
    ]),
  );
  assert.equal(d.state.beat.status, "done");
  assert.equal(
    d.state.beat.evidence,
    "Changed: .claude/skills/five-whys/SKILL.md, .claude/skills/five-whys/notes.md",
  );
});

// spec: verify.value.git-staged
test("git-staged: done once git status says a path is staged; a change not yet added is not", () => {
  // was learn-flow:2374
  const d = onReading("git-staged");
  assert.deepEqual(beatOf(d.state).verify, { kind: "git-staged" });
  assert.deepEqual(pending(d, "git"), {
    type: "git",
    dir: PROJECT,
    files: true,
  });
  d.send(gitLists(["src/config.js"]));
  assert.equal(d.state.beat.status, "waiting");
  d.run();
  d.send(gitLists(["src/config.js"], [], { asked: d.state.beat.asked }));
  assert.equal(d.state.beat.fail.hint, "git status lists nothing staged yet.");
  d.send(gitLists(["src/config.js", "test/config.test.js"], ["src/config.js"]));
  assert.equal(d.state.beat.status, "done");
  assert.equal(d.state.beat.evidence, "Staged: src/config.js");
});

// spec: tiers.counting
test("a Your turn step that git-clean on paths, git-changed, git-only or git-staged verifies counts as checked: the last one gets a notch less help", () => {
  // was learn-flow:2388
  assert.equal(
    tierOf(onReading("none").state),
    "hinted",
    "a step nothing checks keeps its tier",
  );
  for (const verify of [
    "git-clean secrets/",
    "git-changed src/",
    "git-only .claude/",
    "git-staged",
  ]) {
    assert.equal(tierOf(onReading(verify).state), "challenge", verify);
  }
});

// spec: tiers.challenge-try
test("h at CHALLENGE on a git-changed, git-only or git-staged beat: r is the try; and git that could not run is not the learner's work", () => {
  // was learn-flow:2395
  for (const verify of [
    "git-changed src/",
    "git-only .claude/",
    "git-staged",
  ]) {
    const d = onReading(`${verify}\n- hint: "Look at git status."`);
    d.send(gitLists([]));
    // The hintsLater toast's engine facts: no hint yet, and r is the try.
    assert.equal(hintAvailable(d.state), false, verify);
    assert.equal(tryFirst(d.state), "r", verify);
    d.refused("hint.next");
    d.run();
    d.send(gitLists([], [], { asked: d.state.beat.asked }));
    d.hint();
    assert.equal(d.state.beat.rung, 0, verify);
    const broken = onReading(verify);
    broken.send({
      type: "git-error",
      message: "git is not installed",
      dir: PROJECT,
    });
    assert.deepEqual(
      [broken.state.beat.status, broken.state.beat.error],
      ["broken", "git is not installed"],
      verify,
    );
  }
});

test("playUntil plays through every git kind", () => {
  // was learn-flow:2411
  for (const verify of [
    "git-clean secrets/",
    "git-changed src/",
    "git-only .claude",
    "git-staged",
  ]) {
    const d = onReading(verify);
    playUntil(d, (s) => Boolean(s.beat) && stepOf(s)?.id === "C");
    assert.equal(where(d.state).step, "C", verify);
  }
});
