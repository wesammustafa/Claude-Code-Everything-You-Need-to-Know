// The course's step files, course/steps/<lesson-id>.md. These tests check
// their shape; the lesson test checks their quotes against the Guide pages.
import { test } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GUIDE,
  indexLevel as manifestIndexLevel,
  isChoice,
  OWN_PARTS,
  PART_IDS,
  parseLesson as parseContent,
  coursePath,
  parseManifest,
  READS,
  WHERE,
} from "../src/content.mjs";
import { C, TERMS } from "../src/copy.mjs";
import { TYPED_MAX, WARMUPS } from "../src/rules.mjs";
import { inline } from "../src/text.mjs";
import { lessons } from "../../../practice-template/checks/lessons/index.mjs";
import {
  PROBES,
  probeError,
} from "../../../practice-template/checks/probes.mjs";
import { ruleTiers, TIERS } from "../src/tiers.mjs";
import {
  DEMO_B2,
  DEMO_I1,
  DEMO_I1_INDEX,
  withCode,
} from "./fixtures/course.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const manifest = parseManifest(
  JSON.parse(readFileSync(join(root, "course/manifest.json"), "utf8")),
);
const PATH = coursePath(manifest);
const parseLesson = (text, file = "lesson") =>
  parseContent(text, file, {
    manifest,
    checks: lessons,
    probes: { PROBES, probeError },
  });
const indexLevel = (id) => manifestIndexLevel(manifest, id);
const dir = join(root, "course", "steps");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".md"))
  .sort();
const parsed = Object.fromEntries(
  files.map((f) => [
    f.replace(/\.md$/, ""),
    parseLesson(readFileSync(join(dir, f), "utf8"), `course/steps/${f}`),
  ]),
);
const contents = PATH.map((p) => parsed[p.id] ?? null);
const tracked = new Set(
  execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split(
    "\n",
  ),
);
const scripts = JSON.parse(
  readFileSync(join(root, "practice-template/project/package.json"), "utf8"),
).scripts;
const quotesOf = (step) =>
  step.beats
    .flatMap((b) =>
      [
        ...b.lines.filter((l) => l.quoted).flatMap((l) => [l.text, l.win]),
        ...b.hints,
        ...b.bottom.flatMap((x) => [x.text, x.win, x.leadIn]),
        ...b.why,
        ...b.options.flatMap((o) => [o.quoted ? o.text : null, o.because]),
        b.reveal,
        b.point,
        b.self,
        b.codespace,
        b.winNote,
      ].filter(Boolean),
    )
    .join("\n");
// Every step a lesson can show: its warm-ups, then its own steps.
const allSteps = (l) => [...l.warmup, ...l.steps];
const appWords = (step) =>
  [
    step.optional,
    ...step.beats.flatMap((b) => [
      ...b.lines.filter((l) => !l.quoted).map((l) => l.text),
      b.ask,
      b.doneLabel,
      ...b.options
        .filter((o) => !o.quoted && o.kind !== "decoy")
        .map((o) => o.text),
    ]),
  ].filter(Boolean);

test("every lesson file belongs to a lesson on PATH, in its file, and parses", () => {
  assert.ok(files.length > 0);
  for (const [id, l] of Object.entries(parsed)) {
    assert.ok(
      PATH.some((p) => p.id === id),
      `${id} is not on PATH`,
    );
    assert.equal(l.lesson, id);
    assert.ok(l.steps.length > 0);
  }
});

test("front matter keeps the Lesson, its Stamp and its authoring fields, with course metadata only in the manifest", () => {
  for (const [id, l] of Object.entries(parsed)) {
    for (const key of [
      "source",
      "source-commit",
      "page",
      "stuck",
      "next",
      "title",
      "folder",
    ])
      assert.ok(
        !(key in l),
        `${id}: ${key} belongs to the manifest or compiler`,
      );
    assert.match(
      l.stamp,
      /^Verified against Claude Code v\d+\.\d+\.\d+ \(stable\) on \d{4}-\d{2}-\d{2}$/,
    );
    assert.ok(l.intro.can.length > 0 && l.intro.minutes);
  }
});

test("intro: every lesson says why it matters, and its payoff is one of its can lines", () => {
  for (const [id, l] of Object.entries(parsed)) {
    assert.ok(l.intro.why, `${id}: no why line`);
    assert.ok(
      l.intro.can.includes(l.intro.payoff),
      `${id}: the payoff "${l.intro.payoff}" is not a can line`,
    );
  }
});

test("card: every lesson puts the commands its page gives on the card, each once in the course", () => {
  for (const [id, l] of Object.entries(parsed))
    assert.ok(l.card.length > 0, `${id}: no card entries`);
  // Authored entries catch what no run line holds (design D8).
  assert.ok(
    ["/rewind", "/resume"].every((cmd) =>
      parsed["b-4"].card.some((e) => e.show === cmd),
    ),
    "b-4 lists /rewind and /resume",
  );
  const shows = Object.values(parsed).flatMap((l) => l.card.map((e) => e.show));
  assert.deepEqual(
    shows.filter((x, i) => shows.indexOf(x) !== i),
    [],
    "a command on two lessons' cards",
  );
});

// Go further (146): one primary source to read next, as the page lists it.
// A capstone's page has no Go further list, so its file has no read line.
test("intro: every lesson but a capstone names one source to read, quoted with its Markdown link", () => {
  for (const [id, l] of Object.entries(parsed)) {
    if (id.endsWith("capstone")) {
      assert.equal(
        l.intro.read,
        undefined,
        `${id}: a capstone has no Go further`,
      );
      continue;
    }
    assert.ok(l.intro.read, `${id}: no read line`);
    const links = inline(l.intro.read).filter((r) => r.url);
    assert.equal(
      links.length,
      1,
      `${id}: the read line holds ${links.length} links`,
    );
    assert.match(
      links[0].url,
      /^https:\/\/\S+$/,
      `${id}: the read line's link is no full URL`,
    );
    // The page's own line: the link comes first, then what it covers.
    assert.match(
      l.intro.read,
      /^\[[^\]]+\]\(https:\/\/[^)]+\): \S/,
      `${id}: "${l.intro.read}"`,
    );
  }
});

// A first meeting's GUIDED step with no Why line on its card, and why. Name
// one here only where the page has no sentence that is a reason for the step.
const NO_WHY = {};

test("the first GUIDED Worked example step on each skill has a why line on a beat that shows it inline", () => {
  const seen = new Set();
  const first = [];
  for (const [i, l] of contents.entries()) {
    if (!l) continue;
    for (const step of l.steps) {
      if (
        step.part !== "Worked example" ||
        step.tier !== "guided" ||
        seen.has(step.skill)
      )
        continue;
      seen.add(step.skill);
      const at = `${PATH[i].id} ${step.id}`;
      first.push(at);
      // The card shows a do or ask beat's first why line; a predict beat keeps it behind w.
      if (!(at in NO_WHY))
        assert.ok(
          step.beats.some(
            (b) => ["do", "ask"].includes(b.kind) && b.why.length,
          ),
          `${at} (${step.skill}) has no why line on a do or ask beat`,
        );
    }
  }
  for (const at of Object.keys(NO_WHY))
    assert.ok(first.includes(at), `${at} is no first meeting's GUIDED step`);
  // The Beginner path's first meetings, so the test can't pass on an empty list.
  assert.ok(
    first.includes("b-1 W1") && first.includes("b-5 W2"),
    first.join(", "),
  );
});

// A page step split in two: the second step keeps the page step's number.
const SPLIT = {};

// What is wrong with the numbering of lesson `id`'s steps: each part's
// steps (or Your turn's parts) numbered 1 to M in order, its ids W, Y, T or D
// and the number, and the Check last but for the Tear down steps after it
// (ticket 102). `split` collects the SPLIT steps met.
function numberingOff(id, l, split = []) {
  const off = [];
  for (const [part, prefix] of Object.entries(PART_IDS)) {
    const steps = l.steps.filter((s) => s.part === part);
    steps.forEach((s, i) => {
      const before = i ? steps[i - 1].n : 0;
      if (SPLIT[`${id} ${s.id}`]) {
        if (s.n !== before)
          off.push(`${id} ${s.id}: a split step keeps step ${before}`);
        split.push(`${id} ${s.id}`);
      } else if (s.n !== before + 1)
        off.push(`${id} ${s.id}: ${s.unit} ${s.n} after ${s.unit} ${before}`);
      if (s.of !== steps.at(-1).n) off.push(`${id} ${s.id}: says "of ${s.of}"`);
      if (s.unit !== steps[0].unit)
        off.push(`${id} ${s.id}: a ${s.unit} among ${steps[0].unit}s`);
      if (s.id !== `${prefix}${i + 1}`)
        off.push(`${id} ${s.id}: not ${prefix}${i + 1}`);
    });
  }
  const check = l.steps.findIndex((s) => s.id === "C");
  if (
    check < 0 ||
    !l.steps.slice(check + 1).every((s) => s.part === "Tear down")
  )
    off.push(`${id}: the Check comes last, but for Tear down steps`);
  return off;
}

test("numbering: Your turn parts and Tear down steps after the Check count as steps do (102)", () => {
  const steps = (headings, lesson = "a-9") =>
    parseLesson(
      `---\nlesson: ${lesson}\n---\n\n## steps\n${headings.map((h) => `\n${h}\n- tier: challenge\n- skill: x\n- where: shell\n- beat: do\n- verify: self`).join("\n")}`,
      "a-9.md",
    );
  const good = steps([
    "### Y1 | Your turn part 1 of 2 | One",
    "### Y2 | Your turn part 2 of 2 | Two",
    "### C | Check | Check",
    "### D1 | Tear down step 1 of 2 | Undo",
    "### D2 | Tear down step 2 of 2 | Again",
  ]);
  assert.deepEqual(numberingOff("a-9", good), []);
  const bad = steps([
    "### Y1 | Your turn part 1 of 2 | One",
    "### Y2 | Your turn step 2 of 2 | Two",
    "### C | Check | Check",
    "### D1 | Tear down step 1 of 2 | Undo",
    "### D2 | Tear down step 3 of 3 | Again",
  ]);
  assert.deepEqual(numberingOff("a-9", bad), [
    "a-9 Y2: a step among parts",
    'a-9 D1: says "of 2"',
    "a-9 D2: step 3 after step 1",
  ]);
  // In a capstone every step is CHALLENGE, Tear down steps too; elsewhere a
  // Tear down step gets a Your turn step's help.
  const headings = [
    "### Y1 | Your turn part 1 of 1 | One",
    "### C | Check | Check",
    "### D1 | Tear down step 1 of 1 | Undo",
  ];
  const course = PATH.map(() => null);
  const at = (id) => PATH.findIndex((p) => p.id === id);
  course[at("a-capstone")] = steps(headings, "a-capstone");
  course[at("a-1")] = steps(headings, "a-1");
  assert.deepEqual(ruleTiers(course, at("a-capstone")), [
    "challenge",
    "challenge",
    "challenge",
  ]);
  assert.deepEqual(
    ruleTiers(course, at("a-1")),
    ["hinted", "challenge", "hinted"],
    "D1 is hinted, as Y1 is",
  );
});

test("steps are numbered as on the page, one part after the other", () => {
  const split = [];
  for (const [id, l] of Object.entries(parsed)) {
    assert.deepEqual(numberingOff(id, l, split), []);
    for (const s of allSteps(l)) {
      if (s.part !== "Warm-up")
        assert.ok(WHERE.has(s.where), `${id} ${s.id}: where`);
      assert.ok(/^[a-z][a-z-]*$/.test(s.skill ?? ""), `${id} ${s.id}: skill`);
      for (const b of s.beats)
        if (b.verify.since)
          assert.ok(
            l.steps.some((x) => x.id === b.verify.since),
            `${id} ${s.id}: fresh since an unknown step ${b.verify.since}`,
          );
    }
  }
  assert.deepEqual(
    split,
    Object.keys(SPLIT),
    "a split names a step that is no longer there",
  );
});

// What is wrong with lesson `id`'s warm-ups: each a question from an earlier
// lesson, in any level, or from any level's index page (ticket 178),
// numbered, from memory.
function warmupOff(id, l) {
  const off = [];
  const at = PATH.findIndex((p) => p.id === id);
  l.warmup.forEach((w, i) => {
    if (w.id !== `R${i + 1}`) off.push(`${id} ${w.id}: not R${i + 1}`);
    if (w.tier !== "challenge")
      off.push(`${id} ${w.id}: a warm-up is CHALLENGE`);
    const from = PATH.findIndex((p) => p.id === w.from);
    if (!indexLevel(w.from) && !(from >= 0 && from < at))
      off.push(`${id} ${w.id}: from ${w.from} is not an earlier lesson`);
    if (w.beats.length !== 1) off.push(`${id} ${w.id}: one question`);
    if (!["ask", "type"].includes(w.beats[0].kind))
      off.push(`${id} ${w.id}: a warm-up asks`);
  });
  if (
    at > 0 &&
    l.warmup.length < 2 &&
    l.steps.some((s) => s.part === "Worked example")
  )
    off.push(`${id}: a lesson after the first opens with warm-ups`);
  return off;
}

test("warm-ups: questions from an earlier lesson, numbered, from memory", () => {
  assert.deepEqual(
    Object.entries(parsed).flatMap(([id, l]) => warmupOff(id, l)),
    [],
  );
});

// The warm-up explainer goes on the first warm-up a learner meets in a
// level, which since 194 can be any lesson's (a lesson plays one only on a
// missed skill), and says the lesson's words follow a wrong answer: every
// warm-up's must. A wrong pick shows its option's because at once; a wrong
// typed answer its first hint, where it has one, and its reveal after a
// second try.
test("every warm-up shows the lesson's words after a wrong answer", () => {
  for (const [id, l] of Object.entries(parsed)) {
    for (const w of l.warmup) {
      const b = w.beats[0];
      if (b.kind === "type")
        assert.ok(
          b.reveal,
          `${id} ${w.id}: a wrong typed answer shows no quote`,
        );
      else
        for (const o of b.options)
          if (o.kind !== "right")
            assert.ok(o.because, `${id} ${w.id}: "${o.text}" shows no quote`);
    }
  }
});

test("the app's own words name no command or code that the step's quotes don't", () => {
  for (const [id, l] of Object.entries(parsed)) {
    for (const step of allSteps(l)) {
      const quotes = quotesOf(step);
      for (const words of appWords(step)) {
        for (const [, span] of words.matchAll(/`([^`]+)`/g))
          assert.ok(
            quotes.includes(span),
            `${id} ${step.id}: "${words}" names \`${span}\``,
          );
        for (const [, cmd] of words.matchAll(/(?:^|\s)(\/[a-z][a-z-]*)/g))
          assert.ok(
            quotes.includes(cmd),
            `${id} ${step.id}: "${words}" names ${cmd}`,
          );
      }
    }
  }
  const words = copyWords(C);
  assert.ok(words.length >= 20);
  for (const w of words) {
    assert.doesNotMatch(w, /`/, `copy.mjs: "${w}" holds a code span`);
    assert.doesNotMatch(
      w,
      /(^|\s)\/[a-z]/,
      `copy.mjs: "${w}" names a slash command`,
    );
    assert.doesNotMatch(w, /\d+\.\d+\.\d+/, `copy.mjs: "${w}" names a version`);
    assert.doesNotMatch(
      w,
      /\b(Opus|Sonnet|Haiku|Fable)\b|claude-[a-z]+-\d/,
      `copy.mjs: "${w}" names a model`,
    );
  }
});

// Every string the app's own words can produce: each function runs with
// every mix of a few arguments, so a branch on one of them gives its string.
// The arguments are the values the app passes: a via, a beat kind, a tier,
// and counts of none, one and many. A branch on any other value is unseen.
const COPY_ARGS = [
  "x",
  "pick",
  "r",
  "check",
  "file",
  "git-clean",
  "predict",
  "guided",
  "hinted",
  "challenge",
  0,
  1,
  2,
  3,
  10,
];
const tuples = (n) =>
  n === 0
    ? [[]]
    : tuples(n - 1).flatMap((t) => COPY_ARGS.map((a) => [...t, a]));
const calls = new WeakMap();
function copyWords(value) {
  const words = new Set();
  const walk = (v) => {
    if (typeof v === "string") words.add(v);
    else if (typeof v === "function") {
      if (!calls.has(v))
        calls.set(v, [
          ...new Set(tuples(Math.max(v.length, 1)).map((t) => v(...t))),
        ]);
      calls.get(v).forEach(walk);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return [...words];
}

// The screen says only what the app saw: no copy claims the app adapts or
// knows the learner, praises the person, or names work the app doesn't do.
const BANNED = [
  /master/i,
  /\bZPD\b/i,
  /adapt/i,
  /\b(genius|natural|talented|brilliant|smart|clever)\b/i,
  /\byou(?:'re| are) (?:a |so )/i,
  /personali[sz]/i,
  /tailor/i,
  /learns? (about )?you/i,
  /\bThinking\b/i,
  /\bAnaly[sz]ing\b/i,
  /Preparing your lesson/i,
  /Loading your progress/i,
];
// A celebration praises the work, never how it was done: no speed, no
// streak, no "no hints". "quick question" is a where label, not one of these.
const CELEBRATION_BANNED =
  /\b(first try|no hints?|fast|quick(?:ly)?|streak)\b/i;
// The words a celebration shows, of the engine's own: the evidence a passed
// git step shows. The screens' celebration words are the client's (249).
const CELEBRATIONS = ["changedShows", "stagedShows"];
const at = (copy, k) => k.split(".").reduce((v, part) => v?.[part], copy);
const banned = new Map();
const bannedIn = (w) => {
  if (!banned.has(w))
    banned.set(
      w,
      BANNED.filter((re) => re.test(w)),
    );
  return banned.get(w);
};
const claims = (copy) => {
  const out = [];
  for (const w of copyWords(copy))
    for (const re of bannedIn(w)) out.push(`"${w}" matches ${re}`);
  for (const k of CELEBRATIONS)
    for (const w of copyWords(at(copy, k)))
      if (CELEBRATION_BANNED.test(w))
        out.push(`${k}: "${w}" matches ${CELEBRATION_BANNED}`);
  return out;
};

test("the app's own words claim only what the app saw", () => {
  for (const k of CELEBRATIONS)
    assert.notEqual(at(C, k), undefined, `copy.mjs has no ${k}`);
  assert.deepEqual(claims(C), []);
  // Each pattern catches a string that breaks it, wherever it sits.
  for (const bad of [
    "You mastered plan mode.",
    "The app adapts to you.",
    "Adapting the help.",
    "This is your ZPD.",
    "A natural!",
    "You're a star.",
    "Clever!",
    "You are so good at this.",
    "Your personalised path",
    "Help tailored for you",
    "The app learns about you.",
    "Thinking…",
    "Analyzing your work…",
    "Analysing",
    "Preparing your lesson…",
    "Loading your progress…",
  ]) {
    assert.equal(claims({ x: bad }).length, 1, bad);
    assert.equal(
      claims({ ...C, x: () => [bad] }).length,
      1,
      `${bad}, in a function's array`,
    );
  }
  for (const bad of [
    "Done on the first try!",
    "No hints needed!",
    "No hint used.",
    "That was fast.",
    "Quick work!",
    "Done quickly.",
    "A 3 step streak",
  ]) {
    assert.equal(
      claims({ ...C, changedShows: () => bad }).length,
      1,
      `${bad}, on a celebration`,
    );
    assert.equal(
      claims({ ...C, stagedShows: [bad] }).length,
      1,
      `${bad}, on a celebration's array`,
    );
    assert.deepEqual(
      claims({ ...C, noChange: bad }),
      [],
      `${bad}, off a celebration`,
    );
  }
  // A branch counts too: the walk reaches one on each value the app passes.
  for (const branch of [
    (via) => via === "pick",
    (via) => via === "r",
    (kind) => kind === "check",
    (kind) => kind === "git-clean",
    (tier) => tier === "hinted",
    (tier) => tier === "challenge",
    (n) => n === 0,
    (n) => n > 2,
  ]) {
    assert.equal(
      claims({ x: (v) => (branch(v) ? "You mastered it." : "Fine.") }).length,
      1,
      `${branch}`,
    );
  }
});

// One name for each thing (TERMS in copy.mjs). An older name is an alias,
// and so is any table of the three tiers that words them differently. A
// sentence that tells the learner what a tier change gives them is no
// table: it isn't checked here.
// The work folder's words (ticket 86) have theirs too: a working folder or
// directory, a repo, the page's "template copy" for the practice copy or for
// a new copy.
const ALIASES = [
  /practice folder/i,
  /\byour copy\b/i,
  /\bgoal and hints\b/i,
  /\bgoal only\b/i,
  /\bwork(ing)? dir(ector(y|ies))?\b/i,
  /\bworking folder\b/i,
  /\brepo\b/i,
  /\byour own repository\b/i,
  /\btemplate copy\b/i,
  /\b(fresh|second|other) copy\b/i,
];
const aliasIn = (w) =>
  ALIASES.filter((re) => re.test(w)).map((re) => `"${w}" matches ${re}`);
const aliases = (copy) => {
  const out = copyWords(copy).flatMap(aliasIn);
  const walk = (v, at) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return;
    const keys = Object.keys(v);
    if (
      keys.length === TIERS.length &&
      TIERS.every((k) => typeof v[k] === "string")
    ) {
      if (TIERS.some((k) => v[k] !== TERMS.tierHelp[k]))
        out.push(`${at} describes the tiers a second way`);
    } else for (const k of keys) walk(v[k], at ? `${at}.${k}` : k);
  };
  walk(copy, "");
  return out;
};

test("one name for each thing: the app's words use no alias of a TERMS name", () => {
  assert.equal(TERMS.practiceCopy, "practice copy");
  assert.equal(TERMS.workFolder, "work folder");
  assert.equal(TERMS.yourRepository, "your repository");
  assert.equal(TERMS.newCopy, "new copy");
  assert.deepEqual(TERMS.tierHelp, {
    guided: "every command shown",
    hinted: "the goal, hints if you ask",
    challenge: "just the goal",
  });
  // The guide's level names, one each, for the screens that name a level.
  assert.deepEqual(TERMS.levels, {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  });
  assert.deepEqual(aliases(C), []);
  // A lesson file's unquoted lines are the app's words too; its quotes are the guide's.
  for (const [id, l] of Object.entries(parsed)) {
    for (const step of allSteps(l))
      assert.deepEqual(appWords(step).flatMap(aliasIn), [], `${id} ${step.id}`);
  }
  for (const bad of [
    "I'm Pip. I watch your practice folder and light up",
    "Your copy is clean: nothing to commit.",
    "goal and hints",
    "goal only",
    "Your working directory",
    "The working folder for Intermediate",
    "In your repo",
    "In your own repository",
    "Work dir:",
    "This template copy",
    "Give the folder of your fresh copy",
  ]) {
    assert.equal(aliases({ ...C, x: bad }).length, 1, bad);
  }
  assert.equal(
    aliases({
      ...C,
      legend: {
        guided: "all commands",
        hinted: "hints on h",
        challenge: "nothing more",
      },
    }).length,
    1,
    "a second tier description",
  );
  assert.deepEqual(
    aliases({ ...C, legend: { ...TERMS.tierHelp } }),
    [],
    "the same words again are no alias",
  );
});

test("questions: one right answer, a reason for every wrong one, real files in decoys", () => {
  for (const [id, l] of Object.entries(parsed)) {
    for (const step of allSteps(l)) {
      for (const b of step.beats) {
        const where = `${id} ${step.id} (${b.kind})`;
        if (b.kind === "type") {
          assert.ok(b.accept.length, `${where}: no accepted answer`);
          for (const a of b.accept)
            assert.ok(
              quotesOf(step).includes(a),
              `${where}: ${a} is in no quote`,
            );
          // The answer row takes TYPED_MAX characters: a longer answer can't be typed whole.
          for (const a of b.accept)
            assert.ok(
              a.length <= TYPED_MAX,
              `${where}: ${a} is longer than ${TYPED_MAX} characters`,
            );
          assert.ok(b.reveal, `${where}: no reveal`);
          continue;
        }
        if (!b.ask) {
          assert.equal(
            b.options.length,
            0,
            `${where}: options with no question`,
          );
          continue;
        }
        assert.match(b.ask, /\?$/, `${where}: a question ends with ?`);
        const rights = b.options.filter((o) => o.kind === "right");
        // A choice (ticket 104), an ask beat whose every option is an
        // option line, has no right answer; any other question has one.
        if (!isChoice(b))
          assert.equal(
            rights.length,
            1,
            `${where}: ${rights.length} right options`,
          );
        assert.ok(
          b.options.length >= 2 && b.options.length <= 9,
          `${where}: ${b.options.length} options`,
        );
        for (const o of b.options) {
          if (o.kind === "wrong" || o.kind === "stuck")
            assert.ok(o.because, `${where}: "${o.text}" needs a because`);
          if (o.kind === "decoy") {
            for (const [, span] of o.text.matchAll(/`([^`]+)`/g)) {
              const script = span.match(/^npm (?:run )?(\S+)$/)?.[1];
              assert.ok(
                tracked.has(span) ||
                  tracked.has(`practice-template/${span}`) ||
                  tracked.has(`practice-template/project/${span}`) ||
                  (script && scripts[script]),
                `${where}: decoy \`${span}\` is not a file or script`,
              );
            }
          }
        }
        // An unquoted right answer is a claim only through a quote that reveals it.
        if (rights.length && !rights[0].quoted) {
          const at = b.revealAt
            ? l.steps.find((s) => s.id === b.revealAt)
            : step;
          assert.ok(
            at?.beats.some((x) => x.reveal),
            `${where}: no reveal for its right answer`,
          );
        }
        if (b.revealAt)
          assert.ok(
            l.steps.some(
              (s) =>
                s.id === b.revealAt &&
                s.beats.some((x) => x.recall === step.id),
            ),
            `${where}: ${b.revealAt} doesn't recall it`,
          );
      }
    }
  }
});

test("verify lines name real check items, and ladder headings are check items", () => {
  for (const [id, l] of Object.entries(parsed)) {
    const items = lessons[id].items;
    for (const step of l.steps) {
      for (const b of step.beats) {
        if (b.verify.kind !== "check") continue;
        if (b.verify.all)
          assert.equal(
            step.part,
            "Check",
            `${id} ${step.id}: check all outside the Check`,
          );
        else
          for (const i of b.verify.items)
            assert.ok(items[i], `${id} ${step.id}: no item ${i}`);
        assert.ok(
          b.watching || b.evidence || b.verify.all,
          `${id} ${step.id}: says nothing about what it watches`,
        );
      }
    }
    for (const rung of l.ladder)
      assert.ok(
        items.some((it) => it.text === rung.item),
        `${id}: the ladder heading "${rung.item}" is no check item`,
      );
  }
});

// The climb (ticket 80, Q2): one rule for each level, with skill counts
// carried across the course. A level's first lesson may open GUIDED; every
// later one opens above it and gives less help than the level's first. A
// lesson full of new commands may dip below the lesson two before it in its
// level: that is reported, not failed. `course` holds parsed contents in
// course order, null for a lesson with no file.
function climb(course) {
  const off = [];
  const dips = [];
  const levels = new Map();
  course.forEach((c, i) => {
    if (!c) return;
    const rule = ruleTiers(course, i);
    c.steps.forEach((s, k) => {
      if (s.tier !== rule[k])
        off.push(
          `${c.lesson} ${s.id} is ${s.tier}; the course rule says ${rule[k]}`,
        );
    });
    if (c.steps.find((s) => s.part === "Check").tier !== "challenge")
      off.push(`${c.lesson}: the Check is not CHALLENGE`);
    if (
      c.lesson.endsWith("capstone") &&
      !c.steps.every((s) => s.tier === "challenge")
    )
      off.push(`${c.lesson}: a capstone step is not CHALLENGE`);
    const shares = levels.get(PATH[i].level) ?? [];
    levels.set(PATH[i].level, shares);
    if (shares.length && c.steps[0].tier === "guided")
      off.push(`${c.lesson} opens GUIDED`);
    shares.push({
      id: c.lesson,
      share: c.steps.filter((s) => s.tier !== "guided").length / c.steps.length,
    });
  });
  for (const shares of levels.values()) {
    shares.forEach(({ id, share }, i) => {
      if (i > 0 && share <= shares[0].share)
        off.push(`${id} doesn't give less help than ${shares[0].id}`);
      if (i > 1 && share < shares[i - 2].share)
        dips.push(
          `${id} gives more help than ${shares[i - 2].id}, two lessons before`,
        );
    });
  }
  return { off, dips };
}

test("difficulty: each step's tier is the course rule's, and it climbs like a sawtooth", () => {
  const { off, dips } = climb(contents);
  assert.deepEqual(off, []);
  for (const dip of dips) console.info(dip);
  // A safety choice keeps a guess before it at every tier.
  const b1 = parsed["b-1"];
  assert.ok(b1.steps.find((s) => s.id === "W3").beats[0].safety);
  for (const l of Object.values(parsed))
    for (const s of allSteps(l))
      for (const b of s.beats)
        if (b.safety)
          assert.equal(
            b.kind,
            "predict",
            `${l.lesson} ${s.id}: a safety choice is a guess`,
          );
});

// A made-up lesson file with `steps`, each [id, tier, skill]: W steps are
// Worked examples and C the Check, each one beat the check verifies.
function madeUp(id, steps) {
  const heading = ([sid]) =>
    sid === "C"
      ? "### C | Check | Check"
      : `### ${sid} | Worked example step ${sid.slice(1)} of ${steps.length - 1} | Do it`;
  const text = [
    `---\nlesson: ${id}\ntitle: "Demo"\n---\n\n## intro\n- can: "do it"\n\n## steps`,
    ...steps.map(
      (st) =>
        `\n${heading(st)}\n- tier: ${st[1]}\n- skill: ${st[2]}\n- beat: do\n- verify: ${st[0] === "C" ? "check all" : "check 0"}\n- goal: "Do it."`,
    ),
  ].join("\n");
  return parseLesson(text, `${id}.md`);
}
// The real Beginner lessons, then the made-up Intermediate ones in `made`,
// { id: content }.
const withIntermediate = (made) =>
  PATH.map((p) =>
    p.level === "beginner" ? (parsed[p.id] ?? null) : (made[p.id] ?? null),
  );
const CHECK = ["C", "challenge", "check"];

test("difficulty: help fades within each level, a level's first lesson may open GUIDED, skill counts carry across levels, and a dip only reports", () => {
  // i-1 opens GUIDED on a new skill, and commit, which Beginner asked three
  // times, is CHALLENGE even in a Worked example. i-2 and i-3 are all Check.
  // i-4 gives less help than i-1 but more than i-2, two lessons before.
  const i4 = madeUp("i-4", [
    ["W1", "challenge", "commit"],
    ["W2", "challenge", "start"],
    ["W3", "guided", "agent"],
    CHECK,
  ]);
  const { off, dips } = climb(
    withIntermediate({
      "i-1": parseLesson(DEMO_I1, "i-1.md"),
      "i-2": madeUp("i-2", [CHECK]),
      "i-3": madeUp("i-3", [CHECK]),
      "i-4": i4,
    }),
  );
  assert.deepEqual(off, []);
  assert.deepEqual(dips, ["i-4 gives more help than i-2, two lessons before"]);
  // A later lesson in the level still opens above GUIDED and gives less help
  // than the level's first.
  const i2 = madeUp("i-2", [
    ["W1", "guided", "agent"],
    ["W2", "guided", "hook"],
    CHECK,
  ]);
  assert.deepEqual(
    climb(
      withIntermediate({ "i-1": parseLesson(DEMO_I1, "i-1.md"), "i-2": i2 }),
    ).off,
    ["i-2 opens GUIDED", "i-2 doesn't give less help than i-1"],
  );
});

// Action beats above GUIDED that may show nothing behind h, each with its
// reason. Any other beat that hides its command needs a rung.
const NO_RUNG = {};

test("help: above GUIDED, every action with no command on its card has a rung behind h", () => {
  const bare = [];
  const exempt = [];
  contents.forEach((c, i) => {
    if (!c) return;
    const rule = ruleTiers(contents, i);
    c.steps.forEach((s, k) => {
      if (s.part === "Check" || rule[k] === "guided") return;
      s.beats.forEach((b, n) => {
        if (b.kind !== "do" || b.ask || b.lines.some((l) => l.key === "run"))
          return;
        const at = `${c.lesson} ${s.id}.${n}`;
        // A check item's ladder shows its own rungs once the check says no.
        const laddered =
          b.verify.kind === "check" &&
          !b.verify.all &&
          b.verify.items.every((it) => {
            const rung = c.ladder.find(
              (r) => r.item === lessons[c.lesson].items[it].text,
            );
            return (
              rung &&
              (rung.hints.length || rung.bottom.length || rung.narrow.length)
            );
          });
        if (!b.hints.length && !b.bottom.length && !laddered)
          (NO_RUNG[at] ? exempt : bare).push(at);
      });
    });
  });
  assert.deepEqual(bare, [], "nothing behind h");
  assert.deepEqual(
    exempt,
    Object.keys(NO_RUNG),
    "an exemption names a beat that still has nothing behind h",
  );
});

test("help: above GUIDED, no card runs a slash command", () => {
  const shown = [];
  contents.forEach((c, i) => {
    if (!c) return;
    const rule = ruleTiers(contents, i);
    const steps = [
      ...c.warmup.map((s) => [s, "challenge"]),
      ...c.steps.map((s, k) => [s, rule[k]]),
    ];
    for (const [s, tier] of steps) {
      if (tier === "guided") continue;
      s.beats.forEach((b, n) => {
        for (const l of b.lines)
          if (l.key === "run" && l.text.startsWith("/"))
            shown.push(`${c.lesson} ${s.id}.${n}: ${l.text}`);
      });
    }
  });
  assert.deepEqual(shown, [], "a slash command on the card above GUIDED");
});

test("the Check's recall question files a miss under a skill the course has taught", () => {
  const untagged = [];
  contents.forEach((c, i) => {
    if (!c) return;
    const taught = new Set(
      contents
        .slice(0, i + 1)
        .flatMap((x) => (x?.steps ?? []).map((s) => s.skill)),
    );
    taught.delete("check");
    for (const b of c.steps.find((s) => s.part === "Check").beats)
      if (b.kind === "type" && !taught.has(b.skill))
        untagged.push(`${c.lesson} C: ${b.skill ?? "no skill"}`);
  });
  assert.deepEqual(
    untagged,
    [],
    "a Check question's skill is one a step so far uses",
  );
});

// Lessons with no skill in their warm-up pool that comes back in their own
// steps, so R1 can't be one; each with its reason.
const R1_NOT_REUSED = {
  "a-1":
    "the level's first lesson recalls Intermediate's scope and delegation choices; the only earlier skills its steps reuse are commit and save-version, chores with no scenario worth a warm-up",
  "i-1":
    "its pool recalls Beginner's compact, resume and rewind, which no i-1 step asks again: the commit candidate it reused went once no Beginner question could mark commit missed",
};

// What is wrong with the order of lesson `id`'s warm-ups.
function pairOff(id, l) {
  const off = [];
  const [r1, r2] = l.warmup;
  if (!r1) return off;
  // A pool that recalls only one lesson has no lags to mix. A level index
  // counts as a source of its own (ticket 178): R1 from a lesson and R2 from
  // an index mix two.
  if (
    r2 &&
    new Set(l.warmup.map((w) => w.from)).size > 1 &&
    r1.from === r2.from
  )
    off.push(`${id}: R1 and R2 both come from ${r1.from}`);
  // Where the pool holds a skill this lesson reuses, R1 is one, so a missed
  // warm-up eases a step here.
  const reused = (w) => l.steps.some((s) => s.skill === w.skill);
  if (R1_NOT_REUSED[id]) {
    if (l.warmup.some(reused))
      off.push(
        `${id}: its pool has a skill this lesson reuses: drop the exemption`,
      );
  } else if (!reused(r1))
    off.push(`${id}: R1 (${r1.skill}) is a skill no step here reuses`);
  return off;
}

test("warm-ups: the first two mix a recent lesson and an older one, and R1 comes back in this lesson", () => {
  assert.deepEqual(
    Object.entries(parsed).flatMap(([id, l]) => pairOff(id, l)),
    [],
  );
  for (const id of Object.keys(R1_NOT_REUSED))
    assert.ok(
      parsed[id]?.warmup.length,
      `${id}: the exemption names no lesson with warm-ups`,
    );
});

// Ticket 85: i-1's and i-2's pools recall Beginner skills Beginner never
// asks again. The demo i-1's R1 is one it reuses, and its R2 an older
// lesson's; it is read as a lesson of its own, since the shipped i-1's
// exemption in R1_NOT_REUSED doesn't fit a pool that reuses commit.
test("warm-ups: a lesson may recall a lesson of an earlier level, as i-1 recalls Beginner", () => {
  const i1 = parseLesson(DEMO_I1, "i-1.md");
  assert.deepEqual(
    i1.warmup.map((w) => [w.from, w.skill]),
    [
      ["b-5", "commit"],
      ["b-4", "compact"],
    ],
  );
  assert.deepEqual([...warmupOff("i-1", i1), ...pairOff("i-1 demo", i1)], []);
});

// Ticket 178: a warm-up may recall a level's index page, any level's, from
// any lesson. The index has no lesson file and no place on PATH.
test("warm-ups: a warm-up may recall a level index, from any lesson", () => {
  const i1 = parseLesson(DEMO_I1_INDEX, "i-1.md");
  assert.deepEqual(
    i1.warmup.map((w) => [w.from, w.skill]),
    [
      ["b-5", "commit"],
      ["intermediate-index", "when-to-use"],
    ],
  );
  assert.deepEqual([...warmupOff("i-1", i1), ...pairOff("i-1 demo", i1)], []);
  // Beginner's second lesson may quote the Advanced index.
  const b2 = parseLesson(
    DEMO_B2.replace(
      "- from: b-1\n- beat: type",
      "- from: advanced-index\n- beat: type",
    ),
    "b-2.md",
  );
  assert.deepEqual(
    b2.warmup.map((w) => w.from),
    ["b-1", "advanced-index", "b-1"],
  );
  assert.deepEqual(warmupOff("b-2", b2), []);
});

// A typed answer, a wrong or decoy pick, or s on any question but a guess
// marks the skill missed, for a later lesson's warm-up to ask it, the only
// warm-up that lesson plays (194; flow.mjs: submitTyped, pick and s).
const MISSABLE = new Set(["right", "wrong", "decoy"]);
const marksMissed = (b) =>
  b.kind === "type" ||
  (Boolean(b.ask) &&
    b.kind !== "predict" &&
    b.options.some((o) => MISSABLE.has(o.kind)));
// Skills a question can mark missed that no later lesson's pool recalls, each
// with its reason.
const NO_LATER_WARMUP = {
  "limit-run":
    "ticket 27 cut a-4's Your turn question, which tested a flag's definition, so a-7's questions are the first that can mark limit-run, and no lesson after a-7 has warm-ups",
};

// The skills a question in `contents` (in PATH order) can mark missed that
// no later lesson's pool recalls.
function closureGaps(contents) {
  // The first lesson whose questions can mark each skill missed. A level
  // index warm-up recalls a level, not a lesson's skill (ticket 178).
  const first = new Map();
  contents.forEach((c, i) => {
    for (const s of c ? allSteps(c).filter((x) => !indexLevel(x.from)) : [])
      for (const b of s.beats)
        if (marksMissed(b) && !first.has(b.skill ?? s.skill))
          first.set(b.skill ?? s.skill, i);
  });
  return [...first]
    .filter(
      ([skill, i]) =>
        !contents
          .slice(i + 1)
          .some((c) => c?.warmup.some((w) => w.skill === skill)),
    )
    .map(([skill]) => skill);
}

test("warm-ups: a skill a question can mark missed comes back in a later lesson's pool", () => {
  const gaps = closureGaps(contents);
  assert.deepEqual(
    gaps.filter((k) => !NO_LATER_WARMUP[k]),
    [],
    "no later warm-up and no exemption",
  );
  assert.deepEqual(
    Object.keys(NO_LATER_WARMUP).filter((k) => !gaps.includes(k)),
    [],
    "an exemption names a skill that is no gap now: a later warm-up asks it, or no question can mark it missed",
  );
});

// Ticket 178: a warm-up from a level index recalls that level, so its skill
// is no lesson's for a later pool to ask again. i-1's R1, from b-5, is.
test("warm-ups: a level index warm-up leaves no skill for a later pool to recall", () => {
  const i1 = parseLesson(DEMO_I1_INDEX, "i-1.md");
  assert.deepEqual(closureGaps(PATH.map((p) => (p.id === "i-1" ? i1 : null))), [
    "commit",
  ]);
});

// Questions whose options keep a natural order, so their right answer's
// place says nothing; each with its reason.
const NATURAL_ORDER = {};

test("questions give no cue: not by length, quotes, bold, code or place", () => {
  const plain = (t) =>
    t.replace(/\*\*|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const cues = [];
  for (const [id, l] of Object.entries(parsed)) {
    const slots = [];
    for (const step of allSteps(l)) {
      step.beats.forEach((b, n) => {
        // Predictions count too: a cue gives a guess away as well.
        const opts = b.options.filter(
          (o) => o.kind !== "other" && o.kind !== "stuck",
        );
        const r = opts.findIndex((o) => o.kind === "right");
        if (!b.ask || r < 0 || opts.length < 2) return;
        const at = `${id} ${step.id}.${n}`;
        const others = opts.filter((_, k) => k !== r);
        const len = plain(opts[r].text).length;
        const longest = Math.max(...others.map((o) => plain(o.text).length));
        if (len > 1.25 * longest && len - longest > 10)
          cues.push(`${at}: the right option is the longest`);
        if (opts[r].quoted && others.every((o) => !o.quoted))
          cues.push(`${at}: the right option is the only quote`);
        for (const [mark, re] of [
          ["bold", /\*\*/],
          ["a code span", /`/],
        ]) {
          if (re.test(opts[r].text) && others.every((o) => !re.test(o.text)))
            cues.push(`${at}: ${mark} marks the right option alone`);
        }
        if (!NATURAL_ORDER[at])
          slots.push({
            at: r === 0 ? "first" : r === opts.length - 1 ? "last" : "middle",
            three: opts.length >= 3,
          });
      });
    }
    if (slots.length >= 4) {
      for (const slot of ["first", "middle", "last"]) {
        const k = slots.filter((x) => x.at === slot).length;
        if (k / slots.length > 0.6)
          cues.push(
            `${id}: ${k} of ${slots.length} right answers come ${slot}`,
          );
      }
    }
    const three = slots.filter((x) => x.three);
    if (three.length >= 4) {
      const k = three.filter((x) => x.at === "middle").length;
      if (k / three.length > 0.5)
        cues.push(
          `${id}: ${k} of ${three.length} right answers with three or more options sit in the middle`,
        );
    }
  }
  assert.deepEqual(cues, []);
  for (const at of Object.keys(NATURAL_ORDER)) {
    const [id, ref] = at.split(" ");
    const [sid, n] = ref.split(".");
    const b = allSteps(parsed[id]).find((s) => s.id === sid)?.beats[n];
    assert.ok(
      b?.ask && b.options.some((o) => o.kind === "right"),
      `${at}: the exemption names no question with a right option`,
    );
  }
});

test("no key-shaped string, em dash or emoji variation selector in the course or engine source", () => {
  const all = execFileSync(
    "git",
    [
      "ls-files",
      "-co",
      "--exclude-standard",
      "course/steps",
      "quest/engine/src",
    ],
    { cwd: root, encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);
  assert.ok(all.length > 5);
  for (const f of all) {
    const text = readFileSync(join(root, f), "utf8");
    assert.doesNotMatch(text, /sk-ant-/, f);
    assert.doesNotMatch(text, /—/, `${f} has an em dash`);
    assert.doesNotMatch(text, /️/, `${f} has U+FE0F`);
  }
});

// A match or no-match line's regex is the app's own words: it compiles, and
// it holds no code span, which would read as a quote of the page.
const regexProblems = (l) =>
  allSteps(l).flatMap((st) =>
    st.beats
      .filter((b) => ["match", "no-match"].includes(b.verify.kind))
      .flatMap((b) => {
        const found = [];
        try {
          new RegExp(b.verify.regex);
        } catch (error) {
          found.push(`${st.id}: ${error.message}`);
        }
        if (/`[^`]+`/.test(b.verify.regex))
          found.push(`${st.id}: a code span in ${b.verify.regex}`);
        return found;
      }),
  );

test("every match and no-match regex compiles and holds no code span", () => {
  for (const [id, l] of Object.entries(parsed))
    assert.deepEqual(regexProblems(l), [], id);
  // The rule finds both, on made-up lessons.
  const withVerify = (v) =>
    parseLesson(
      DEMO_B2.replace(
        "- verify: check 0 fresh\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt",
        `- verify: ${v}`,
      ),
      "b-2.md",
    );
  assert.equal(regexProblems(withVerify("match CLAUDE.md ^@(docs")).length, 1);
  assert.match(
    regexProblems(withVerify("no-match SKILL.md `TODO`"))[0],
    /a code span/,
  );
  assert.deepEqual(
    regexProblems(withVerify("match CLAUDE.md ^@docs/.+\\.md$")),
    [],
  );
});

// ---- code blocks (ticket 90) --------------------------------------------------
// The hooks page's Your turn skeleton, from its first line to its case block:
// indented lines and a blank line, as the page has them.
const SKELETON = [
  "#!/bin/bash",
  "INPUT=$(cat)",
  "FILE_PATH=$(echo \"$INPUT\" | jq -r '.tool_input.file_path // empty')",
  'FILE_PATH="${FILE_PATH//\\\\//}"',
  'NAME=$(basename "$FILE_PATH")',
  "",
  'case "/$FILE_PATH" in',
  "  */package-lock.json | */.git/*)",
];
const fenced = (lines, info = "bash") => [`\`\`\`${info}`, ...lines, "```"];
const codeOf = (lines) =>
  parseLesson(withCode(lines), "b-2.md").steps[0].beats[0].lines.find(
    (l) => l.key === "code",
  );

test("a beat holds one fenced block from the page, its lines kept as they are", () => {
  const code = codeOf(["- code: point 3", ...fenced(SKELETON)]);
  assert.deepEqual(code.lines, SKELETON);
  // The lines after the block are the beat's again.
  const l = parseLesson(
    withCode([
      "- code: point 1",
      ...fenced(["ls"]),
      '- note: "The page says so."',
    ]),
    "b-2.md",
  );
  assert.deepEqual(
    l.steps[0].beats[0].lines.map((x) => x.key),
    ["code", "note"],
  );
});

test("a code block is closed and not empty, one to a beat", () => {
  const bad = [
    [
      ["- code: point 1", "```bash", "ls"],
      /b-2\.md:\d+: a code block with no closing fence/,
    ],
    [["- code: point 1", "```bash", "```"], /b-2\.md:\d+: an empty code block/],
    [["- code: point 1", "```bash", "", "```"], /an empty code block/],
    [
      ["- code: point 1", '- note: "x"'],
      /a code line with no fenced block under it/,
    ],
    [
      [
        "- code: point 1",
        ...fenced(["ls"]),
        "- code: point 1",
        ...fenced(["pwd"]),
      ],
      /a second code block on one beat/,
    ],
    // A closing fence is as long as the opening one, at least: a shorter one
    // is the block's own line.
    [
      ["- code: point 1", "````markdown", "```", "ls"],
      /a code block with no closing fence/,
    ],
  ];
  for (const [lines, error] of bad)
    assert.throws(() => codeOf(lines), error, lines.join("\n"));
  assert.deepEqual(
    codeOf(["- code: point 1", "````markdown", "```bash", "ls", "```", "````"])
      .lines,
    ["```bash", "ls", "```"],
  );
});

// The whole skeleton: 17 lines.
const SKELETON_ALL = [
  ...SKELETON,
  '    echo "Blocked: $FILE_PATH is protected" >&2',
  "    exit 2",
  "    ;;",
  "esac",
  "",
  "# TODO: block a file named .env, or .env. followed by anything except example",
  "# TODO: block any file inside a secrets/ folder",
  "",
  "exit 0",
];

test("a win line stands in for the command line just above it, and one with none above it fails", () => {
  const block = fenced(["mkdir -p .practice"]);
  const WIN = "New-Item -ItemType Directory -Force .practice";
  const l = parseLesson(
    withCode(["- code: point 1", ...block, `- win: "${WIN}"`]),
    "b-2.md",
  );
  assert.equal(
    l.steps[0].beats[0].lines.find((x) => x.key === "code").win,
    WIN,
  );
  assert.throws(
    () =>
      parseLesson(
        withCode([
          "- code: point 1",
          ...block,
          '- note: "x"',
          `- win: "${WIN}"`,
        ]),
        "b-2.md",
      ),
    /a win line with no run, code or bottom line above it/,
  );
});

test("a beat shows at most 8 lines of code, with a pointer on the line it explains; a longer block shows a window of it on each beat", () => {
  const whole = codeOf(["- code: point 3", ...fenced(SKELETON)]);
  assert.deepEqual([whole.from, whole.to, whole.point], [1, 8, 3]);
  const part = codeOf(["- code: lines 9-16 point 10", ...fenced(SKELETON_ALL)]);
  assert.deepEqual(
    [part.from, part.to, part.point, part.lines.length],
    [9, 16, 10, 17],
  );
  const bad = [
    // 17 lines with no window: a beat would show all of them.
    [
      ["- code: point 3", ...fenced(SKELETON_ALL)],
      /b-2\.md:\d+: this beat shows 17 lines of code; a beat shows at most 8: name the lines it shows, as lines 1-8/,
    ],
    [
      ["- code: lines 1-9 point 3", ...fenced(SKELETON_ALL)],
      /this beat shows 9 lines of code; a beat shows at most 8/,
    ],
    [
      ["- code: lines 9-16", ...fenced(SKELETON_ALL)],
      /a code line is \[lines <first>-<last>\] point <line>/,
    ],
    [
      ["- code: lines 9-16 point 3", ...fenced(SKELETON_ALL)],
      /point 3 is not a line this beat shows \(9 to 16\)/,
    ],
    [
      ["- code: lines 12-18 point 12", ...fenced(SKELETON_ALL)],
      /lines 12-18: the block has 17 lines/,
    ],
    [
      ["- code: lines 5-4 point 4", ...fenced(SKELETON_ALL)],
      /lines 5-4: the block has 17 lines/,
    ],
    [
      ["- code: point 0", ...fenced(["ls"])],
      /point 0 is not a line this beat shows \(1 to 1\)/,
    ],
    [
      ["- code: the loop", ...fenced(["ls"])],
      /a code line is \[lines <first>-<last>\] point <line>/,
    ],
  ];
  for (const [lines, error] of bad)
    assert.throws(() => codeOf(lines), error, lines[0]);
});

test("a code block shows on a do, ask or self beat, and names no folder a run line would fill in", () => {
  const asKind = (kind, lines) =>
    withCode(lines).replace(
      "- where: shell\n- beat: do\n",
      `- where: shell\n- beat: ${kind}\n`,
    );
  for (const kind of ["predict", "type"]) {
    assert.throws(
      () =>
        parseLesson(
          asKind(kind, ["- code: point 1", ...fenced(["ls"])]),
          "b-2.md",
        ),
      new RegExp(`b-2\\.md:\\d+: a code block on a ${kind} beat`),
      kind,
    );
  }
  for (const line of ["cd <your practice copy>", "git -C <your repo> status"]) {
    assert.throws(
      () => codeOf(["- code: point 1", ...fenced(["ls", line])]),
      /a code block that names <your practice copy> or <your repo>/,
      line,
    );
  }
});

// ---- back lines (ticket 192) --------------------------------------------------
// `- back: <step id> <why>` on a ladder block or a beat: where the step's
// state comes from. b-2's after item is its one use so far; 195 and 196 add
// the rest with each level's rework.
// Parser failure cases use a stable synthetic lesson, independent of editorial numbering.
const B2 = readFileSync(
  join(root, "quest/engine/test/fixtures/reducer-course/b-2.md"),
  "utf8",
);
const B2_BACK =
  "- back: W2 The edits this step saves come from the plan you make there.\n";
const withBack = (line, text = B2) =>
  parseLesson(text.replace(B2_BACK, line), "b-2.md");

test("back lines: b-2's after item goes back to the step that switches to plan mode, before the step that asks for the change", () => {
  assert.ok(B2.includes(B2_BACK));
  const rung = parseLesson(B2, "b-2.md").ladder.find(
    (r) => r.item === lessons["b-2"].items[1].text,
  );
  assert.deepEqual([rung.back.step, rung.back.quoted], ["W2", false]);
  const steps = parsed["b-2"].steps.map((s) => s.id);
  assert.equal(steps[steps.indexOf("W2") + 1], "W3");
  assert.ok(
    parsed["b-2"].steps
      .find((s) => s.id === "W3")
      .beats[0].lines.some(
        (l) => l.key === "goal" && /Ask for the change/.test(l.text),
      ),
  );
});

test("back lines: a later step, a step the lesson lacks, another lesson, a warm-up or a second line fails, naming its line", () => {
  const bad = [
    [
      "- back: W8 why\n",
      /b-2\.md:\d+: back W8 is not before step W7, the first step that checks this item/,
    ],
    ["- back: W7 why\n", /back W7 is not before step W7/],
    ["- back: Y1 why\n", /back Y1 is not before step W7/],
    ["- back: W9 why\n", /b-2\.md:\d+: back W9: this lesson has no step W9/],
    ["- back: R1 why\n", /this lesson has no step R1/],
    ["- back: b-1 W2 why\n", /b-2\.md:\d+: back b-1 names another lesson/],
    ["- back: b-1.W2 why\n", /back b-1\.W2 names another lesson/],
    ["- back: W2\n", /b-2\.md:\d+: a back line is a step id, then why/],
    [`${B2_BACK}${B2_BACK}`, /a second back line in one ladder block/],
  ];
  for (const [line, error] of bad)
    assert.throws(() => withBack(line), error, line);
  // On a beat: before the beat's own step.
  const onY5 = (line) =>
    withBack(
      B2_BACK,
      B2.replace(
        '- after: "Stop before committing.',
        `${line}- after: "Stop before committing.`,
      ),
    );
  assert.equal(
    onY5("- back: Y1 Your turn starts over here.\n").steps.find(
      (s) => s.id === "Y5",
    ).beats[3].back.step,
    "Y1",
  );
  assert.throws(
    () => onY5("- back: Y5 why\n"),
    /back Y5 is not before step Y5, the step it goes back from/,
  );
  assert.throws(() => onY5("- back: C why\n"), /back C is not before step Y5/);
  assert.throws(
    () => onY5("- back: Y1 one\n- back: Y2 two\n"),
    /a second back line on one beat/,
  );
  assert.throws(
    () =>
      withBack(
        B2_BACK,
        B2.replace(
          "- from: b-1\n- where: claude\n- beat: ask\n- ask: When the trust dialog",
          "- from: b-1\n- where: claude\n- beat: ask\n- back: W1 why\n- ask: When the trust dialog",
        ),
      ),
    /a back line on a warm-up/,
  );
  // A quote parses as one.
  const { step, text, quoted } = withBack(
    '- back: W2 "It can\'t edit your files until you approve the plan"\n',
  ).ladder[1].back;
  assert.deepEqual(
    { step, text, quoted },
    {
      step: "W2",
      text: "It can't edit your files until you approve the plan",
      quoted: true,
    },
  );
});

// The guide's quote check (lesson-quotes) compares a `- key: "…"` line whose
// whole value is a quote, so the quote after a back line's step id is one it
// doesn't read yet: until it does, a back line's why is the app's own words,
// which name no command or code.
test("back lines: each why is the app's own words until the guide's quote check reads them, and names no command", () => {
  for (const [id, l] of Object.entries(parsed)) {
    const backs = [
      ...l.ladder.map((r) => r.back),
      ...l.steps.flatMap((s) => s.beats.map((b) => b.back)),
    ].filter(Boolean);
    for (const back of backs) {
      assert.equal(
        back.quoted,
        false,
        `${id}:${back.line}: a back line quotes the page before the guide's quote check reads it`,
      );
      assert.doesNotMatch(
        back.text,
        /`|(^|\s)\/[a-z]/,
        `${id}:${back.line}: "${back.text}" names a command`,
      );
    }
  }
});

// ---- the lesson value rework's rules (ticket 194) -----------------------------
// design/lesson-value-rework.md's rules 3 to 5, as far as a test can judge
// them: the budget, no guess whose every option approves, each safety kind
// once a level, and warm-ups that are scenarios. Today's lesson files were
// written before the rules, and each breaks at least one: each is exempt by
// name until its level's rework rewrites it, 195 for Beginner and 196 for
// Intermediate, which removes its entry here. An entry whose lesson keeps
// every rule fails, so the rework can't leave one behind.
const BEFORE_REWORK = {};
// Rule 3: at most 3 graded questions per core lesson, and none in a capstone.
const BUDGET = 3;
// The questions a lesson grades outside its warm-ups, as [step, beat index]:
// every predict, ask and type beat, safety guesses included, and a do beat
// that asks (its verify is answer). Your turn's decision is one of these. A
// choice (ticket 104) asks which path the learner is on, and grades nothing.
const gradedOf = (l) =>
  l.steps.flatMap((s) =>
    s.beats.flatMap((b, n) =>
      !isChoice(b) && (["predict", "ask", "type"].includes(b.kind) || b.ask)
        ? [[s, n]]
        : [],
    ),
  );
const bare = (text) => text.replace(/\*\*|`/g, "").trim();

function budgetOff(id, l) {
  const graded = gradedOf(l);
  if (id.endsWith("capstone")) {
    return [
      ...(graded.length
        ? [
            `${id}: a capstone has no quiz, and this one asks ${graded.length} questions`,
          ]
        : []),
      ...(l.warmup.length
        ? [
            `${id}: a capstone has no warm-up, and this one has ${l.warmup.length}`,
          ]
        : []),
    ];
  }
  return graded.length > BUDGET
    ? [`${id}: ${graded.length} graded questions, over the budget of ${BUDGET}`]
    : [];
}

// Rule 5: no "approve?" guess whose every option approves, so its answer is
// always to approve. An option approves when it leads with yes, approve,
// allow, accept or let, whatever follows ("Yes, and don't ask again", Claude
// Code's own second choice), or says one of them later with nothing that
// refuses ("Read it, then choose Yes"). "Don't ask again" approves too, so
// it is no refusal, in either apostrophe.
const APPROVES = /\b(yes|approve|allow|accept|let)\b/i;
const LEADS_APPROVING = /^(?:plain\s+)?(?:yes|approve|allow|accept|let)\b/i;
const REFUSES = /\b(no|not|decline|deny|never|don't)\b/i;
const approves = (o) => {
  const text = bare(o.text)
    .replace(/^["']|["']$/g, "")
    .replace(/\u2019/g, "'")
    .replace(/\b(?:don't|do not) ask (?:me )?again\b/gi, "");
  return (
    LEADS_APPROVING.test(text) || (APPROVES.test(text) && !REFUSES.test(text))
  );
};
const approveOnlyOff = (id, l) =>
  l.steps.flatMap((s) =>
    s.beats.flatMap((b, n) => {
      const options = b.options.filter(
        (o) => !["other", "stuck"].includes(o.kind),
      );
      return b.kind === "predict" && options.length && options.every(approves)
        ? [`${id} ${s.id}.${n}: every option of this guess approves`]
        : [];
    }),
  );

// Rule 5: a safety kind (the `safety:` value) is asked once a level; after
// that a one-line reminder does. `entries` is [id, lesson] pairs.
function safetyOff(entries) {
  const asked = new Map();
  for (const [id, l] of entries) {
    const level = PATH.find((p) => p.id === id)?.level ?? id;
    for (const s of l.steps) {
      s.beats.forEach((b, n) => {
        if (!b.safety) return;
        const key = `${level} ${b.safety}`;
        asked.set(key, [...(asked.get(key) ?? []), `${id} ${s.id}.${n}`]);
      });
    }
  }
  return [...asked]
    .filter(([, at]) => at.length > 1)
    .map(([key, at]) => `${key}: asked ${at.length} times (${at.join(", ")})`);
}

// Rule 4: a warm-up is a scenario, never a key or a command: no typed answer
// and no right option that is one, or names one. KEY and COMMAND judge a
// whole answer, a code or bold span, and each word of an answer made of
// keys ("Esc Esc", "Esc twice"). In prose, where "tab" or "delete" is a
// plain word, a key counts only as a modifier chord (not "option" or
// "command", which prose uses), Esc, or the word after press, hit or tap,
// and a command only as a word that starts with / or --. A key or command
// in prose beyond these is Review.
const MOD = "(?:shift|ctrl|control|alt|option|cmd|command|meta)";
const KEY = new RegExp(
  `^(?:${MOD}[+-])*(?:tab|esc|escape|enter|return|space|backspace|delete|up|down|left|right|f\\d{1,2})$|^(?:${MOD}[+-])+\\S+$|^(?:ctrl|cmd|alt)\\s\\S$`,
  "i",
);
const COMMAND = /^(?:\/[a-z]|--?[a-z]|(?:claude|git|npm|npx|node)(?:\s|$))/i;
const whole = (text) => KEY.test(text) || COMMAND.test(text);
const REPEATS = /^(?:twice|again|then|and|times?|\d+)$/i;
function keyOrCommand(text) {
  const plain = bare(text).replace(/^["']|["'.]$/g, "");
  const words = plain.split(/[\s,]+/).filter((w) => w && !REPEATS.test(w));
  const spans = [...text.matchAll(/`([^`]+)`|\*\*([^*]+)\*\*/g)].map((m) =>
    (m[1] ?? m[2]).trim(),
  );
  return (
    whole(plain) ||
    (words.length > 0 && words.every((w) => KEY.test(w))) ||
    spans.some(whole) ||
    /\b(?:shift|ctrl|control|alt|cmd|meta)[+-]\w{1,9}\b|\b(?:ctrl|cmd)\s\S\b|\besc\b/i.test(
      plain,
    ) ||
    [...plain.matchAll(/\b(?:press|hit|tap)\s+(\S+)/gi)].some((m) =>
      KEY.test(m[1].replace(/[,.;:]$/, "")),
    ) ||
    plain.split(/\s+/).some((w) => /^(?:\/[a-z]|--[a-z])/i.test(w))
  );
}
const warmupFormOff = (id, l) =>
  l.warmup.flatMap((w) =>
    w.beats.flatMap((b) => {
      const answers =
        b.kind === "type"
          ? b.accept
          : b.options.filter((o) => o.kind === "right").map((o) => o.text);
      const found = answers.find(keyOrCommand);
      return found
        ? [
            `${id} ${w.id}: a warm-up's answer is a key or a command (${found}): ask a scenario`,
          ]
        : [];
    }),
  );

const reworkOff = (id, l) => [
  ...budgetOff(id, l),
  ...approveOnlyOff(id, l),
  ...warmupFormOff(id, l),
];

test("the rework's rules: one warm-up shown, at most 3 graded questions and none in a capstone, no approve-only guess, a safety kind once a level, scenario warm-ups", () => {
  assert.equal(WARMUPS, 1, "the app shows at most one warm-up");
  const after = Object.entries(parsed).filter(([id]) => !(id in BEFORE_REWORK));
  assert.deepEqual(
    [...after.flatMap(([id, l]) => reworkOff(id, l)), ...safetyOff(after)],
    [],
  );
  for (const [id, ticket] of Object.entries(BEFORE_REWORK)) {
    assert.ok(parsed[id], `${id}: the exemption names no lesson file`);
    const broken = [
      ...reworkOff(id, parsed[id]),
      ...safetyOff([[id, parsed[id]]]),
    ];
    assert.ok(
      broken.length,
      `${id} keeps every rule now: drop its exemption, as ${ticket} does`,
    );
  }
});

// A made-up lesson `id` for the rules: `warm` holds each warm-up's beat
// lines, `beats` each beat's lines on its one Worked example step.
function ruled(id, { warm = [], beats = [] } = {}) {
  const text = [
    `---\nlesson: ${id}\ntitle: "Demo"\n---\n\n## intro\n- can: "do it"`,
    ...(warm.length
      ? [
          "\n## warm-up",
          ...warm.map(
            (lines, i) =>
              `\n### R${i + 1} | Warm-up | Recall\n- tier: challenge\n- skill: status\n- from: b-1\n${lines.join("\n")}`,
          ),
        ]
      : []),
    '\n## steps\n\n### W1 | Worked example step 1 of 1 | Do it\n- tier: guided\n- skill: status\n- where: claude\n- beat: do\n- verify: self\n- goal: "Do it."',
    ...beats.map((lines) => lines.join("\n")),
    '\n### C | Check | Check\n- tier: challenge\n- skill: check\n- where: terminal\n- beat: do\n- verify: check all\n- goal: "Run the check."',
  ].join("\n");
  return parseLesson(text, `${id}.md`);
}
const guess = (...options) => [
  "- beat: predict",
  "- ask: Guess: what do you answer?",
  ...options,
];
const PICK = [
  "- beat: ask",
  "- ask: Which one fits?",
  "- right: this one",
  "- wrong: that one",
  '- because: "Because."',
];
const TYPED = [
  "- beat: type",
  "- ask: Which file?",
  "- accept: CLAUDE.md",
  '- reveal: "`CLAUDE.md`"',
];
const ASKED = [
  "- beat: do",
  "- verify: answer",
  "- ask: What did it print?",
  "- right: a version",
  "- other: something else",
];

test("the rework's budget: a fourth graded question fails a new lesson, and a capstone fails on any", () => {
  const three = [guess("- right: **No**", "- option: **Yes**"), PICK, TYPED];
  assert.deepEqual(budgetOff("a-1", ruled("a-1", { beats: three })), []);
  // Warm-ups are no part of it.
  assert.deepEqual(
    budgetOff("a-1", ruled("a-1", { warm: [PICK, PICK], beats: three })),
    [],
  );
  // A fourth, of any kind: a safety guess, a pick, a typed answer or a do beat that asks.
  for (const fourth of [
    [
      ...guess("- right: **No**", "- option: **Yes**"),
      "- safety: permission-prompt",
    ],
    PICK,
    TYPED,
    ASKED,
  ]) {
    assert.deepEqual(
      budgetOff("a-1", ruled("a-1", { beats: [...three, fourth] })),
      ["a-1: 4 graded questions, over the budget of 3"],
      fourth.join("\n"),
    );
  }
  assert.deepEqual(budgetOff("a-capstone", ruled("a-capstone")), []);
  assert.deepEqual(
    budgetOff(
      "a-capstone",
      ruled("a-capstone", { warm: [PICK], beats: [PICK] }),
    ),
    [
      "a-capstone: a capstone has no quiz, and this one asks 1 questions",
      "a-capstone: a capstone has no warm-up, and this one has 1",
    ],
  );
});

test("the rework's approve-only guess: a new lesson fails a guess whose every option approves", () => {
  const at = (...options) =>
    approveOnlyOff("a-1", ruled("a-1", { beats: [guess(...options)] }));
  for (const options of [
    ["- right: plain **Yes**", "- option: the other Yes choices"],
    ['- right: "Approve it"', "- option: let Claude commit"],
    [
      "- right: Read the whole command, then choose **Yes**.",
      "- option: **Yes, and switch to auto mode**",
      "- other: I saw something different",
    ],
    // Claude Code's own second choice, in either apostrophe: its "don't" refuses nothing.
    ["- right: plain **Yes**", "- option: **Yes, and don't ask again**"],
    [
      "- right: **Yes**",
      "- option: **Yes, and don't ask again for this command**",
    ],
    [
      "- right: **Yes**",
      "- option: **Yes, and don\u2019t ask again for this command**",
    ],
    ["- right: **Yes**", "- option: Choose **Yes**, and don't ask again"],
    ["- right: **Yes**", "- option: Yes, but not again"],
    ["- right: Accept the edit", "- option: Press enter to accept"],
  ]) {
    assert.deepEqual(
      at(...options),
      ["a-1 W1.1: every option of this guess approves"],
      options.join("\n"),
    );
  }
  for (const options of [
    [
      "- right: plain **Yes**",
      "- option: Answer **No** and say what to do instead",
    ],
    ["- right: Decline it", "- option: Approve it, so the write can finish"],
    [
      "- right: Once you've reviewed the server it runs",
      "- option: Always, since the file is committed",
    ],
    ["- right: plain **Yes**", "- option: No, let me edit it first"],
    [
      "- right: **Yes, and don't ask again**",
      "- option: Don't approve it: say what to do instead",
    ],
  ]) {
    assert.deepEqual(at(...options), [], options.join("\n"));
  }
  // A pick is no guess: its wrong options say why.
  assert.deepEqual(
    approveOnlyOff(
      "a-1",
      ruled("a-1", {
        beats: [
          [
            "- beat: ask",
            "- ask: Which?",
            "- right: plain **Yes**",
            "- wrong: the other Yes choices",
            '- because: "Because."',
          ],
        ],
      }),
    ),
    [],
  );
});

test("the rework's safety kinds: a kind asked a second time in a level fails, in one lesson or two", () => {
  const safe = (kind) => [
    ...guess("- right: **No**", "- option: **Yes**"),
    `- safety: ${kind}`,
  ];
  const a1 = ruled("a-1", { beats: [safe("permission-prompt")] });
  assert.deepEqual(
    safetyOff([
      ["a-1", a1],
      ["a-2", ruled("a-2", { beats: [safe("plan-approval")] })],
    ]),
    [],
  );
  assert.deepEqual(
    safetyOff([
      ["a-1", a1],
      ["a-2", ruled("a-2", { beats: [safe("permission-prompt")] })],
    ]),
    ["advanced permission-prompt: asked 2 times (a-1 W1.1, a-2 W1.1)"],
  );
  assert.deepEqual(
    safetyOff([
      [
        "a-1",
        ruled("a-1", { beats: [safe("mcp-approval"), safe("mcp-approval")] }),
      ],
    ]),
    ["advanced mcp-approval: asked 2 times (a-1 W1.1, a-1 W1.2)"],
  );
  // Each level asks it once.
  assert.deepEqual(
    safetyOff([
      ["i-1", ruled("i-1", { beats: [safe("permission-prompt")] })],
      ["a-1", a1],
    ]),
    [],
  );
});

test("the rework's warm-ups: a new lesson fails a warm-up whose answer is a key or a command", () => {
  const typed = (...accept) => [
    "- beat: type",
    "- ask: Which one?",
    ...accept.map((a) => `- accept: ${a}`),
    '- reveal: "It is."',
  ];
  const right = (text) => [
    "- beat: ask",
    "- ask: Which one?",
    `- right: ${text}`,
    "- wrong: the other",
    '- because: "Because."',
  ];
  for (const [beat, answer] of [
    [typed("Shift+Tab", "Alt+M"), "Shift+Tab"],
    [typed("Esc"), "Esc"],
    [typed("Ctrl+O"), "Ctrl+O"],
    [typed("/context"), "/context"],
    [typed("disable", "claude plugin disable"), "claude plugin disable"],
    [typed("--settings"), "--settings"],
    [right('"`/rewind`"'), "`/rewind`"],
    [right("`claude --version`"), "`claude --version`"],
    // A key or command inside the answer, repeated, or joined some other way.
    [typed("Esc Esc"), "Esc Esc"],
    [typed("Esc twice"), "Esc twice"],
    [typed("Ctrl-O"), "Ctrl-O"],
    [typed("ctrl o"), "ctrl o"],
    [typed("Ctrl+C twice"), "Ctrl+C twice"],
    [right("Press **Shift+Tab**"), "Press **Shift+Tab**"],
    [right("Run `/clear`"), "Run `/clear`"],
    [right("Press `Esc` twice"), "Press `Esc` twice"],
    [right("Press Enter to send it"), "Press Enter to send it"],
    [
      right("Start it with claude --continue"),
      "Start it with claude --continue",
    ],
    [
      right("Type /context and read the grid"),
      "Type /context and read the grid",
    ],
  ]) {
    assert.deepEqual(
      warmupFormOff("a-1", ruled("a-1", { warm: [beat] })),
      [
        `a-1 R1: a warm-up's answer is a key or a command (${answer}): ask a scenario`,
      ],
      beat.join("\n"),
    );
  }
  for (const beat of [
    typed(".claude/settings.json"),
    typed("PreToolUse"),
    right("the project's `CLAUDE.md`"),
    right("plain **Yes**"),
    PICK,
    // Prose whose words are keys only elsewhere.
    right("Delete the worktree, then open a new tab"),
    right("Go back to the plan and return to it later"),
    right("The command-line option the page names"),
    right("Shift the task to a subagent"),
    right("`.claude/skills/<name>/SKILL.md`"),
    right("Undo the last turn and/or restore the code"),
  ]) {
    assert.deepEqual(
      warmupFormOff("a-1", ruled("a-1", { warm: [beat] })),
      [],
      beat.join("\n"),
    );
  }
});

// ---- choices and the beats that depend on them (ticket 104) -----------------
const CHOICE = [
  "- beat: ask",
  "- ask: Which credential do you use?",
  "- option: An API key",
  '- option: "A token"',
];
const WHEN_KEY = (when) => [
  "- beat: do",
  `- when: ${when}`,
  "- verify: self",
  '- goal: "Add it."',
];

test("choices: a question with no right answer is allowed, and grades nothing, not even in a capstone (104)", () => {
  const l = ruled("a-capstone", { beats: [CHOICE] });
  assert.ok(isChoice(l.steps[0].beats[1]));
  assert.deepEqual(budgetOff("a-capstone", l), []);
  // A question with a wrong option is no choice: it still needs its right one.
  assert.ok(!isChoice(ruled("a-1", { beats: [PICK] }).steps[0].beats[1]));
  assert.ok(
    !isChoice(
      ruled("a-1", {
        beats: [[...CHOICE, "- wrong: neither", '- because: "Because."']],
      }).steps[0].beats[1],
    ),
  );
});

test("choices: every when names a real choice made before it, and one of its options (104)", () => {
  const l = ruled("a-1", {
    beats: [CHOICE, WHEN_KEY("W1.1=An API key"), WHEN_KEY("W1.1=A token")],
  });
  assert.deepEqual(
    l.steps[0].beats
      .slice(2)
      .map((b) => [b.when.step, b.when.beat, b.when.option]),
    [
      ["W1", 1, "An API key"],
      ["W1", 1, "A token"],
    ],
  );
  const bad = (beats, re) => assert.throws(() => ruled("a-1", { beats }), re);
  bad(
    [CHOICE, WHEN_KEY("W1.1=A key")],
    /"A key" is none of its options: "An API key", "A token"/,
  );
  bad([CHOICE, WHEN_KEY("Y1.1=An API key")], /this lesson has no step Y1/);
  bad([CHOICE, WHEN_KEY("W1.0=An API key")], /names no choice/);
  bad([PICK, WHEN_KEY("W1.1=this one")], /names no choice/);
  bad([WHEN_KEY("W1.2=An API key"), CHOICE], /not before this one/);
  bad([CHOICE, WHEN_KEY("W1.1")], /a when line is <step id>\.<beat>=<option>/);
  bad(
    [CHOICE, WHEN_KEY('"W1.1=An API key"')],
    /when holds the app's own words/,
  );
  bad(
    [CHOICE, [...WHEN_KEY("W1.1=An API key"), "- when: W1.1=A token"]],
    /a second when line/,
  );
  // A step's first beat always shows; a warm-up follows no choice.
  assert.throws(
    () =>
      parseLesson(
        `---\nlesson: a-1\ntitle: "Demo"\n---\n\n## intro\n- can: "do it"\n\n## steps\n\n### W1 | Worked example step 1 of 1 | Do it\n- tier: guided\n- skill: s\n- where: claude\n${WHEN_KEY("C.0=x").join("\n")}\n\n### C | Check | Check\n- tier: challenge\n- skill: check\n- where: terminal\n- beat: do\n- verify: check all\n- goal: "Run it."`,
        "a-1.md",
      ),
    /first beat always shows/,
  );
  assert.throws(
    () => ruled("a-1", { warm: [[...CHOICE, ...WHEN_KEY("R1.0=An API key")]] }),
    /a when line on a warm-up/,
  );
});

// ---- what the ticket 27 dry-runs found (patterns A to I) --------------------
// The 2.1.308 dry-runs found step-file patterns that a script can spot, each
// fixed in every lesson: a line that dangles (A), a hint that repeats the
// card (B), `terminal` while Claude Code still runs there (D), a beat that
// passes before the learner looks (E), a line cut from mid-sentence (F), a
// card line that repeats the title (G), a command beside "No commands this
// time" (H), and a Check whose command is only behind h (I). Their C, a
// decision or a format only behind h, is a finish-review item: no script
// can tell which hint holds one. Each test reads every lesson in PATH order
// at its plan tiers, and names the file line, the step and beat, and the
// line it found.
const sourceLines = Object.fromEntries(
  files.map((f) => [
    f.replace(/\.md$/, ""),
    readFileSync(join(dir, f), "utf8").split("\n"),
  ]),
);

// Where a beat's line sits: `course/steps/<id>.md:<n> <step>.<beat>`, with n
// the file line of the beat's `- <key>: ` line that holds `text`, or of the
// beat's own line.
function placeOf(id, step, n, key, text) {
  const lines = sourceLines[id];
  const from = step.beats[n].line - 1;
  let at = from;
  for (
    let i = from + 1;
    key && i < lines.length && !/^(- beat:|### )/.test(lines[i]);
    i++
  ) {
    if (
      [`- ${key}: "${text}"`, `- ${key}: ${text}`].includes(lines[i].trim())
    ) {
      at = i;
      break;
    }
  }
  return `course/steps/${id}.md:${at + 1} ${step.id}.${n}`;
}

// Every beat of every lesson in PATH order, each with its step's plan tier:
// a lesson's warm-ups first, at CHALLENGE, then its steps.
function planBeats() {
  const out = [];
  contents.forEach((c, i) => {
    if (!c) return;
    const rule = ruleTiers(contents, i);
    for (const [s, tier] of [
      ...c.warmup.map((w) => [w, "challenge"]),
      ...c.steps.map((s, k) => [s, rule[k]]),
    ]) {
      s.beats.forEach((b, n) => out.push({ id: c.lesson, s, n, b, tier }));
    }
  });
  return out;
}

// The lines a beat's card shows at its plan tier, in order: a guess shows
// only its notes. Run and code lines show at the plan's tier (only "less
// help" on a GUIDED step hides them), and bottom lines never do.
const cardLines = (b) =>
  b.kind === "predict" ? b.lines.filter((x) => x.key === "note") : b.lines;
const CARD_TEXT = new Set([
  "goal",
  "do",
  "say",
  "note",
  "rule",
  "after",
  "expect",
]);
// Two lines say the same words when they differ only in case, bold, code
// marks, spacing or closing punctuation.
const sameWords = (x) =>
  x
    .replace(/\*\*|`/g, "")
    .replace(/[\s.:,;]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// What a card line's closing colon may introduce, on the line right under
// it: a command (a run or code line), what to expect (an expect line), a
// list (the next two lines share a key, as b-2 W4's choices do), or, under
// a say line, the app's own words, the quote it introduces (as a-2 Y1's job
// text). Anything else means the page's colon lost its code block: what it
// introduces went behind h, to a later beat, or nowhere.
const introduces = (line, next, after) =>
  Boolean(next) &&
  (["run", "code", "expect"].includes(next.key) ||
    (["note", "do", "say"].includes(next.key) && after?.key === next.key) ||
    (line.key === "say" && next.key === "note"));

test("card: a line that ends in a colon has what it introduces under it, and no card line, GUIDED why line or hint is left hanging (27, pattern A)", () => {
  const off = [];
  for (const { id, s, n, b, tier } of planBeats()) {
    const shown = cardLines(b);
    shown.forEach((x, j) => {
      if (!CARD_TEXT.has(x.key)) return;
      const text = x.text.trim();
      if (text.endsWith(","))
        off.push(
          `${placeOf(id, s, n, x.key, x.text)}: ${x.key} "${x.text}" ends in a comma`,
        );
      else if (text.endsWith(":") && !introduces(x, shown[j + 1], shown[j + 2]))
        off.push(
          `${placeOf(id, s, n, x.key, x.text)}: ${x.key} "${x.text}" ends in a colon, and what it introduces is not under it`,
        );
    });
    // At GUIDED a do or ask beat's first why line shows under the title, alone.
    const why = b.why[0]?.trim() ?? "";
    if (
      tier === "guided" &&
      ["do", "ask"].includes(b.kind) &&
      /[:,]$/.test(why)
    )
      off.push(
        `${placeOf(id, s, n, "why", b.why[0])}: why "${b.why[0]}" ends in a ${why.endsWith(":") ? "colon" : "comma"} under the title`,
      );
    // A hint shows alone: it ends in a colon only as the last one, where the
    // y/n and the bottom line after it finish its sentence.
    b.hints.forEach((h, m) => {
      if (
        h.trim().endsWith(":") &&
        !(m === b.hints.length - 1 && b.bottom.length)
      )
        off.push(
          `${placeOf(id, s, n, "hint", h)}: hint ${m + 1} "${h}" ends in a colon, and no bottom line follows it`,
        );
    });
  }
  assert.deepEqual(off, []);
});

test("help: no hint repeats a line the card already shows (27, pattern B)", () => {
  const off = [];
  for (const { id, s, n, b, tier } of planBeats()) {
    const card = cardLines(b)
      .filter((x) => CARD_TEXT.has(x.key))
      .map((x) => x.text);
    if (b.self) card.push(b.self);
    if (tier === "guided" && ["do", "ask"].includes(b.kind) && b.why.length)
      card.push(b.why[0]);
    const shown = new Set(card.map(sameWords));
    b.hints.forEach((h, m) => {
      if (shown.has(sameWords(h)))
        off.push(
          `${placeOf(id, s, n, "hint", h)}: hint ${m + 1} "${h}" repeats the card`,
        );
    });
  }
  assert.deepEqual(off, []);
});

// A session's starts and ends, in the order a beat gives them: a run or
// bottom line that starts an interactive `claude` (flags only: no `-p`, no
// subcommand, no `--version` or `--help`) or types `/exit`, and an order on
// the card, such as "start `claude` again" or "End the session". Hints are
// left out: one may offer a session the step doesn't need ("For a second
// opinion, start `claude`"), or repeat the step before.
const ORDER = String.raw`(?:^|[.,:;]\s+|\b(?:then|and)\s+)`;
const STARTS = new RegExp(
  String.raw`${ORDER}start\b[^.;:]*?(?:\x60claude[\x60\s]|\bsession\b|\bClaude Code\b)`,
  "gi",
);
const ENDS = new RegExp(
  String.raw`/exit\b|${ORDER}(?:end|exit|quit|close)\b[^.;:]*?\bsession\b`,
  "gi",
);
const startsClaude = (cmd) =>
  /^claude(\s|$)/.test(cmd) &&
  !/^claude\s+[a-z]/.test(cmd) &&
  !/(^|\s)(-p|--print|-v|--version|-h|--help)(\s|$)/.test(cmd);
function sessionEvents(b) {
  const events = [];
  const command = (cmd) => {
    if (startsClaude(cmd)) events.push("start");
    else if (/^\/exit\b/.test(cmd)) events.push("end");
  };
  for (const x of cardLines(b)) {
    if (x.key === "run") command(x.text);
    else if (CARD_TEXT.has(x.key)) {
      const found = [
        ...[...x.text.matchAll(STARTS)].map((m) => [m.index, "start"]),
        ...[...x.text.matchAll(ENDS)].map((m) => [m.index, "end"]),
      ];
      events.push(...found.sort((p, q) => p[0] - q[0]).map(([, e]) => e));
    }
  }
  for (const x of b.bottom) command(x.text);
  return events;
}

// Beats that say `terminal` where a session may still run, kept on
// purpose, each with its reason.
const LEARNERS_ORDER =
  "the capstone leaves the order of its tasks to the learner, so the file can't tell whether step 4's session is still open in that terminal; ticket 27 left it";
const TERMINAL_WHILE_OPEN = {
  "a-capstone T5.3": LEARNERS_ORDER,
  "a-capstone C.0": LEARNERS_ORDER,
  "a-capstone D1.0": LEARNERS_ORDER,
  "a-capstone D2.0": LEARNERS_ORDER,
  "a-capstone D2.1": LEARNERS_ORDER,
  "a-capstone D3.0": LEARNERS_ORDER,
  "a-capstone D3.2": LEARNERS_ORDER,
  "a-capstone D3.3": LEARNERS_ORDER,
};

test("where: no beat sends the learner to the terminal Claude Code is still running in (27, pattern D)", () => {
  const off = [];
  const exempt = [];
  for (const c of contents) {
    // A page that numbers its terminals has each beat say which one.
    if (!c || c.terminals) continue;
    // `terminal` is the window Claude Code runs in: a claude beat, or a
    // start in that window, opens its session, and an end there closes it.
    // claude-2, shell, editor and browser are other windows.
    let open = null;
    c.steps.forEach((s) =>
      s.beats.forEach((b, n) => {
        const events = sessionEvents(b);
        if (
          b.kind === "do" &&
          b.where === "terminal" &&
          open &&
          !events.length
        ) {
          const at = `${c.lesson} ${s.id}.${n}`;
          if (TERMINAL_WHILE_OPEN[at]) exempt.push(at);
          else
            off.push(
              `${placeOf(c.lesson, s, n)}: where terminal, while the session from ${open} still runs there`,
            );
        }
        if (b.where !== "terminal" && b.where !== "claude") return;
        if (events.length)
          open = events.at(-1) === "start" ? `${s.id}.${n}` : null;
        else if (b.where === "claude" && !open) open = `${s.id}.${n}`;
      }),
    );
  }
  assert.deepEqual(off, []);
  assert.deepEqual(
    exempt,
    Object.keys(TERMINAL_WHILE_OPEN),
    "an exemption names a beat that no longer says terminal while a session runs there",
  );
});

test("a git-clean beat that asks the learner to run git status waits for them: it has a done-label (27, pattern E)", () => {
  const off = [];
  for (const { id, s, n, b } of planBeats()) {
    const run = b.lines.find(
      (x) => x.key === "run" && /^git status\b/.test(x.text),
    );
    if (b.verify.kind === "git-clean" && run && !b.doneLabel)
      off.push(
        `${placeOf(id, s, n, "run", run.text)}: verify git-clean beside "${run.text}" with no done-label, so it passes before the learner looks`,
      );
  }
  assert.deepEqual(off, []);
});

// How a sentence starts: a capital or a digit, or a code span, a link, a
// quote mark, bold or a parenthesis around one.
const SENTENCE_START = /^[A-Z0-9`["*(]/;

test("card: a beat's first goal, do or say line starts a sentence, never midway through the page's (27, pattern F)", () => {
  const off = [];
  for (const { id, s, n, b } of planBeats()) {
    const first = cardLines(b).find((x) =>
      ["goal", "do", "say"].includes(x.key),
    );
    if (first && !SENTENCE_START.test(first.text))
      off.push(
        `${placeOf(id, s, n, first.key, first.text)}: ${first.key} "${first.text}" starts midway through a sentence`,
      );
  }
  assert.deepEqual(off, []);
});

test("card: no line on a step's card repeats the step's title (27, pattern G)", () => {
  const off = [];
  for (const { id, s, n, b } of planBeats()) {
    for (const x of cardLines(b)) {
      if (CARD_TEXT.has(x.key) && sameWords(x.text) === sameWords(s.title))
        off.push(
          `${placeOf(id, s, n, x.key, x.text)}: ${x.key} "${x.text}" repeats the title "${s.title}"`,
        );
    }
  }
  assert.deepEqual(off, []);
});

test('card: a CHALLENGE Your turn or task step shows no run line beside "No commands this time" (27, pattern H)', () => {
  const off = [];
  contents.forEach((c, i) => {
    if (!c) return;
    const rule = ruleTiers(contents, i);
    c.steps.forEach((s, k) => {
      if (rule[k] !== "challenge" || !OWN_PARTS.has(s.part)) return;
      // The card says it on the step's first beat that is no guess.
      const n = s.beats.findIndex((b) => b.kind !== "predict");
      const run = s.beats[n]?.lines.find((x) => x.key === "run");
      if (run)
        off.push(
          `${placeOf(c.lesson, s, n, "run", run.text)}: run "${run.text}" beside "No commands this time."`,
        );
    });
  });
  assert.deepEqual(off, []);
});

// Checks that keep their command behind h, each with its reason.
const CHECK_COMMAND_BEHIND_H = {
  "a-capstone C":
    "any line on C.0's card, a goal or a run line, pushed even the title off the Terminal app's 60x20 ASCII card under three of its FAIL messages (only a workflow that waits for a mention, no credential, a key in a committed note), the real failures ladders.test.mjs drives to the check rung; it needs shorter messages or another Check title before it shows its command",
};

test("card: every Check shows its npm run check command on the card, not only behind h (27, pattern I)", () => {
  const off = [];
  const exempt = [];
  for (const c of contents) {
    if (!c) continue;
    const check = c.steps.find((s) => s.part === "Check");
    const shows = check.beats.some((b) =>
      cardLines(b).some(
        (x) =>
          (x.key === "run" && /^npm run check\b/.test(x.text)) ||
          (CARD_TEXT.has(x.key) && /`npm run check\b/.test(x.text)),
      ),
    );
    const at = `${c.lesson} ${check.id}`;
    if (shows) continue;
    if (CHECK_COMMAND_BEHIND_H[at]) exempt.push(at);
    else
      off.push(
        `course/steps/${c.lesson}.md:${check.line} ${check.id}: no beat shows \`npm run check\` on the card${check.beats.some((b) => b.bottom.some((x) => /^npm run check\b/.test(x.text))) ? ": it is only a bottom line, behind h" : ""}`,
      );
  }
  assert.deepEqual(off, []);
  assert.deepEqual(
    exempt,
    Object.keys(CHECK_COMMAND_BEHIND_H),
    "an exemption names a Check that shows its command now",
  );
});

test("card: a beat planned and written GUIDED shows its command, not only behind h (27, pattern J)", () => {
  // The card inlines bottom lines only on a step planned GUIDED and written
  // above it, so on a step written GUIDED a command kept only in `bottom`
  // hides behind h while the header promises every command shown. A card
  // line that names the bottom's command in a code span shows it.
  const off = [];
  contents.forEach((c, i) => {
    if (!c) return;
    const rule = ruleTiers(contents, i);
    c.steps.forEach((s, k) =>
      s.beats.forEach((b, n) => {
        if (
          rule[k] !== "guided" ||
          s.tier !== "guided" ||
          b.kind !== "do" ||
          s.part === "Check" ||
          !b.bottom.length
        )
          return;
        if (b.lines.some((x) => ["run", "code"].includes(x.key))) return;
        const card = b.lines
          .filter((x) => CARD_TEXT.has(x.key))
          .map((x) => x.text)
          .join("\n");
        const hidden = b.bottom.filter((x) => !card.includes(`\`${x.text}\``));
        if (hidden.length)
          off.push(
            `${placeOf(c.lesson, s, n, "bottom", hidden[0].text)}: ${hidden.map((x) => x.text).join(" | ")} only behind h on a GUIDED step`,
          );
      }),
    );
  });
  assert.deepEqual(off, []);
});

// A slash command in a card line, a hint or a bottom line.
const SLASH = /(?:^|[\s`(])(\/[a-z][a-z-]+)(?=[\s`.,:)]|$)/g;

test("card: a slash command the course shows for the first time in a Worked example is on the card (27, pattern K)", () => {
  // Curriculum 3.6: a first meeting is Guided. A Worked example step that
  // reuses an earlier skill plans above GUIDED, so a command the learner has
  // never met would wait behind h.
  const seen = new Set();
  const off = [];
  contents.forEach((c, i) => {
    if (!c) return;
    const rule = ruleTiers(contents, i);
    c.steps.forEach((s, k) =>
      s.beats.forEach((b, n) => {
        const inline = rule[k] === "guided" && s.tier !== "guided";
        const card = b.lines
          .filter(
            (x) => CARD_TEXT.has(x.key) || ["run", "code"].includes(x.key),
          )
          .map((x) => x.text);
        const visible = [
          ...card,
          ...(inline ? b.bottom.map((x) => x.text) : []),
          ...(rule[k] === "guided" ? b.why.slice(0, 1) : []),
        ].join("\n");
        const hidden = [
          ...b.hints,
          ...(inline ? [] : b.bottom.map((x) => x.text)),
        ].join("\n");
        const vis = new Set([...visible.matchAll(SLASH)].map((m) => m[1]));
        for (const cmd of new Set([
          ...vis,
          ...[...hidden.matchAll(SLASH)].map((m) => m[1]),
        ])) {
          if (seen.has(cmd)) continue;
          seen.add(cmd);
          if (
            !vis.has(cmd) &&
            s.part === "Worked example" &&
            rule[k] !== "guided"
          )
            off.push(
              `${placeOf(c.lesson, s, n)}: ${cmd} is first shown here, only behind h`,
            );
        }
      }),
    );
  });
  assert.deepEqual(off, []);
});

test("card: a beat that runs /diff carries the page's note that the panel may already be open (27, pattern O)", () => {
  // The diff panel can open on its own once Claude edits files, and typing
  // /diff then closes it.
  const off = [];
  for (const l of Object.values(parsed))
    for (const s of l.steps)
      s.beats.forEach((b, n) => {
        if (
          b.lines.some((x) => x.key === "run" && x.text === "/diff") &&
          !b.lines.some((x) => /typing `\/diff` closes it/.test(x.text))
        )
          off.push(placeOf(l.lesson, s, n, "run", "/diff"));
      });
  assert.deepEqual(off, []);
});

test('intro: every can line reads after "You\'ll be able to" (27, pattern T)', () => {
  // A can line cut from the middle of the Goal starts with a third-person
  // verb ("reads its JSON result"); a capitalised noun phrase ("Two parts at
  // once") is a title, not a can-do. A capitalised verb with an object, as
  // a-7's "Bound a real task", reads.
  const off = [];
  for (const l of Object.values(parsed)) {
    for (const c of l.intro.can) {
      if (
        /^[a-z]+[^s\W]s\b/.test(c) ||
        (/^[A-Z][a-z]*(?: [a-z]+)*,? [a-z]/.test(c) &&
          !/^[A-Z][a-z]+ (?:a|an|the|your)\b/.test(c))
      )
        off.push(`${l.lesson}: ${c}`);
    }
  }
  assert.deepEqual(off, []);
});

test("verify: a beat that asks for a commit or a removal checks it (27, pattern U)", () => {
  // A beat that says "then commit it" and reads only the working file, with
  // no later beat in its step that reads the commit, turns green before the
  // commit; a removal that verifies only `probe pushed` turns green on any
  // push. The `removed` probe checks the paths are gone from HEAD and pushed.
  // "Don't commit it" asks for no commit.
  const off = [];
  for (const l of Object.values(parsed))
    for (const s of l.steps)
      s.beats.forEach((b, n) => {
        if (b.kind !== "do") return;
        const card = b.lines
          .filter((x) => CARD_TEXT.has(x.key))
          .map((x) => x.text)
          .join(" ");
        const later = s.beats
          .slice(n + 1)
          .some((x) =>
            ["check", "probe", "head-moved"].includes(x.verify.kind),
          );
        if (
          READS.has(b.verify.kind) &&
          /\bthen commit\b|(?<!\bdon't )\bcommit it\b/i.test(card) &&
          !later
        )
          off.push(placeOf(l.lesson, s, n));
        if (
          b.verify.kind === "probe" &&
          b.verify.name === "pushed" &&
          /\b(delete|remove)\b/i.test(card)
        )
          off.push(placeOf(l.lesson, s, n));
      });
  assert.deepEqual(off, []);
});

test("code in a link's text shows as code with no backticks, as the page does, and keeps the link", () => {
  assert.deepEqual(
    inline(
      "where Node.js offers [`import.meta.dirname`](https://nodejs.org/api/esm.html#importmetadirname).",
    ),
    [
      { text: "where Node.js offers " },
      {
        text: "import.meta.dirname",
        code: true,
        url: "https://nodejs.org/api/esm.html#importmetadirname",
      },
      { text: "." },
    ],
  );
  assert.deepEqual(inline("[`tdd` skill](x.md)"), [
    { text: "tdd", code: true, url: "x.md" },
    { text: " skill", url: "x.md" },
  ]);
  // Every lesson file's link text, so none shows a stray backtick.
  for (const f of files) {
    for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
      for (const r of inline(line).filter((x) => x.url))
        assert.ok(!r.text.includes("`"), `${f}: ${r.text}`);
    }
  }
});

// Lesson 2 commits its reviewed change (ticket 27, S3), so lesson 3 starts
// from a clean tree with nothing to set aside.
test("lesson 3 starts from the clean tree lesson 2 committed", () => {
  const first = parsed["b-3"].steps[0].beats[0];
  assert.equal(first.verify.kind, "git-clean");
  assert.equal(first.where, "terminal");
  assert.ok(!first.bottom.some((line) => line.text.includes("git stash")));
  assert.ok(
    parsed["b-2"].steps.some(
      (s) =>
        s.part === "Worked example" &&
        s.beats.some(
          (b) =>
            b.verify.kind === "git-clean" &&
            b.lines.some(
              (line) =>
                line.key === "run" && line.text.startsWith("git commit"),
            ),
        ),
    ),
    "b-2 commits its Worked example",
  );
  assert.ok(
    !readFileSync(join(dir, "b-2.md"), "utf8").includes("git stash"),
    "b-2 stashes nothing",
  );
});

test("capstone prepares committed memory and preserves its Windows reproduction warning", () => {
  const first = parsed["b-capstone"].steps[0];
  assert.ok(
    first.beats.some(
      (b) => b.verify.kind === "check" && b.verify.items?.includes(5),
    ),
  );
  assert.ok(first.beats.some((b) => b.verify.kind === "git-clean"));
  assert.ok(first.beats.some((b) => b.winNote?.includes("Set-Content")));
});

test("Beginner live content teaches the promoted features and all four memory notes", () => {
  const text = (id) => readFileSync(join(dir, `${id}.md`), "utf8");
  for (const feature of ["Ctrl+B", "/btw", "/tasks"])
    assert.ok(text("b-3").includes(feature), feature);
  // Ticket 27, S2: b-4 recovers with Esc and a rewind of code and
  // conversation; /branch and Summarize from here move to Go further.
  for (const feature of [
    "Restore code and conversation",
    "**Restore code**",
    "Esc",
    "/compact",
    "/clear",
  ])
    assert.ok(text("b-4").includes(feature), feature);
  for (const gone of ["/branch", "Summarize from here"])
    assert.ok(!text("b-4").includes(gone), gone);
  for (const note of [
    "npm run tests",
    "~/scratch/linkcheck-docs",
    "summary at the end",
    "linkcheck:",
  ])
    assert.ok(text("b-5").includes(note), note);
  for (const scope of ["~/.claude/CLAUDE.md", "CLAUDE.local.md", "Auto memory"])
    assert.ok(text("b-5").includes(scope), scope);
  assert.ok(!text("b-1").includes(".practice/version.txt"));
});

// No hint can see whether the Learner took it, so a hint never holds a
// command that saves a file for the check: that command is a bottom rung,
// behind the y/n that records the exact command.
test("no capstone hint holds a command that saves a file for the check", () => {
  const savesForCheck = (text) =>
    [...text.matchAll(/`([^`]+)`/g)].some(([, code]) =>
      /\s>\s*\.practice\//.test(code),
    );
  const capstones = Object.entries(parsed).filter(([id]) =>
    id.endsWith("-capstone"),
  );
  assert.equal(capstones.length, 3);
  for (const [id, { steps, ladder }] of capstones) {
    const hints = [
      ...steps.flatMap((step) => step.beats.flatMap((b) => b.hints)),
      ...ladder.flatMap((l) => l.hints),
    ];
    assert.deepEqual(hints.filter(savesForCheck), [], id);
  }
  // The scan finds such a command where it belongs, on a bottom rung.
  assert.ok(
    capstones.some(([, { steps }]) =>
      steps.some((step) =>
        step.beats.some((b) =>
          b.bottom.some((x) => savesForCheck(`\`${x.text}\``)),
        ),
      ),
    ),
  );
});
