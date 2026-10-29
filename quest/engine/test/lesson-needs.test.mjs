// What a lesson needs before it starts (ticket 89), driven by actions
// (ticket 208): the commands its page's You need lists, the work an earlier
// lesson leaves behind, and, on native Windows, the page's note. The
// overview knows what is missing, so the Learner finds out before spending
// usage. Ported from learn-needs.test.mjs; what the terminal drew of it is
// cut.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  asksFolder,
  asksHere,
  course,
  DEMO_I1,
  driver,
  finishedBefore,
  folderOptions,
  folderProblem,
  introAsks,
  introNotes,
  introOptions,
  judge,
  lessonNumber,
  levelOf,
  loadCourse,
  missingNeeds,
  offered,
  parseLesson,
  PATH,
  pending,
  prereq,
  repoNeed,
  save,
  snapshot,
  threeLevels,
  unmet,
} from "./drive.mjs";

// The guide's own You need lines, as the lessons that need them quote them.
const NEED_JQ =
  "`jq`, which the hook scripts use, and `python3`, which `format-after-edit.sh` uses.";
const NEED_SANDBOX =
  "On Linux and WSL 2, the sandbox needs `bubblewrap` and `socat`";

// DEMO_I1 with `front` lines added to its front matter and `intro` lines to
// its intro.
const withNeeds = ({ front = [], intro = [] } = {}) =>
  DEMO_I1.replace(
    "next: i-2\n---",
    `next: i-2\n${front.map((l) => `${l}\n`).join("")}---`,
  ).replace(
    '- can: "do it"\n',
    `- can: "do it"\n${intro.map((l) => `${l}\n`).join("")}`,
  );
const parse = (opts) => parseLesson(withNeeds(opts), "i-1.md");

// was learn-needs:30
// spec: needs.needs-commands
test('front matter names the commands the page needs: each needs item is the commands one need line quotes, "on linux" for Linux only', () => {
  const l = parse({
    front: ["needs: [jq python3, bwrap socat on linux]"],
    intro: [`- need: "${NEED_JQ}"`, `- need: "${NEED_SANDBOX}"`],
  });
  assert.deepEqual(l.needs, [
    { commands: ["jq", "python3"], linux: false, quote: NEED_JQ },
    { commands: ["bwrap", "socat"], linux: true, quote: NEED_SANDBOX },
  ]);
  assert.deepEqual(parse().needs, [], "a lesson that names none needs none");
});

// was learn-needs:39
test("a needs item the app can't read, or one with no need line to quote, is an error naming the file", () => {
  const bad = [
    // The front matter's needs line, the sixth, is the one named; with no
    // needs line, the need line is.
    [
      { front: ["needs: [jq]"] },
      /i-1\.md:6: needs has 1 item and the intro 0 need lines/,
    ],
    [
      { intro: [`- need: "${NEED_JQ}"`] },
      /i-1\.md:\d+: needs has 0 items and the intro 1 need line/,
    ],
    [
      { front: ["needs: [jq, python3]"], intro: [`- need: "${NEED_JQ}"`] },
      /i-1\.md:6: needs has 2 items and the intro 1 need line/,
    ],
    [
      { front: ["needs: [jq;rm]"], intro: [`- need: "${NEED_JQ}"`] },
      /i-1\.md:6: needs item "jq;rm" is command names/,
    ],
    [
      { front: ["needs: [../bin/jq]"], intro: [`- need: "${NEED_JQ}"`] },
      /needs item "\.\.\/bin\/jq"/,
    ],
    [
      {
        front: ["needs: [bwrap on mac]"],
        intro: [`- need: "${NEED_SANDBOX}"`],
      },
      /needs item "bwrap on mac"/,
    ],
    [
      { front: ["needs: [on linux]"], intro: [`- need: "${NEED_SANDBOX}"`] },
      /needs item "on linux"/,
    ],
    [
      { front: ["needs: [jq]"], intro: ["- need: jq is needed"] },
      /need must be a quote of the lesson/,
    ],
  ];
  for (const [opts, error] of bad)
    assert.throws(() => parse(opts), error, JSON.stringify(opts));
  // A block list reads as the inline one does.
  assert.deepEqual(
    parse({ front: ["needs:", "  - jq"], intro: [`- need: "${NEED_JQ}"`] })
      .needs,
    [{ commands: ["jq"], linux: false, quote: NEED_JQ }],
  );
});

// ---- the overview --------------------------------------------------------------
const MINE = "/home/sam/code/my-app";
// The practice copy: the driver's FACTS.root.
const COPY = "/home/sam/claude-code-practice";
// At i-1's overview, Beginner finished and Intermediate's folder answered,
// with `opts` in its lesson file; `facts` as main found them.
const atIntro = (opts, facts = {}, folders = { intermediate: MINE }) => {
  const lessons = threeLevels({ "i-1": withNeeds(opts) });
  const d = driver({
    course: lessons,
    facts,
    saved: save({ lessons: finishedBefore("i-1", lessons), folders }),
  });
  assert.deepEqual([d.state.phase, d.state.lesson], ["overview", "i-1"]);
  return d;
};
const NEEDS = {
  front: ["needs: [jq python3, bwrap socat on linux]"],
  intro: [`- need: "${NEED_JQ}"`, `- need: "${NEED_SANDBOX}"`],
};

// was learn-needs:75
// spec: needs.needs-commands
test("the intro asks main to look up the commands its page needs, the Linux-only ones on Linux alone; each missing one shows its You need line", () => {
  const mac = atIntro(NEEDS);
  assert.deepEqual(introAsks(mac.state), [
    { type: "commands", names: ["jq", "python3"] },
  ]);
  const linux = atIntro(NEEDS, { linux: true });
  assert.deepEqual(introAsks(linux.state), [
    { type: "commands", names: ["jq", "python3", "bwrap", "socat"] },
  ]);
  // Opened again, the overview asks again: a command installed meanwhile
  // counts. The engine asks only when the overview's lesson changes, so the
  // Learner opens another lesson and comes back (D3).
  linux.open("b-1");
  linux.open("i-1");
  assert.equal(linux.state.phase, "overview");
  assert.deepEqual(pending(linux, "commands"), {
    type: "commands",
    names: ["jq", "python3", "bwrap", "socat"],
  });
  // Before main answers, nothing is said.
  // dropped: T-render the screen's text at 60x20 and 80x24
  assert.deepEqual(missingNeeds(linux.state), []);
  assert.deepEqual(introNotes(linux.state), []);
  linux.send({
    type: "commands",
    found: { jq: true, python3: false, bwrap: true, socat: true },
  });
  // What is found says nothing; the Learner can still start.
  assert.deepEqual(missingNeeds(linux.state), [
    { quote: NEED_JQ, names: ["python3"] },
  ]);
  assert.deepEqual(introNotes(linux.state), ["needs"]);
  assert.equal(introOptions(linux.state)[0], "start");
  linux.send({ type: "commands", found: { python3: true, socat: false } });
  assert.deepEqual(missingNeeds(linux.state), [
    { quote: NEED_SANDBOX, names: ["socat"] },
  ]);
  // Two lines missing: each names its commands.
  // dropped: T-render the one sentence that names every command
  linux.send({ type: "commands", found: { jq: false } });
  assert.deepEqual(missingNeeds(linux.state), [
    { quote: NEED_JQ, names: ["jq"] },
    { quote: NEED_SANDBOX, names: ["socat"] },
  ]);
  // On macOS a Linux-only command is never asked about, so never shown.
  mac.send({
    type: "commands",
    found: { jq: false, python3: false, bwrap: false },
  });
  assert.deepEqual(missingNeeds(mac.state), [
    { quote: NEED_JQ, names: ["jq", "python3"] },
  ]);
  // A lesson that needs nothing asks nothing.
  assert.deepEqual(introAsks(atIntro().state), []);
});

// The guide's NOTE, on Intermediate lesson 1's page.
const WINDOWS =
  "From this level on, the lessons are written for macOS, Linux and WSL 2.";

// was learn-needs:114
test("on native Windows the intro shows the page's note, and the learner can still start", () => {
  assert.equal(
    parse({ intro: [`- win-note: "${WINDOWS}"`] }).intro["win-note"],
    WINDOWS,
  );
  assert.throws(
    () => parse({ intro: [`- win-note: ${WINDOWS}`] }),
    /win-note must be a quote of the lesson/,
  );
  assert.throws(
    () =>
      parse({
        intro: [`- win-note: "${WINDOWS}"`, `- win-note: "${WINDOWS}"`],
      }),
    /a second win-note line/,
  );
  const d = atIntro({ intro: [`- win-note: "${WINDOWS}"`] }, { win32: true });
  // dropped: T-render the note drawn whole in two themes at 60x20 and 80x24
  assert.deepEqual(introNotes(d.state), ["win"]);
  assert.equal(introOptions(d.state)[0], "start", "the start option stays");
  // Elsewhere it says nothing.
  // dropped: T-render a win32 state drawn in a non-Windows theme; render gates the note on t.caps.win32, the engine on facts.win32, and main sets both from the platform
  assert.deepEqual(
    introNotes(atIntro({ intro: [`- win-note: "${WINDOWS}"`] }).state),
    [],
  );
  d.start();
  assert.equal(d.state.phase, "playing");
  assert.ok(d.state.beat, "the first beat is open");
});

// ---- what the page asks of your repository (ticket 179) ------------------------
// Intermediate lesson 1's You need line, which names no command.
const NEED_REPO =
  "One of your own repositories with a test command and no uncommitted changes";

// was learn-needs:136
test("an intro may quote the page's You need line for the learner's repository, once", () => {
  assert.equal(
    parse({ intro: [`- need-repo: "${NEED_REPO}"`] }).intro["need-repo"],
    NEED_REPO,
  );
  assert.equal(parse().intro["need-repo"], undefined);
  assert.throws(
    () => parse({ intro: [`- need-repo: ${NEED_REPO}`] }),
    /need-repo must be a quote of the lesson/,
  );
  assert.throws(
    () =>
      parse({
        intro: [`- need-repo: "${NEED_REPO}"`, `- need-repo: "${NEED_REPO}"`],
      }),
    /a second need-repo line/,
  );
});

// was learn-needs:143
test("the intro shows the repository line only where the level's work folder is set and is not the practice copy; n shows it too", () => {
  const repo = { intro: [`- need-repo: "${NEED_REPO}"`] };
  const mine = atIntro(repo);
  // dropped: T-render the line drawn with its lead at 60x20 and 80x24
  assert.equal(repoNeed(mine.state), NEED_REPO);
  assert.deepEqual(introNotes(mine.state), ["repo"]);
  assert.equal(introOptions(mine.state)[0], "start", "the learner can start");
  // dropped: T-overlay n opens the notes and shows the line
  // In the practice copy, and while the folder question waits, it says
  // nothing.
  const copy = atIntro(repo, {}, { intermediate: COPY });
  const asking = atIntro(repo, {}, null);
  assert.ok(asksFolder(asking.state));
  assert.equal(levelOf(asking.state), "intermediate");
  for (const d of [copy, asking]) {
    assert.equal(repoNeed(d.state), null);
    // With nothing to say, n has nothing to open.
    assert.deepEqual(introNotes(d.state), []);
  }
  // dropped: T-overlay n does nothing in the copy
  // Answered with this practice copy, still nothing: the answer row shows.
  asking.folderChoose("intermediate", "practice-copy");
  assert.equal(asking.state.folders.intermediate, COPY);
  assert.ok(asksHere(asking.state) && !asksFolder(asking.state));
  assert.equal(repoNeed(asking.state), null);
  mine.start();
  assert.equal(mine.state.phase, "playing");
  assert.ok(mine.state.beat);
});

// At `id`'s overview, every lesson before it finished, with `opts` in its
// lesson file and `folders` saved.
const atLesson = (id, opts, folders) => {
  const lessons = threeLevels({
    [id]: withNeeds(opts).replace("lesson: i-1", `lesson: ${id}`),
  });
  const d = driver({
    course: lessons,
    saved: save({ lessons: finishedBefore(id, lessons), folders }),
  });
  assert.deepEqual([d.state.phase, d.state.lesson], ["overview", id]);
  return d;
};

// was learn-needs:181
test("the repository line shows on a later intro in the level's work folder, and never where the lesson runs elsewhere", () => {
  const repo = { intro: [`- need-repo: "${NEED_REPO}"`] };
  // A later overview, with no answer row: the line still shows.
  const later = atLesson("i-2", repo, { intermediate: MINE });
  // dropped: T-render the line drawn at 60x20 and 80x24
  assert.equal(repoNeed(later.state), NEED_REPO);
  assert.equal(asksHere(later.state), false, "no answer row");
  // The capstone pinned to the copy, a lesson in a new copy of the
  // template, and Beginner, which has no work folder: nothing, so n has
  // nothing to open.
  const elsewhere = [
    ["i-capstone", { intermediate: MINE }],
    [
      "a-5",
      { intermediate: MINE, advanced: MINE, "a-5": "/home/sam/new-copy" },
    ],
    ["b-4", {}],
  ];
  for (const [id, folders] of elsewhere) {
    const d = atLesson(id, repo, folders);
    assert.equal(repoNeed(d.state), null, id);
    assert.deepEqual(introNotes(d.state), [], id);
    // dropped: T-overlay n does nothing
  }
});

// ---- prerequisites -------------------------------------------------------------
const SKILL = ".claude/skills/five-whys/SKILL.md";

// was learn-needs:208
// spec: needs.requires
test("front matter names a prerequisite: an earlier lesson's check item, or a file an earlier lesson leaves", () => {
  const l = parseLesson(
    withNeeds({
      front: [`requires: [b-5 check 0, b-4 file ${SKILL}]`],
    }).replace("lesson: i-1", "lesson: i-3"),
    "i-3.md",
  );
  assert.deepEqual(l.requires, [
    { lesson: "b-5", item: 0 },
    { lesson: "b-4", path: SKILL },
  ]);
  assert.deepEqual(parse().requires, []);
  // Each error names the front matter's requires line, the sixth.
  const bad = [
    [
      "requires: [b-5]",
      /i-1\.md:6: requires item "b-5" is <lesson> check <item>, <lesson> file <path> or probe todos <n>/,
    ],
    [
      "requires: [probe todos x]",
      /requires item "probe todos x": probe todos takes a count/,
    ],
    [
      "requires: [probe pushed]",
      /requires item "probe pushed" is <lesson> check/,
    ],
    ["requires: [b-5 check]", /requires item "b-5 check"/],
    ["requires: [b-5 check x]", /requires item "b-5 check x"/],
    [
      "requires: [b-5 check 9]",
      /i-1\.md:6: requires item "b-5 check 9": b-5 has no check item 9/,
    ],
    ["requires: [z-9 check 0]", /z-9 is no lesson before i-1/],
    ["requires: [i-1 check 0]", /i-1 is no lesson before i-1/],
    ["requires: [i-2 check 0]", /i-2 is no lesson before i-1/],
    [
      "requires: [b-5 file ../secret.txt]",
      /names a file from the work folder, like/,
    ],
    [
      "requires: [b-5 file /etc/passwd]",
      /names a file from the work folder, like/,
    ],
    [
      "requires: [b-5 file a\\b.txt]",
      /names a file from the work folder, like/,
    ],
    // A folder is no file: reading it finds no line.
    [
      "requires: [b-4 file .claude/skills/]",
      /names a file from the work folder, like .* not \.claude\/skills\//,
    ],
    // A check item that starts another process runs only on r.
    ["requires: [b-3 check 1]", /b-3's check item 1 starts another process/],
    [
      "requires: [b-5 check 0, b-5 check 0]",
      /requires item "b-5 check 0" is named twice/,
    ],
  ];
  for (const [line, error] of bad)
    assert.throws(() => parse({ front: [line] }), error, line);
  // A lesson off the path has nothing before it.
  assert.throws(
    () =>
      parseLesson(
        withNeeds({ front: ["requires: [a-7 check 0]"] }).replace(
          "lesson: i-1",
          "lesson: zz-9",
        ),
        "zz-9.md",
      ),
    /zz-9\.md:6: requires: zz-9 is no lesson on the path/,
  );
});

// was learn-needs:237
test("a course that puts a prerequisite's lesson after the lesson that needs it does not load", () => {
  const dir = mkdtempSync(join(tmpdir(), "learn-requires-"));
  try {
    mkdirSync(join(dir, "learn", "lessons"), { recursive: true });
    writeFileSync(
      join(dir, "learn", "lessons", "i-1.md"),
      withNeeds({ front: ["requires: [b-5 check 0]"] }),
    );
    const at = (id) => PATH.find((p) => p.id === id);
    assert.equal(
      loadCourse(dir, [at("b-5"), at("i-1")])[1].content.requires.length,
      1,
    );
    assert.throws(
      () => loadCourse(dir, [at("i-1"), at("b-5")]),
      /learn\/lessons\/i-1\.md: requires b-5, no lesson before i-1 here/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const REQUIRES = { front: [`requires: [b-5 check 0, b-4 file ${SKILL}]`] };
const ASKED = [
  { lesson: "b-5", item: 0 },
  { lesson: "b-4", path: SKILL },
];
const B5_ITEM =
  "a committed CLAUDE.md holds the rule saved in `.practice/b-5-rule.txt`";
// What a prerequisite file that isn't there says, as a file beat says it.
const NO_SKILL = judge({ kind: "file", path: SKILL }, null).hint;
// main's answer to one prerequisite of i-1's.
const answer = (dir, at, found) => prereq({ lesson: "i-1", dir }, at, found);

// was learn-needs:256
// spec: guards.2-folder-match
test("the intro looks for its prerequisites in the work folder; one that fails says so, and is offered where that lesson is practised in the same folder", () => {
  const d = atIntro(REQUIRES, {}, { intermediate: COPY });
  assert.deepEqual(introAsks(d.state), [
    { type: "prereqs", lesson: "i-1", dir: COPY, requires: ASKED },
  ]);
  // Until main answers, nothing is said and the two starts are offered.
  assert.deepEqual(unmet(d.state), []);
  assert.deepEqual(introOptions(d.state), ["start", "less"]);
  // A result from another folder says nothing about this one.
  d.send(answer(MINE, 0, { pass: false }));
  assert.deepEqual(unmet(d.state), []);
  assert.equal(d.state.prereqs["i-1"], undefined);
  d.send(answer(COPY, 0, { pass: false }));
  d.send(answer(COPY, 1, { read: null }));
  // Each says what isn't there; the offer says whose work it is.
  // dropped: T-render the 60x20 row that hands the notes to n
  assert.deepEqual(unmet(d.state), [
    { lesson: "b-5", item: 0, hint: B5_ITEM, offer: true },
    { lesson: "b-4", path: SKILL, hint: NO_SKILL, offer: true },
  ]);
  assert.deepEqual(introNotes(d.state), ["prereq", "prereq"]);
  assert.equal(offered(d.state), "b-5");
  // The offer is the third option, and opens B5.
  // dropped: T-cursor down twice, or 3, then enter
  assert.deepEqual(introOptions(d.state), ["start", "less", "first"]);
  d.open(offered(d.state));
  assert.deepEqual([d.state.phase, d.state.lesson], ["overview", "b-5"]);
  // Back at i-1 the overview looks again; what passes now says nothing.
  const again = atIntro(REQUIRES, {}, { intermediate: COPY });
  again.send(answer(COPY, 0, { pass: true }));
  again.send(answer(COPY, 1, { read: "---\nname: five-whys\n---\n" }));
  assert.deepEqual(unmet(again.state), []);
  assert.equal(offered(again.state), null);
  // An item the check could not decide (an error) says nothing.
  again.send(answer(COPY, 0, { pass: null }));
  assert.deepEqual(unmet(again.state), []);
  // The file's lesson is offered too, and with nothing to offer there is no
  // third option.
  const three = atIntro(REQUIRES, {}, { intermediate: COPY });
  three.send(answer(COPY, 1, { read: "" }));
  assert.equal(offered(three.state), "b-4");
  three.open(offered(three.state));
  assert.deepEqual(
    [three.state.phase, three.state.lesson],
    ["overview", "b-4"],
  );
  // dropped: T-cursor 3 leaves the cursor where it was
  assert.deepEqual(introOptions(again.state), ["start", "less"]);
});

// was learn-needs:303
test("a prerequisite that fails in the learner's own repository says so, but offers no lesson practised in another folder", () => {
  // Intermediate practises in my-app; Beginner in the practice copy, so
  // doing B5 again there would not change what my-app holds.
  const d = atIntro(REQUIRES);
  assert.deepEqual(introAsks(d.state), [
    { type: "prereqs", lesson: "i-1", dir: MINE, requires: ASKED },
  ]);
  d.send(answer(MINE, 0, { pass: false }));
  // dropped: T-render the line drawn at 60x20 and 80x24
  assert.deepEqual(unmet(d.state), [
    { lesson: "b-5", item: 0, hint: B5_ITEM, offer: false },
  ]);
  assert.equal(offered(d.state), null);
  // There is no third option.
  // dropped: T-cursor 3 and down twice leave the cursor on the start option
  assert.deepEqual(introOptions(d.state), ["start", "less"]);
});

// was learn-needs:321
// spec: guards.5-prereq-folder-asks
test("while the folder question waits for an answer the prerequisites wait too; the answer asks for them in that folder", () => {
  const d = atIntro(REQUIRES, {}, null);
  assert.deepEqual(introAsks(d.state), []);
  d.refused("lesson.start");
  d.folderChoose("intermediate", "practice-copy");
  assert.deepEqual(pending(d, "prereqs"), {
    type: "prereqs",
    lesson: "i-1",
    dir: COPY,
    requires: ASKED,
    asked: 1,
  });
});

// was learn-needs:328
// spec: guards.1-ask-numbers
test("each ask for the prerequisites has its number: an answer to an older ask that lands after a newer one says nothing", () => {
  const d = atIntro(REQUIRES, {}, { intermediate: COPY });
  // main's first look at startup has no number; each overview opened after
  // has a newer one. The engine asks only when the overview's lesson
  // changes, so the Learner opens another lesson and comes back (D3).
  const reopen = () => {
    d.open("b-1");
    d.open("i-1");
    const eff = pending(d, "prereqs");
    assert.equal(eff.lesson, "i-1");
    return eff.asked;
  };
  const older = reopen();
  const newer = reopen();
  assert.ok(older >= 1 && newer > older, `${older} then ${newer}`);
  // The newer ask's answer: it passes. The older one's, landing late, says
  // nothing.
  d.send(answer(COPY, 0, { pass: true, asked: newer }));
  d.send(answer(COPY, 0, { pass: false, asked: older }));
  assert.deepEqual(unmet(d.state), []);
  // In order, each answer counts.
  d.send(answer(COPY, 1, { read: "x\n", asked: older }));
  d.send(answer(COPY, 1, { read: null, asked: newer }));
  assert.deepEqual(unmet(d.state), [
    { lesson: "b-4", path: SKILL, hint: NO_SKILL, offer: true },
  ]);
});

// was learn-needs:347
test("an offer that goes once its prerequisite passes leaves the cursor on the start option", () => {
  const d = atIntro(REQUIRES, {}, { intermediate: COPY });
  d.send(answer(COPY, 0, { pass: false }));
  assert.deepEqual(introOptions(d.state), ["start", "less", "first"]);
  d.send(answer(COPY, 0, { pass: true }));
  // dropped: T-cursor the cursor moved from the offer back to the start option
  assert.deepEqual(introOptions(d.state), ["start", "less"]);
  assert.equal(offered(d.state), null);
});

// ---- the row plan ----------------------------------------------------------------
const NEED_SHORT = "`jq`, for the load log in the Worked example.";
// Advanced lesson 7's You need line, the longest that names commands.
const NEED_LONG =
  "bash and `jq`, on macOS, Linux or WSL 2. On Linux and WSL 2, the sandbox needs `bubblewrap` and `socat`";
const NOT_GIT = {
  missing: false,
  git: false,
  gitBroken: null,
  practice: false,
};

// At `id`'s overview, with every command missing and every prerequisite
// failing: its level's folder question waiting (`asking`), answered there
// with this practice copy (`answered`), or my-app saved before (`saved`),
// where `probe` is what main found there.
function crowded(id, opts, { mode = "saved", probe = null } = {}) {
  const lessons = threeLevels({
    [id]: withNeeds(opts).replace("lesson: i-1", `lesson: ${id}`),
  });
  // Every lesson before it finished, but its level's: its folder question
  // is the level's first.
  const done = Object.fromEntries(
    lessons
      .slice(
        0,
        lessons.findIndex((l) => l.id === id),
      )
      .map((l) => [l.id, { complete: true }]),
  );
  const level = lessons.find((l) => l.id === id).level;
  const d = driver({
    course: lessons,
    facts: { linux: true, win32: true },
    saved: save({
      lessons: done,
      ...(mode === "saved" ? { folders: { [level]: MINE } } : {}),
    }),
  });
  assert.equal(d.state.lesson, id);
  if (mode === "answered") d.folderChoose(level, "practice-copy");
  const dir = mode === "saved" ? MINE : COPY;
  if (probe) d.send({ type: "probed", path: dir, ...probe });
  const { content } = d.state.course.find((l) => l.id === id);
  d.send({
    type: "commands",
    found: Object.fromEntries(
      content.needs.flatMap((n) => n.commands).map((c) => [c, false]),
    ),
  });
  content.requires.forEach((r, at) =>
    d.send(
      prereq(
        { lesson: id, dir },
        at,
        r.path ? { read: null } : { pass: false },
      ),
    ),
  );
  return d;
}

// What the old intro's rows said, as engine facts.
const ROWS = {
  // The folder question, with another folder among its answers.
  asking: (s) =>
    asksFolder(s) &&
    levelOf(s) === "intermediate" &&
    folderOptions(s).includes("other"),
  // The answer row: the folder question's lesson, answered.
  answered: (s) => asksHere(s) && !asksFolder(s),
  start: (s) => introOptions(s)[0] === "start" && lessonNumber(s) === 1,
  firstB5: (s) => offered(s) === "b-5",
  firstI1: (s) => offered(s) === "i-1",
  buildsOnB5: (s) =>
    unmet(s).some((r) => r.lesson === "b-5" && r.hint === B5_ITEM),
};

// was learn-needs:431
test("the intro's notes share its row plan with the Why line and the folder question: no teaching line is cut, the Why line gives way first, and notes with no room left take one row that hands them to n", () => {
  const sandbox = {
    front: ["needs: [jq, bwrap socat on linux]", "requires: [b-5 check 0]"],
    intro: [`- need: "${NEED_SHORT}"`, `- need: "${NEED_SANDBOX}"`],
  };
  const windows = { intro: [`- win-note: "${WINDOWS}"`] };
  const first = {
    front: ["needs: [jq]", "requires: [b-5 check 0]"],
    intro: [`- need: "${NEED_SHORT}"`],
  };
  // The longest real You need lines, the Windows note, a prerequisite and
  // a work folder that isn't a git repository, all on one overview.
  const everything = {
    front: [
      "needs: [jq python3, bash jq bwrap socat]",
      `requires: [b-5 check 0, i-1 file ${SKILL}]`,
    ],
    intro: [
      `- need: "${NEED_JQ}"`,
      `- need: "${NEED_LONG}"`,
      `- win-note: "${WINDOWS}"`,
      `- need-repo: "${NEED_REPO}"`,
    ],
  };
  // dropped: T-render the extra can lines, which only crowd the screen
  const cases = [
    // A level's first overview: the folder question, then its answer.
    [
      "first, asking, the Windows note",
      "i-1",
      windows,
      { mode: "asking" },
      ["asking"],
    ],
    [
      "first, answered, the Windows note",
      "i-1",
      windows,
      { mode: "answered" },
      ["answered", "start"],
    ],
    [
      "first, asking, a command missing",
      "i-2",
      first,
      { mode: "asking" },
      ["asking"],
    ],
    [
      "first, answered, a command and a prerequisite missing",
      "i-2",
      first,
      { mode: "answered" },
      ["answered", "firstB5"],
    ],
    [
      "saved, a prerequisite missing in my-app",
      "i-2",
      { front: ["requires: [b-5 check 0]"] },
      {},
      ["buildsOnB5"],
    ],
    [
      "saved, not a git repository, the Windows note and a command missing",
      "i-1",
      { ...first, intro: [...first.intro, ...windows.intro] },
      { probe: NOT_GIT },
      ["start"],
    ],
    // In the copy B5 is offered, as its lesson is practised there; in
    // my-app only I1 is.
    [
      "first, answered, everything",
      "i-3",
      everything,
      { mode: "answered" },
      ["answered", "firstB5"],
    ],
    [
      "saved, everything in my-app",
      "i-3",
      everything,
      { probe: NOT_GIT },
      ["firstI1"],
    ],
    // The level's first overview in my-app: the answer row, the folder's
    // note and the repository line together.
    [
      "saved, everything on the level's first intro",
      "i-1",
      {
        ...everything,
        front: [everything.front[0], "requires: [b-5 check 0]"],
      },
      { probe: NOT_GIT },
      ["answered", "start"],
    ],
    ["later, two needs", "a-7", sandbox, {}, []],
  ];
  for (const [label, id, opts, how, rows] of cases) {
    const d = crowded(id, opts, how);
    const s = d.state;
    // dropped: T-render fits(): no row dropped or cut at 60x20 and 80x24 in
    // four themes, the Why line giving way before the notes
    for (const r of rows) assert.ok(ROWS[r](s), `${label}: ${r}`);
    // Whatever the overview shows, the notes hold every note.
    // dropped: T-overlay the notes drawn whole behind n
    const { content } = s.course.find((l) => l.id === id);
    const notes = introNotes(s);
    const missing = missingNeeds(s).map((n) => n.quote);
    for (const n of content.needs.filter((x) => !x.linux))
      assert.ok(
        missing.includes(n.quote),
        `${label}: the notes hold "${n.quote}"`,
      );
    if (content.intro["win-note"])
      assert.ok(
        notes.includes("win"),
        `${label}: the notes hold the Windows note`,
      );
    if (how.probe) {
      assert.equal(folderProblem(s), "notGit", label);
      assert.ok(
        notes.includes("folder"),
        `${label}: the notes hold the folder's note`,
      );
    }
    // The repository line, in my-app alone.
    if (content.intro["need-repo"]) {
      const saved = (how.mode ?? "saved") === "saved";
      assert.equal(repoNeed(s), saved ? NEED_REPO : null, label);
      assert.equal(
        notes.includes("repo"),
        saved,
        `${label}: the repository line in my-app alone`,
      );
    }
  }
});

// was learn-needs:563
test("what main finds, on the PATH and in the work folder, is never saved", () => {
  const d = atIntro(
    {
      ...REQUIRES,
      front: [...REQUIRES.front, "needs: [jq]"],
      intro: [`- need: "${NEED_JQ}"`],
    },
    {},
    { intermediate: COPY },
  );
  const before = JSON.stringify(snapshot(d.state));
  d.send({ type: "commands", found: { jq: false } });
  d.send(answer(COPY, 0, { pass: false }));
  d.send(answer(COPY, 1, { read: null }));
  assert.equal(offered(d.state), "b-5");
  assert.equal(JSON.stringify(snapshot(d.state)), before);
});

// was learn-needs:573
// spec: needs.requires
test("a prerequisite can be the work folder's own: probe todos <n>, run as a probe, says what the folder lacks and offers no lesson (105)", () => {
  const opts = { front: ["requires: [probe todos 2]"] };
  assert.deepEqual(parse(opts).requires, [{ probe: "todos", args: ["2"] }]);
  const d = atIntro(opts, {}, { intermediate: COPY });
  assert.deepEqual(introAsks(d.state), [
    {
      type: "prereqs",
      lesson: "i-1",
      dir: COPY,
      requires: [{ probe: "todos", args: ["2"] }],
    },
  ]);
  const hint =
    "git grep finds TODO or FIXME in 1 top-level folder (src/) here; this needs 2.";
  d.send(answer(COPY, 0, { pass: false, hint }));
  // dropped: T-render the line drawn within the width at 60x20 and 80x24
  assert.deepEqual(unmet(d.state), [
    { probe: "todos", args: ["2"], hint, offer: false },
  ]);
  assert.equal(offered(d.state), null);
  d.send(answer(COPY, 0, { pass: true, hint: "" }));
  assert.deepEqual(unmet(d.state), []);
  assert.deepEqual(introNotes(d.state), []);
});
