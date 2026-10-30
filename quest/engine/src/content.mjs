// Step files, course/steps/<lesson-id>.md. A double-quoted value is the
// lesson page's exact words; an unquoted value is the app's own words and
// states no Claude Code fact. The lesson test compares every quoted value
// with the page. Parsing and compilation are pure: callers supply all text,
// Check modules and probe definitions.
import { createHash } from "node:crypto";
import { z } from "zod";
import { frontmatter } from "./frontmatter.ts";
import { inline } from "./text.ts";

// `### <id> | <part> step N of M | <title>`, or `### C | Check | <title>`
// and `### R<n> | Warm-up | <title>`. A page whose Your turn is parts, not
// numbered steps, says `### Y<n> | Your turn part N of M | <title>`; a page
// with a Tear down after its Check says `### D<n> | Tear down step N of M |
// <title>` there, after the Check only (ticket 102).
export const STEP_HEADING =
  /^### (W\d+|Y\d+|T\d+|D\d+|C|R\d+) \| (?:(Worked example|Your turn|The task|Tear down) (step|part) (\d+) of (\d+)|(Check|Warm-up)) \| (\S.*)$/;
// Each numbered part's id letter.
export const PART_IDS = {
  "Worked example": "W",
  "Your turn": "Y",
  "The task": "T",
  "Tear down": "D",
};
// Parts whose steps the learner does on their own, with the goal in front.
export const OWN_PARTS = new Set(["Your turn", "The task"]);
// `optional: <when to skip it>` (ticket 102), the app's own words: the card
// shows them, and x skips the step.
export const STEP_KEYS = new Set([
  "tier",
  "skill",
  "where",
  "from",
  "optional",
]);
// A step id, as a fresh check's `since`, a back line or the saved place name it.
export const STEP_ID = /^[WYTDCR]\d*$/;
// Where a step's work happens: the other terminal, Claude Code, a third
// terminal for shell commands while Claude Code is still open, or an editor;
// since ticket 103 also a second Claude Code session (`claude-2`) and a
// browser, whose beats verify with self, or with `none` and a later beat of
// the step that reads a local file.
export const WHERE = new Set([
  "terminal",
  "claude",
  "claude-2",
  "shell",
  "editor",
  "browser",
]);
// The windows a page may number, "In terminal 1", "In terminal 2": the front
// matter's `terminals: [claude, claude-2, shell]` names them in the page's
// order, one item a terminal, and an item may name two that share one
// (`terminal claude`). Each beat in one of them is then labelled "in
// terminal <n>" (ticket 103).
export const NUMBERED = ["terminal", "claude", "claude-2", "shell"];
// Verify kinds the app answers by reading the beat's file itself, with no
// process: `file`, and HOLDS, what a file holds (ticket 87).
export const HOLDS = new Set(["json", "match", "no-match"]);
export const READS = new Set(["file", ...HOLDS]);
// Verify kinds the app answers with git status (ticket 88): the whole tree
// clean, or part of it; and, against how git was when a step opened (ticket
// 105), HEAD moved with the tree clean, or the same paths listed.
export const GIT = new Set([
  "git-clean",
  "git-changed",
  "git-only",
  "git-staged",
  "head-moved",
  "git-unchanged",
]);
// The verify kinds that compare git with how it was when a step opened.
export const SINCE_GIT = new Set(["head-moved", "git-unchanged"]);
export const BEAT_KINDS = new Set(["do", "predict", "ask", "type", "self"]);
// Keys a beat may hold, and whether their value must be a quote of the page.
// `wait` (ticket 103) marks a long wait, for an agent, workflow or CI run:
// `- wait: long` in the app's words, or `- wait: "<the page's words>"` where
// the page says how long. No idle offer, and no CHALLENGE hint unlock, while
// it waits.
// `lead-in` (ticket 188): the page's words that frame the bottom line just
// above it, such as "In the practice template:", drawn above its command
// wherever the bottom line shows; at most one a bottom line. Like `win`, it
// goes under its bottom line, before or after that line's `win`.
export const BEAT_KEYS = {
  where: false,
  verify: false,
  wait: null,
  "done-label": false,
  watching: false,
  evidence: false,
  safety: false,
  tick: false,
  skill: false,
  say: false,
  ask: false,
  other: false,
  decoy: false,
  "reveal-at": false,
  recall: false,
  accept: false,
  code: false,
  goal: true,
  do: true,
  run: true,
  win: true,
  expect: true,
  note: true,
  rule: true,
  after: true,
  why: true,
  codespace: true,
  "win-note": true,
  hint: true,
  bottom: true,
  "lead-in": true,
  because: true,
  point: true,
  reveal: true,
  self: true,
  right: null,
  wrong: null,
  option: null,
  stuck: null,
  back: null,
  when: false,
};
// `when: <step id>.<beat>=<option>` (ticket 104): the beat shows only while
// the learner's pick on that choice, an ask beat whose every option is an
// `option`, is that option's text. <beat> counts the step's beats from 0, as
// the saved answers' keys do.
export const WHEN = /^([WYTDC]\d*)\.(\d+)=(\S.*)$/;
// A choice: an ask beat whose every option is an `option`, so no pick on it
// is right or wrong, and none is graded.
export const isChoice = (b) =>
  b?.kind === "ask" &&
  b.options.length > 0 &&
  b.options.every((o) => o.kind === "option");
// `why`: why the lesson matters; `payoff`: the one `can` line the intro and
// complete screens flag as what the lesson builds to; `read`: one line of
// the page's Go further list, with its Markdown link, to read next. At most
// one of each. `need`: a line of the page's You need that names commands,
// shown for each one the learner's PATH lacks; the front matter's `needs`
// says which (ticket 89). `win-note`: the page's note for native Windows,
// at most one. `need-repo`: the page's You need line that asks for one of
// the learner's own repositories, naming no command, at most one; shown
// only where the lesson runs in its level's work folder and that folder is
// not the practice copy (ticket 179).
export const INTRO_KEYS = {
  minutes: true,
  can: true,
  why: true,
  payoff: true,
  read: true,
  need: true,
  "win-note": true,
  "need-repo": true,
};
// `back`, on a ladder block or a beat (ticket 192): where the step's state
// comes from, as `- back: <step id> <why>`, the why a quote of the page or
// the app's own words. A check that keeps answering the same sends the
// learner back there. A ladder's bottom line takes a `win` and a `lead-in`
// line as a beat's does.
export const LADDER_KEYS = {
  hint: true,
  bottom: true,
  win: true,
  "lead-in": true,
  back: null,
};
// The card (the c overlay): each entry a `skill` line in the app's words,
// then the page's command (`show`) and what it does (`does`). An entry shows
// once the learner finished a step on its skill.
export const CARD_KEYS = { skill: false, show: true, does: true };
const OPTION_KEYS = new Set([
  "right",
  "wrong",
  "option",
  "stuck",
  "other",
  "decoy",
]);

const levelSchema = z.strictObject({
  id: z.enum(["beginner", "intermediate", "advanced"]),
  index: z
    .string()
    .regex(/^docs\/(beginner|intermediate|advanced)\/README\.md$/),
});
const lessonSchema = z.strictObject({
  id: z.string().regex(/^[a-z]+-(?:\d+|capstone)$/),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  order: z.number().int().positive(),
  page: z.string().regex(/^docs\/.+\.md$/),
  steps: z.string().regex(/^course\/steps\/.+\.md$/),
  check: z.string().min(1),
  folder: z.enum(["work", "copy", "new-copy"]),
  slow: z.array(z.number().int().nonnegative()),
});
const manifestSchema = z
  .strictObject({
    levels: z.array(levelSchema).min(1),
    lessons: z.array(lessonSchema).min(1),
  })
  .superRefine((manifest, ctx) => {
    const levels = new Set(manifest.levels.map((level) => level.id));
    const ids = new Set();
    for (const [index, lesson] of manifest.lessons.entries()) {
      if (!levels.has(lesson.level))
        ctx.addIssue({
          code: "custom",
          path: ["lessons", index, "level"],
          message: `unknown Level ${lesson.level}`,
        });
      if (ids.has(lesson.id))
        ctx.addIssue({
          code: "custom",
          path: ["lessons", index, "id"],
          message: `duplicate Lesson ${lesson.id}`,
        });
      ids.add(lesson.id);
      if (lesson.order !== index + 1)
        ctx.addIssue({
          code: "custom",
          path: ["lessons", index, "order"],
          message: `expected ${index + 1}`,
        });
      if (lesson.steps !== `course/steps/${lesson.id}.md`)
        ctx.addIssue({
          code: "custom",
          path: ["lessons", index, "steps"],
          message: `expected course/steps/${lesson.id}.md`,
        });
      if (lesson.check !== lesson.id)
        ctx.addIssue({
          code: "custom",
          path: ["lessons", index, "check"],
          message: `expected ${lesson.id}`,
        });
      if (new Set(lesson.slow).size !== lesson.slow.length)
        ctx.addIssue({
          code: "custom",
          path: ["lessons", index, "slow"],
          message: "duplicate Check item index",
        });
    }
  });

export function parseManifest(value, file = "course/manifest.json") {
  const result = manifestSchema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw new Error(`${file}:1: ${issue.path.join(".")}: ${issue.message}`);
}

export const coursePath = (manifest) =>
  [...manifest.lessons].sort((a, b) => a.order - b.order);
export const indexLevel = (manifest, id) =>
  manifest.levels.find((level) => id === `${level.id}-index`)?.id ?? null;
export const workLevels = (manifest) =>
  manifest.levels
    .filter((level) =>
      manifest.lessons.some(
        (lesson) => lesson.level === level.id && lesson.folder === "work",
      ),
    )
    .map((level) => level.id);
export const folderKeys = (manifest) => [
  ...workLevels(manifest),
  ...coursePath(manifest)
    .filter((lesson) => lesson.folder === "new-copy")
    .map((lesson) => lesson.id),
];
export const PATH_MAX = 1024;
export const GUIDE =
  "https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know";
export const COMMANDS_URL = `${GUIDE}/blob/main/docs/reference/commands.md`;
export const indexUrl = (level) => `${GUIDE}/blob/main/docs/${level}/README.md`;

function value(raw) {
  const q = raw.match(/^"(.*)"$/);
  return q ? { text: q[1], quoted: true } : { text: raw, quoted: false };
}

// Parses one content file. Throws an Error naming the file and line on any
// line it can't read, so a broken file fails its test, not the learner.
// `context.onPageText`, when given, receives each piece of the page the file
// shows, as the parser reads it: every double-quoted value (`kind: "quote"`,
// with its `text`) and every code block (`kind: "block"`, with its `lines`),
// each with its 1-based `line`, the `heading` it sits under, and `from`, the
// Lesson or Level index a warm-up names, or null for the file's own page.
// The lesson test compares them with the pages.
export function parseLesson(text, file = "lesson", context = {}) {
  const manifest = context.manifest ?? { levels: [], lessons: [] };
  const checks = context.checks ?? {};
  const probes = context.probes ?? {
    PROBES: {},
    probeError: (name) => `unknown probe ${name}`,
  };
  const { PROBES, probeError } = probes;
  const fm = frontmatter(text);
  if (!fm) throw new Error(`${file}: no front matter`);
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((l, i) => i > 0 && l.trim() === "---") + 1;
  if ("folder" in fm.fields && context.rejectFolder) {
    const line = lines.findIndex((l) => l.startsWith("folder:"));
    throw new Error(
      `${file}:${line + 1}: folder is declared only in course/manifest.json`,
    );
  }
  if ("folder" in fm.fields && !["copy", "new copy"].includes(fm.fields.folder))
    throw new Error(
      `${file}: folder is copy or new copy, not ${fm.fields.folder}`,
    );
  // `worked: copy` runs the lesson's Worked example steps (W) in the
  // practice copy, while its Your turn steps, its Check and its
  // prerequisites stay in the level's work folder (ticket 183), as a page
  // says "In your practice copy:" over its Worked example. A pinned folder
  // already places every step, so the two never go together.
  if ("worked" in fm.fields && fm.fields.worked !== "copy")
    throw new Error(`${file}: worked is copy, not ${fm.fields.worked}`);
  if ("worked" in fm.fields && "folder" in fm.fields)
    throw new Error(
      `${file}: worked: copy with folder: ${fm.fields.folder}, which already places every step`,
    );
  const lesson = {
    ...fm.fields,
    intro: { can: [] },
    warmup: [],
    steps: [],
    ladder: [],
    card: [],
  };
  const cardLines = [];
  const needLines = [];
  let section = null;
  let step = null;
  let beat = null;
  let rung = null;
  let payoffLine = null;
  const fail = (n, msg) => {
    throw new Error(`${file}:${n + 1}: ${msg}`);
  };
  // Where a quote or block on line n sits, for onPageText: only a warm-up's
  // from line points it at another page.
  const pageText = (entry, n) => {
    const inStep = (section === "steps" || section === "warm-up") && step;
    context.onPageText?.({
      ...entry,
      line: n + 1,
      heading: inStep
        ? lines[step.line - 1].slice(4)
        : section === "ladder" && rung
          ? rung.item
          : (section ?? "front matter"),
      from: section === "warm-up" && step ? (step.from ?? null) : null,
    });
  };
  const leadIn = (bottom, text, n) => {
    if (bottom.leadIn) fail(n, "a second lead-in line on one bottom line");
    bottom.leadIn = text;
  };
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const h2 = line.match(/^## (intro|warm-up|steps|ladder|card)$/);
    if (h2) {
      section = h2[1];
      continue;
    }
    if (
      (section === "steps" || section === "warm-up") &&
      line.startsWith("### ")
    ) {
      const m = line.match(STEP_HEADING);
      if (!m) fail(i, `a step heading the app can't read: ${line}`);
      if ((section === "warm-up") !== (m[6] === "Warm-up"))
        fail(
          i,
          `a ${section === "warm-up" ? "step" : "warm-up"} heading in the ${section} section: ${line}`,
        );
      if (m[2] && m[1][0] !== PART_IDS[m[2]])
        fail(
          i,
          `a ${m[2]} step's id is ${PART_IDS[m[2]]}<n>, not ${m[1]}: ${line}`,
        );
      if (m[3] === "part" && m[2] !== "Your turn")
        fail(i, `only Your turn has parts; ${m[2]} has steps: ${line}`);
      const checked = lesson.steps.some((x) => x.part === "Check");
      if (m[2] === "Tear down" && !checked)
        fail(i, `a Tear down step only follows the Check: ${line}`);
      if (lesson.steps.at(-1)?.part === "Tear down" && m[2] !== "Tear down")
        fail(i, `only Tear down steps follow the Check: ${line}`);
      step = {
        id: m[1],
        part: m[2] ?? m[6],
        unit: m[3] ?? null,
        n: m[4] ? Number(m[4]) : null,
        of: m[5] ? Number(m[5]) : null,
        title: m[7],
        beats: [],
        line: i + 1,
      };
      (section === "warm-up" ? lesson.warmup : lesson.steps).push(step);
      beat = null;
      continue;
    }
    if (section === "ladder" && line.startsWith("### ")) {
      rung = { item: line.slice(4).trim(), narrow: [], hints: [], bottom: [] };
      lesson.ladder.push(rung);
      continue;
    }
    const narrow = line.match(/^- narrow "(.+)": (.+)$/);
    if (narrow) {
      if (section !== "ladder" || !rung)
        fail(i, "a narrow line outside a ladder block");
      rung.narrow.push({ part: narrow[1], question: narrow[2] });
      continue;
    }
    const kv = line.match(/^- ([a-z-]+): (.+)$/);
    if (!kv) fail(i, `a line the app can't read: ${line}`);
    const [, key, raw] = kv;
    const v = value(raw.trim());
    if (v.quoted) pageText({ kind: "quote", text: v.text }, i);
    if (section === "intro") {
      if (!(key in INTRO_KEYS)) fail(i, `unknown intro key ${key}`);
      if (!v.quoted) fail(i, `${key} must be a quote of the lesson`);
      if (key === "can") lesson.intro.can.push(v.text);
      else if (key === "need") needLines.push({ quote: v.text, line: i });
      else if (key in lesson.intro)
        fail(i, `a second ${key} line in the intro`);
      else lesson.intro[key] = v.text;
      if (key === "payoff") payoffLine = i;
      // The p overlay spells out the read line's address: it needs one.
      if (key === "read" && inline(v.text).filter((r) => r.url).length !== 1)
        fail(i, "a read line links one page to read, with a Markdown link");
      continue;
    }
    if (section === "card") {
      if (!(key in CARD_KEYS)) fail(i, `unknown card key ${key}`);
      if (CARD_KEYS[key] && !v.quoted)
        fail(i, `${key} must be a quote of the lesson`);
      if (!CARD_KEYS[key] && v.quoted)
        fail(i, `${key} holds the app's own words: no quotes`);
      if (key === "skill") {
        lesson.card.push({ skill: raw });
        cardLines.push(i);
      } else if (!lesson.card.length)
        fail(i, "a card line before its skill line");
      else if (key in lesson.card.at(-1))
        fail(i, `a second ${key} line in a card entry`);
      else lesson.card.at(-1)[key] = v.text;
      continue;
    }
    if (section === "ladder") {
      if (!rung) fail(i, "a ladder line before its heading");
      if (!(key in LADDER_KEYS)) fail(i, `unknown ladder key ${key}`);
      if (key === "back") {
        if (rung.back) fail(i, "a second back line in one ladder block");
        rung.back = backLine(raw, i, fail);
        if (rung.back.quoted)
          pageText({ kind: "quote", text: rung.back.text }, i);
        continue;
      }
      if (!v.quoted) fail(i, `${key} must be a quote of the lesson`);
      if (key === "hint") rung.hints.push(v.text);
      else if (key === "bottom") rung.bottom.push({ text: v.text });
      else if (!rung.bottom.length)
        fail(i, `a ${key} line with no bottom line above it`);
      else if (key === "lead-in") leadIn(rung.bottom.at(-1), v.text, i);
      else rung.bottom.at(-1).win = v.text;
      continue;
    }
    if (!["steps", "warm-up"].includes(section) || !step)
      fail(i, `a line outside a step: ${line}`);
    if (key === "beat") {
      if (!BEAT_KINDS.has(raw)) fail(i, `unknown beat kind ${raw}`);
      beat = {
        kind: raw,
        lines: [],
        options: [],
        hints: [],
        bottom: [],
        why: [],
        accept: [],
        line: i + 1,
      };
      step.beats.push(beat);
      continue;
    }
    if (!beat) {
      if (!STEP_KEYS.has(key)) fail(i, `unknown step key ${key}`);
      if (key === "from" && step.part !== "Warm-up")
        fail(i, "only a warm-up names the lesson it comes from");
      if (
        key === "from" &&
        raw.endsWith("-index") &&
        !indexLevel(manifest, raw)
      )
        fail(
          i,
          `from ${raw}: a level index is ${manifest.levels
            .map((level) => `${level.id}-index`)
            .join(", ")
            .replace(/, (?=[^,]*$)/, " or ")}`,
        );
      if (key === "optional" && v.quoted)
        fail(
          i,
          "optional holds the app's own words, saying when to skip the step: no quotes",
        );
      if (key === "optional" && ["Warm-up", "Check"].includes(step.part))
        fail(i, `a ${step.part} step can't be optional`);
      step[key] = raw;
      continue;
    }
    if (!(key in BEAT_KEYS)) fail(i, `unknown beat key ${key}`);
    if (key !== "win" && key !== "lead-in") beat.lastKey = key;
    if (BEAT_KEYS[key] === true && !v.quoted)
      fail(i, `${key} must be a quote of the lesson`);
    if (BEAT_KEYS[key] === false && v.quoted)
      fail(i, `${key} holds the app's own words: no quotes`);
    if (OPTION_KEYS.has(key)) beat.options.push({ kind: key, ...v });
    else if (key === "because") {
      const last = beat.options.at(-1);
      if (!last) fail(i, "a because line with no option above it");
      last.because = v.text;
    } else if (key === "win") {
      // A Windows line replaces the command line just above it: a run line,
      // a code block, or the last bottom line when that came last.
      const last =
        beat.lastKey === "bottom" ? beat.bottom.at(-1) : beat.lines.at(-1);
      if (beat.lastKey !== "bottom" && !["run", "code"].includes(last?.key))
        fail(i, "a win line with no run, code or bottom line above it");
      last.win = v.text;
    } else if (key === "lead-in") {
      if (beat.lastKey !== "bottom")
        fail(i, "a lead-in line with no bottom line above it");
      leadIn(beat.bottom.at(-1), v.text, i);
    } else if (key === "code") {
      if (beat.lines.some((l) => l.key === "code"))
        fail(i, "a second code block on one beat");
      if (["predict", "type"].includes(beat.kind))
        fail(
          i,
          `a code block on a ${beat.kind} beat: only a do, ask or self beat shows one`,
        );
      const open = lines[i + 1]?.match(FENCE);
      if (!open) fail(i, "a code line with no fenced block under it");
      const end = lines.findIndex((l, k) => k > i + 1 && closes(open[1], l));
      if (end < 0) fail(i, "a code block with no closing fence");
      const block = lines.slice(i + 2, end);
      pageText({ kind: "block", lines: block }, i + 1);
      if (!block.some((l) => l.trim())) fail(i, "an empty code block");
      if (block.some((l) => /<your (practice copy|repo)>/.test(l)))
        fail(
          i,
          "a code block that names <your practice copy> or <your repo>: a run line fills in the folder, a block does not",
        );
      const shows = raw.match(/^(?:lines (\d+)-(\d+) )?point (\d+)$/);
      if (!shows)
        fail(
          i,
          "a code line is [lines <first>-<last>] point <line>, the lines this beat shows and the one it explains",
        );
      const [from, to, point] = [
        Number(shows[1] ?? 1),
        Number(shows[2] ?? block.length),
        Number(shows[3]),
      ];
      if (from < 1 || to > block.length || from > to)
        fail(i, `lines ${from}-${to}: the block has ${block.length} lines`);
      if (to - from + 1 > CODE_LINES)
        fail(
          i,
          `this beat shows ${to - from + 1} lines of code; a beat shows at most ${CODE_LINES}: name the lines it shows, as lines ${from}-${from + CODE_LINES - 1}`,
        );
      if (point < from || point > to)
        fail(
          i,
          `point ${point} is not a line this beat shows (${from} to ${to})`,
        );
      beat.lines.push({
        key: "code",
        text: block.join("\n"),
        quoted: true,
        lines: block,
        from,
        to,
        point,
      });
      i = end;
    } else if (key === "back") {
      if (step.part === "Warm-up")
        fail(
          i,
          "a back line on a warm-up: only a lesson step goes back to an earlier one",
        );
      if (beat.back) fail(i, "a second back line on one beat");
      beat.back = backLine(raw, i, fail);
      if (beat.back.quoted)
        pageText({ kind: "quote", text: beat.back.text }, i);
    } else if (key === "when") {
      if (beat.when) fail(i, "a second when line on one beat");
      if (step.part === "Warm-up")
        fail(
          i,
          "a when line on a warm-up: only a lesson step follows a choice",
        );
      const m = raw.match(WHEN);
      if (!m)
        fail(
          i,
          "a when line is <step id>.<beat>=<option>: the choice, its beat counted from 0, and the option the beat shows for",
        );
      if (step.beats.length === 1)
        fail(
          i,
          "a when line on a step's first beat: the first beat always shows",
        );
      beat.when = { step: m[1], beat: Number(m[2]), option: m[3], line: i + 1 };
    } else if (key === "tick") {
      const last = beat.lines.at(-1);
      if (last?.key !== "run") fail(i, "a tick line with no run line above it");
      last.tick = raw;
    } else if (key === "hint") beat.hints.push(v.text);
    else if (key === "bottom") beat.bottom.push({ text: v.text });
    else if (key === "why") beat.why.push(v.text);
    else if (key === "accept") beat.accept.push(raw);
    else if (key === "wait") {
      if (!["do", "self"].includes(beat.kind))
        fail(
          i,
          `a wait line on the ${beat.kind} beat: only a do or self beat waits`,
        );
      if (!v.quoted && raw !== "long")
        fail(i, "a wait line is wait: long, or the page's words in quotes");
      if (beat.wait) fail(i, "a second wait line on one beat");
      beat.wait = v.quoted ? { text: v.text } : { text: null };
    } else if (
      ["goal", "say", "do", "run", "note", "rule", "after", "expect"].includes(
        key,
      )
    ) {
      // A `say` that opens "Done when" is a check's expectation in the app's
      // words, for a step whose page has none to quote: like `expect`, a done
      // beat hides it where the evidence line replaces it.
      beat.lines.push({
        key,
        text: v.text,
        quoted: v.quoted,
        ...(key === "say" && /^Done when /.test(v.text)
          ? { doneWhen: true }
          : {}),
      });
    } else beat[camel(key)] = v.text;
  }
  // A payoff that is no `can` line would flag nothing on screen.
  if (payoffLine !== null && !lesson.intro.can.includes(lesson.intro.payoff))
    fail(
      payoffLine,
      `the payoff "${lesson.intro.payoff}" is not one of the intro's can lines`,
    );
  // The front matter's line for `key`, for an error to name.
  const fmLine = (key) => {
    const i = lines.slice(0, start).findIndex((l) => l.startsWith(`${key}:`));
    return i < 0 ? null : i;
  };
  lesson.needs = needsOf(fm.fields.needs, needLines, fmLine("needs"), fail);
  lesson.requires = requiresOf(
    fm.fields.requires,
    fm.fields.lesson,
    fmLine("requires"),
    fail,
    { manifest, checks, probeError },
  );
  lesson.terminals = terminalsOf(
    fm.fields.terminals,
    fmLine("terminals"),
    fail,
  );
  lesson.card.forEach((e, k) => {
    if (!e.show || !e.does)
      fail(cardLines[k], "a card entry needs a show and a does line");
    if (!lesson.steps.some((s) => s.skill === e.skill))
      fail(
        cardLines[k],
        `the card entry's skill ${e.skill} is no step of this lesson`,
      );
  });
  for (const s of [...lesson.warmup, ...lesson.steps]) {
    if (!s.beats.length)
      throw new Error(`${file}:${s.line}: step ${s.id} has no beats`);
    for (const b of s.beats) {
      b.where = b.where ?? s.where;
      if (b.where !== undefined && !WHERE.has(b.where))
        throw new Error(`${file}:${b.line}: unknown where ${b.where}`);
      if (
        lesson.terminals &&
        NUMBERED.includes(b.where) &&
        !(b.where in lesson.terminals)
      )
        throw new Error(
          `${file}:${b.line}: where ${b.where}, which terminals doesn't number`,
        );
      b.verify = parseVerify(b, file, probes);
      if (
        b.lines.some((l) => l.doneWhen) &&
        b.verify.kind !== "check" &&
        !READS.has(b.verify.kind)
      )
        throw new Error(
          `${file}:${b.line}: a "Done when" say line needs a check beat or a beat that reads a file`,
        );
    }
  }
  // The app can't see a browser: its beat is the learner's word, or a
  // later beat of the step reads the local file it leaves (a git probe,
  // ticket 105, reads only local refs too). That later beat shows whenever
  // the browser beat does: it has no when line (104), or the same one.
  const sameWhen = (a, b) =>
    !a.when ||
    (b.when &&
      a.when.step === b.when.step &&
      a.when.beat === b.when.beat &&
      a.when.option === b.when.option);
  for (const s of lesson.steps) {
    s.beats.forEach((b, k) => {
      if (b.where !== "browser" || b.verify.kind === "self") return;
      const later = s.beats
        .slice(k + 1)
        .some(
          (x) =>
            sameWhen(x, b) &&
            (x.verify.kind === "check" ||
              READS.has(x.verify.kind) ||
              GIT.has(x.verify.kind) ||
              x.verify.kind === "probe"),
        );
      if (b.verify.kind !== "none" || !later)
        throw new Error(
          `${file}:${b.line}: a browser beat verifies with self, or with none and a later beat of its step that reads a local file`,
        );
    });
  }
  backsOf(lesson, file, checks);
  whensOf(lesson, file);
  return lesson;
}

// `terminals: [claude, claude-2, shell]` (ticket 103): each where the page
// numbers, to its terminal's number, or null without the key.
function terminalsOf(raw, at, fail) {
  if (raw === undefined) return null;
  const items = listOf(raw);
  if (!items.length) fail(at, "terminals names at least one terminal");
  const out = {};
  items.forEach((item, k) => {
    for (const w of item.trim().split(/\s+/)) {
      if (!NUMBERED.includes(w))
        fail(
          at,
          `terminals item "${item}": ${w} is none of ${NUMBERED.join(", ")}`,
        );
      if (w in out) fail(at, `terminals names ${w} twice`);
      out[w] = k + 1;
    }
  });
  return out;
}

// `back: <step id> <why>` (ticket 192): the step, then why its state is
// where this one's comes from, quoted from the page or in the app's words.
function backLine(raw, n, fail) {
  const m = raw.match(/^(\S+) (\S.*)$/);
  if (!m)
    fail(
      n,
      "a back line is a step id, then why: a quote of the page or the app's own words",
    );
  return { step: m[1], ...value(m[2].trim()), line: n + 1 };
}

// Each back line goes to an earlier step of this lesson: on a beat, before
// the beat's own step; in a ladder block, before the first step that checks
// its item, so every step that shows the item's FAIL is after it. A back to
// another lesson, to a step this lesson doesn't have, or to the step itself
// or one after it is an error, naming its line.
function backsOf(lesson, file, checks) {
  const ids = lesson.steps.map((s) => s.id);
  const check = (back, from, what) => {
    const at = `${file}:${back.line}`;
    if (/^[a-z]+-/.test(back.step))
      throw new Error(
        `${at}: back ${back.step} names another lesson: a back goes to a step of this lesson`,
      );
    if (!ids.includes(back.step))
      throw new Error(
        `${at}: back ${back.step}: this lesson has no step ${back.step}`,
      );
    if (from !== null && ids.indexOf(back.step) >= from)
      throw new Error(`${at}: back ${back.step} is not before ${what}`);
  };
  lesson.steps.forEach((s, k) =>
    s.beats.forEach(
      (b) =>
        b.back && check(b.back, k, `step ${s.id}, the step it goes back from`),
    ),
  );
  const items = checks[lesson.lesson]?.items ?? [];
  for (const rung of lesson.ladder) {
    if (!rung.back) continue;
    const item = items.findIndex((it) => it.text === rung.item);
    const first =
      item < 0
        ? -1
        : lesson.steps.findIndex((s) =>
            s.beats.some(
              (b) =>
                b.verify.kind === "check" &&
                (b.verify.all || b.verify.items.includes(item)),
            ),
          );
    check(
      rung.back,
      first < 0 ? null : first,
      `step ${lesson.steps[first]?.id}, the first step that checks this item`,
    );
  }
}

// Each when line names a choice made before its beat, in this lesson's
// steps, and one of that choice's options (ticket 104). A choice is an ask
// beat whose every option is an `option`: no pick on it is right or wrong.
function whensOf(lesson, file) {
  lesson.steps.forEach((s, k) =>
    s.beats.forEach((b, n) => {
      if (!b.when) return;
      const { step, beat, option, line } = b.when;
      const at = `${file}:${line}: when ${step}.${beat}`;
      const from = lesson.steps.findIndex((x) => x.id === step);
      if (from < 0) throw new Error(`${at}: this lesson has no step ${step}`);
      if (from > k || (from === k && beat >= n))
        throw new Error(
          `${at}: that beat is not before this one; a when follows a choice made earlier`,
        );
      const q = lesson.steps[from].beats[beat];
      if (!isChoice(q))
        throw new Error(
          `${at}: names no choice, an ask beat whose every option is an option line`,
        );
      if (!q.options.some((o) => o.text === option))
        throw new Error(
          `${at}: "${option}" is none of its options: ${q.options.map((o) => `"${o.text}"`).join(", ")}`,
        );
    }),
  );
}

// A front matter list: an inline or block list, or one item alone.
const listOf = (raw) =>
  raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];

// `needs: [jq python3, bwrap socat on linux]`: the commands the page's You
// need lists, as the app looks them up on the PATH. Each item is the
// commands the intro's need line of the same place quotes (the first item
// the first need line), and "on linux" makes them Linux only, as the
// sandbox's are. Errors name the front matter's needs line.
const COMMAND = /^[A-Za-z0-9][\w.+-]*$/;
function needsOf(raw, lines, at, fail) {
  const items = listOf(raw);
  if (items.length !== lines.length) {
    fail(
      at ?? lines[0].line,
      `needs has ${items.length} item${items.length === 1 ? "" : "s"} and the intro ${lines.length} need line${lines.length === 1 ? "" : "s"}: each item is the commands one need line quotes`,
    );
  }
  return items.map((item, k) => {
    const words = item.trim().split(/\s+/);
    const linux =
      words.length > 2 && words.at(-2) === "on" && words.at(-1) === "linux";
    const commands = linux ? words.slice(0, -2) : words;
    // "on" only opens the qualifier: "bwrap on mac" is no command list.
    const bad = commands.find((c) => c === "on" || !COMMAND.test(c));
    if (!item.trim() || bad !== undefined)
      fail(
        at,
        `needs item "${item}" is command names, then "on linux" for Linux only`,
      );
    return { commands, linux, quote: lines[k].quote };
  });
}

// `requires: [b-5 check 0, i-1 file .claude/skills/five-whys/SKILL.md]`:
// what an earlier lesson leaves that this one builds on, looked at in this
// lesson's work folder. `<lesson> check <item>` passes when that lesson's
// check item does, `<lesson> file <path>` once the file holds a line. A
// check item that starts another process (SLOW) runs only on r, so it is no
// prerequisite; a file is a file, not a folder. `probe todos <n>` (ticket
// 105) is what the work folder itself must hold, from no lesson: TODO or
// FIXME in n top-level folders. Errors name the front matter's requires line.
function requiresOf(raw, id, at, fail, { manifest, checks, probeError }) {
  const items = listOf(raw);
  const path = coursePath(manifest);
  const here = path.findIndex((entry) => entry.id === id);
  if (items.length && here < 0)
    fail(at, `requires: ${id} is no lesson on the path`);
  const before = path.slice(0, here).map((entry) => entry.id);
  const seen = new Set();
  return items.map((item) => {
    const todos = item.trim().match(/^probe todos (\S+)$/);
    if (todos) {
      if (probeError("todos", [todos[1]]))
        fail(at, `requires item "${item}": probe todos takes a count, like 2`);
      return { probe: "todos", args: [todos[1]] };
    }
    const m = item.trim().match(/^(\S+) (?:check (\d+)|file (\S+))$/);
    if (!m)
      fail(
        at,
        `requires item "${item}" is <lesson> check <item>, <lesson> file <path> or probe todos <n>`,
      );
    const [, lesson, n, file] = m;
    if (!before.includes(lesson))
      fail(at, `requires item "${item}": ${lesson} is no lesson before ${id}`);
    if (seen.has(m[0])) fail(at, `requires item "${item}" is named twice`);
    seen.add(m[0]);
    if (n !== undefined) {
      if (!checks[lesson]?.items[Number(n)])
        fail(at, `requires item "${item}": ${lesson} has no check item ${n}`);
      const required = path.find((entry) => entry.id === lesson);
      if (required?.slow.includes(Number(n)))
        fail(
          at,
          `requires item "${item}": ${lesson}'s check item ${n} starts another process, so it runs only on r`,
        );
      return { lesson, item: Number(n) };
    }
    if (!workPath(file) || file.endsWith("/"))
      fail(
        at,
        `requires item "${item}" names a file from the work folder, like .claude/settings.json, not ${file}`,
      );
    return { lesson, path: file };
  });
}

// A path named from the work folder, like src/ or .claude/settings.json:
// never ./, / or .. in it, nor a backslash.
const workPath = (path) =>
  !path.includes("\\") &&
  !path.startsWith("/") &&
  !path
    .replace(/\/$/, "")
    .split("/")
    .some((part) => ["", ".", ".."].includes(part));

// A code block (ticket 90): one fenced block of the page, for code a quote
// can't carry, such as a loop, a JSON file or a script. A beat holds one:
//
//   - code: lines 9-16 point 12
//   ```bash
//   <the page block's lines>
//   ```
//
// The fence opens on the line under the `code` line, at its first column,
// with the page's info string, and its lines are the page block's lines
// exactly, less the indent the page's fence has (three spaces inside a
// numbered step), blank lines included: the guide's quote check compares
// them with the page's blocks. A block shows on a do, ask or self beat,
// and names no <your practice copy> or <your repo>, which only a run line
// fills in.
// The `code` line is the app's own words: `point <n>` is the line the beat
// explains, counted from the block's first line, and the card marks it.
// A beat shows at most CODE_LINES lines, so a longer block names the lines
// the beat shows, `lines <first>-<last>`, which hold its point: each beat
// that explains a part of a longer block carries the whole block again,
// with its own window. A `win` line right after the block replaces it on
// native Windows, as it replaces a run line.
export const CODE_LINES = 8;
// A fence at the start of a line, three backticks or tildes or more, with
// the page's info string; it closes on a line of the same character, at
// least as long, as CommonMark has it.
const FENCE = /^(`{3,}|~{3,})([^`]*)$/;
const closes = (fence, line) => {
  const m = line.match(/^(`{3,}|~{3,})[ \t]*$/);
  return Boolean(m) && m[1][0] === fence[0] && m[1].length >= fence.length;
};

// A path a reading beat names may end in a glob, for a file whose name
// Claude picks: `*` stands for any characters and `?` for one, in the file
// name only (`file .claude/workflows/*.js fresh`). It reads the newest file
// that matches (verify.mjs matchOf), and the card shows that file's path.
export const isGlob = (path) => /[*?]/.test(path);
export const globName = (name) =>
  new RegExp(
    `^${name
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".")}$`,
  );

const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function parseVerify(beat, file, { PROBES, probeError }) {
  if (beat.kind !== "do")
    return { kind: beat.kind === "self" ? "self" : "answer" };
  const v = beat.verify ?? (beat.ask ? "answer" : "none");
  if (v === "check all") return { kind: "check", all: true };
  // `fresh`: it counts only once the beat's evidence file has changed since
  // its step opened (or since the step `since` names), so a step that redoes
  // an earlier one can't pass on what the earlier one left behind. On a match
  // or no-match, a file that only grew since then is read for what was added
  // (a no-match whole when nothing was), and a rewritten one whole.
  const fresh = v.match(/ fresh(?: since ([WYTDCR]\d*))?$/);
  const base = fresh ? v.slice(0, fresh.index) : v;
  const extra = fresh ? { fresh: true, since: fresh[1] ?? null } : {};
  // The beats that read a file themselves: its evidence is its own file.
  const own = (path) => {
    if (beat.evidence && beat.evidence !== path)
      throw new Error(
        `${file}:${beat.line}: a file check's evidence is its own file`,
      );
    if (isGlob(path.slice(0, path.lastIndexOf("/") + 1)))
      throw new Error(
        `${file}:${beat.line}: a glob goes in the file name only, like .claude/workflows/*.js, not ${path}`,
      );
    beat.evidence = path;
  };
  // `file <path>`: a file no check item covers, done once it holds a line.
  const path = base.match(/^file (\S+)$/);
  if (path) {
    own(path[1]);
    return { kind: "file", path: path[1], ...extra };
  }
  // `json <path> [<key.path>[=<value>]]`: done once the file parses, and
  // holds the key, with that value when one is given.
  const json = base.match(/^json (\S+)(?: ([^\s=]+)(?:=(.+))?)?$/);
  if (json) {
    own(json[1]);
    return {
      kind: "json",
      path: json[1],
      key: json[2] ?? null,
      value: json[3] ?? null,
      ...extra,
    };
  }
  // `match <path> <regex>`: done once a line of the file matches.
  // `no-match`: done once the file is there and no line matches. Fresh, on
  // a file that only grew, the lines are the ones added (see `fresh` above).
  const lines = base.match(/^(match|no-match) (\S+) (.+)$/);
  if (lines) {
    own(lines[2]);
    return { kind: lines[1], path: lines[2], regex: lines[3], ...extra };
  }
  // `probe <name> [args]` (ticket 105): a git probe, which the host's
  // quest/host/src/probes.mjs runs in the check child. branch-ahead is
  // always fresh: it passes once the branch moved since its step opened (or
  // the step `since` names).
  const probe = base.match(/^probe (\S+)((?: \S+)*)$/);
  if (probe) {
    const args = probe[2].split(" ").filter(Boolean);
    const error = probeError(probe[1], args);
    if (error) throw new Error(`${file}:${beat.line}: ${error}`);
    beat.watching = beat.watching ?? PROBES[probe[1]].watching;
    return {
      kind: "probe",
      name: probe[1],
      args,
      ...(PROBES[probe[1]].fresh
        ? { fresh: true, since: null, ...extra }
        : extra),
    };
  }
  if (fresh && !beat.evidence)
    throw new Error(
      `${file}:${beat.line}: a fresh check needs an evidence file`,
    );
  const check = base.match(/^check (\d+(?: \d+)*)$/);
  if (check)
    return { kind: "check", items: check[1].split(" ").map(Number), ...extra };
  if (fresh)
    throw new Error(
      `${file}:${beat.line}: only a check, a file or a probe can be fresh`,
    );
  // `head-moved [since <step>]`: HEAD is another commit than when that step
  // (by default its own) opened, and git status lists nothing.
  // `git-unchanged [since <step>]`: git status lists the same paths as then.
  const since = v.match(/^(head-moved|git-unchanged)(?: since (\S+))?$/);
  if (since) {
    if (since[2] !== undefined && !STEP_ID.test(since[2]))
      throw new Error(
        `${file}:${beat.line}: ${since[1]} since a step id, like W2, not ${since[2]}`,
      );
    return { kind: since[1], since: since[2] ?? null };
  }
  // A path git status is asked about, as it names one: from the work folder.
  const gitPath = (path) => {
    if (!workPath(path)) {
      throw new Error(
        `${file}:${beat.line}: a git path is named from the work folder, like src/ or .claude/settings.json, not ${path}`,
      );
    }
    return path;
  };
  // `git-clean <path>...`: git status lists nothing under those paths; with
  // none, nothing at all.
  const clean = v.match(/^git-clean (\S+(?: \S+)*)$/);
  if (clean)
    return { kind: "git-clean", paths: clean[1].split(" ").map(gitPath) };
  // `git-changed <path>`: git status lists something under the path.
  // `git-only <path>`: it lists something, and all of it under the path.
  const scoped = v.match(/^(git-changed|git-only) (\S+)$/);
  if (scoped) return { kind: scoped[1], path: gitPath(scoped[2]) };
  // `git-staged`: git status says a path is staged.
  if (["git-clean", "git-staged", "answer", "self", "none"].includes(v))
    return { kind: v };
  throw new Error(`${file}:${beat.line}: unknown verify value ${v}`);
}

export function fingerprint(content) {
  const steps = content.steps.map((step) => ({
    id: step.id,
    part: step.part,
    unit: step.unit,
    n: step.n,
    of: step.of,
    verification: step.beats.map((beat) => beat.verify),
  }));
  return createHash("sha256").update(JSON.stringify(steps)).digest("hex");
}

function pageMetadata(text, file) {
  const title = text.match(/^# (\S.*)$/m)?.[1];
  const minutes = text.match(/^<sub>.*? · ([^·]+) · Needs:/m)?.[1].trim();
  const stamp = text.match(/Verified against Claude Code [^<]+/)?.[0].trim();
  if (!title || !minutes || !stamp)
    throw new Error(`${file}:1: expected a title, time estimate and Stamp`);
  return { title, minutes, stamp };
}

const compiledCourseSchema = z.strictObject({
  levels: z.array(levelSchema),
  lessons: z.array(
    z.looseObject({
      id: z.string(),
      title: z.string(),
      minutes: z.string(),
      stamp: z.string(),
      next: z.string().nullable(),
      url: z.string().url(),
      stuck: z.string().url(),
      items: z.array(z.string()),
      content: z.unknown(),
      fingerprint: z.string().length(64),
      legacyFingerprint: z.string().length(64),
    }),
  ),
});

export function compileCourse(
  value,
  stepFiles,
  pages,
  { lessons: checks, probes },
) {
  const manifest = parseManifest(value);
  const path = coursePath(manifest);
  const compiled = {
    levels: manifest.levels,
    lessons: path.map((entry, at) => {
      const text = stepFiles[entry.steps];
      const page = pages[entry.page];
      if (typeof text !== "string")
        throw new Error(`${entry.steps}:1: no step-file text supplied`);
      if (typeof page !== "string")
        throw new Error(`${entry.page}:1: no page text supplied`);
      const content = parseLesson(text, entry.steps, {
        manifest,
        checks,
        probes,
        rejectFolder: true,
      });
      const metadata = pageMetadata(page, entry.page);
      if (content.lesson !== entry.id)
        throw new Error(
          `${entry.steps}:2: expected lesson ${entry.id}, not ${content.lesson}`,
        );
      if (content.stamp !== metadata.stamp)
        throw new Error(
          `${entry.steps}:3: the Stamp differs from ${entry.page}`,
        );
      const late = content.requires.find(
        (requirement) =>
          requirement.lesson &&
          !path
            .slice(0, at)
            .some((previous) => previous.id === requirement.lesson),
      );
      if (late)
        throw new Error(
          `${entry.steps}:1: requires ${late.lesson}, no lesson before ${entry.id} here`,
        );
      if (content.worked && entry.folder !== "work")
        throw new Error(
          `${entry.steps}:1: worked: copy, but ${entry.id} runs every step in ${entry.folder === "new-copy" ? "its new copy" : "the practice copy"}`,
        );
      const check = checks[entry.check];
      if (!check)
        throw new Error(
          `course/manifest.json:1: no Check module for ${entry.check}`,
        );
      for (const item of entry.slow) {
        if (!check.items[item])
          throw new Error(
            `course/manifest.json:1: ${entry.id} has no slow Check item ${item}`,
          );
      }
      const print = fingerprint(content);
      return {
        ...entry,
        ...metadata,
        newCopy: entry.folder === "new-copy",
        next: path[at + 1]?.id ?? null,
        url: `${GUIDE}/blob/main/${entry.page}`,
        stuck: `${GUIDE}/issues/new?template=lesson-feedback.yml&lesson=${entry.id}`,
        items: check.items.map((item) => item.text),
        content,
        fingerprint: print,
        legacyFingerprint: print,
      };
    }),
  };
  const result = compiledCourseSchema.safeParse(compiled);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw new Error(
    `course/course.json:1: ${issue.path.join(".")}: ${issue.message}`,
  );
}

export function generateCheckIndex(value) {
  const manifest = parseManifest(value);
  const path = coursePath(manifest);
  const alias = (id) =>
    id.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());
  const imports = path
    .map((entry) => `import * as ${alias(entry.id)} from './${entry.id}.mjs';`)
    .join("\n");
  const lessons = path
    .map((entry) => `'${entry.id}': ${alias(entry.id)}`)
    .join(", ");
  return `// Every lesson and capstone with a check, in course order.\n${imports}\n\nexport const lessons = { ${lessons} };\n`;
}
