// The lesson engine (ticket 207): every transition of a lesson, as a pure
// function: reduce(state, input) returns { state, effects, events }, the
// events being the moments the input marked (moments.ts). Its
// inputs are Learner actions (ACTION_TYPES), the results of its own effects
// and clock ticks; its effects (EFFECT_TYPES) ask the wiring to run a
// check, read git status or a file, look at a folder or save progress, and
// their results come back as inputs. Nothing here reads a file or a clock,
// and nothing outside this package is imported but the Checks the course
// is parsed with (no module that reads a file): what a screen shows is the
// client's.
import type {
  EngineAction,
  FolderKey,
  HelpTier,
  LessonId,
} from "@quest/contract";
import {
  fingerprint,
  GIT,
  isChoice,
  isGitVerify,
  isReadVerify,
  must,
  READS,
  SINCE_GIT,
  type Back,
  type Beat,
  type Bottom,
  type CodeLine,
  type LessonContent,
  type Step,
} from "./content.ts";
import { evidenceOf, grewFrom, judge } from "./holds.ts";
import { EVENT_TYPES, momentsOf } from "./moments.ts";
import {
  cleanListed,
  eachFile,
  judgeGit,
  needsChange,
  statusStamp,
  type GitResult,
} from "./status.ts";
import { effectiveTier, ruleTiers, TIERS } from "./tiers.ts";
import type {
  ActionHandlers,
  BeatState,
  CardState,
  CourseEntry,
  Effect,
  EngineInput,
  EngineState,
  Facts,
  Failing,
  HelpUsed,
  HintRung,
  HostInput,
  HostInputOf,
  LessonProgress,
  Outcome,
  SavedProgress,
  Watch,
} from "./types.ts";
export { ruleTiers };

import { TYPED_MAX, WARMUPS } from "./rules.ts";

export { EVENT_TYPES, TYPED_MAX, WARMUPS };

export const IDLE_MS = 120_000;
// The help a finished step used (ticket 213), least first: on the Learner's
// own, with hints, or with every command shown. Saved per step, and a
// skill's Mastery.
export const HELP_USED = [
  "own",
  "hints",
  "commands",
] as const satisfies readonly HelpUsed[];

// The effects the engine asks for.
export const EFFECT_TYPES = [
  "save",
  "check",
  "file",
  "git",
  "probe",
  "stamp",
  "folder",
  "prereqs",
  "commands",
] as const satisfies readonly Effect["type"][];
// Every field of the engine's state. `levelTo` and `levelFrom` come with
// the first step-down.
export const ENGINE_FIELDS = [
  "course",
  "facts",
  "progress",
  "eased",
  "missed",
  "welcomed",
  "folders",
  "now",
  "missedNow",
  "answeredNow",
  "whileShown",
  "lesson",
  "phase",
  "pos",
  "beat",
  "levelTo",
  "levelFrom",
  "checks",
  "git",
  "session",
  "lastActivity",
  "asks",
  "probes",
  "commands",
  "prereqs",
  "prereqAsks",
  "folderAnswered",
  "folderAsk",
  "firstCompletion",
  "epoch",
  "stepHelp",
  "changed",
];

const clone = <T>(x: T): T => structuredClone(x);
const blankProgress = (): LessonProgress => ({
  step: null,
  beat: 0,
  done: [],
  answers: {},
  levels: [],
  lessHelp: false,
  moreHelpAt: null,
  easedSteps: {},
  complete: false,
  warm: [],
  recalled: [],
  stamps: {},
  bottomAt: null,
});
export const sameJson = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

// A lesson's fingerprints (ticket 213): its steps' as the course has them
// now, and what a save with none was started under, the course file's
// legacy fingerprint, the Terminal app's last version of the lesson. Where
// the content is not the course file's own (a test's), the legacy is now's.
const printsOf = (l: CourseEntry, content: LessonContent) => {
  const current = fingerprint(content);
  return {
    current,
    legacy:
      l.fingerprint === current && l.legacyFingerprint
        ? l.legacyFingerprint
        : current,
  };
};

export function initialState({
  course,
  saved = null,
  facts,
  now = 0,
  epoch = 0,
}: {
  course: CourseEntry[];
  saved?: SavedProgress | null;
  facts: Facts;
  now?: number;
  epoch?: number;
}): EngineState {
  const progress: Record<LessonId, LessonProgress> = {};
  // The lessons whose steps changed since the Learner started them, and of
  // those the ones the Learner had a step open in.
  const changed: LessonId[] = [];
  const placed = new Set<LessonId>();
  for (const l of course) {
    const p = saved?.lessons?.[l.id];
    const pr: LessonProgress = { ...blankProgress(), ...(p ?? {}) };
    progress[l.id] = pr;
    const { content } = l;
    if (!content) continue;
    const { current, legacy } = printsOf(l, content);
    // A lesson started under other steps starts again at its overview,
    // keeping its Badge and the help its steps used. A finished one keeps
    // the ticks of the steps it still has too, so its card entries and the
    // help that fades after it stay; with only its ticks it says nothing,
    // as nothing of its place is lost.
    if ((pr.step || pr.done.length) && (pr.fingerprint ?? legacy) !== current) {
      if (pr.step || !pr.complete) changed.push(l.id);
      if (pr.step) placed.add(l.id);
      progress[l.id] = {
        ...blankProgress(),
        complete: pr.complete,
        done: pr.complete
          ? pr.done.filter((id) => content.steps.some((x) => x.id === id))
          : [],
        ...(pr.help && { help: pr.help }),
      };
      continue;
    }
    // The same steps: what the save holds is still put in order, as a
    // hand-edited file may hold any ids. Warm-ups are not in the
    // fingerprint.
    pr.warm = pr.warm.filter((id) => content.warmup.some((w) => w.id === id));
    pr.recalled = pr.recalled.filter((id) =>
      content.warmup.some((w) => w.id === id),
    );
    const steps = playOrder(content, pr);
    const ids = new Set(steps.map((s) => s.id));
    pr.done = pr.done.filter((id) => ids.has(id));
    if (pr.moreHelpAt === null || !ids.has(pr.moreHelpAt)) pr.moreHelpAt = null;
    const step = steps.find((x) => x.id === pr.step);
    if (!step) Object.assign(pr, { step: null, beat: 0 });
    else if (!(pr.beat >= 0 && pr.beat < step.beats.length)) pr.beat = 0;
    else if (!beatShown(pr, must(step.beats[pr.beat], "a saved beat")))
      pr.beat = shownBefore(pr, step, pr.beat);
  }
  // A lesson the Learner was in the middle of that changed opens at its
  // overview, with its note.
  // Every lesson of the course has its progress now.
  const of = (l: CourseEntry) =>
    must(progress[l.id], `no progress for ${l.id}`);
  const open =
    course.find((l) => placed.has(l.id) && !of(l).complete) ??
    course.find((l) => l.content && of(l).step && !of(l).complete) ??
    course.find((l) => l.content && !of(l).complete);
  const folders = { ...(saved?.folders ?? {}) };
  // Every lesson in the app is done: open the map at the next lesson, or
  // where only lessons that run in a new copy with no folder saved are left,
  // at the first of them.
  const next = must(
    open ??
      course.find((l) => toFinish({ progress, folders }, l)) ??
      course.find((l) => !of(l).complete) ??
      course[0],
    "a course with no lesson",
  );
  const welcomed = Boolean(saved?.welcomed);
  const eased = saved?.eased ?? [];
  // A warm-up the learner quit on with its skill eased was most likely missed
  // just before: its answer was shown, so asking it again recalls nothing.
  const answeredNow: string[] = [];
  for (const l of course) {
    const pr = of(l);
    const w = l.content?.warmup.find(
      (x) => x.id === pr.step && pr.warm.includes(x.id),
    );
    if (w && eased.includes(w.beats[pr.beat]?.skill ?? w.skill))
      answeredNow.push(`${l.id}.${w.id}`);
  }
  const p = of(next);
  return {
    course,
    facts,
    progress,
    now,
    eased,
    missed: saved?.missed ?? [],
    missedNow: [],
    answeredNow,
    // The warm-ups a long wait's box asked in this sitting (ticket 150), in
    // memory only: `lesson.id`.
    whileShown: [],
    welcomed,
    // The Learner's place: the active lesson and its phase, 'overview',
    // 'playing' (a resume waits there with no beat open until the lesson
    // opens), 'step-down' or 'complete'.
    lesson: next.id,
    phase: next.content && p.step ? "playing" : "overview",
    pos: { step: 0, beat: 0 },
    beat: null,
    checks: {},
    git: null,
    session: 0,
    lastActivity: now,
    // How many times r asked for a run, in memory: each r's number goes out
    // on its effect and comes back on its result (`asked`).
    asks: 0,
    // The work folders the learner chose, saved (folderOf reads them), and
    // what the app found in each folder it looked at, in memory.
    folders,
    probes: {},
    // The folder answer being checked: whose folder it is, the folder it
    // last found missing, and the number of the ask the host is looking at, in
    // memory.
    folderAsk: null,
    // The lesson whose intro took the answer, which then shows it, in memory.
    folderAnswered: null,
    // What the host found on the PATH, { command: true or false }, and, for
    // each lesson, the folder its prerequisites were looked at in and what
    // each one came to, { dir, met: { index: { pass, hint, asked } } }, with
    // the number of the latest ask for them: in memory.
    commands: {},
    prereqs: {},
    prereqAsks: 0,
    // The lesson whose end on screen is its first completion, for Lesson
    // complete's first time (ticket 212), in memory.
    firstCompletion: null,
    // The wall clock, in epoch milliseconds, as the host stamps each input:
    // when a finished step's help is saved (ticket 213).
    epoch,
    // The help each step used so far in this play of its lesson, in
    // memory: { "<lesson> <step>": used }, kept through back, revisit and
    // other lessons, cleared as the lesson starts. The tier and an exact
    // command taken count when it finishes.
    stepHelp: {},
    // The lessons whose steps changed since the Learner started them, each
    // overview's note until it starts again, in memory.
    changed,
  };
}

// Where the Learner is (ticket 207): on a step card or on an overview. The
// engine watches the active step on every screen the client shows. A lesson
// with no lesson file is never opened (ticket 212 removed its check-only
// screen): it only sits in the course.
export const onCard = (s: EngineState): s is CardState =>
  s.phase === "playing" && Boolean(s.beat);
const inOverview = (s: EngineState) =>
  s.phase === "overview" && Boolean(contentOf(s));

// ---- lookups -----------------------------------------------------------------
export const lessonOf = (s: EngineState, id: LessonId = s.lesson) =>
  s.course.find((l) => l.id === id);
// A lesson the course has, where the caller knows it does.
export const lessonIn = (s: EngineState, id: LessonId = s.lesson) =>
  must(lessonOf(s, id), `no lesson ${id} in the course`);
// A lesson's progress: every lesson of the course has one.
export const progressOf = (s: EngineState, id: LessonId = s.lesson) =>
  must(s.progress[id], `no progress for ${id}`);
// A lesson's level, from its PATH entry: 'beginner' for b-2.
export const levelOf = (s: EngineState, id: LessonId = s.lesson) =>
  lessonOf(s, id)?.level;
// The lessons of a level, in course order, capstone last.
export const levelLessons = (s: EngineState, level: string | undefined) =>
  s.course.filter((l) => l.level === level);
// The course's levels, in course order.
export const levelsOf = (s: EngineState) => [
  ...new Set(s.course.map((l) => l.level)),
];
// A lesson's number within its level, as its page says "Lesson 2 of 8".
export const lessonNumber = (s: EngineState, id: LessonId = s.lesson) =>
  levelLessons(s, levelOf(s, id)).findIndex((l) => l.id === id) + 1;
export const contentOf = (s: EngineState, id: LessonId = s.lesson) =>
  lessonOf(s, id)?.content;
// Where a lesson pins its folder: 'copy', the practice copy whatever its
// level's work folder is (i-capstone), or 'new copy', the new copy of the
// template it asks for (a-5, a-capstone). Its lesson file's front matter
// says so, or, while it has none, its PATH entry.
export const pinOf = (l: CourseEntry) =>
  l.content?.folder ?? l.folder ?? (l.newCopy ? "new copy" : null);
// What a lesson's folder is saved under: its level, or the lesson itself for
// one that runs in a new copy. Beginner, and a lesson pinned to the copy,
// have none.
export function folderKey(s: EngineState, id: LessonId = s.lesson) {
  const l = lessonIn(s, id);
  if (pinOf(l) === "new copy") return l.id;
  return pinOf(l) === "copy" ? null : levelKey(s, id);
}
// Whether a level practises in a work folder: Intermediate and Advanced,
// whose lessons' PATH entries say so (course.ts).
const isWorkLevel = (s: EngineState, level: string | undefined) =>
  s.course.some((l) => l.level === level && l.work);
// A lesson's level where that level practises in a work folder: Intermediate
// or Advanced. Null for Beginner.
export const levelKey = (s: EngineState, id: LessonId = s.lesson) =>
  isWorkLevel(s, levelOf(s, id)) ? (levelOf(s, id) ?? null) : null;
// The practice copy's project/, where the Starter project lives: the
// default Work folder (ticket 277).
const sepOf = (s: EngineState) => (s.facts.win32 ? "\\" : "/");
const projectOf = (s: EngineState, base: string) => base + sepOf(s) + "project";
export const projectDir = (s: EngineState) => projectOf(s, s.facts.root);
// Whether a path is the practice copy or a folder inside it.
export const inCopy = (s: EngineState, p: string) =>
  p === s.facts.root || p.startsWith(s.facts.root + sepOf(s));
// The folder work runs in for a saved folder: the copy's project/ for the
// copy, a new copy's project/ for its root, another folder as given.
function workOf(s: EngineState, saved: string | undefined, newCopy = false) {
  if (!saved) return null;
  if (saved === s.facts.root) return projectDir(s);
  return newCopy ? projectOf(s, saved) : saved;
}
// A later level's work folder: the one saved for it, the copy's project/
// by default.
export const levelFolder = (s: EngineState, level: string) =>
  workOf(s, s.folders[level]) ?? projectDir(s);
// The folder a lesson's check, git status and file reads run in: its work
// folder, the copy's project/ by default (ticket 277). A lesson that runs in
// a new copy runs in that copy's project/, and has none (null) until the
// learner gives it, and no check runs for it before.
// With `step`, the folder that step runs in: a Worked example step of a
// lesson whose front matter says `worked: copy` runs in the copy's project/,
// every other step in its lesson's folder (ticket 183). Every choice of a
// folder for a step comes through here: its verifies, its fresh stamps, the
// watcher and the header. Without a step, the lesson's own folder, where
// its prerequisites, its notes and its first look are.
export function folderOf(
  s: EngineState,
  id: LessonId = s.lesson,
  step: Step | null = null,
): string | null {
  const l = lessonIn(s, id);
  if (pinOf(l) === "new copy") return workOf(s, s.folders[l.id], true);
  if (step?.part === "Worked example" && l.content?.worked === "copy")
    return projectDir(s);
  const k = folderKey(s, id);
  return (k && workOf(s, s.folders[k])) || projectDir(s);
}
// A lesson whose Check passed with its Tear down still to do (ticket 102):
// it completes only after its last Tear down step.
export const tearDownLeft = (s: EngineState, id: LessonId = s.lesson) => {
  const p = progressOf(s, id);
  return (
    Boolean(contentOf(s, id)?.steps.some((x) => x.part === "Tear down")) &&
    !p.complete &&
    p.done.includes("C")
  );
};
// A lesson the learner can still finish: not complete, and not one that
// runs in a new copy of the template while that copy's folder is not saved,
// as no check of it runs until then. The next lesson the map marks and
// opens at is one of these.
export const toFinish = (
  { progress, folders }: Pick<EngineState, "progress" | "folders">,
  l: CourseEntry,
) =>
  !must(progress[l.id], `no progress for ${l.id}`).complete &&
  (pinOf(l) !== "new copy" || Boolean(folders[l.id]));
// The steps a learner meets, in order: the warm-up questions chosen when the
// lesson started, then the lesson's own steps.
const playOrder = (content: LessonContent, p: LessonProgress): Step[] => [
  ...p.warm
    .map((id) => content.warmup.find((w) => w.id === id))
    .filter((w) => w !== undefined),
  ...content.steps,
];
export const stepsOf = (s: EngineState, id: LessonId = s.lesson) => {
  const content = contentOf(s, id);
  return content ? playOrder(content, progressOf(s, id)) : [];
};
export const stepOf = (s: EngineState): Step | undefined =>
  stepsOf(s)[s.pos.step];
export const beatOf = (s: EngineState): Beat | undefined =>
  currentStep(s).beats[s.pos.beat];
// The step and beat on screen, where the caller knows there is one: on the
// card, a Step-down, or the lesson's end.
export const currentStep = (s: EngineState) =>
  must(stepOf(s), `no step ${String(s.pos.step)} in ${s.lesson}`);
export const currentBeat = (s: EngineState) =>
  must(beatOf(s), `no beat ${String(s.pos.beat)} in ${s.lesson}`);
// The beat on the card's state, where the caller knows there is one.
export const beatState = (s: EngineState) =>
  must(s.beat, "no beat on the card");
// Whether a beat shows (ticket 104): one with a when line only while the
// saved pick on its choice is its option. The store keeps 200 characters of
// a pick, so a pick made in this sitting compares as a saved one does.
export const beatShown = (p: LessonProgress, beat: Beat) =>
  !beat.when ||
  p.answers[`${beat.when.step}.${String(beat.when.beat)}`]?.slice(0, 200) ===
    beat.when.option.slice(0, 200);
// The step's next beat that shows after beat `at`, or -1; and its last one
// that shows before `at`, or -1. A step's first beat always shows.
const shownAfter = (p: LessonProgress, step: Step, at: number) =>
  step.beats.findIndex((b, i) => i > at && beatShown(p, b));
const shownBefore = (p: LessonProgress, step: Step, at: number) =>
  step.beats.findLastIndex((b, i) => i < at && beatShown(p, b));
// Whether the beat on screen is the last of its step that shows.
export const isLastBeat = (s: EngineState) =>
  shownAfter(progressOf(s), currentStep(s), s.pos.beat) < 0;

// What this learner did with each skill: `steps` holds "k skill" for each
// lesson k where they finished one of its own steps on it (warm-ups aside),
// `finished` those skills, and `recalled` the skills of the warm-ups they
// answered right the first time, in any lesson.
function history(s: EngineState) {
  const steps = new Set<string>();
  const finished = new Set<string>();
  const recalled = new Set<string>();
  s.course.forEach((l, k) => {
    if (!l.content) return;
    const p = progressOf(s, l.id);
    for (const step of l.content.steps) {
      if (!p.done.includes(step.id)) continue;
      steps.add(`${String(k)} ${step.skill}`);
      finished.add(step.skill);
    }
    for (const id of p.recalled) {
      const w = l.content.warmup.find((x) => x.id === id);
      if (w) for (const b of w.beats) recalled.add(b.skill ?? w.skill);
    }
  });
  return { steps, finished, recalled };
}
// Your card (the c panel): every lesson's card entries, in course order,
// whose skill the learner finished one of that lesson's own steps on, read
// from done. An entry's pill names its lesson, so only that lesson's steps
// count: a skill an earlier lesson also teaches shows nothing early.
export function cardOf(s: EngineState) {
  const { steps } = history(s);
  return s.course.flatMap((l, k) =>
    (l.content?.card ?? [])
      .filter((e) => steps.has(`${String(k)} ${e.skill}`))
      .map((e) => ({ ...e, lesson: l.id })),
  );
}
// The entries the next screen asks the learner to recall: this lesson's own
// on the card.
export const recallOf = (s: EngineState) =>
  cardOf(s).filter((e) => e.lesson === s.lesson);
// Where the next screen's enter goes: the next lesson, or null for the map.
export const nextLessonOf = (s: EngineState) => {
  const id = contentOf(s)?.next;
  return (id && lessonOf(s, id)) || null;
};
// Whether the learner did what the step on screen asks again: finished a
// step on its skill, in any lesson. A capstone step draws on every lesson
// before it, so there it takes a finished step on every skill they teach.
export function doneBefore(s: EngineState) {
  const { finished } = history(s);
  if (!s.lesson.endsWith("capstone")) return finished.has(currentStep(s).skill);
  const idx = s.course.findIndex((l) => l.id === s.lesson);
  return s.course
    .slice(0, idx)
    .every((l) =>
      (l.content?.steps ?? []).every(
        (x) => x.optional || finished.has(x.skill),
      ),
    );
}

// Each step's tier in play order. A warm-up recalls an earlier lesson from
// memory, so it is always CHALLENGE and counts toward no skill's fading.
// Help fades only for what this learner did: an earlier lesson counts toward
// a skill once they finished a step on it there, and every lesson does once a
// warm-up on it was right the first time. g on a level-up and an ease each
// give a step one tier more help, and together still one.
export function tiersOf(s: EngineState, id: LessonId = s.lesson) {
  const contents = s.course.map((l) => l.content);
  const idx = s.course.findIndex((l) => l.id === id);
  const p = progressOf(s, id);
  const h = history(s);
  const rule = ruleTiers(
    contents,
    idx,
    (k, skill) => h.steps.has(`${String(k)} ${skill}`) || h.recalled.has(skill),
  );
  const steps = stepsOf(s, id);
  const more = moreHelp(p, steps);
  const own = must(contents[idx], `no content for ${id}`);
  return steps.map((step, i): HelpTier => {
    if (step.part === "Warm-up") return "challenge";
    // Every step but a warm-up is one of the lesson's own.
    const t = must(rule[own.steps.indexOf(step)], `no tier for ${step.id}`);
    return effectiveTier(t, {
      lessHelp: p.lessHelp,
      eased: more[i] || Boolean(p.easedSteps[step.id]),
    });
  });
}
// Which steps g on a level-up gives one tier more help: the step it was
// pressed on and every one after it in play order, but the Check.
function moreHelp(p: LessonProgress, steps: Step[]) {
  const from = steps.findIndex((x) => x.id === p.moreHelpAt);
  return steps.map(
    (step, i) => from !== -1 && i >= from && step.part !== "Check",
  );
}
// Whether g on the level-up on screen gives any step more help. Not on the
// Check, which stays CHALLENGE, nor after an earlier g, which covers every
// step this one would: so g never moves `moreHelpAt` later and takes back
// help already given.
export function moreHelpGives(s: EngineState) {
  const p = progressOf(s);
  const step = currentStep(s);
  const easedSteps = Object.fromEntries(
    Object.entries(p.easedSteps).filter(([id]) => id !== step.id),
  );
  const after = tiersOf({
    ...s,
    progress: {
      ...s.progress,
      [s.lesson]: { ...p, moreHelpAt: step.id, easedSteps },
    },
  });
  return tiersOf(s).some(
    (t, i) => TIERS.indexOf(must(after[i], "a tier")) < TIERS.indexOf(t),
  );
}
export function authoredTier(s: EngineState): HelpTier {
  const step = currentStep(s);
  if (step.part === "Warm-up") return "challenge";
  const idx = s.course.findIndex((l) => l.id === s.lesson);
  return must(
    ruleTiers(
      s.course.map((l) => l.content),
      idx,
    )[must(contentOf(s), `no content for ${s.lesson}`).steps.indexOf(step)],
    `no tier for ${step.id}`,
  );
}
export const tierOf = (s: EngineState) => tiersOf(s)[s.pos.step];

// What the host reads off the state on its own (ticket 209, lifted here in
// 210): the folder to watch, the evidence file a check guards, and whether
// the app opens with a check.
// The folder the Learner works in now: the step on screen's, or, before
// its beat opens, the saved step's; else the lesson's.
export const workFolder = (s: EngineState) =>
  s.phase === "playing" && contentOf(s)
    ? folderOf(
        s,
        s.lesson,
        s.beat
          ? currentStep(s)
          : (stepsOf(s).find((x) => x.id === progressOf(s).step) ?? null),
      )
    : folderOf(s);

// The file whose change during a check makes it run again (guard 8): the
// beat on the card's, as the engine's own re-ask names it.
export const evidence = (s: EngineState) =>
  onCard(s) ? (currentBeat(s).evidence ?? null) : null;

// Whether the app opens with a look at the lesson's check: a Learner
// welcomed back to a lesson with a page that is not complete.
export const opensWithCheck = (s: EngineState) =>
  s.welcomed && Boolean(contentOf(s)) && !progressOf(s).complete;

// What the wiring should keep an eye on for the beat on screen.
// `dir` is the folder it runs in.
export function watching(s: EngineState): Watch | null {
  if (!onCard(s)) return null;
  const dir = folderOf(s, s.lesson, currentStep(s));
  if (["done", "already"].includes(s.beat.status)) return null;
  const v = currentBeat(s).verify;
  if (v.kind === "check")
    return { check: { lesson: s.lesson, items: v.all ? null : v.items }, dir };
  if (isReadVerify(v)) return { file: v.path, dir };
  if (isGitVerify(v))
    return {
      git: true,
      dir,
      ...(eachFile(v) ? { files: true } : {}),
      ...(v.kind === "head-moved" ? { head: true } : {}),
    };
  if (v.kind === "probe") return { probe: { name: v.name, args: v.args }, dir };
  return null;
}
// The effect that asks git about what `w` watches, in its folder.
const gitAsk = (w: Watch, extra: { asked?: number } = {}): Effect => ({
  type: "git",
  ...extra,
  dir: w.dir,
  ...(w.files ? { files: true } : {}),
  ...(w.head ? { head: true } : {}),
});
// The effect that runs the probe `w` watches (ticket 105).
const probeAsk = (w: Watch, extra: { asked?: number } = {}): Effect => {
  const probe = must(w.probe, "a probe to run");
  return {
    type: "probe",
    ...extra,
    name: probe.name,
    args: probe.args,
    dir: w.dir,
  };
};
// Whether a git result answers what `w` watches: a beat on part of the tree
// reads only one that lists each untracked file, and a whole-tree beat only
// one that lists what git status shows; a head-moved beat only one that
// says where HEAD is.
export const answersGit = (
  w: Watch | null,
  ev: { files?: boolean; head?: string | null },
): w is Watch =>
  w !== null &&
  Boolean(w.git) &&
  Boolean(ev.files) === Boolean(w.files) &&
  "head" in ev === Boolean(w.head);

// The intro that holds the folder question: a lesson that runs in a new
// copy; for a level, the first of its intros the learner opens while it has
// no answer, its first lesson's, and the one the answer was given on, which
// then shows the answer.
export function asksHere(s: EngineState) {
  const key = folderKey(s);
  if (!key) return false;
  return (
    key !== levelOf(s) ||
    !(key in s.folders) ||
    s.folderAnswered === s.lesson ||
    must(levelLessons(s, key)[0], `no lesson in ${key}`).id === s.lesson
  );
}
// The intro asks where to practise until there is an answer. A folder given
// with --dir, or on the map, is one.
export const asksFolder = (s: EngineState) =>
  inOverview(s) && asksHere(s) && !(String(folderKey(s)) in s.folders);
// The answers it offers: this practice copy, or another folder; a lesson
// that runs in a new copy offers only its folder.
export const folderOptions = (s: EngineState) =>
  folderKey(s) === levelOf(s) ? ["copy", "other"] : ["other"];

// The learner's answer: saved, and from now on where that key's lessons
// run. What a check found in the folder before, and the states a fresh
// check compares its file with, say nothing about another one. A step that
// stays where it was, a Worked example in the practice copy (ticket 183),
// keeps its states.
function setFolder(
  s: EngineState,
  key: string,
  path: string,
  effects: Effect[],
) {
  const moved = s.course
    .filter((l) => folderKey(s, l.id) === key && folderOf(s, l.id) !== path)
    .map((l) => l.id);
  const where = (id: LessonId) =>
    new Map(stepsOf(s, id).map((x) => [x.id, folderOf(s, id, x)]));
  const was = new Map(moved.map((id) => [id, where(id)]));
  s.folders[key] = path;
  for (const id of moved) {
    Reflect.deleteProperty(s.checks, id);
    const now = where(id);
    const stays = (k: string) => {
      const step = k.slice(0, k.lastIndexOf("."));
      return (
        now.has(step) &&
        now.get(step) === must(was.get(id), `${id} moved`).get(step)
      );
    };
    progressOf(s, id).stamps = Object.fromEntries(
      Object.entries(progressOf(s, id).stamps).filter(([k]) => stays(k)),
    );
  }
  if (s.folderAsk?.key === key) s.folderAsk = null;
  if (inOverview(s)) s.folderAnswered = s.lesson;
  effects.push({ type: "save" });
}

// ---- what a lesson needs (ticket 89) ----------------------------------------
// The groups of commands the lesson's page needs here: a Linux-only one on
// Linux alone.
const needsHere = (s: EngineState) =>
  (contentOf(s)?.needs ?? []).filter((n) => !n.linux || s.facts.linux);
// What the intro on screen asks the host to look at: the commands it needs,
// and, once its folder question has an answer, its prerequisites there.
export function introAsks(s: EngineState): Effect[] {
  if (!inOverview(s)) return [];
  const names = needsHere(s).flatMap((n) => n.commands);
  const requires = contentOf(s)?.requires ?? [];
  const dir = folderOf(s);
  return [
    ...(names.length ? [{ type: "commands" as const, names }] : []),
    ...(requires.length && !asksFolder(s) && dir
      ? [{ type: "prereqs" as const, lesson: s.lesson, dir, requires }]
      : []),
  ];
}
// A prerequisite the host looked at, in the folder it looked in: a check item
// passes or not (null: the run couldn't say, an error); a file is read as a
// `file` beat reads it, done once it holds a line. An answer to an older ask
// than the one already shown says nothing.
function onPrereq(s: EngineState, ev: HostInputOf<"prereq">) {
  const req = contentOf(s, ev.lesson)?.requires[ev.at];
  if (!req || ev.dir !== folderOf(s, ev.lesson)) return;
  let looked = s.prereqs[ev.lesson];
  if (looked?.dir !== ev.dir)
    looked = s.prereqs[ev.lesson] = { dir: ev.dir, met: {} };
  const asked = ev.asked ?? 0;
  if (asked < (looked.met[ev.at]?.asked ?? 0)) return;
  const r = req.path
    ? judge({ kind: "file", path: req.path }, ev.read)
    : {
        pass: ev.pass ?? null,
        hint: req.probe
          ? (ev.hint ?? "")
          : lessonIn(s, req.lesson).items[must(req.item, "a check item")],
      };
  looked.met[ev.at] = { pass: r.pass, hint: r.hint, asked };
}
// The intro's prerequisites that failed in the lesson's folder now, with
// what was not there, and whether its lesson is one to offer: only where
// that lesson is practised in the folder that was looked at, so doing it
// there can set this one right.
export function unmet(s: EngineState) {
  const r = s.prereqs[s.lesson];
  if (!r || r.dir !== folderOf(s) || asksFolder(s)) return [];
  return (contentOf(s)?.requires ?? []).flatMap((req, k) =>
    r.met[k]?.pass === false
      ? [
          {
            ...req,
            hint: r.met[k].hint,
            offer: Boolean(req.lesson) && folderOf(s, req.lesson) === r.dir,
          },
        ]
      : [],
  );
}
// The lesson the intro offers to open first: the first failed
// prerequisite's that can set it right.
export const offered = (s: EngineState) =>
  unmet(s).find((r) => r.offer)?.lesson ?? null;
// The intro's start options, and, where a prerequisite failed, its lesson.
export const introOptions = (s: EngineState) => [
  "start",
  "less",
  ...(offered(s) ? ["first"] : []),
];
// Each You need line with the commands it names that the host found on no PATH
// folder. Nothing until the host has looked.
export const missingNeeds = (s: EngineState) =>
  needsHere(s)
    .map((n) => ({
      quote: n.quote,
      names: n.commands.filter((c) => s.commands[c] === false),
    }))
    .filter((n) => n.names.length);
// What the host found wrong with the lesson's work folder, where it isn't the
// copy (ticket 86): 'missing', 'gitBroken', 'notGit' or 'noPractice'. Null
// until the host has looked, and where all is well.
// The lesson's saved folder outside the practice copy and what the host
// found there, or null: what the notes and the host's second look read.
export function savedProbe(s: EngineState) {
  const k = folderKey(s);
  const dir = k ? s.folders[k] : null;
  const found = dir && !inCopy(s, dir) ? s.probes[dir] : null;
  return found ? { dir: dir as string, found } : null;
}
export function folderProblem(s: EngineState) {
  const found = savedProbe(s)?.found;
  if (!found) return null;
  return found.missing
    ? "missing"
    : found.gitBroken
      ? "gitBroken"
      : !found.git
        ? "notGit"
        : !found.practice
          ? "noPractice"
          : null;
}
// The page's You need line for the learner's own repository (ticket 179),
// where the lesson runs in its level's work folder and that folder is set
// and is not the practice copy: never in a lesson pinned to the copy, nor
// in one that runs in a new copy of the template.
export function repoNeed(s: EngineState) {
  const k = folderKey(s);
  const dir = k && k === levelKey(s) ? s.folders[k] : null;
  return dir && !inCopy(s, dir)
    ? (contentOf(s)?.intro["need-repo"] ?? null)
    : null;
}
// What the intro has to say before the learner starts, a note each: the
// work folder's problem, the page's line for the learner's repository, on
// native Windows the page's note, the commands missing, and each
// prerequisite that failed. n shows them all.
export const introNotes = (s: EngineState) => [
  ...(!asksFolder(s) && folderProblem(s) ? ["folder"] : []),
  ...(repoNeed(s) ? ["repo"] : []),
  ...(s.facts.win32 && contentOf(s)?.intro["win-note"] ? ["win"] : []),
  ...(missingNeeds(s).length ? ["needs"] : []),
  ...unmet(s).map(() => "prereq"),
];

// ---- hints -------------------------------------------------------------------
// The status the hints and the actions answer to: while a check run goes, the
// one it put "Checking" over, so an open hint and the actions stay as they
// were.
export const hintStatus = (st: BeatState) =>
  (st.status === "opening" && st.before) || st.status;

// Point, then teach, then the exact command after a y/n: the check's own
// question for its FAIL message first, the lesson's words next, the bottom
// line last.
export function rungsOf(s: EngineState) {
  const beat = currentBeat(s);
  const lesson = must(contentOf(s), `no content for ${s.lesson}`);
  const st = beatState(s);
  const rungs: HintRung[] = [];
  let bottom: (Bottom | CodeLine)[] = [];
  const hideRuns = hidesRuns(s);
  // A hidden code block waits there whole, as the card would show it.
  const runs = beat.lines
    .filter((l) => ["run", "code"].includes(l.key))
    .map((l) => (l.key === "code" ? l : { text: l.text, win: l.win }));
  const fail = st.fail;
  if (hintStatus(st) === "fail" && fail?.item) {
    const ladder = lesson.ladder.find((l) => l.item === fail.item);
    const narrow = ladder?.narrow.find((n) => fail.hint.includes(n.part));
    if (narrow) rungs.push({ kind: "ask", text: narrow.question });
    rungs.push({ kind: "check", text: fail.hint });
    for (const h of ladder?.hints ?? []) rungs.push({ kind: "quote", text: h });
    bottom = ladder?.bottom ?? [];
  }
  for (const h of beat.hints) rungs.push({ kind: "quote", text: h });
  if (!bottom.length) bottom = [...(hideRuns ? runs : []), ...beat.bottom];
  if (bottom.length) rungs.push({ kind: "bottom", lines: bottom });
  return rungs;
}

// Where the step's state comes from (ticket 192): the earlier step a `back`
// line names, with its place in play order and its title. The beat's own
// line first; else the ladder block's for the item that FAILs, from a step
// of the part it names, as a Your turn or the Check redoes the Worked
// example on its own. Null where there is none, or none before this step.
export function backTo(s: EngineState) {
  if (!onCard(s) || isDone(s.beat)) return null;
  const st = s.beat;
  const steps = stepsOf(s);
  const item = hintStatus(st) === "fail" ? st.fail?.item : null;
  const ladder = item
    ? must(contentOf(s), `no content for ${s.lesson}`).ladder.find(
        (l) => l.item === item,
      )?.back
    : null;
  const part = (back: Back | null | undefined) =>
    steps.find((x) => x.id === back?.step)?.part === currentStep(s).part;
  const back = currentBeat(s).back ?? (part(ladder) ? ladder : null);
  const at = back ? steps.findIndex((x) => x.id === back.step) : -1;
  return back && at >= 0 && at < s.pos.step
    ? { ...back, at, title: must(steps[at], "the step back").title }
    : null;
}
// Where e goes back offers it: on the same-answer note, or on the hint
// ladder's last rung while it is open.
export function backOffered(s: EngineState) {
  const back = backTo(s);
  if (!back) return null;
  // backTo found one on the card.
  const st = beatState(s);
  if (st.confirm) return null;
  const note = st.same && hintStatus(st) === "fail";
  return note || (st.rung >= 0 && st.rung === rungsOf(s).length - 1)
    ? back
    : null;
}

// e: back to the step a back line names. Every saved file and done tick
// stays; the fresh checks stamped there or later lose their stamps, so each
// takes a new one as its step opens again and waits for new work.
function goBack(
  s: EngineState,
  back: NonNullable<ReturnType<typeof backTo>>,
  effects: Effect[],
) {
  const p = progressOf(s);
  const steps = stepsOf(s);
  const opensAt = (key: string) => {
    const id = key.slice(0, key.lastIndexOf("."));
    const beat = steps.find((x) => x.id === id)?.beats[
      Number(key.slice(key.lastIndexOf(".") + 1))
    ];
    return steps.findIndex((x) => x.id === (beat?.verify.since ?? id));
  };
  p.stamps = Object.fromEntries(
    Object.entries(p.stamps).filter(([k]) => opensAt(k) < back.at),
  );
  openStep(s, back.at, effects);
}

// A GUIDED step met with less help: its run lines and code block leave the
// card for the bottom rung.
export const hidesRuns = (s: EngineState) =>
  tierOf(s) !== "guided" && authoredTier(s) === "guided";

// What the learner tries before h opens a hint at CHALLENGE: r on a beat the
// app checks, a pick on a question with a wrong answer, or nothing (null)
// where nothing can fail, so h answers at once.
export function tryFirst(s: EngineState) {
  const beat = currentBeat(s);
  if (
    beat.verify.kind === "check" ||
    beat.verify.kind === "probe" ||
    GIT.has(beat.verify.kind) ||
    READS.has(beat.verify.kind)
  )
    return "r";
  const canMiss = beat.options.some(
    (o) => o.kind === "wrong" || o.kind === "decoy",
  );
  return beat.ask && beat.kind !== "predict" && beat.kind !== "type" && canMiss
    ? "pick"
    : null;
}

// A beat on screen that waits on a long run (ticket 103): the idle offer
// never fires there, so the motion layer never goes still for it.
export const longWait = (s: EngineState) =>
  onCard(s) &&
  !["done", "already"].includes(s.beat.status) &&
  Boolean(currentBeat(s).wait);

// Recall while a long run works (ticket 150): the warm-up a long wait's box
// offers, one of this lesson's pool that its warm-ups did not show and the
// box has not asked, on a missed skill first, then in the file's order. Only
// a question with options: typing would take the card's keys. Never a choice
// (ticket 104): it has no right answer to recall. Never scored.
function whileRunsPick(s: EngineState) {
  const p = progressOf(s);
  const missed = (w: Step) =>
    w.beats.some((b) => s.missed.includes(b.skill ?? w.skill));
  // Every step has a beat (the parser fails one with none).
  const first = (w: Step) => must(w.beats[0], `${w.id} has no beats`);
  const pool = must(contentOf(s), `no content for ${s.lesson}`).warmup.filter(
    (w) =>
      !p.warm.includes(w.id) &&
      !s.whileShown.includes(`${s.lesson}.${w.id}`) &&
      first(w).ask &&
      first(w).kind !== "type" &&
      first(w).options.length &&
      !isChoice(first(w)),
  );
  return (
    [...pool.filter(missed), ...pool.filter((w) => !missed(w))][0]?.id ?? null
  );
}
// The box's warm-up step, its first beat and the answer picked (an option's
// index, or null), while the long wait lasts; else null.
export function whileRunsOf(s: EngineState) {
  const box = longWait(s) ? s.beat?.whileRuns : undefined;
  if (!box) return null;
  const step = must(contentOf(s), `no content for ${s.lesson}`).warmup.find(
    (w) => w.id === box.id,
  );
  return step
    ? {
        step,
        beat: must(step.beats[0], `${step.id} has no beats`),
        answer: box.answer,
      }
    : null;
}
// A question still open in the box: rule 3 holds ambient motion beside it.
export const whileRunsOpen = (s: EngineState) =>
  whileRunsOf(s)?.answer === null;

export function hintAvailable(s: EngineState) {
  if (!onCard(s) || ["done", "already"].includes(s.beat.status)) return false;
  if (currentBeat(s).kind === "type") return false;
  const rungs = rungsOf(s);
  if (!rungs.length || s.beat.rung >= rungs.length - 1) return false;
  // A FAIL, r, a first wrong pick or two quiet minutes set `unlocked`.
  if (tierOf(s) === "challenge" && tryFirst(s)) return s.beat.unlocked;
  return true;
}

// ---- moving through a lesson -------------------------------------------------
function openBeat(s: EngineState, effects: Effect[]) {
  const step = currentStep(s);
  const beat = currentBeat(s);
  const p = progressOf(s);
  p.step = step.id;
  p.beat = s.pos.beat;
  markEased(s, s.pos.step);
  const st: BeatState = {
    status: "waiting",
    rung: -1,
    confirm: false,
    wrongs: [],
    answer: null,
    revealed: false,
    typedWrong: 0,
    feedback: null,
    idle: false,
    unlocked: false,
    explicit: false,
    ended: false,
    opened: s.now,
    eased: Boolean(p.easedSteps[step.id]),
    // The run the card says "Checking" for, from the moment its child really
    // starts (`run-start`) until the status leaves "opening": { asked }. And
    // the last look at what the beat watches, as a digest, so a look that
    // differs from the one before is a change (work.changed), unless a file
    // change already said so since the last look. In memory.
    run: null,
    look: null,
    touched: false,
  };
  s.beat = st;
  const offer = beat.wait ? whileRunsPick(s) : null;
  if (offer) st.whileRuns = { id: offer, answer: null };
  s.lastActivity = s.now;
  if (beat.codespace && s.facts.codespace) {
    st.status = "already";
    st.codespace = true;
  } else if (beat.verify.kind === "check") {
    st.status = "opening";
    effects.push({
      type: "check",
      lesson: s.lesson,
      items: beat.verify.all ? null : beat.verify.items,
      evidence: beat.evidence ?? null,
      dir: folderOf(s, s.lesson, step),
    });
  } else if (isReadVerify(beat.verify)) {
    st.status = "opening";
    effects.push({
      type: "file",
      path: beat.verify.path,
      dir: folderOf(s, s.lesson, step),
    });
  } else if (isGitVerify(beat.verify)) {
    st.status = "opening";
    effects.push(gitAsk(must(watching(s), "a git beat watches git")));
  } else if (beat.verify.kind === "probe") {
    st.status = "opening";
    effects.push(probeAsk(must(watching(s), "a probe beat watches a probe")));
  }
  effects.push({ type: "save" });
}

// A fresh check compares its file with how it was when its step opened (or
// the step it names): ask for that file's state now, once, in the folder
// the fresh beat's own step reads it in (ticket 183). A fresh probe stamps
// what its probe answers, and head-moved and git-unchanged where HEAD is
// or what git status lists (ticket 105).
const stampOf = (
  b: Beat,
):
  | { probe: { name: string; args: string[] } }
  | { git: "head" | "status" }
  | { path: string | undefined }
  | null => {
  const v = b.verify;
  if (v.kind === "probe")
    return v.fresh ? { probe: { name: v.name, args: v.args } } : null;
  if (SINCE_GIT.has(v.kind))
    return { git: v.kind === "head-moved" ? "head" : "status" };
  return v.fresh ? { path: b.evidence } : null;
};
function stampFresh(s: EngineState, effects: Effect[]) {
  const step = currentStep(s);
  const stamps = progressOf(s).stamps;
  for (const other of stepsOf(s)) {
    other.beats.forEach((b, i) => {
      const key = `${other.id}.${String(i)}`;
      const what = stampOf(b);
      if (what && (b.verify.since ?? other.id) === step.id && !(key in stamps))
        effects.push({
          type: "stamp",
          key,
          ...what,
          dir: folderOf(s, s.lesson, other),
        });
    });
  }
}

// A skill that needed the bottom rung, or a missed warm-up, comes back one
// tier easier, once: at the next step that asks for it where the ease changes
// the help.
function markEased(s: EngineState, index: number) {
  const step = must(stepsOf(s)[index], `no step ${String(index)}`);
  if (!s.eased.includes(step.skill) || !easeLands(s, index)) return;
  progressOf(s).easedSteps[step.id] = true;
  s.eased = s.eased.filter((k) => k !== step.skill);
}

// Whether an ease waiting on step `index`'s skill would give it more help. Not
// on a warm-up, which is always from memory, a finished step, the rest of the
// step whose bottom rung set it, a step already eased, a step g already gives
// one tier more help, or a GUIDED step, which shows every command anyway:
// there the ease waits for the next step.
export function easeLands(s: EngineState, index: number, tiers = tiersOf(s)) {
  const steps = stepsOf(s);
  const step = must(steps[index], `no step ${String(index)}`);
  const p = progressOf(s);
  if (
    step.part === "Warm-up" ||
    p.done.includes(step.id) ||
    p.bottomAt === step.id ||
    p.easedSteps[step.id]
  )
    return false;
  if (moreHelp(p, steps)[index]) return false;
  return tiers[index] !== "guided";
}

function openStep(s: EngineState, index: number, effects: Effect[]) {
  markEased(s, index);
  const tiers = tiersOf(s);
  const steps = stepsOf(s);
  const prev = index > 0 ? must(tiers[index - 1], "the tier before") : null;
  const p = progressOf(s);
  s.pos = { step: index, beat: 0 };
  stampFresh(s, effects);
  // Less help than the step before. A level-up says the help stays lower from
  // here on, so it shows only when no later step of the lesson gets more help;
  // a step that is harder on its own gets a line on its card instead.
  const { harder, stays } = climb(s, index, tiers, steps);
  const tier = must(tiers[index], `no tier for step ${String(index)}`);
  if (harder && stays && !p.levels.includes(tier)) {
    s.phase = "step-down";
    s.levelTo = tier;
    s.levelFrom = prev;
    s.beat = null;
    p.step = currentStep(s).id;
    p.beat = 0;
    effects.push({ type: "save" });
    return;
  }
  s.phase = "playing";
  openBeat(s, effects);
}

// Whether step `index` gives less help than the one before, and whether the
// help stays that low for the rest of the lesson. An ease still pending for a
// later step's skill counts where it will land: that step comes back one tier
// easier.
function climb(
  s: EngineState,
  index: number,
  tiers = tiersOf(s),
  steps = stepsOf(s),
) {
  // A tier past the lesson's steps ranks below them all, as indexOf has it.
  const rank = (t: HelpTier | null | undefined) => (t ? TIERS.indexOf(t) : -1);
  const prev = index > 0 ? tiers[index - 1] : null;
  const harder = Boolean(prev) && rank(tiers[index]) > rank(prev);
  const pending = new Set(s.eased);
  const stays = steps.slice(index + 1).every((step, k) => {
    if (step.part === "Warm-up") return true;
    let r = rank(tiers[index + 1 + k]);
    if (pending.has(step.skill) && easeLands(s, index + 1 + k, tiers)) {
      pending.delete(step.skill);
      r -= 1;
    }
    return r >= rank(tiers[index]);
  });
  return { harder, stays };
}

// The line a step that is harder on its own shows instead of a level-up:
// its tier, or null.
export function stepNote(s: EngineState) {
  if (!onCard(s) || currentStep(s).part === "Warm-up") return null;
  const { harder, stays } = climb(s, s.pos.step);
  return harder && !stays ? tierOf(s) : null;
}

// What the intro's enter clears, so a play starts its help from the plan.
function startPlay(p: LessonProgress) {
  p.stamps = {};
  p.bottomAt = null;
  p.easedSteps = {};
  p.recalled = [];
  p.moreHelpAt = null;
}
// The state as the intro's enter will leave the lesson, so the intro shows
// the help the play will give, not the eases and recalls of an earlier play.
export function asStarted(s: EngineState) {
  const p = { ...progressOf(s) };
  startPlay(p);
  return { ...s, progress: { ...s.progress, [s.lesson]: p } };
}

function startLesson(s: EngineState, id: LessonId, effects: Effect[]) {
  s.lesson = id;
  const p = progressOf(s, id);
  const steps = stepsOf(s, id);
  // A lesson's end clears its step, so a step saved is a play to resume: a
  // first play, or a replay of a lesson that keeps its Badge.
  const at = steps.findIndex((x) => x.id === p.step);
  const saved = steps[at];
  if (saved) {
    const beat = p.beat >= 0 && p.beat < saved.beats.length ? p.beat : 0;
    s.pos = {
      step: at,
      beat: beatShown(p, must(saved.beats[beat], "a saved beat"))
        ? beat
        : shownBefore(p, saved, beat),
    };
    s.phase = "playing";
    openBeat(s, effects);
  } else s.phase = "overview";
}

// The more of two helps used.
const moreUsed = (a: HelpUsed, b: HelpUsed) =>
  HELP_USED.indexOf(a) >= HELP_USED.indexOf(b) ? a : b;
// The step on screen used at least `help` in this play.
const helpKey = (s: EngineState) => `${s.lesson} ${currentStep(s).id}`;
function used(s: EngineState, help: HelpUsed) {
  const key = helpKey(s);
  s.stepHelp[key] = moreUsed(s.stepHelp[key] ?? "own", help);
}
// A new play of a lesson: its steps' help starts again.
function forgetHelp(s: EngineState, lesson: LessonId) {
  for (const key of Object.keys(s.stepHelp))
    if (key.startsWith(`${lesson} `)) Reflect.deleteProperty(s.stepHelp, key);
}
// The help a lesson's own step used, saved as it finishes, a replay's over
// the last (ticket 213): its tier (Guided shows every command, Hinted
// hints), a hint opened and the exact command taken, here or before a quit.
// A warm-up is from memory and saves none.
function saveHelp(s: EngineState) {
  const step = currentStep(s);
  const p = progressOf(s);
  if (!must(contentOf(s), `no content for ${s.lesson}`).steps.includes(step))
    return;
  // Guided shows every command, Hinted hints, Challenge neither.
  const t = tierOf(s);
  const tier: HelpUsed =
    t === "guided" ? "commands" : t === "hinted" ? "hints" : "own";
  const opened = s.stepHelp[helpKey(s)] ?? "own";
  const bottom = p.bottomAt === step.id ? "commands" : "own";
  p.help = {
    ...(p.help ?? {}),
    [step.id]: { used: moreUsed(moreUsed(tier, opened), bottom), at: s.epoch },
  };
}

function finishStep(s: EngineState, effects: Effect[]) {
  const step = currentStep(s);
  const p = progressOf(s);
  saveHelp(s);
  if (!p.done.includes(step.id)) {
    p.done.push(step.id);
    s.session += 1;
  }
  nextStep(s, effects);
}

// x on an optional step (ticket 102): on to the next step, or the lesson's
// end, with the step not done. Skipping changes no eased or missed state: an
// ease that landed on this step waits for the next step on its skill.
function skipStep(s: EngineState, effects: Effect[]) {
  const step = currentStep(s);
  const p = progressOf(s);
  if (p.easedSteps[step.id] && !p.done.includes(step.id)) {
    Reflect.deleteProperty(p.easedSteps, step.id);
    if (!s.eased.includes(step.skill)) s.eased.push(step.skill);
  }
  nextStep(s, effects);
}

// The step after the one on screen, or, after the last (the Check, or the
// last Tear down step after it), the lesson's end.
function nextStep(s: EngineState, effects: Effect[]) {
  const p = progressOf(s);
  const steps = stepsOf(s);
  if (s.pos.step + 1 >= steps.length) {
    s.firstCompletion = p.complete ? null : s.lesson;
    p.complete = true;
    p.step = null;
    s.phase = "complete";
    s.beat = null;
    effects.push({ type: "save" });
    return;
  }
  openStep(s, s.pos.step + 1, effects);
}

// On and back pass over the beats that don't show (ticket 104).
function advance(s: EngineState, effects: Effect[]) {
  const next = shownAfter(progressOf(s), currentStep(s), s.pos.beat);
  if (next >= 0) {
    s.pos.beat = next;
    openBeat(s, effects);
  } else finishStep(s, effects);
}

function back(s: EngineState, effects: Effect[]) {
  const p = progressOf(s);
  if (s.pos.beat > 0) {
    s.pos.beat = shownBefore(p, currentStep(s), s.pos.beat);
    openBeat(s, effects);
  } else if (s.pos.step > 0) {
    const prev = must(stepsOf(s)[s.pos.step - 1], "the step before");
    s.pos = {
      step: s.pos.step - 1,
      beat: shownBefore(p, prev, prev.beats.length),
    };
    s.phase = "playing";
    openBeat(s, effects);
  }
}

// Picks the lesson's warm-up as it starts: the first question in the file's
// order on a skill the learner missed before, or none when they missed no
// skill the pool recalls (ticket 194: a warm-up spends a question only where
// it brings back something missed, so unmet skills and the file order no
// longer fill the place). A beat that names the skill it recalls counts
// under that skill, as its miss and its recall do.
export function pickWarmups(s: EngineState, id: LessonId = s.lesson) {
  const missed = (w: Step) =>
    w.beats.some((b) => s.missed.includes(b.skill ?? w.skill));
  return must(contentOf(s, id), `no content for ${id}`)
    .warmup.filter(missed)
    .slice(0, WARMUPS)
    .map((w) => w.id);
}
function chooseWarmups(s: EngineState) {
  progressOf(s).warm = pickWarmups(s);
}

// A question answered wrong, or shown, marks its skill for a warm-up later;
// a warm-up on that skill answered right at once clears the mark, unless it
// was missed again in this sitting. A beat may name the skill it recalls.
// A warm-up is recall from memory, so its first answer in a play also sets
// the help: a miss eases the skill, and a right answer at once cancels a
// waiting ease and joins the lesson's `recalled`, so the skill's help fades
// on the course plan. Asked again (gone back to, or after a quit), it is not.
const skillOf = (s: EngineState) =>
  currentBeat(s).skill ?? currentStep(s).skill;
const warmKey = (s: EngineState) => `${s.lesson}.${currentStep(s).id}`;
function firstAnswer(s: EngineState) {
  const p = progressOf(s);
  if (currentStep(s).part !== "Warm-up" || s.answeredNow.includes(warmKey(s)))
    return false;
  // On a first play the done list holds only this play's steps; a lesson
  // played again keeps its old ticks, so there it tells nothing.
  return p.complete || !p.done.includes(currentStep(s).id);
}
function answered(s: EngineState) {
  if (currentStep(s).part === "Warm-up" && !s.answeredNow.includes(warmKey(s)))
    s.answeredNow.push(warmKey(s));
}
function missed(s: EngineState, effects: Effect[]) {
  const skill = skillOf(s);
  if (!s.missed.includes(skill)) s.missed.push(skill);
  if (firstAnswer(s) && !s.eased.includes(skill)) s.eased.push(skill);
  if (!s.missedNow.includes(skill)) s.missedNow.push(skill);
  answered(s);
  effects.push({ type: "save" });
}
function recalled(s: EngineState) {
  const st = beatState(s);
  const skill = skillOf(s);
  const first = firstAnswer(s);
  answered(s);
  if (
    !first ||
    st.wrongs.length ||
    st.typedWrong ||
    s.missedNow.includes(skill)
  )
    return;
  s.missed = s.missed.filter((k) => k !== skill);
  s.eased = s.eased.filter((k) => k !== skill);
  const p = progressOf(s);
  if (!p.recalled.includes(currentStep(s).id))
    p.recalled.push(currentStep(s).id);
}

// ---- questions ---------------------------------------------------------------
export const answerKey = (s: EngineState) =>
  `${currentStep(s).id}.${String(s.pos.beat)}`;
const questionOf = (beat: Beat) => (beat.ask ? beat : null);

function pick(s: EngineState, index: number, effects: Effect[]) {
  const beat = currentBeat(s);
  const st = beatState(s);
  const opt = beat.options[index];
  if (!opt || st.answer) return;
  const p = progressOf(s);
  if (beat.kind === "predict") {
    st.answer = { index, kind: opt.kind };
    p.answers[answerKey(s)] = opt.text;
    st.status = "done";
    effects.push({ type: "save" });
    return;
  }
  if (opt.kind === "right" || opt.kind === "option" || opt.kind === "other") {
    st.answer = { index, kind: opt.kind };
    // Saved as a guess is (ticket 104): a when line reads a choice's pick,
    // and a changed pick changes which beats after it show.
    p.answers[answerKey(s)] = opt.text;
    st.feedback =
      opt.kind === "right"
        ? { kind: "right" }
        : { kind: opt.kind, because: opt.because };
    st.status = "done";
    if (opt.kind === "right") recalled(s);
    effects.push({ type: "save" });
    return;
  }
  // Saying it went wrong is a try too, so hints may open.
  if (opt.kind === "stuck") {
    st.feedback = { kind: "stuck", because: opt.because };
    st.unlocked = true;
    return;
  }
  // A wrong pick or a decoy: explain once, reveal on the second. It is a
  // try, so hints may open.
  if (!st.wrongs.includes(index)) st.wrongs.push(index);
  st.unlocked = true;
  missed(s, effects);
  if (st.wrongs.length >= 2) {
    reveal(s, effects);
    return;
  }
  st.feedback = { kind: "wrong", because: opt.because, point: beat.point };
}

function reveal(s: EngineState, effects: Effect[]) {
  const beat = currentBeat(s);
  const st = beatState(s);
  st.revealed = true;
  missed(s, effects);
  st.answer = {
    index: beat.options.findIndex((o) => o.kind === "right"),
    kind: "revealed",
  };
  st.feedback = { kind: "revealed" };
  st.status = "done";
  effects.push({ type: "save" });
}

// Case, spaces, a leading slash and the + or - between keys don't matter, and
// Escape is Esc.
export const normalize = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[+\-\s]+/g, "")
    .replace(/^\//, "")
    .replace(/^escape$/, "esc");

function submitTyped(s: EngineState, text: string, effects: Effect[]) {
  const beat = currentBeat(s);
  const st = beatState(s);
  const said = normalize(text);
  if (!said) {
    reveal(s, effects);
    return;
  }
  if (beat.accept.some((a) => normalize(a) === said)) {
    st.status = "done";
    st.feedback = { kind: "right" };
    recalled(s);
    effects.push({ type: "save" });
    return;
  }
  st.typedWrong += 1;
  missed(s, effects);
  if (st.typedWrong >= 2) {
    reveal(s, effects);
    return;
  }
  const known = beat.options.find(
    (o) => o.kind === "wrong" && normalize(o.text) === said,
  );
  st.feedback = known
    ? { kind: "wrong", because: known.because }
    : { kind: "wrong", hint: beat.hints[0] };
}

// ---- checks and git ----------------------------------------------------------
export const RESULTS = [
  "check",
  "check-error",
  "file",
  "git",
  "git-error",
  "probe",
  "probe-error",
] as const;

// `read` is the bytes of the beat's evidence file, as the host read it.
function onCheck(
  s: EngineState,
  input: HostInputOf<"check">,
  effects: Effect[],
  rRuns: boolean,
) {
  const ev = { ...input, evidence: evidenceOf(input.read) };
  s.checks[ev.lesson] = {
    items: ev.items,
    evidence: ev.evidence,
    error: null,
  };
  if (rRuns || !onCard(s) || ev.lesson !== s.lesson) return;
  const beat = currentBeat(s);
  if (beat.verify.kind !== "check") return;
  const st = s.beat;
  if (["done", "already"].includes(st.status)) return;
  const indexes = beat.verify.all
    ? lessonIn(s).items.map((_, i) => i)
    : beat.verify.items;
  const wanted = indexes.map((i) => ev.items.find((it) => it.index === i));
  // A result that doesn't cover every item decides nothing.
  if (!wanted.every((it) => it !== undefined)) return;
  const failing = wanted.find((it) => !it.slow && !it.pass);
  // Everything else passes, and a slow item waits for r: say so, in place of
  // any message about the items that pass now. A FAIL about a slow item stays
  // with its hints: a run without that item can't tell whether it passes now.
  if (!failing && wanted.some((it) => it.slow)) {
    if (
      st.status === "fail" &&
      wanted.some((it) => it.slow && it.text === st.fail?.item)
    ) {
      st.slowWait = true;
      return;
    }
    if (st.baseline === undefined) st.baseline = null;
    Object.assign(st, {
      status: "waiting",
      slowWait: true,
      fail: null,
      error: null,
      rung: -1,
      confirm: false,
      explicit: false,
      same: false,
    });
    return;
  }
  st.slowWait = false;
  decide(s, ev, effects, failing && { item: failing.text, hint: failing.hint });
}

// Where a fresh beat's file `ev.read` starts being new (holds.ts grewFrom):
// past what it held at its stamp (saved, so a restart reads it too) when it
// only grew, else 0. With no stamp yet, this read is the one decide stamps,
// so the first answer is judged as every later one is.
export function readFrom(
  s: EngineState,
  ev: { read?: Buffer | null; stamp?: string | null },
) {
  if (!currentBeat(s).verify.fresh || !ev.read) return 0;
  return grewFrom(progressOf(s).stamps[answerKey(s)] ?? ev.stamp, ev.read);
}

// A file the beat reads itself, by what it holds now (holds.ts): `read`
// is its bytes, null when it isn't there. A fresh match on a file that only
// grew reads what was added; a rewritten one is read whole.
function onFile(
  s: EngineState,
  ev: HostInputOf<"file">,
  effects: Effect[],
  rRuns: boolean,
) {
  if (rRuns || !onCard(s)) return;
  const v = currentBeat(s).verify;
  if (
    !isReadVerify(v) ||
    ev.path !== v.path ||
    ["done", "already"].includes(s.beat.status)
  )
    return;
  const r = judge(v, ev.read, readFrom(s, ev));
  decide(
    s,
    { ...ev, evidence: r.evidence },
    effects,
    r.pass ? null : { hint: r.hint },
  );
}

// Turns a result into the beat's status. `failing` is null when it passes.
function decide(
  s: EngineState,
  ev: Outcome,
  effects: Effect[],
  failing: Failing | null | undefined,
) {
  const beat = currentBeat(s);
  const st = beatState(s);
  // A fresh check also needs its evidence file to have changed since its
  // step opened; a result about another file decides nothing.
  let stale = false;
  if (beat.verify.fresh) {
    // null: the file couldn't be read just now, so nothing is known yet.
    if (ev.path !== beat.evidence || ev.stamp === null) return;
    const stamps = progressOf(s).stamps;
    const key = answerKey(s);
    if (!(key in stamps)) {
      stamps[key] = ev.stamp ?? "";
      effects.push({ type: "save" });
    }
    stale = (ev.stamp ?? "") === stamps[key];
  }
  const explicit = st.explicit;
  st.explicit = false;
  st.error = null;
  // The same FAIL message as the result before, with the watched file
  // changed between them: the learner redid the step and the check says the
  // same, so the cause is likely earlier (ticket 192). Only a result that
  // carries its file's state (`stamp`) tells a redo from a poll or an r.
  const stamp = typeof ev.stamp === "string" ? ev.stamp : null;
  // A hint equal to the last one's means there was a last one, unless
  // both are undefined, which the JavaScript read as one too.
  const last = st.last;
  const redone =
    !!failing &&
    stamp !== null &&
    last?.hint === failing.hint &&
    must(last, "the result before").stamp !== null &&
    must(last, "the result before").stamp !== stamp;
  st.last = failing ? { hint: failing.hint, stamp } : null;
  if (!failing) st.same = false;
  if (!failing && stale) {
    if (st.baseline === undefined) st.baseline = null;
    st.status = "waiting";
    st.stale = true;
    return;
  }
  st.stale = false;
  if (!failing) {
    st.status = st.baseline === undefined ? "already" : "done";
    // The run that passed the lesson's whole check: its done line counts
    // these, not a later poll's, which leaves the slow items out.
    if (beat.verify.all) st.passed = ev.items;
    st.evidence = ev.evidence ?? null;
    // The file a glob matched, for the card to name (106).
    st.found = ev.found ?? null;
    st.feedback = null;
    st.rung = -1;
    st.confirm = false;
    effects.push({ type: "save" });
    return;
  }
  // The first answer is what the learner starts from: no "not yet" for it.
  if (st.baseline === undefined) {
    st.baseline = failing.hint;
    if (!explicit) {
      st.status = "waiting";
      return;
    }
  }
  // Once a fail is on screen it follows the check; before that, a fail that
  // only repeats the first answer means nothing changed yet.
  const shown = hintStatus(st) === "fail";
  if (shown || failing.hint !== st.baseline || explicit) {
    if (st.fail?.hint !== failing.hint) {
      st.rung = -1;
      st.confirm = false;
      st.same = false;
    }
    // The note follows a FAIL the learner saw, never the first one on
    // screen, and shows once a beat visit: after it goes, it stays gone.
    if (redone && shown && !st.sameShown) {
      st.same = true;
      st.sameShown = true;
    }
    st.status = "fail";
    st.fail = failing;
    st.unlocked = true;
    st.idle = false;
    s.lastActivity = s.now;
  } else st.status = "waiting";
}

function onGit(
  s: EngineState,
  ev: HostInputOf<"git">,
  effects: Effect[],
  rRuns: boolean,
) {
  const w = watching(s);
  if (w?.git && !answersGit(w, ev)) return;
  s.git = { paths: ev.paths, error: null };
  if (rRuns || !onCard(s)) return;
  const beat = currentBeat(s);
  if (!isGitVerify(beat.verify)) return;
  const st = s.beat;
  if (["done", "already"].includes(st.status)) return;
  // A beat that needs git status to list something starts from what it
  // lists first, as a check does.
  if (needsChange(beat.verify)) {
    const r = judgeGit(
      beat.verify,
      ev,
      SINCE_GIT.has(beat.verify.kind) ? gitSince(s, ev, effects) : undefined,
    );
    // Nothing changing is the work: the first look can say not yet.
    if (beat.verify.kind === "git-unchanged" && st.baseline === undefined)
      st.baseline = null;
    decide(
      s,
      { ...ev, evidence: r.evidence },
      effects,
      r.pass ? null : { hint: r.hint },
    );
    return;
  }
  const listed = cleanListed(beat.verify, ev.paths);
  const clean = listed.length === 0;
  // With a done-label, the tree decides only after the learner says the
  // session has ended; before that it is shown live.
  if (beat.doneLabel && !st.ended) {
    if (st.status === "opening") st.status = "waiting";
    return;
  }
  st.error = null;
  if (clean) {
    st.status = "done";
    st.rung = -1;
    st.confirm = false;
    effects.push({ type: "save" });
    return;
  }
  st.status = "fail";
  st.unlocked = true;
  st.fail = { paths: listed };
  st.explicit = false;
}

// How git was when a head-moved or git-unchanged beat's step (or the step
// it names) opened: the stamp taken then, or, where none was, this result,
// kept as the stamp. `n` is that step's number on screen.
function gitSince(s: EngineState, ev: GitResult, effects: Effect[]) {
  const v = currentBeat(s).verify;
  const stamps = progressOf(s).stamps;
  const key = answerKey(s);
  if (!(key in stamps)) {
    stamps[key] =
      v.kind === "head-moved" ? (ev.head ?? "") : statusStamp(ev.paths);
    effects.push({ type: "save" });
  }
  return {
    stamp: must(stamps[key], "the stamp just kept"),
    n: stepsOf(s).findIndex((x) => x.id === (v.since ?? currentStep(s).id)) + 1,
  };
}

// What a git probe answered (ticket 105), for the probe beat on screen. A
// fresh one passes only once its `state` changed since its step opened.
function onProbe(
  s: EngineState,
  ev: HostInputOf<"probe">,
  effects: Effect[],
  rRuns: boolean,
) {
  if (rRuns || !onCard(s)) return;
  const beat = currentBeat(s);
  const v = beat.verify;
  if (
    v.kind !== "probe" ||
    ev.name !== v.name ||
    !sameJson(ev.args, v.args) ||
    ["done", "already"].includes(s.beat.status)
  )
    return;
  decide(
    s,
    {
      ...ev,
      path: beat.evidence,
      stamp: ev.state ?? null,
      evidence: ev.evidence ?? null,
    },
    effects,
    ev.pass ? null : { hint: ev.hint },
  );
}

// ---- the Learner's actions ---------------------------------------------------
export const isDone = (st: BeatState | null | undefined) =>
  st?.status === "done" || st?.status === "already";
// The y/n before the exact command: while it is up, only its answer acts.
const yesNo = (s: EngineState) => Boolean(s.beat?.confirm) && !isDone(s.beat);
// On the card, its beat not done and no y/n up: where an answer acts.
const answering = (s: EngineState) => onCard(s) && !isDone(s.beat) && !yesNo(s);
const openQuestion = (s: EngineState) =>
  Boolean(questionOf(currentBeat(s))) && !beatState(s).answer;
// An action comes over the wire: its fields are checked, not trusted.
const inRange = (option: unknown, n: number): option is number =>
  typeof option === "number" &&
  Number.isInteger(option) &&
  option >= 0 &&
  option < n;
const pathOf = (to: unknown) =>
  typeof to === "object" &&
  to !== null &&
  "path" in to &&
  typeof to.path === "string"
    ? to.path.trim()
    : "";
// String() keeps the JavaScript engine's coercion of a malformed answer.
// eslint-disable-next-line @typescript-eslint/no-base-to-string
const textOf = (text: unknown) => String(text ?? "");
const steppingDown = (s: EngineState) => s.phase === "step-down";
// What a folder answer can be for: a level with a work folder, or a lesson
// that runs in a new copy.
const answersFolder = (s: EngineState, key: FolderKey) =>
  isWorkLevel(s, key) ||
  (Boolean(lessonOf(s, key)) && folderKey(s, key) === key);

// The step-down's accept: its tier joins the lesson's levels and the step
// opens.
function stepDown(s: EngineState, effects: Effect[], more: boolean) {
  const p = progressOf(s);
  const to = must(s.levelTo, "no level to step down to");
  if (!p.levels.includes(to)) p.levels.push(to);
  // More help where it gives nothing goes on like accept.
  if (more && moreHelpGives(s)) {
    const step = currentStep(s);
    p.moreHelpAt = step.id;
    // More help gives this step the help an ease that landed here gave, so
    // the ease waits for a later step.
    if (p.easedSteps[step.id]) {
      Reflect.deleteProperty(p.easedSteps, step.id);
      if (!s.eased.includes(step.skill)) s.eased.push(step.skill);
    }
  }
  s.phase = "playing";
  openBeat(s, effects);
}

// Each action's handler. A guard that fails returns false and changes
// nothing: an action that can't act where the Learner is does nothing.
const ACTIONS: ActionHandlers = {
  "welcome.finish"(s, _a, effects) {
    if (s.welcomed) return false;
    s.welcomed = true;
    s.phase = "overview";
    effects.push({ type: "save" });
    return true;
  },
  // Resumes the lesson's play, or shows its overview. A lesson with no
  // lesson file has neither.
  "lesson.open"(s, { lesson }, effects) {
    if (!lessonOf(s, lesson)?.content) return false;
    startLesson(s, lesson, effects);
    return true;
  },
  // Not while the overview's folder question is open: no Check runs until
  // it has its answer.
  "lesson.start"(s, { help }, effects) {
    if (!inOverview(s) || asksFolder(s)) return false;
    // A finished lesson played again keeps its badge and its ticks, but
    // every fresh check waits for new work and the help starts from the plan.
    const p = progressOf(s);
    p.lessHelp = help === "less";
    startPlay(p);
    // The steps it is played under, so a later change starts it again.
    p.fingerprint = fingerprint(
      must(contentOf(s), `no content for ${s.lesson}`),
    );
    forgetHelp(s, s.lesson);
    s.changed = s.changed.filter((id) => id !== s.lesson);
    s.answeredNow = s.answeredNow.filter((k) => !k.startsWith(`${s.lesson}.`));
    chooseWarmups(s);
    openStep(s, 0, effects);
    return true;
  },
  // The browser confirms first. It keeps the eases, the misses and the
  // answers of this sitting, and a finished lesson keeps its Badge: a
  // replay never awards one again (spec, Rewards and Mastery).
  "lesson.restart"(s, { lesson }, effects) {
    if (!lessonOf(s, lesson)) return false;
    const { complete, help } = progressOf(s, lesson);
    s.progress[lesson] = {
      ...blankProgress(),
      complete,
      ...(help && { help }),
    };
    forgetHelp(s, lesson);
    s.changed = s.changed.filter((id) => id !== lesson);
    s.lesson = lesson;
    s.phase = "overview";
    effects.push({ type: "save" });
    return true;
  },
  "lesson.next"(s, _a, effects) {
    const next = s.phase === "complete" ? nextLessonOf(s) : null;
    if (!next?.content) return false;
    startLesson(s, next.id, effects);
    return true;
  },
  // The Learner opens a folder answer, or edits the one open: the notes
  // about the last answer go.
  "folder.ask"(s, { key }) {
    if (!answersFolder(s, key) || s.folderAsk?.asked) return false;
    if (s.folderAsk?.key === key)
      Object.assign(s.folderAsk, { missing: null, isCopy: false });
    else s.folderAsk = { key, missing: null, isCopy: false, asked: 0 };
    return true;
  },
  // The practice copy is an answer for a level; another folder goes to the host
  // to look at first (`probed` answers).
  "folder.choose"(s, { key, to }, effects) {
    if (to === "practice-copy") {
      if (!isWorkLevel(s, key)) return false;
      setFolder(s, key, s.facts.root, effects);
      return true;
    }
    const path = pathOf(to);
    if (!path || !answersFolder(s, key)) return false;
    s.asks += 1;
    // In place, so what a screen keeps on the answer stays with it.
    if (s.folderAsk?.key === key)
      Object.assign(s.folderAsk, {
        asked: s.asks,
        missing: null,
        isCopy: false,
      });
    else s.folderAsk = { key, asked: s.asks, missing: null, isCopy: false };
    effects.push({ type: "folder", key, text: path, asked: s.asks });
    return true;
  },
  // The folder answer is dropped: a late `probed` for it says nothing.
  "folder.cancel"(s) {
    s.folderAsk = null;
    return true;
  },
  "step.continue"(s, _a, effects) {
    if (!onCard(s) || !isDone(s.beat)) return false;
    advance(s, effects);
    return true;
  },
  "step.back"(s, _a, effects) {
    if (!onCard(s) || yesNo(s)) return false;
    back(s, effects);
    return true;
  },
  "step.skip"(s, _a, effects) {
    if (!onCard(s) || yesNo(s) || !currentStep(s).optional) return false;
    skipStep(s, effects);
    return true;
  },
  // Back to the step a back line names, where it is offered.
  "step.revisit"(s, _a, effects) {
    const to = backOffered(s);
    if (!to) return false;
    goBack(s, to, effects);
    return true;
  },
  // A typed-answer beat's options are its known wrong answers: it takes
  // only a typed answer.
  "answer.pick"(s, { option }, effects) {
    if (
      !answering(s) ||
      !openQuestion(s) ||
      currentBeat(s).kind === "type" ||
      !inRange(option, currentBeat(s).options.length)
    )
      return false;
    pick(s, option, effects);
    return true;
  },
  "answer.reveal"(s, _a, effects) {
    if (!answering(s) || !openQuestion(s)) return false;
    const beat = currentBeat(s);
    if (
      beat.kind === "predict" ||
      beat.kind === "type" ||
      !beat.options.some((o) => o.kind === "right")
    )
      return false;
    reveal(s, effects);
    return true;
  },
  "answer.type"(s, { text }, effects) {
    if (
      !onCard(s) ||
      yesNo(s) ||
      currentBeat(s).kind !== "type" ||
      s.beat.status === "done"
    )
      return false;
    submitTyped(s, textOf(text), effects);
    return true;
  },
  // Self, none and self-kind beats: the Learner says it is done, and the
  // card goes on.
  "step.markDone"(s, _a, effects) {
    if (!answering(s) || openQuestion(s)) return false;
    const beat = currentBeat(s);
    const v = beat.verify.kind;
    if (v !== "self" && v !== "none" && beat.kind !== "self") return false;
    beatState(s).status = "done";
    advance(s, effects);
    return true;
  },
  // "The session has ended": a git-clean beat with a done-label decides
  // only after it.
  "session.ended"(s, _a, effects) {
    if (!answering(s) || openQuestion(s)) return false;
    const beat = currentBeat(s);
    if (beat.verify.kind !== "git-clean" || !beat.doneLabel) return false;
    const st = beatState(s);
    st.ended = true;
    st.explicit = true;
    effects.push(gitAsk(must(watching(s), "a git-clean beat watches git")));
    return true;
  },
  "check.run"(s, _a, effects) {
    const w = watching(s);
    if (!w || yesNo(s)) return false;
    const beat = currentBeat(s);
    const st = beatState(s);
    st.explicit = true;
    // Asking for a check is a try, whatever the check says.
    st.unlocked = true;
    if (w.git && beat.doneLabel) st.ended = st.ended || st.status === "fail";
    // Show that r's run is going, until its own result lands: r's number
    // goes out on the effect and comes back on the result. `before` keeps
    // the status "Checking" covers, for the hints and the actions.
    s.asks += 1;
    st.before = st.status === "opening" ? st.before : st.status;
    st.status = "opening";
    st.slowWait = false;
    st.asked = s.asks;
    st.running = null;
    if (w.check)
      effects.push({
        type: "check",
        lesson: w.check.lesson,
        items: w.check.items,
        evidence: beat.evidence ?? null,
        slow: true,
        asked: s.asks,
        dir: w.dir,
      });
    if (w.file)
      effects.push({ type: "file", path: w.file, asked: s.asks, dir: w.dir });
    if (w.git) effects.push(gitAsk(w, { asked: s.asks }));
    if (w.probe) effects.push(probeAsk(w, { asked: s.asks }));
    return true;
  },
  // The next rung, or the y/n before the exact command.
  "hint.next"(s) {
    if (!hintAvailable(s) || yesNo(s)) return false;
    const st = beatState(s);
    const rungs = rungsOf(s);
    if (st.rung + 1 === rungs.length - 1 && rungs.at(-1)?.kind === "bottom")
      st.confirm = true;
    else {
      st.rung += 1;
      used(s, "hints");
    }
    return true;
  },
  // The y/n's answer: the exact command eases its skill.
  "hint.takeExact"(s, { take }, effects) {
    if (!onCard(s) || !yesNo(s)) return false;
    const st = s.beat;
    st.confirm = false;
    if (!take) return true;
    st.rung = rungsOf(s).length - 1;
    used(s, "commands");
    if (!s.eased.includes(currentStep(s).skill))
      s.eased.push(currentStep(s).skill);
    progressOf(s).bottomAt = currentStep(s).id;
    effects.push({ type: "save" });
    return true;
  },
  // The long wait's question: answered once, scored nothing.
  "waitQuestion.answer"(s, { option }) {
    const box = whileRunsOpen(s) && !yesNo(s) && whileRunsOf(s);
    if (!box || !inRange(option, box.beat.options.length)) return false;
    must(beatState(s).whileRuns, "a long wait has its question").answer =
      option;
    s.whileShown.push(`${s.lesson}.${box.step.id}`);
    return true;
  },
  "stepDown.accept"(s, _a, effects) {
    if (!steppingDown(s)) return false;
    stepDown(s, effects, false);
    return true;
  },
  "stepDown.moreHelp"(s, _a, effects) {
    if (!steppingDown(s)) return false;
    stepDown(s, effects, true);
    return true;
  },
  "stepDown.back"(s, _a, effects) {
    if (!steppingDown(s)) return false;
    back(s, effects);
    return true;
  },
};
// The inputs a Learner can send: the spec's catalogue, but milestone.shown,
// which comes with milestones in ticket 212, and with folder.ask and
// folder.cancel, which open and drop a folder answer.
export const ACTION_TYPES = Object.keys(ACTIONS) as EngineAction["type"][];

// ---- the reducer -------------------------------------------------------------
// The folder a result has to come from (ticket 183): a stamp's, its fresh
// beat's step's; a result for the step card on screen, that step's; any
// other, its lesson's.
function resultFolder(s: EngineState, ev: HostInputOf<HostInput["type"]>) {
  const id = ev.lesson ?? s.lesson;
  if (ev.type === "stamp") {
    const named = ev.key.slice(0, ev.key.lastIndexOf("."));
    return folderOf(s, id, stepsOf(s, id).find((x) => x.id === named) ?? null);
  }
  return folderOf(
    s,
    id,
    id === s.lesson && onCard(s) && contentOf(s) ? currentStep(s) : null,
  );
}

// A look (moments.ts's work.changed): a result about what the beat on
// screen watches, as a digest of what it judges, or null. A result about
// another lesson, or a git result the beat doesn't read, is none; a look at
// part of the tree also differs when another path is staged.
function lookAt(s: EngineState, ev: EngineInput) {
  const w = watching(s);
  if (ev.type === "check" && w?.check?.lesson === ev.lesson)
    return JSON.stringify([ev.items, evidenceOf(ev.read)]);
  if (ev.type === "file" && w?.file === ev.path) {
    // A beat watches a file only for a verify that reads one.
    const verify = currentBeat(s).verify;
    if (isReadVerify(verify))
      return JSON.stringify(judge(verify, ev.read, readFrom(s, ev)));
  }
  if (ev.type === "git" && answersGit(w, ev))
    return JSON.stringify(
      "head" in ev
        ? [ev.paths, ev.head]
        : ev.files
          ? [ev.paths, ev.staged]
          : ev.paths,
    );
  if (
    ev.type === "probe" &&
    w?.probe?.name === ev.name &&
    sameJson(ev.args, w.probe.args)
  )
    return JSON.stringify([ev.pass, ev.state]);
  return null;
}

// Applies one input to `s` in place and returns the input it handled: a
// result about another folder comes back as `stale`, and an action whose
// guard failed as null.
const isAction = (input: EngineInput): input is EngineAction & EngineInput =>
  Object.hasOwn(ACTIONS, input.type);

// Runs an action's handler. The map pairs each type with its own handler, so
// the one cast says what TypeScript can't follow through the index.
const act = (s: EngineState, action: EngineAction, effects: Effect[]) =>
  (
    ACTIONS[action.type] as (
      s: EngineState,
      a: EngineAction,
      e: Effect[],
    ) => boolean
  )(s, action, effects);

function apply(
  s: EngineState,
  input: EngineInput,
  effects: Effect[],
): EngineInput | null {
  if (isAction(input)) return act(s, input, effects) ? input : null;
  let ev: EngineInput = input;
  // r's run goes until its own result lands: the one that carries the latest
  // r's number, wherever the learner is by then. A poll's result, or an
  // earlier r's, that lands first decides nothing for the beat.
  const result = RESULTS.some((t) => t === ev.type);
  if (result && s.beat?.asked && ev.asked === s.beat.asked) s.beat.asked = 0;
  const rRuns = result && Boolean(s.beat?.asked);
  // One check child runs at a time, so its result means the run that
  // reported has ended: the count goes with it.
  if ((ev.type === "check" || ev.type === "check-error") && s.beat?.running)
    s.beat.running = null;
  // A result about another folder than the one its lesson runs in now (a run
  // asked for before the learner changed it, or for a step in another
  // folder) decides nothing.
  if (
    (result || ev.type === "stamp") &&
    ev.dir !== undefined &&
    ev.dir !== resultFolder(s, ev)
  )
    ev = { ...ev, type: "stale" };
  const look = lookAt(s, ev);
  switch (ev.type) {
    case "check":
      onCheck(s, ev, effects, rRuns);
      break;
    case "run-start": {
      // A child really started (the host's run-start: what it runs, the r
      // number it carries and its folder). Only the run the card says
      // "Checking" for counts, as for `running`: what the beat watches, in
      // its folder, asked by the latest r, or by the beat opening when no r
      // is out. A later r's run keeps the one run going.
      const w = watching(s);
      const asked = ev.asked ?? 0;
      const watched =
        ev.run === "check"
          ? w?.check !== undefined &&
            w.check.lesson === ev.lesson &&
            sameJson(ev.items ?? null, w.check.items)
          : ev.run === "git"
            ? Boolean(w?.git)
            : w?.probe?.name === ev.name;
      if (
        s.beat?.status !== "opening" ||
        !w ||
        !watched ||
        ev.dir !== w.dir ||
        asked !== (s.beat.asked || 0)
      )
        break;
      if (s.beat.run) s.beat.run.asked = asked;
      else s.beat.run = { asked };
      break;
    }
    case "running": {
      // The check child starts its nth item of m. Only the run the card says
      // "Checking" for counts: this beat's check (its lesson and its items,
      // so a run the beat before asked for, still going, is not it), asked
      // by the latest r, or by the beat opening when no r is out.
      const w = watching(s)?.check;
      if (
        s.beat?.status === "opening" &&
        (ev.asked ?? 0) === (s.beat.asked || 0) &&
        w !== undefined &&
        w.lesson === ev.lesson &&
        sameJson(ev.items ?? null, w.items)
      )
        s.beat.running = { n: ev.n, m: ev.m };
      break;
    }
    case "check-error":
      s.checks[ev.lesson] = {
        ...(s.checks[ev.lesson] ?? {}),
        error: ev.message,
      };
      if (
        !rRuns &&
        onCard(s) &&
        currentBeat(s).verify.kind === "check" &&
        !["done", "already"].includes(s.beat.status)
      ) {
        Object.assign(s.beat, {
          status: "broken",
          error: ev.message,
          rung: -1,
          confirm: false,
        });
      }
      break;
    case "git":
      onGit(s, ev, effects, rRuns);
      break;
    case "probe":
      onProbe(s, ev, effects, rRuns);
      break;
    case "probe-error":
      if (
        !rRuns &&
        onCard(s) &&
        currentBeat(s).verify.kind === "probe" &&
        !["done", "already"].includes(s.beat.status)
      ) {
        Object.assign(s.beat, {
          status: "broken",
          error: ev.message,
          rung: -1,
          confirm: false,
        });
      }
      break;
    case "file":
      onFile(s, ev, effects, rRuns);
      break;
    case "stamp": {
      const stamps = s.progress[s.lesson]?.stamps;
      if (stamps && !(ev.key in stamps) && ev.stamp !== null) {
        stamps[ev.key] = ev.stamp ?? "";
        effects.push({ type: "save" });
      }
      break;
    }
    case "git-error":
      s.git = { paths: [], error: ev.message };
      if (
        !rRuns &&
        onCard(s) &&
        GIT.has(currentBeat(s).verify.kind) &&
        !["done", "already"].includes(s.beat.status)
      ) {
        Object.assign(s.beat, {
          status: "broken",
          error: ev.message,
          rung: -1,
          confirm: false,
        });
      }
      break;
    case "tick":
      // A long wait (ticket 103) is quiet by design: no offer, no unlock.
      if (
        onCard(s) &&
        !["done", "already"].includes(s.beat.status) &&
        !longWait(s) &&
        s.now - s.lastActivity >= IDLE_MS
      ) {
        s.beat.idle = true;
        s.beat.unlocked = true;
      }
      break;
    case "facts":
      // Root `.practice/` came: the place so far is saved at last.
      if (ev.facts.practiceDir && !s.facts.practiceDir)
        effects.push({ type: "save" });
      Object.assign(s.facts, ev.facts);
      break;
    case "commands":
      Object.assign(s.commands, ev.found);
      break;
    case "prereq":
      onPrereq(s, ev);
      break;
    case "activity":
      // A file changed or git moved: the learner is working, so no "stuck?" offer.
      s.lastActivity = s.now;
      if (s.beat) s.beat.idle = false;
      // A change moments.ts says (work.changed): the look it brings says
      // nothing more.
      if (watching(s) && s.beat && !s.beat.run) s.beat.touched = true;
      break;
    // Something the Learner should read (a save that failed): no state
    // changes, and moments.ts says it.
    case "notice":
      break;
    case "probed": {
      // What the host found at a folder: kept for the notes, and, for the ask
      // the answer is waiting on, the answer.
      const found = {
        missing: ev.missing,
        git: ev.git,
        gitBroken: ev.gitBroken ?? null,
        practice: ev.practice,
      };
      s.probes[ev.path] = found;
      const a = s.folderAsk;
      if (!ev.key || !a || a.key !== ev.key || a.asked !== ev.asked) break;
      const newCopy = !isWorkLevel(s, ev.key);
      // A new copy's project/ given for the copy saves the copy itself.
      const tail = projectOf(s, "");
      const parent = ev.path.slice(0, -tail.length);
      const path =
        newCopy && ev.path.endsWith(tail) && !inCopy(s, parent)
          ? parent
          : ev.path;
      if (path !== ev.path) s.probes[path] = found;
      if (ev.missing) Object.assign(a, { asked: 0, missing: ev.path });
      // A new copy is another folder than this practice copy, or its project/.
      else if (newCopy && inCopy(s, path))
        Object.assign(a, { asked: 0, isCopy: true });
      else setFolder(s, ev.key, path, effects);
      break;
    }
    default:
      break;
  }
  if (look !== null && s.beat) Object.assign(s.beat, { look, touched: false });
  return ev;
}

// An overview that opens looks again at what its lesson needs, and so does
// one whose folder changed or got its answer. Each ask for prerequisites has
// its number, so an answer to an older one that comes late says nothing.
function settle(prev: EngineState, s: EngineState, effects: Effect[]) {
  if (
    inOverview(s) &&
    (!inOverview(prev) ||
      prev.lesson !== s.lesson ||
      folderOf(prev) !== folderOf(s) ||
      asksFolder(prev) !== asksFolder(s))
  ) {
    effects.push(
      ...introAsks(s).map((e) =>
        e.type === "prereqs" ? { ...e, asked: ++s.prereqAsks } : e,
      ),
    );
  }
}

// The engine's interface: one input, the state after it, the effects it
// asks for and the moments to react to once (moments.ts).
export function reduce(prev: EngineState, input: EngineInput) {
  const s: EngineState = {
    ...clone({ ...prev, course: null }),
    course: prev.course,
  };
  const effects: Effect[] = [];
  if (input.now !== undefined) s.now = input.now;
  if (typeof input.epoch === "number") s.epoch = input.epoch;
  const handled = apply(s, input, effects);
  settle(prev, s, effects);
  // A started run ends as the status leaves "opening".
  if (s.beat?.run && s.beat.status !== "opening") s.beat.run = null;
  return { state: s, effects, events: momentsOf(prev, s, handled) };
}
