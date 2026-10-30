// The snapshot (ticket 212): project(state) builds everything a tab shows
// from the engine's state, field by field, as the contract's Snapshot
// (quest/contract/src/snapshot.ts) less its header, which the host adds.
// Pure, and the same for the same state: a tick changes nothing here.
//
// Left out: saved stamps, earlier answers but the one on screen, raw check
// output beyond the verification lines (a FAIL message, an item's text, the
// engine's lines about a file or git status), every path but the practice
// copy and the Work folders, an option's kind before it is answered, a
// typed beat's accepted answers, the hints not yet shown, and the engine's
// counters. The rules render.mjs decided until ticket 210 are here as
// fields: the warm-up explainer, notch-harder, the on-card Why, the Windows
// variants, the handover and the invitation.
import { READS } from "./content.mjs";
import { cleanLine } from "./status.mjs";
import {
  asksFolder,
  asksHere,
  asStarted,
  authoredTier,
  backOffered,
  beatOf,
  cardOf,
  contentOf,
  doneBefore,
  folderKey,
  folderOf,
  folderProblem,
  hidesRuns,
  hintAvailable,
  hintStatus,
  isDone,
  isLastBeat,
  lessonNumber,
  lessonOf,
  levelFolder,
  levelKey,
  levelLessons,
  levelOf,
  levelsOf,
  missingNeeds,
  moreHelpGives,
  nextLessonOf,
  offered,
  pickWarmups,
  pinOf,
  repoNeed,
  ruleTiers,
  rungsOf,
  stepNote,
  stepOf,
  stepsOf,
  tearDownLeft,
  tierOf,
  tiersOf,
  toFinish,
  tryFirst,
  unmet,
  whileRunsOf,
} from "./engine.mjs";
import { mix, TIERS } from "./tiers.mjs";

/** The snapshot of `s`, but its instance, revision and milestones. */
export function project(s) {
  return {
    course: courseView(s),
    learner: learnerView(s),
    lesson: activeLesson(s),
  };
}

/**
 * The lesson a reduce from `prev` to `next` starts playing, or null: one
 * that begins playing, from another lesson or from a screen that was not
 * play (its overview, its end). The host lapses the pending milestones of
 * any other lesson then.
 */
export function startedLesson(prev, next) {
  if (next.phase !== "playing") return null;
  const was = prev.phase === "playing" || prev.phase === "step-down";
  return next.lesson !== prev.lesson || !was ? next.lesson : null;
}

// ---- the course --------------------------------------------------------------
function courseView(s) {
  return {
    levels: levelsOf(s).map((level) => {
      const lessons = levelLessons(s, level);
      return {
        id: level,
        complete: lessons.every((l) => s.progress[l.id].complete),
        lessons: lessons.map((l) => summary(s, l)),
      };
    }),
    next: s.course.find((l) => l.content && toFinish(s, l))?.id ?? null,
  };
}

function summary(s, l) {
  return {
    id: l.id,
    number: lessonNumber(s, l.id),
    title: l.title ?? l.content?.title ?? l.id,
    minutes: l.minutes ?? "",
    page: l.page ?? "",
    capstone: l.id.endsWith("capstone"),
    complete: s.progress[l.id].complete,
    badge: l.content?.badge ?? null,
    folder: folderNeed(s, l),
    tearDownLeft: tearDownLeft(s, l.id),
  };
}

// Where a lesson runs: Beginner's practice copy, its level's work folder,
// its own new copy of the template, or the copy where its level has a work
// folder (i-capstone).
function folderNeed(s, l) {
  if (pinOf(l) === "new copy")
    return { kind: "new-copy", lesson: l.id, set: Boolean(s.folders[l.id]) };
  const level = levelKey(s, l.id);
  if (!level) return { kind: "copy" };
  if (!folderKey(s, l.id)) return { kind: "pinned" };
  return { kind: "work", level, set: level in s.folders };
}

// ---- the Learner -------------------------------------------------------------
const firstName = (name) =>
  String(name ?? "")
    .trim()
    .split(/\s+/)[0] || null;

function learnerView(s) {
  return {
    welcomed: s.welcomed,
    name: firstName(s.facts.name),
    practiceCopy: s.facts.root,
    workFolders: Object.entries(s.folders).map(([key, path]) => ({
      key,
      path,
    })),
    card: cardOf(s).map(({ skill, show, does, lesson }) => ({
      skill,
      show,
      does,
      lesson,
    })),
    mastery: masteryOf(s),
    windows: Boolean(s.facts.win32),
    // Progress is saved only while root `.practice/` exists, and never over
    // a save that could not be moved aside (ticket 213).
    saving: Boolean(s.facts.practiceDir) && !s.facts.saveKept,
  };
}

// Each skill's Mastery (ticket 213): the help the latest finished step on
// it used, by its saved time, and on a tie the later step in course order.
// Only skills with a step finished since help was saved, and only steps the
// lessons still have: a beat's own skill counts for nothing here.
function masteryOf(s) {
  const mastery = {};
  for (const l of s.course) {
    const help = s.progress[l.id].help ?? {};
    for (const step of l.content?.steps ?? []) {
      const h = help[step.id];
      if (h && !(mastery[step.skill]?.at > h.at))
        mastery[step.skill] = { used: h.used, at: h.at };
    }
  }
  return mastery;
}

// ---- the active lesson -------------------------------------------------------
function activeLesson(s) {
  const l = lessonOf(s);
  const head = {
    id: l.id,
    title: l.title ?? l.content?.title ?? l.id,
    level: l.level,
    capstone: l.id.endsWith("capstone"),
  };
  if (s.phase === "playing" && contentOf(s)) return playingOf(s, head);
  if (s.phase === "step-down") return stepDownOf(s, head);
  if (s.phase === "complete") return completeOf(s, head);
  return overviewOf(s, head);
}

const stairs = (steps, tiers) =>
  steps.map((x, i) => ({ part: x.part, tier: tiers[i] }));

// The steps and tiers the overview's start will play: with the warm-ups it
// would pick, and the help as planned or with less help.
function planOf(s, lessHelp) {
  const st = asStarted(s);
  const p = st.progress[s.lesson];
  p.lessHelp = lessHelp;
  p.warm = pickWarmups(s);
  return stairs(stepsOf(st), tiersOf(st));
}

function overviewOf(s, head) {
  const c = contentOf(s);
  // A lesson with no lesson file: never opened, so there is nothing to say.
  if (!c)
    return {
      ...head,
      phase: "overview",
      intro: null,
      staircase: { planned: [], less: null },
      notes: [],
      folderQuestion: null,
      start: null,
      resumable: false,
    };
  const p = s.progress[s.lesson];
  const planned = planOf(s, false);
  const less = planOf(s, true);
  const lessDiffers = JSON.stringify(less) !== JSON.stringify(planned);
  return {
    ...head,
    phase: "overview",
    intro: {
      can: [...(c.intro.can ?? [])],
      payoff: c.intro.payoff ?? null,
      why: c.intro.why ?? null,
      read: c.intro.read ?? null,
    },
    staircase: { planned, less: lessDiffers ? less : null },
    notes: notesOf(s, c),
    folderQuestion: folderQuestionOf(s),
    start: asksFolder(s)
      ? null
      : { planned: true, less: lessDiffers, first: offered(s) },
    resumable: Boolean(p.step),
  };
}

// The intro's notes: that the lesson's steps changed since it was started
// (ticket 213), then, in introNotes' order, the work folder's problem, the
// page's line for the Learner's repository, on Windows the page's note,
// the commands missing, and each prerequisite that failed.
function notesOf(s, c) {
  const notes = [];
  if (s.changed.includes(s.lesson)) notes.push({ kind: "changed" });
  const problem = asksFolder(s) ? null : folderProblem(s);
  if (problem) notes.push({ kind: "folder-problem", problem });
  const repo = repoNeed(s);
  if (repo) notes.push({ kind: "need-repo", text: repo });
  if (s.facts.win32 && c.intro["win-note"])
    notes.push({ kind: "win-note", text: c.intro["win-note"] });
  for (const n of missingNeeds(s))
    notes.push({ kind: "need", quote: n.quote, missing: [...n.names] });
  for (const r of unmet(s))
    notes.push({
      kind: "unmet",
      line: r.hint ?? "",
      lesson: r.offer ? r.lesson : null,
    });
  return notes;
}

function folderQuestionOf(s) {
  if (!asksHere(s)) return null;
  const key = folderKey(s);
  const ask = s.folderAsk?.key === key ? s.folderAsk : null;
  return {
    key,
    asks: key === levelOf(s) ? "work" : "new-copy",
    current: s.folders[key] ?? null,
    problem: ask?.missing ? "missing" : ask?.isCopy ? "is-copy" : null,
    open: asksFolder(s) || Boolean(ask),
    checking: Boolean(ask?.asked),
  };
}

// ---- play --------------------------------------------------------------------
const NO_HINTS = {
  shown: [],
  available: false,
  unavailable: null,
  confirmExact: false,
};

function playingOf(s, head) {
  const p = s.progress[s.lesson];
  const steps = stepsOf(s);
  const tiers = tiersOf(s);
  const current = s.beat ? s.pos.step : steps.findIndex((x) => x.id === p.step);
  // A step counts as passed once its last beat is done, by any route.
  const passedNow = Boolean(s.beat) && isDone(s.beat) && isLastBeat(s);
  const list = steps.map((x, i) => ({
    id: x.id,
    part: x.part,
    title: x.title,
    tier: tiers[i],
    state:
      i === current
        ? passedNow
          ? "done"
          : "current"
        : p.done.includes(x.id)
          ? "done"
          : "todo",
    optional: Boolean(x.optional),
  }));
  if (!s.beat)
    return {
      ...head,
      phase: "playing",
      steps: list,
      step: null,
      beat: null,
      hints: NO_HINTS,
      offers: { back: null, skip: null },
      waitQuestion: null,
    };
  const step = stepOf(s);
  const st = s.beat;
  const back = backOffered(s);
  const yesNo = Boolean(st.confirm) && !isDone(st);
  return {
    ...head,
    phase: "playing",
    steps: list,
    step: stepView(s),
    beat: beatView(s),
    hints: hintsView(s),
    offers: {
      back: back ? { to: back.step, title: back.title, why: back.text } : null,
      skip: step.optional && !yesNo ? { when: step.optional } : null,
    },
    waitQuestion: waitQuestionOf(s),
  };
}

// The Level's first warm-up the Learner plays (the warm-up explainer): the
// lesson's first step, a warm-up, while no other lesson of its Level played
// one. Each lesson's saved `warm` says what it played.
const firstWarmupOfLevel = (s) =>
  s.pos.step === 0 &&
  !levelLessons(s, levelOf(s)).some(
    (l) => l.id !== s.lesson && s.progress[l.id]?.warm.length,
  );

const TERMINALS = new Set(["terminal", "claude", "claude-2", "shell"]);
const WHERE = new Set([...TERMINALS, "editor", "browser"]);

function stepView(s) {
  const step = stepOf(s);
  const beat = beatOf(s);
  const p = s.progress[s.lesson];
  const warmup = step.part === "Warm-up";
  return {
    index: s.pos.step,
    id: step.id,
    part: step.part,
    title: step.title,
    tier: tierOf(s),
    authoredTier: authoredTier(s),
    where: whereOf(s, step, beat),
    note: stepNote(s),
    doneBefore: !warmup && doneBefore(s),
    extraHelp: Boolean(p.easedSteps[step.id]),
    warmup: warmup
      ? { from: step.from, explainer: firstWarmupOfLevel(s) }
      : null,
  };
}

// Where the beat's work happens, with the terminal's number where the page
// numbers them, and the folder a terminal runs in where the lesson has a
// work folder: that folder, or the practice copy for a step that runs
// there (a Worked example, ticket 183, or a command that names <your
// repo>, run from the copy). Null where everything is in the copy.
function whereOf(s, step, beat) {
  const kind = beat.where ?? step.where ?? null;
  if (!WHERE.has(kind)) return null;
  return {
    kind,
    terminal: contentOf(s).terminals?.[kind] ?? null,
    folder: TERMINALS.has(kind) ? placeOf(s, step, beat) : null,
  };
}

function placeOf(s, step, beat) {
  const dir = folderOf(s, s.lesson, step);
  if (!dir) return null;
  const root = s.facts.root;
  const level = levelKey(s);
  const levelDir = level ? levelFolder(s, level) : root;
  const fromCopy = [...beat.lines, ...beat.bottom].some((l) =>
    l.text?.includes("<your repo>"),
  );
  if (dir !== root && !fromCopy) return dir;
  return dir !== root || levelDir !== root ? root : null;
}

// The practice copy's folder in a command, quoted where the shell needs it,
// and the lesson's work folder for <your repo> (ticket 86).
function quotePath(path, win32) {
  if (/^[\w@%+=:,./~\\-]+$/.test(path)) return path;
  return win32 ? `"${path}"` : `'${path.replace(/'/g, "'\\''")}'`;
}
function fill(s, text) {
  const win32 = Boolean(s.facts.win32);
  const out = text.replace(
    "<your practice copy>",
    quotePath(s.facts.root, win32),
  );
  const dir = folderOf(s);
  return dir ? out.replace("<your repo>", quotePath(dir, win32)) : out;
}
// A command for this platform: its Windows line on native Windows.
const commandOf = (s, line) =>
  (s.facts.win32 && line.win) || fill(s, line.text);

const codeView = (line) => ({
  lines: line.lines
    .slice(line.from - 1, line.to)
    .map((text, k) => ({ n: line.from + k, text })),
  point: line.point ?? null,
  copy: line.text,
});

// A beat whose check is about a file: a check item, or a file read here.
const looksAtFile = (beat) =>
  beat.verify.kind === "check" || READS.has(beat.verify.kind);

function beatView(s) {
  const beat = beatOf(s);
  const st = s.beat;
  const hide = hidesRuns(s);
  const win32 = Boolean(s.facts.win32);
  const lines = [];
  let code = null;
  for (const l of beat.lines) {
    // A guess shows only its notes before the question.
    if (beat.kind === "predict" && l.key !== "note") continue;
    if (l.key === "run") {
      if (hide) continue;
      // A command ticks only where the app watched the Learner run it: a
      // done beat that looks at a file, or the live .practice/ tick.
      const watched =
        (st.status === "done" && looksAtFile(beat)) ||
        (l.tick === "practice-dir" && Boolean(s.facts.practiceDir));
      lines.push({ kind: "run", text: commandOf(s, l), watched });
    } else if (l.key === "code") {
      if (hide) continue;
      // On Windows a block's win line stands in for it.
      if (win32 && l.win) lines.push({ kind: "run", text: l.win });
      else code ??= codeView(l);
    } else
      lines.push({
        kind: l.key,
        text: l.text,
        ...(l.doneWhen || (l.key === "expect" && looksAtFile(beat))
          ? { doneWhen: true }
          : {}),
      });
  }
  const tier = tierOf(s);
  const answered = Boolean(st.answer);
  const f = st.feedback;
  return {
    index: s.pos.beat,
    kind: beat.kind,
    last: isLastBeat(s),
    lines,
    code,
    commandsInHints:
      hide && beat.lines.some((l) => ["run", "code"].includes(l.key)),
    ask: beat.ask ?? null,
    self: beat.self ?? null,
    doneLabel: beat.doneLabel ?? null,
    wait: beat.wait ? { text: beat.wait.text ?? null } : null,
    why: {
      onCard:
        tier === "guided" &&
        ["do", "ask"].includes(beat.kind) &&
        beat.why.length > 0
          ? beat.why[0]
          : null,
      all: [...beat.why],
    },
    winNote: win32 && beat.winNote ? beat.winNote : null,
    codespace: st.codespace ? (beat.codespace ?? null) : null,
    // A typed beat's options are its known wrong answers: never shown.
    options:
      beat.kind === "type"
        ? []
        : beat.options.map((o, i) => {
            const shown =
              answered || st.wrongs.includes(i) || st.answer?.index === i;
            return {
              text: o.text,
              ...(shown
                ? { kind: o.kind, ...(o.because ? { because: o.because } : {}) }
                : {}),
            };
          }),
    answer: {
      picked: st.answer?.index ?? null,
      feedback: f?.kind ?? null,
      because: f?.because ?? f?.hint ?? null,
      point: f?.point ?? null,
      reveal: beat.ask && isDone(st) ? (beat.reveal ?? null) : null,
      recall: recallOf(s, beat),
    },
    status: st.status === "opening" ? "checking" : st.status,
    running: st.status === "opening" ? (st.running ?? null) : null,
    checking:
      st.status === "opening" ? (beat.watching ?? beat.evidence ?? null) : null,
    verification: verificationOf(s, beat),
    evidence: st.evidence ?? null,
    found: st.found ?? null,
    fail:
      hintStatus(st) === "fail" && st.fail
        ? (st.fail.hint ?? cleanLine(beat.verify, st.fail.paths ?? []))
        : null,
    broken: st.status === "broken" ? brokenKind(st.error) : null,
    same: Boolean(st.same),
    slowWait: Boolean(st.slowWait),
    stale: Boolean(st.stale),
  };
}

// The guess a question recalls (ticket 104): the saved pick on a predict
// beat of the step its recall line names. The one earlier answer a
// snapshot carries.
function recallOf(s, beat) {
  if (!beat.recall) return null;
  const guessed = stepsOf(s).find((x) => x.id === beat.recall)?.beats ?? [];
  const hit = Object.entries(s.progress[s.lesson].answers).find(
    ([k]) =>
      k.startsWith(`${beat.recall}.`) &&
      guessed[Number(k.slice(k.lastIndexOf(".") + 1))]?.kind === "predict",
  );
  return hit ? hit[1] : null;
}

// The check items of the beat's last result, as their text and whether each
// passed: the run that passed a whole check, else the latest. A slow item a
// run left out is not shown as failing.
function verificationOf(s, beat) {
  const v = beat.verify;
  if (v.kind !== "check") return [];
  const items = s.beat.passed ?? s.checks[s.lesson]?.items ?? [];
  return items
    .filter((it) => (v.all || v.items.includes(it.index)) && !it.slow)
    .map((it) => ({ text: it.text, pass: Boolean(it.pass) }));
}

// Why a Check could not run, from the host's message: it ran out of time,
// it printed too much or not what was expected, or anything else.
function brokenKind(message) {
  if (message === "it took too long") return "timeout";
  if (
    ["it printed too much", "it printed something unexpected"].includes(message)
  )
    return "output";
  return "crashed";
}

function hintView(s, r) {
  if (r.kind !== "bottom") return { kind: r.kind, text: r.text };
  return {
    kind: "exact",
    commands: r.lines.map((b) =>
      b.key === "code" && !(s.facts.win32 && b.win)
        ? { leadIn: b.leadIn ?? null, text: b.text, code: codeView(b) }
        : { leadIn: b.leadIn ?? null, text: commandOf(s, b), code: null },
    ),
  };
}

function hintsView(s) {
  const st = s.beat;
  if (isDone(st)) return NO_HINTS;
  const rungs = rungsOf(s);
  const available = hintAvailable(s);
  const left = rungs.length > 0 && st.rung < rungs.length - 1;
  const first = tryFirst(s);
  const waits =
    !available &&
    left &&
    beatOf(s).kind !== "type" &&
    tierOf(s) === "challenge" &&
    first !== null &&
    !st.unlocked;
  return {
    shown: rungs.slice(0, st.rung + 1).map((r) => hintView(s, r)),
    available,
    unavailable: waits ? (first === "r" ? "run-check" : "pick-answer") : null,
    confirmExact: Boolean(st.confirm),
  };
}

function waitQuestionOf(s) {
  const box = whileRunsOf(s);
  if (!box) return null;
  const { beat, answer } = box;
  const picked = answer === null ? null : beat.options[answer];
  return {
    prompt: beat.ask,
    options: beat.options.map((o, i) =>
      answer !== null && (o.kind === "right" || i === answer)
        ? { text: o.text, kind: o.kind === "right" ? "right" : "wrong" }
        : { text: o.text },
    ),
    answered: answer,
    words:
      picked === null
        ? null
        : picked.kind !== "right" && picked.because
          ? picked.because
          : (beat.reveal ?? null),
  };
}

// ---- a Step-down and the lesson's end ----------------------------------------
const byTier = (tiers) =>
  TIERS.map((tier) => ({
    tier,
    count: tiers.filter((t) => t === tier).length,
  })).filter((x) => x.count > 0);

function stepDownOf(s, head) {
  const steps = stepsOf(s);
  const tiers = tiersOf(s);
  return {
    ...head,
    phase: "step-down",
    from: s.levelFrom,
    to: s.levelTo,
    toCome: byTier(
      tiers.filter((_, i) => i >= s.pos.step && steps[i].part !== "Warm-up"),
    ),
    moreHelp: moreHelpGives(s),
  };
}

// The share of a lesson's planned steps above Guided.
function lessHelpShare(s, id) {
  const m = mix(
    ruleTiers(
      s.course.map((l) => l.content),
      s.course.findIndex((l) => l.id === id),
    ),
  );
  return (m[1] + m[2]) / (m[0] + m[1] + m[2] || 1);
}

// "A notch harder" (ticket 186): the next lesson is in the same Level, has
// a lesson file, and plans a larger share of steps above Guided. Help fades
// within a Level, so a next Level's first lesson never is.
const notchHarder = (s, next) =>
  Boolean(next.content) &&
  levelOf(s, next.id) === levelOf(s) &&
  lessHelpShare(s, next.id) > lessHelpShare(s, s.lesson);

function completeOf(s, head) {
  const c = contentOf(s);
  const p = s.progress[s.lesson];
  const steps = stepsOf(s);
  const tiers = tiersOf(s);
  const skills = [
    ...new Set(
      steps
        .filter((x) => x.part !== "Warm-up" && p.done.includes(x.id))
        .map((x) => x.skill),
    ),
  ];
  const next = nextLessonOf(s);
  const mastery = masteryOf(s);
  return {
    ...head,
    phase: "complete",
    practised: skills.map((skill) => ({
      skill,
      mastery: mastery[skill] ?? null,
    })),
    badge: c?.badge ?? null,
    firstTime: s.firstCompletion === s.lesson,
    checkSummary: (s.checks[s.lesson]?.items ?? [])
      .filter((it) => !it.slow)
      .map((it) => ({ text: it.text, pass: Boolean(it.pass) })),
    staircase: stairs(steps, tiers).filter((x) => x.part !== "Warm-up"),
    handover: head.capstone && p.bottomAt === null,
    invitation: head.capstone,
    next: next?.content
      ? {
          id: next.id,
          title: next.title ?? next.content.title ?? next.id,
          notchHarder: notchHarder(s, next),
        }
      : null,
  };
}
