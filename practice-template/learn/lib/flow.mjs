// Every transition of the app, as a pure function: reduce(state, event)
// returns { state, effects }. Effects ask the wiring in main.mjs to run a
// check, read git status, save progress or quit; their results come back as
// events. Nothing here reads a file, a clock or the terminal.
import { GIT, isChoice, PATH_MAX, READS, SINCE_GIT, WORK_LEVELS } from './content.mjs';
import { C } from './copy.mjs';
import { evidenceOf, grewFrom, judge } from './holds.mjs';
import { cleanListed, eachFile, judgeGit, needsChange, statusStamp } from './status.mjs';
import { effectiveTier, ruleTiers, TIERS } from './tiers.mjs';

export const IDLE_MS = 120_000;
// The longest the reading grace holds ambient motion (motion.mjs).
export const GRACE_MAX_MS = 20_000;
export const HINT_LOCK_MS = 2_000;
export const DEFER_MS = 300;
const SWALLOW_MS = 800;
const TOAST_MS = 5_000;
// The file-change stamps kept before the newest (motion.mjs's shotStarts).
const ACTIVITY_KEPT = 8;

const clone = (x) => structuredClone(x);
const blankProgress = () => ({ step: null, beat: 0, done: [], answers: {}, levels: [], lessHelp: false, moreHelpAt: null, easedSteps: {}, complete: false, warm: [], recalled: [], stamps: {}, bottomAt: null });
// How many warm-up questions open a lesson, at most: one, on a skill the
// learner missed (ticket 194, the lesson value rework's rule 4).
export const WARMUPS = 1;

// The screens Pip greets the learner on, once per opening (176).
const GREETS = ['welcome', 'resume'];

export function initialState({ course, saved = null, facts, now = 0 }) {
  const progress = {};
  for (const l of course) {
    const p = saved?.lessons?.[l.id];
    progress[l.id] = { ...blankProgress(), ...(p ?? {}) };
    if (l.content) {
      // Unknown step ids from an older content file start that lesson's place over.
      const pr = progress[l.id];
      pr.warm = pr.warm.filter((id) => l.content.warmup.some((w) => w.id === id));
      pr.recalled = pr.recalled.filter((id) => l.content.warmup.some((w) => w.id === id));
      const steps = playOrder(l.content, pr);
      const ids = new Set(steps.map((s) => s.id));
      pr.done = pr.done.filter((id) => ids.has(id));
      if (!ids.has(pr.moreHelpAt)) pr.moreHelpAt = null;
      const step = steps.find((x) => x.id === pr.step);
      if (!step) Object.assign(pr, { step: null, beat: 0 });
      else if (!(pr.beat >= 0 && pr.beat < step.beats.length)) pr.beat = 0;
      else if (!beatShown(pr, step.beats[pr.beat])) pr.beat = shownBefore(pr, step, pr.beat);
    }
  }
  const open = course.find((l) => l.content && progress[l.id].step && !progress[l.id].complete)
    ?? course.find((l) => l.content && !progress[l.id].complete);
  const folders = { ...(saved?.folders ?? {}) };
  // Every lesson in the app is done: open the map at the next lesson, or
  // where only lessons that run in a new copy with no folder saved are left,
  // at the first of them.
  const next = open ?? course.find((l) => toFinish({ progress, folders }, l)) ?? course.find((l) => !progress[l.id].complete) ?? course[0];
  const welcomed = Boolean(saved?.welcomed);
  const eased = saved?.eased ?? [];
  // A warm-up the learner quit on with its skill eased was most likely missed
  // just before: its answer was shown, so asking it again recalls nothing.
  const answeredNow = [];
  for (const l of course) {
    const pr = progress[l.id];
    const w = l.content?.warmup.find((x) => x.id === pr.step && pr.warm.includes(x.id));
    if (w && eased.includes(w.beats[pr.beat]?.skill ?? w.skill)) answeredNow.push(`${l.id}.${w.id}`);
  }
  const view = !welcomed ? 'welcome' : !open ? 'map' : progress[open.id].step ? 'resume' : 'intro';
  return {
    course, facts, progress, now,
    eased,
    missed: saved?.missed ?? [],
    missedNow: [],
    answeredNow,
    // The warm-ups a long wait's box asked in this sitting (ticket 150), in
    // memory only: `lesson.id`.
    whileShown: [],
    welcomed,
    view,
    overlay: null, lesson: next.id, pos: { step: 0, beat: 0 }, beat: null,
    checks: {}, git: null, session: 0, cursor: 0, mapCursor: course.indexOf(next), toast: null,
    held: null, swallowUntil: 0, confirmRestart: false, lastActivity: now,
    // The first card entry the c overlay shows, and the first item the
    // check-only card shows, in memory.
    cardAt: 0, itemsAt: 0,
    // How many times r asked for a run, in memory: each r's number goes out
    // on its effect and comes back on its result (`asked`).
    asks: 0,
    // r's run on the check-only card of a lesson with a slow item, until its
    // own result lands: its lesson, r's number and how far the child has
    // got, in memory.
    checkOnlyRun: null,
    // The motion layer's stamps (stampFx): the first screen appears now,
    // and Pip greets on it if it is the welcome or resume.
    fx: GREETS.includes(view) ? { view: now, greet: now } : { view: now },
    // The work folders the learner chose, saved (folderOf reads them), and
    // what the app found in each folder it looked at, in memory.
    folders,
    probes: {},
    // The path prompt while it is open: whose folder it asks for, what is
    // typed, the folder it last found missing, and the number of the ask
    // main is looking at, in memory.
    folderAsk: null,
    // The lesson whose intro took the answer, which then shows it, in memory.
    folderAnswered: null,
    // What main found on the PATH, { command: true or false }, and, for
    // each lesson, the folder its prerequisites were looked at in and what
    // each one came to, { dir, met: { index: { pass, hint, asked } } }, with
    // the number of the latest ask for them: in memory.
    commands: {},
    prereqs: {},
    prereqAsks: 0,
  };
}

// ---- lookups -----------------------------------------------------------------
export const lessonOf = (s, id = s.lesson) => s.course.find((l) => l.id === id);
// A lesson's level, from its PATH entry: 'beginner' for b-2.
export const levelOf = (s, id = s.lesson) => lessonOf(s, id)?.level;
// The lessons of a level, in course order, capstone last.
export const levelLessons = (s, level) => s.course.filter((l) => l.level === level);
// The course's levels, in course order.
export const levelsOf = (s) => [...new Set(s.course.map((l) => l.level))];
// A lesson's number within its level, as its page says "Lesson 2 of 8".
export const lessonNumber = (s, id = s.lesson) => levelLessons(s, levelOf(s, id)).findIndex((l) => l.id === id) + 1;
export const contentOf = (s, id = s.lesson) => lessonOf(s, id)?.content;
// Where a lesson pins its folder: 'copy', the practice copy whatever its
// level's work folder is (i-capstone), or 'new copy', the new copy of the
// template it asks for (a-5, a-capstone). Its lesson file's front matter
// says so, or, while it has none, its PATH entry.
export const pinOf = (l) => l.content?.folder ?? l.folder ?? (l.newCopy ? 'new copy' : null);
// What a lesson's folder is saved under: its level, or the lesson itself for
// one that runs in a new copy. Beginner, and a lesson pinned to the copy,
// have none.
export function folderKey(s, id = s.lesson) {
  const l = lessonOf(s, id);
  if (pinOf(l) === 'new copy') return l.id;
  return pinOf(l) === 'copy' ? null : levelKey(s, id);
}
// A lesson's level where that level practises in a work folder: Intermediate
// or Advanced. Null for Beginner.
export const levelKey = (s, id = s.lesson) => (WORK_LEVELS.includes(levelOf(s, id)) ? levelOf(s, id) : null);
// A later level's work folder: the one saved for it, the practice copy by default.
export const levelFolder = (s, level) => s.folders[level] ?? s.facts.root;
// The folder a lesson's check, git status and file reads run in: its work
// folder, the practice copy by default. A lesson that runs in a new copy has
// none (null) until the learner gives it, and no check runs for it before.
// With `step`, the folder that step runs in: a Worked example step of a
// lesson whose front matter says `worked: copy` runs in the practice copy,
// every other step in its lesson's folder (ticket 183). Every choice of a
// folder for a step comes through here: its verifies, its fresh stamps, the
// watcher and the header. Without a step, the lesson's own folder, where
// its prerequisites, its notes and its first look are.
export function folderOf(s, id = s.lesson, step = null) {
  const l = lessonOf(s, id);
  if (pinOf(l) === 'new copy') return s.folders[l.id] ?? null;
  if (step?.part === 'Worked example' && l.content?.worked === 'copy') return s.facts.root;
  const k = folderKey(s, id);
  return (k && s.folders[k]) || s.facts.root;
}
// The step the screen is about: the one on a step card or its level-up,
// and the one a resume screen goes back to. Null on any other screen.
export function stepHere(s) {
  if (!contentOf(s)) return null;
  if (s.view === 'step' || s.view === 'levelup') return stepOf(s) ?? null;
  if (s.view === 'resume') return stepsOf(s).find((x) => x.id === s.progress[s.lesson].step) ?? null;
  return null;
}
// The folder of what the screen shows (ticket 183): its step's where there
// is one, else the lesson's. The header, the watcher and a card's place read it.
export const folderHere = (s) => folderOf(s, s.lesson, stepHere(s));
// A lesson whose Check passed with its Tear down still to do (ticket 102):
// it completes only after its last Tear down step.
export const tearDownLeft = (s, id = s.lesson) => {
  const p = s.progress[id];
  return Boolean(contentOf(s, id)?.steps.some((x) => x.part === 'Tear down')) && !p.complete && p.done.includes('C');
};
// A lesson the learner can still finish: not complete, and not one that
// runs in a new copy of the template while that copy's folder is not saved,
// as no check of it runs until then. The next lesson the map marks and
// opens at is one of these.
export const toFinish = ({ progress, folders }, l) => !progress[l.id].complete && (pinOf(l) !== 'new copy' || Boolean(folders[l.id]));
// What the check-only card says above a lesson's items.
export const checkOnlyWords = (s, l) => (pinOf(l) !== 'new copy' ? C.checkOnly : folderOf(s, l.id) ? C.newCopyAt : C.newCopy);
// The steps a learner meets, in order: the warm-up questions chosen when the
// lesson started, then the lesson's own steps.
const playOrder = (content, p) => [...p.warm.map((id) => content.warmup.find((w) => w.id === id)).filter(Boolean), ...content.steps];
export const stepsOf = (s, id = s.lesson) => (contentOf(s, id) ? playOrder(contentOf(s, id), s.progress[id]) : []);
export const stepOf = (s) => stepsOf(s)[s.pos.step];
export const beatOf = (s) => stepOf(s).beats[s.pos.beat];
// Whether a beat shows (ticket 104): one with a when line only while the
// saved pick on its choice is its option. The store keeps 200 characters of
// a pick, so a pick made in this sitting compares as a saved one does.
export const beatShown = (p, beat) => !beat.when || p.answers[`${beat.when.step}.${beat.when.beat}`]?.slice(0, 200) === beat.when.option.slice(0, 200);
// The step's next beat that shows after beat `at`, or -1; and its last one
// that shows before `at`, or -1. A step's first beat always shows.
const shownAfter = (p, step, at) => step.beats.findIndex((b, i) => i > at && beatShown(p, b));
const shownBefore = (p, step, at) => step.beats.findLastIndex((b, i) => i < at && beatShown(p, b));
// Whether the beat on screen is the last of its step that shows.
export const isLastBeat = (s) => shownAfter(s.progress[s.lesson], stepOf(s), s.pos.beat) < 0;

// What this learner did with each skill: `steps` holds "k skill" for each
// lesson k where they finished one of its own steps on it (warm-ups aside),
// `finished` those skills, and `recalled` the skills of the warm-ups they
// answered right the first time, in any lesson.
function history(s) {
  const steps = new Set();
  const finished = new Set();
  const recalled = new Set();
  s.course.forEach((l, k) => {
    if (!l.content) return;
    const p = s.progress[l.id];
    for (const step of l.content.steps) {
      if (!p.done.includes(step.id)) continue;
      steps.add(`${k} ${step.skill}`);
      finished.add(step.skill);
    }
    for (const id of p.recalled) {
      const w = l.content.warmup.find((x) => x.id === id);
      for (const b of w?.beats ?? []) recalled.add(b.skill ?? w.skill);
    }
  });
  return { steps, finished, recalled };
}
// Your card (the c overlay): every lesson's card entries, in course order,
// whose skill the learner finished one of that lesson's own steps on, read
// from done. An entry's pill names its lesson, so only that lesson's steps
// count: a skill an earlier lesson also teaches shows nothing early.
export function cardOf(s) {
  const { steps } = history(s);
  return s.course.flatMap((l, k) => (l.content?.card ?? []).filter((e) => steps.has(`${k} ${e.skill}`)).map((e) => ({ ...e, lesson: l.id })));
}
// The entries the next screen asks the learner to recall: this lesson's own
// on the card.
export const recallOf = (s) => cardOf(s).filter((e) => e.lesson === s.lesson);
// The overlays the arrows scroll, each by its entries: one place an entry,
// then the Commands by level link, the last (render.mjs); the intro's notes
// one place a note.
const SCROLLED = { card: cardOf, compare: recallOf, notes: (s) => introNotes(s).slice(1) };
// One place a press of the arrows, from 0 to `max`: a place past `max`, as
// before a resize, counts as `max`, so up moves at once.
const arrowed = (at, max, name) => Math.max(0, Math.min(max, Math.min(at, max) + (name === 'down' ? 1 : -1)));
// Where the next screen's enter goes: the next lesson, or null for the map.
export const nextLessonOf = (s) => {
  const id = contentOf(s)?.next;
  return (id && lessonOf(s, id)) || null;
};
// Whether the learner did what the step on screen asks again: finished a
// step on its skill, in any lesson. A capstone step draws on every lesson
// before it, so there it takes a finished step on every skill they teach.
export function doneBefore(s) {
  const { finished } = history(s);
  if (!s.lesson.endsWith('capstone')) return finished.has(stepOf(s).skill);
  const idx = s.course.findIndex((l) => l.id === s.lesson);
  return s.course.slice(0, idx).every((l) => (l.content?.steps ?? []).every((x) => x.optional || finished.has(x.skill)));
}

// Each step's tier in play order. A warm-up recalls an earlier lesson from
// memory, so it is always CHALLENGE and counts toward no skill's fading.
// Help fades only for what this learner did: an earlier lesson counts toward
// a skill once they finished a step on it there, and every lesson does once a
// warm-up on it was right the first time. g on a level-up and an ease each
// give a step one tier more help, and together still one.
export function tiersOf(s, id = s.lesson) {
  const contents = s.course.map((l) => l.content);
  const idx = s.course.findIndex((l) => l.id === id);
  const p = s.progress[id];
  const h = history(s);
  const rule = ruleTiers(contents, idx, (k, skill) => h.steps.has(`${k} ${skill}`) || h.recalled.has(skill));
  const steps = stepsOf(s, id);
  const more = moreHelp(p, steps);
  return steps.map((step, i) => {
    if (step.part === 'Warm-up') return 'challenge';
    const t = rule[contents[idx].steps.indexOf(step)];
    return effectiveTier(t, { lessHelp: p.lessHelp, eased: more[i] || Boolean(p.easedSteps[step.id]) });
  });
}
// Which steps g on a level-up gives one tier more help: the step it was
// pressed on and every one after it in play order, but the Check.
function moreHelp(p, steps) {
  const from = steps.findIndex((x) => x.id === p.moreHelpAt);
  return steps.map((step, i) => from !== -1 && i >= from && step.part !== 'Check');
}
// Whether g on the level-up on screen gives any step more help. Not on the
// Check, which stays CHALLENGE, nor after an earlier g, which covers every
// step this one would: so g never moves `moreHelpAt` later and takes back
// help already given.
export function moreHelpGives(s) {
  const p = s.progress[s.lesson];
  const step = stepOf(s);
  const easedSteps = Object.fromEntries(Object.entries(p.easedSteps).filter(([id]) => id !== step.id));
  const after = tiersOf({ ...s, progress: { ...s.progress, [s.lesson]: { ...p, moreHelpAt: step.id, easedSteps } } });
  return tiersOf(s).some((t, i) => TIERS.indexOf(after[i]) < TIERS.indexOf(t));
}
export function authoredTier(s) {
  const step = stepOf(s);
  if (step.part === 'Warm-up') return 'challenge';
  const idx = s.course.findIndex((l) => l.id === s.lesson);
  return ruleTiers(s.course.map((l) => l.content), idx)[contentOf(s).steps.indexOf(step)];
}
export const tierOf = (s) => tiersOf(s)[s.pos.step];

// What the wiring should keep an eye on for the beat on screen.
// `dir` is the folder it runs in.
export function watching(s) {
  const dir = folderHere(s);
  // A lesson that runs in a new copy has no check to run until it has one.
  if (s.view === 'checkonly') return dir ? { check: { lesson: s.lesson, items: null }, dir } : null;
  if (s.view !== 'step' || !s.beat) return null;
  if (['done', 'already'].includes(s.beat.status)) return null;
  const v = beatOf(s).verify;
  if (v.kind === 'check') return { check: { lesson: s.lesson, items: v.all ? null : v.items }, dir };
  if (READS.has(v.kind)) return { file: v.path, dir };
  if (GIT.has(v.kind)) return { git: true, dir, ...(eachFile(v) ? { files: true } : {}), ...(v.kind === 'head-moved' ? { head: true } : {}) };
  if (v.kind === 'probe') return { probe: { name: v.name, args: v.args }, dir };
  return null;
}
// The effect that asks git about what `w` watches, in its folder.
const gitAsk = (w, extra = {}) => ({ type: 'git', ...extra, dir: w.dir, ...(w.files ? { files: true } : {}), ...(w.head ? { head: true } : {}) });
// The effect that runs the probe `w` watches (ticket 105).
const probeAsk = (w, extra = {}) => ({ type: 'probe', ...extra, name: w.probe.name, args: w.probe.args, dir: w.dir });
// Whether a git result answers what `w` watches: a beat on part of the tree
// reads only one that lists each untracked file, and a whole-tree beat only
// one that lists what git status shows; a head-moved beat only one that
// says where HEAD is.
const answersGit = (w, ev) => Boolean(w?.git) && Boolean(ev.files) === Boolean(w.files) && ('head' in ev) === Boolean(w.head);

// The intro that holds the folder question: a lesson that runs in a new
// copy; for a level, the first of its intros the learner opens while it has
// no answer, its first lesson's, and the one the answer was given on, which
// then shows the answer.
export function asksHere(s) {
  const key = folderKey(s);
  if (!key) return false;
  return key !== levelOf(s) || !(key in s.folders) || s.folderAnswered === s.lesson || levelLessons(s, key)[0].id === s.lesson;
}
// The intro asks where to practise until there is an answer. A folder given
// with --dir, or on the map, is one.
export const asksFolder = (s) => s.view === 'intro' && asksHere(s) && !(folderKey(s) in s.folders);
// The answers it offers: this practice copy, or another folder; a lesson
// that runs in a new copy offers only its folder.
export const folderOptions = (s) => (folderKey(s) === levelOf(s) ? ['copy', 'other'] : ['other']);

function askFolder(s, key) {
  s.overlay = 'folder';
  s.folderAsk = { key, typed: '', missing: null, isCopy: false, asked: 0 };
}

// The learner's answer: saved, and from now on where that key's lessons
// run. What a check found in the folder before, and the states a fresh
// check compares its file with, say nothing about another one. A step that
// stays where it was, a Worked example in the practice copy (ticket 183),
// keeps its states.
function setFolder(s, key, path, effects) {
  const moved = s.course.filter((l) => folderKey(s, l.id) === key && folderOf(s, l.id) !== path).map((l) => l.id);
  const where = (id) => new Map(stepsOf(s, id).map((x) => [x.id, folderOf(s, id, x)]));
  const was = new Map(moved.map((id) => [id, where(id)]));
  s.folders[key] = path;
  for (const id of moved) {
    delete s.checks[id];
    const now = where(id);
    const stays = (k) => {
      const step = k.slice(0, k.lastIndexOf('.'));
      return now.has(step) && now.get(step) === was.get(id).get(step);
    };
    s.progress[id].stamps = Object.fromEntries(Object.entries(s.progress[id].stamps).filter(([k]) => stays(k)));
  }
  if (s.checkOnlyRun && moved.includes(s.checkOnlyRun.lesson)) s.checkOnlyRun = null;
  if (s.folderAsk?.key === key) {
    s.folderAsk = null;
    s.overlay = null;
  }
  // The intro's menu is the start options now: the cursor goes to the first.
  if (s.view === 'intro') {
    s.cursor = 0;
    s.folderAnswered = s.lesson;
  }
  effects.push({ type: 'save' });
  if (s.view === 'checkonly' && folderKey(s) === key) effects.push({ type: 'check', lesson: s.lesson, items: null, dir: path });
}

// The path prompt's keys: a pasted path arrives whole (onPaste), typed
// keys one at a time. Enter sends the path to main to look at; an empty line
// is the practice copy, where the copy is an answer. While main looks, only
// Esc works.
function folderKeyPress(s, { name, ch }, effects) {
  const a = s.folderAsk;
  if (name === 'escape') {
    s.overlay = null;
    s.folderAsk = null;
    return;
  }
  if (a.asked) return;
  if (name === 'enter') {
    const text = a.typed.trim();
    if (text) {
      s.asks += 1;
      Object.assign(a, { asked: s.asks, missing: null, isCopy: false });
      effects.push({ type: 'folder', key: a.key, text, asked: s.asks });
    } else if (WORK_LEVELS.includes(a.key)) setFolder(s, a.key, s.facts.root, effects);
    return;
  }
  if (name === 'backspace') a.typed = a.typed.slice(0, -1);
  else if (ch && ch >= ' ') a.typed = (a.typed + ch).slice(0, PATH_MAX);
  else return;
  Object.assign(a, { missing: null, isCopy: false });
}

// ---- what a lesson needs (ticket 89) ----------------------------------------
// The groups of commands the lesson's page needs here: a Linux-only one on
// Linux alone.
const needsHere = (s) => (contentOf(s)?.needs ?? []).filter((n) => !n.linux || s.facts.linux);
// What the intro on screen asks main to look at: the commands it needs,
// and, once its folder question has an answer, its prerequisites there.
export function introAsks(s) {
  if (s.view !== 'intro') return [];
  const names = needsHere(s).flatMap((n) => n.commands);
  const requires = contentOf(s)?.requires ?? [];
  return [...(names.length ? [{ type: 'commands', names }] : []),
    ...(requires.length && !asksFolder(s) && folderOf(s) ? [{ type: 'prereqs', lesson: s.lesson, dir: folderOf(s), requires }] : [])];
}
// A prerequisite main looked at, in the folder it looked in: a check item
// passes or not (null: the run couldn't say, an error); a file is read as a
// `file` beat reads it, done once it holds a line. An answer to an older ask
// than the one already shown says nothing.
function onPrereq(s, ev) {
  const req = contentOf(s, ev.lesson)?.requires?.[ev.at];
  if (!req || ev.dir !== folderOf(s, ev.lesson)) return;
  if (s.prereqs[ev.lesson]?.dir !== ev.dir) s.prereqs[ev.lesson] = { dir: ev.dir, met: {} };
  const asked = ev.asked ?? 0;
  if (asked < (s.prereqs[ev.lesson].met[ev.at]?.asked ?? 0)) return;
  const r = req.path ? judge({ kind: 'file', path: req.path }, ev.read) : { pass: ev.pass ?? null, hint: req.probe ? ev.hint ?? '' : lessonOf(s, req.lesson).items[req.item] };
  s.prereqs[ev.lesson].met[ev.at] = { pass: r.pass, hint: r.hint, asked };
  // An offer that goes takes the cursor on it back to the first option.
  if (s.view === 'intro' && s.lesson === ev.lesson && !asksFolder(s) && s.cursor >= introOptions(s).length) s.cursor = 0;
}
// The intro's prerequisites that failed in the lesson's folder now, with
// what was not there, and whether its lesson is one to offer: only where
// that lesson is practised in the folder that was looked at, so doing it
// there can set this one right.
export function unmet(s) {
  const r = s.prereqs[s.lesson];
  if (!r || r.dir !== folderOf(s) || asksFolder(s)) return [];
  return (contentOf(s)?.requires ?? []).flatMap((req, k) => (r.met[k]?.pass === false ? [{ ...req, hint: r.met[k].hint, offer: Boolean(req.lesson) && folderOf(s, req.lesson) === r.dir }] : []));
}
// The lesson the intro offers to open first: the first failed
// prerequisite's that can set it right.
export const offered = (s) => unmet(s).find((r) => r.offer)?.lesson ?? null;
// The intro's start options, and, where a prerequisite failed, its lesson.
export const introOptions = (s) => ['start', 'less', ...(offered(s) ? ['first'] : [])];
// Each You need line with the commands it names that main found on no PATH
// folder. Nothing until main has looked.
export const missingNeeds = (s) => needsHere(s).map((n) => ({ quote: n.quote, names: n.commands.filter((c) => s.commands[c] === false) })).filter((n) => n.names.length);
// What main found wrong with the lesson's work folder, where it isn't the
// copy (ticket 86): 'missing', 'gitBroken', 'notGit' or 'noPractice'. Null
// until main has looked, and where all is well.
export function folderProblem(s) {
  const dir = folderOf(s);
  const found = dir && dir !== s.facts.root ? s.probes[dir] : null;
  if (!found) return null;
  return found.missing ? 'missing' : found.gitBroken ? 'gitBroken' : !found.git ? 'notGit' : !found.practice ? 'noPractice' : null;
}
// The page's You need line for the learner's own repository (ticket 179),
// where the lesson runs in its level's work folder and that folder is set
// and is not the practice copy: never in a lesson pinned to the copy, nor
// in one that runs in a new copy of the template.
export function repoNeed(s) {
  const k = folderKey(s);
  const dir = k && k === levelKey(s) ? s.folders[k] : null;
  return dir && dir !== s.facts.root ? contentOf(s)?.intro['need-repo'] ?? null : null;
}
// What the intro has to say before the learner starts, a note each: the
// work folder's problem, the page's line for the learner's repository, on
// native Windows the page's note, the commands missing, and each
// prerequisite that failed. n shows them all.
export const introNotes = (s) => [
  ...(!asksFolder(s) && folderProblem(s) ? ['folder'] : []),
  ...(repoNeed(s) ? ['repo'] : []),
  ...(s.facts.win32 && contentOf(s)?.intro['win-note'] ? ['win'] : []),
  ...(missingNeeds(s).length ? ['needs'] : []),
  ...unmet(s).map(() => 'prereq'),
];

// n opens the notes at their first.
function openNotes(s) {
  s.overlay = 'notes';
  s.cardAt = 0;
}

// ---- hints -------------------------------------------------------------------
// The status the hints and the key bar answer to: while r's run goes, the one
// r put "Checking" over, so an open hint, h and the keys stay as they were.
export const hintStatus = (st) => (st.status === 'opening' && st.before) || st.status;

// Point, then teach, then the exact command after a y/n: the check's own
// question for its FAIL message first, the lesson's words next, the bottom
// line last.
export function rungsOf(s) {
  const beat = beatOf(s);
  const lesson = contentOf(s);
  const st = s.beat;
  const rungs = [];
  let bottom = [];
  const hideRuns = hidesRuns(s);
  // A hidden code block waits there whole, as the card would show it.
  const runs = beat.lines.filter((l) => ['run', 'code'].includes(l.key)).map((l) => (l.key === 'code' ? l : { text: l.text, win: l.win }));
  if (hintStatus(st) === 'fail' && st.fail?.item) {
    const ladder = lesson.ladder.find((l) => l.item === st.fail.item);
    const narrow = ladder?.narrow.find((n) => st.fail.hint.includes(n.part));
    if (narrow) rungs.push({ kind: 'ask', text: narrow.question });
    rungs.push({ kind: 'check', text: st.fail.hint });
    for (const h of ladder?.hints ?? []) rungs.push({ kind: 'quote', text: h });
    bottom = ladder?.bottom ?? [];
  }
  for (const h of beat.hints) rungs.push({ kind: 'quote', text: h });
  if (!bottom.length) bottom = [...(hideRuns ? runs : []), ...beat.bottom];
  if (bottom.length) rungs.push({ kind: 'bottom', lines: bottom });
  return rungs;
}

// Where the step's state comes from (ticket 192): the earlier step a `back`
// line names, with its place in play order and its title. The beat's own
// line first; else the ladder block's for the item that FAILs, from a step
// of the part it names, as a Your turn or the Check redoes the Worked
// example on its own. Null where there is none, or none before this step.
export function backTo(s) {
  if (s.view !== 'step' || !s.beat || isDone(s.beat)) return null;
  const st = s.beat;
  const steps = stepsOf(s);
  const item = hintStatus(st) === 'fail' ? st.fail?.item : null;
  const ladder = item ? contentOf(s).ladder.find((l) => l.item === item)?.back : null;
  const part = (back) => steps.find((x) => x.id === back?.step)?.part === stepOf(s).part;
  const back = beatOf(s).back ?? (part(ladder) ? ladder : null);
  const at = back ? steps.findIndex((x) => x.id === back.step) : -1;
  return at >= 0 && at < s.pos.step ? { ...back, at, title: steps[at].title } : null;
}
// Where e goes back offers it: on the same-answer note, or on the hint
// ladder's last rung while it is open.
export function backOffered(s) {
  const back = backTo(s);
  const st = s.beat;
  if (!back || st.confirm) return null;
  const note = st.same && hintStatus(st) === 'fail';
  return note || (st.rung >= 0 && st.rung === rungsOf(s).length - 1) ? back : null;
}

// e: back to the step a back line names. Every saved file and done tick
// stays; the fresh checks stamped there or later lose their stamps, so each
// takes a new one as its step opens again and waits for new work.
function goBack(s, back, effects) {
  const p = s.progress[s.lesson];
  const steps = stepsOf(s);
  const opensAt = (key) => {
    const id = key.slice(0, key.lastIndexOf('.'));
    const beat = steps.find((x) => x.id === id)?.beats[Number(key.slice(key.lastIndexOf('.') + 1))];
    return steps.findIndex((x) => x.id === (beat?.verify.since ?? id));
  };
  p.stamps = Object.fromEntries(Object.entries(p.stamps).filter(([k]) => opensAt(k) < back.at));
  openStep(s, back.at, effects);
}

// A GUIDED step met with less help: its run lines and code block leave the
// card for the bottom rung.
export const hidesRuns = (s) => tierOf(s) !== 'guided' && authoredTier(s) === 'guided';

// The beat's code block where k copies it: in a terminal that takes OSC 52,
// while the block is on screen, on the card or in the open bottom rung.
export function copyable(s) {
  const code = beatOf(s).lines.find((l) => l.key === 'code');
  if (!code || !s.facts.clipboard) return null;
  if (!hidesRuns(s)) return code;
  const st = s.beat;
  if (['done', 'already'].includes(st.status) || st.rung < 0 || st.confirm) return null;
  const rung = rungsOf(s)[st.rung];
  return rung?.kind === 'bottom' && rung.lines.includes(code) ? code : null;
}

// What the learner tries before h opens a hint at CHALLENGE: r on a beat the
// app checks, a pick on a question with a wrong answer, or nothing (null)
// where nothing can fail, so h answers at once.
export function tryFirst(s) {
  const beat = beatOf(s);
  if (beat.verify.kind === 'check' || beat.verify.kind === 'probe' || GIT.has(beat.verify.kind) || READS.has(beat.verify.kind)) return 'r';
  const canMiss = beat.options.some((o) => o.kind === 'wrong' || o.kind === 'decoy');
  return beat.ask && beat.kind !== 'predict' && beat.kind !== 'type' && canMiss ? 'pick' : null;
}

// A beat on screen that waits on a long run (ticket 103): the idle offer
// never fires there, so the motion layer never goes still for it.
export const longWait = (s) => s.view === 'step' && Boolean(s.beat) && !['done', 'already'].includes(s.beat.status) && Boolean(beatOf(s).wait);

// Recall while a long run works (ticket 150): the warm-up a long wait's box
// offers, one of this lesson's pool that its warm-ups did not show and the
// box has not asked, on a missed skill first, then in the file's order. Only
// a question with options: typing would take the card's keys. Never a choice
// (ticket 104): it has no right answer to recall. Never scored.
function whileRunsPick(s) {
  const p = s.progress[s.lesson];
  const missed = (w) => w.beats.some((b) => s.missed.includes(b.skill ?? w.skill));
  const pool = contentOf(s).warmup.filter((w) => !p.warm.includes(w.id) && !s.whileShown.includes(`${s.lesson}.${w.id}`) && w.beats[0].ask && w.beats[0].kind !== 'type' && w.beats[0].options.length && !isChoice(w.beats[0]));
  return [...pool.filter(missed), ...pool.filter((w) => !missed(w))][0]?.id ?? null;
}
// The box's warm-up step, its first beat and the answer picked (an option's
// index, or null), while the long wait lasts; else null.
export function whileRunsOf(s) {
  const id = longWait(s) ? s.beat.whileRuns?.id : null;
  const step = id && contentOf(s).warmup.find((w) => w.id === id);
  return step ? { step, beat: step.beats[0], answer: s.beat.whileRuns.answer } : null;
}
// A question still open in the box: rule 3 holds ambient motion beside it.
export const whileRunsOpen = (s) => whileRunsOf(s)?.answer === null;

export function hintAvailable(s) {
  if (s.view !== 'step' || !s.beat || ['done', 'already'].includes(s.beat.status)) return false;
  if (beatOf(s).kind === 'type') return false;
  const rungs = rungsOf(s);
  if (!rungs.length || s.beat.rung >= rungs.length - 1) return false;
  // A FAIL, r, a first wrong pick or two quiet minutes set `unlocked`.
  if (tierOf(s) === 'challenge' && tryFirst(s)) return s.beat.unlocked;
  return true;
}

// ---- moving through a lesson -------------------------------------------------
function openBeat(s, effects) {
  const step = stepOf(s);
  const beat = beatOf(s);
  const p = s.progress[s.lesson];
  p.step = step.id;
  p.beat = s.pos.beat;
  markEased(s, s.pos.step);
  s.beat = { status: 'waiting', rung: -1, lockUntil: 0, confirm: false, wrongs: [], answer: null, revealed: false, typed: '', typedWrong: 0, feedback: null, idle: false, unlocked: false, explicit: false, ended: false, opened: s.now, eased: Boolean(p.easedSteps[step.id]) };
  const offer = beat.wait ? whileRunsPick(s) : null;
  if (offer) s.beat.whileRuns = { id: offer, answer: null };
  s.lastActivity = s.now;
  // Nothing is picked until the learner picks: an Enter meant for the screen
  // before can't answer a question.
  s.cursor = beat.ask && beat.options.length ? -1 : 0;
  if (beat.codespace && s.facts.codespace) {
    s.beat.status = 'already';
    s.beat.codespace = true;
  } else if (beat.verify.kind === 'check') {
    s.beat.status = 'opening';
    effects.push({ type: 'check', lesson: s.lesson, items: beat.verify.all ? null : beat.verify.items, evidence: beat.evidence ?? null, dir: folderOf(s, s.lesson, step) });
  } else if (READS.has(beat.verify.kind)) {
    s.beat.status = 'opening';
    effects.push({ type: 'file', path: beat.verify.path, dir: folderOf(s, s.lesson, step) });
  } else if (GIT.has(beat.verify.kind)) {
    s.beat.status = 'opening';
    effects.push(gitAsk(watching(s)));
  } else if (beat.verify.kind === 'probe') {
    s.beat.status = 'opening';
    effects.push(probeAsk(watching(s)));
  }
  effects.push({ type: 'save' });
}

// A fresh check compares its file with how it was when its step opened (or
// the step it names): ask for that file's state now, once, in the folder
// the fresh beat's own step reads it in (ticket 183). A fresh probe stamps
// what its probe answers, and head-moved and git-unchanged where HEAD is
// or what git status lists (ticket 105).
const stampOf = (b) => {
  const v = b.verify;
  if (v.kind === 'probe') return v.fresh ? { probe: { name: v.name, args: v.args } } : null;
  if (SINCE_GIT.has(v.kind)) return { git: v.kind === 'head-moved' ? 'head' : 'status' };
  return v.fresh ? { path: b.evidence } : null;
};
function stampFresh(s, effects) {
  const step = stepOf(s);
  const stamps = s.progress[s.lesson].stamps;
  for (const other of stepsOf(s)) {
    other.beats.forEach((b, i) => {
      const key = `${other.id}.${i}`;
      const what = stampOf(b);
      if (what && (b.verify.since ?? other.id) === step.id && !(key in stamps)) effects.push({ type: 'stamp', key, ...what, dir: folderOf(s, s.lesson, other) });
    });
  }
}

// A skill that needed the bottom rung, or a missed warm-up, comes back one
// tier easier, once: at the next step that asks for it where the ease changes
// the help.
function markEased(s, index) {
  const step = stepsOf(s)[index];
  if (!s.eased.includes(step.skill) || !easeLands(s, index)) return;
  s.progress[s.lesson].easedSteps[step.id] = true;
  s.eased = s.eased.filter((k) => k !== step.skill);
}

// Whether an ease waiting on step `index`'s skill would give it more help. Not
// on a warm-up, which is always from memory, a finished step, the rest of the
// step whose bottom rung set it, a step already eased, a step g already gives
// one tier more help, or a GUIDED step, which shows every command anyway:
// there the ease waits for the next step.
export function easeLands(s, index, tiers = tiersOf(s)) {
  const steps = stepsOf(s);
  const step = steps[index];
  const p = s.progress[s.lesson];
  if (step.part === 'Warm-up' || p.done.includes(step.id) || p.bottomAt === step.id || p.easedSteps[step.id]) return false;
  if (moreHelp(p, steps)[index]) return false;
  return tiers[index] !== 'guided';
}

function openStep(s, index, effects) {
  markEased(s, index);
  const tiers = tiersOf(s);
  const steps = stepsOf(s);
  const prev = index > 0 ? tiers[index - 1] : null;
  const p = s.progress[s.lesson];
  s.pos = { step: index, beat: 0 };
  stampFresh(s, effects);
  // Less help than the step before. A level-up says the help stays lower from
  // here on, so it shows only when no later step of the lesson gets more help;
  // a step that is harder on its own gets a line on its card instead.
  const { harder, stays } = climb(s, index, tiers, steps);
  if (harder && stays && !p.levels.includes(tiers[index])) {
    s.view = 'levelup';
    s.levelTo = tiers[index];
    s.levelFrom = prev;
    s.beat = null;
    p.step = stepOf(s).id;
    p.beat = 0;
    effects.push({ type: 'save' });
    return;
  }
  s.view = 'step';
  openBeat(s, effects);
}

// Whether step `index` gives less help than the one before, and whether the
// help stays that low for the rest of the lesson. An ease still pending for a
// later step's skill counts where it will land: that step comes back one tier
// easier.
function climb(s, index, tiers = tiersOf(s), steps = stepsOf(s)) {
  const rank = (t) => TIERS.indexOf(t);
  const prev = index > 0 ? tiers[index - 1] : null;
  const harder = Boolean(prev) && rank(tiers[index]) > rank(prev);
  const pending = new Set(s.eased);
  const stays = steps.slice(index + 1).every((step, k) => {
    if (step.part === 'Warm-up') return true;
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
export function stepNote(s) {
  if (s.view !== 'step' || !s.beat || stepOf(s).part === 'Warm-up') return null;
  const { harder, stays } = climb(s, s.pos.step);
  return harder && !stays ? tierOf(s) : null;
}

// What the intro's enter clears, so a play starts its help from the plan.
function startPlay(p) {
  p.stamps = {};
  p.bottomAt = null;
  p.easedSteps = {};
  p.recalled = [];
  p.moreHelpAt = null;
}
// The state as the intro's enter will leave the lesson, so the intro shows
// the help the play will give, not the eases and recalls of an earlier play.
export function asStarted(s) {
  const p = { ...s.progress[s.lesson] };
  startPlay(p);
  return { ...s, progress: { ...s.progress, [s.lesson]: p } };
}

export function startLesson(s, id, effects) {
  s.lesson = id;
  s.overlay = null;
  const l = lessonOf(s, id);
  if (!l.content) {
    s.view = 'checkonly';
    s.itemsAt = 0;
    // r's run on this card goes on through a trip to the map; another
    // lesson's run is not this card's (verify.mjs owing drops what r asked for it).
    if (s.checkOnlyRun?.lesson !== id) s.checkOnlyRun = null;
    if (folderOf(s, id)) effects.push({ type: 'check', lesson: id, items: null, dir: folderOf(s, id) });
    return;
  }
  const p = s.progress[id];
  const steps = stepsOf(s, id);
  const at = steps.findIndex((x) => x.id === p.step);
  if (at !== -1 && !p.complete) {
    const beat = p.beat >= 0 && p.beat < steps[at].beats.length ? p.beat : 0;
    s.pos = { step: at, beat: beatShown(p, steps[at].beats[beat]) ? beat : shownBefore(p, steps[at], beat) };
    s.view = 'step';
    openBeat(s, effects);
  } else {
    s.view = 'intro';
    s.cursor = 0;
  }
}

function finishStep(s, effects) {
  const step = stepOf(s);
  const p = s.progress[s.lesson];
  if (!p.done.includes(step.id)) {
    p.done.push(step.id);
    s.session += 1;
  }
  nextStep(s, effects);
}

// x on an optional step (ticket 102): on to the next step, or the lesson's
// end, with the step not done. Skipping changes no eased or missed state: an
// ease that landed on this step waits for the next step on its skill.
function skipStep(s, effects) {
  const step = stepOf(s);
  const p = s.progress[s.lesson];
  if (p.easedSteps[step.id] && !p.done.includes(step.id)) {
    delete p.easedSteps[step.id];
    if (!s.eased.includes(step.skill)) s.eased.push(step.skill);
  }
  nextStep(s, effects);
}

// The step after the one on screen, or, after the last (the Check, or the
// last Tear down step after it), the lesson's end.
function nextStep(s, effects) {
  const p = s.progress[s.lesson];
  const steps = stepsOf(s);
  if (s.pos.step + 1 >= steps.length) {
    p.complete = true;
    p.step = null;
    s.view = 'complete';
    s.beat = null;
    effects.push({ type: 'save' });
    return;
  }
  openStep(s, s.pos.step + 1, effects);
}

// On and back pass over the beats that don't show (ticket 104).
function advance(s, effects) {
  const next = shownAfter(s.progress[s.lesson], stepOf(s), s.pos.beat);
  if (next >= 0) {
    s.pos.beat = next;
    openBeat(s, effects);
  } else finishStep(s, effects);
}

function back(s, effects) {
  const p = s.progress[s.lesson];
  if (s.pos.beat > 0) {
    s.pos.beat = shownBefore(p, stepOf(s), s.pos.beat);
    openBeat(s, effects);
  } else if (s.pos.step > 0) {
    const prev = stepsOf(s)[s.pos.step - 1];
    s.pos = { step: s.pos.step - 1, beat: shownBefore(p, prev, prev.beats.length) };
    s.view = 'step';
    openBeat(s, effects);
  }
}

// Picks the lesson's warm-up as it starts: the first question in the file's
// order on a skill the learner missed before, or none when they missed no
// skill the pool recalls (ticket 194: a warm-up spends a question only where
// it brings back something missed, so unmet skills and the file order no
// longer fill the place). A beat that names the skill it recalls counts
// under that skill, as its miss and its recall do.
export function pickWarmups(s, id = s.lesson) {
  const missed = (w) => w.beats.some((b) => s.missed.includes(b.skill ?? w.skill));
  return contentOf(s, id).warmup.filter(missed).slice(0, WARMUPS).map((w) => w.id);
}
function chooseWarmups(s) {
  s.progress[s.lesson].warm = pickWarmups(s);
}

// A question answered wrong, or shown, marks its skill for a warm-up later;
// a warm-up on that skill answered right at once clears the mark, unless it
// was missed again in this sitting. A beat may name the skill it recalls.
// A warm-up is recall from memory, so its first answer in a play also sets
// the help: a miss eases the skill, and a right answer at once cancels a
// waiting ease and joins the lesson's `recalled`, so the skill's help fades
// on the course plan. Asked again (gone back to, or after a quit), it is not.
const skillOf = (s) => beatOf(s).skill ?? stepOf(s).skill;
const warmKey = (s) => `${s.lesson}.${stepOf(s).id}`;
function firstAnswer(s) {
  const p = s.progress[s.lesson];
  if (stepOf(s).part !== 'Warm-up' || s.answeredNow.includes(warmKey(s))) return false;
  // On a first play the done list holds only this play's steps; a lesson
  // played again keeps its old ticks, so there it tells nothing.
  return p.complete || !p.done.includes(stepOf(s).id);
}
function answered(s) {
  if (stepOf(s).part === 'Warm-up' && !s.answeredNow.includes(warmKey(s))) s.answeredNow.push(warmKey(s));
}
function missed(s, effects) {
  const skill = skillOf(s);
  if (!s.missed.includes(skill)) s.missed.push(skill);
  if (firstAnswer(s) && !s.eased.includes(skill)) s.eased.push(skill);
  if (!s.missedNow.includes(skill)) s.missedNow.push(skill);
  answered(s);
  effects.push({ type: 'save' });
}
function recalled(s) {
  const st = s.beat;
  const skill = skillOf(s);
  const first = firstAnswer(s);
  answered(s);
  if (!first || st.wrongs.length || st.typedWrong || s.missedNow.includes(skill)) return;
  s.missed = s.missed.filter((k) => k !== skill);
  s.eased = s.eased.filter((k) => k !== skill);
  const p = s.progress[s.lesson];
  if (!p.recalled.includes(stepOf(s).id)) p.recalled.push(stepOf(s).id);
}

// ---- questions ---------------------------------------------------------------
export const answerKey = (s) => `${stepOf(s).id}.${s.pos.beat}`;
const questionOf = (beat) => (beat.ask ? beat : null);

function pick(s, index, effects) {
  const beat = beatOf(s);
  const st = s.beat;
  const opt = beat.options[index];
  if (!opt || st.answer) return;
  const p = s.progress[s.lesson];
  if (beat.kind === 'predict') {
    st.answer = { index, kind: opt.kind };
    p.answers[answerKey(s)] = opt.text;
    st.status = 'done';
    effects.push({ type: 'save' });
    return;
  }
  if (opt.kind === 'right' || opt.kind === 'option' || opt.kind === 'other') {
    st.answer = { index, kind: opt.kind };
    // Saved as a guess is (ticket 104): a when line reads a choice's pick,
    // and a changed pick changes which beats after it show.
    p.answers[answerKey(s)] = opt.text;
    st.feedback = opt.kind === 'right' ? { kind: 'right' } : { kind: opt.kind, because: opt.because };
    st.status = 'done';
    if (opt.kind === 'right') recalled(s);
    effects.push({ type: 'save' });
    return;
  }
  // Saying it went wrong is a try too, so hints may open.
  if (opt.kind === 'stuck') {
    st.feedback = { kind: 'stuck', because: opt.because };
    st.unlocked = true;
    return;
  }
  // A wrong pick or a decoy: explain once, reveal on the second. It is a
  // try, so hints may open.
  if (!st.wrongs.includes(index)) st.wrongs.push(index);
  st.unlocked = true;
  missed(s, effects);
  if (st.wrongs.length >= 2) return reveal(s, effects);
  st.feedback = { kind: 'wrong', because: opt.because, point: beat.point };
}

function reveal(s, effects) {
  const beat = beatOf(s);
  const st = s.beat;
  st.revealed = true;
  missed(s, effects);
  st.answer = { index: beat.options.findIndex((o) => o.kind === 'right'), kind: 'revealed' };
  st.feedback = { kind: 'revealed' };
  st.status = 'done';
  effects.push({ type: 'save' });
}

// The most a typed answer holds: a lesson's accepted answers fit in it.
export const TYPED_MAX = 40;

// Case, spaces, a leading slash and the + or - between keys don't matter, and
// Escape is Esc.
export const normalize = (text) => text.trim().toLowerCase().replace(/[+\-\s]+/g, '').replace(/^\//, '').replace(/^escape$/, 'esc');

function submitTyped(s, effects) {
  const beat = beatOf(s);
  const st = s.beat;
  const typed = normalize(st.typed);
  if (!typed) return reveal(s, effects);
  if (beat.accept.some((a) => normalize(a) === typed)) {
    st.status = 'done';
    st.feedback = { kind: 'right' };
    recalled(s);
    effects.push({ type: 'save' });
    return;
  }
  st.typedWrong += 1;
  missed(s, effects);
  if (st.typedWrong >= 2) return reveal(s, effects);
  const known = beat.options.find((o) => o.kind === 'wrong' && normalize(o.text) === typed);
  st.feedback = known ? { kind: 'wrong', because: known.because } : { kind: 'wrong', hint: beat.hints[0] };
  st.typed = '';
}

// ---- checks and git ----------------------------------------------------------
const RESULTS = ['check', 'check-error', 'file', 'git', 'git-error', 'probe', 'probe-error'];

// `read` is the bytes of the beat's evidence file, as main read it.
function onCheck(s, ev, effects, rRuns) {
  ev = { ...ev, evidence: evidenceOf(ev.read) };
  s.checks[ev.lesson] = { items: keptSlow(s, ev), evidence: ev.evidence, error: null };
  checkOnlyDone(s, ev, effects);
  if (rRuns || s.view !== 'step' || ev.lesson !== s.lesson || !s.beat) return;
  const beat = beatOf(s);
  if (beat.verify.kind !== 'check') return;
  const st = s.beat;
  if (['done', 'already'].includes(st.status)) return;
  const indexes = beat.verify.all ? lessonOf(s).items.map((_, i) => i) : beat.verify.items;
  const wanted = indexes.map((i) => ev.items.find((it) => it.index === i));
  // A result that doesn't cover every item decides nothing.
  if (wanted.some((it) => !it)) return;
  const failing = wanted.find((it) => !it.slow && !it.pass);
  // Everything else passes, and a slow item waits for r: say so, in place of
  // any message about the items that pass now. A FAIL about a slow item stays
  // with its hints: a run without that item can't tell whether it passes now.
  if (!failing && wanted.some((it) => it.slow)) {
    if (st.status === 'fail' && wanted.some((it) => it.slow && it.text === st.fail?.item)) {
      st.slowWait = true;
      return;
    }
    if (st.baseline === undefined) st.baseline = null;
    Object.assign(st, { status: 'waiting', slowWait: true, fail: null, error: null, rung: -1, confirm: false, explicit: false, same: false });
    return;
  }
  st.slowWait = false;
  decide(s, ev, effects, failing && { item: failing.text, hint: failing.hint });
}

// On a lesson with no lesson file, a slow item a run left out keeps what the
// last run that had it found, so a poll changes no row of its card.
function keptSlow(s, ev) {
  if (lessonOf(s, ev.lesson)?.content) return ev.items;
  const before = s.checks[ev.lesson]?.items ?? [];
  return ev.items.map((it) => (it.slow ? before.find((b) => b.index === it.index && !b.slow) ?? it : it));
}

// A lesson with no lesson file is complete once a full check passes: every
// item passed, slow ones too (r runs those; a run that left one out marks it
// not passing). It stays complete.
function checkOnlyDone(s, ev, effects) {
  const l = lessonOf(s, ev.lesson);
  const p = s.progress[ev.lesson];
  if (!l || l.content || p.complete) return;
  if (!l.items.every((_, i) => ev.items.some((it) => it.index === i && it.pass))) return;
  p.complete = true;
  effects.push({ type: 'save' });
}

// Where a fresh beat's file `ev.read` starts being new (holds.mjs grewFrom):
// past what it held at its stamp (saved, so a restart reads it too) when it
// only grew, else 0. With no stamp yet, this read is the one decide stamps,
// so the first answer is judged as every later one is.
function readFrom(s, ev) {
  if (!beatOf(s).verify.fresh || !ev.read) return 0;
  return grewFrom(s.progress[s.lesson].stamps[answerKey(s)] ?? ev.stamp, ev.read);
}

// A file the beat reads itself, by what it holds now (holds.mjs): `read`
// is its bytes, null when it isn't there. A fresh match on a file that only
// grew reads what was added; a rewritten one is read whole.
function onFile(s, ev, effects, rRuns) {
  if (rRuns || s.view !== 'step' || !s.beat) return;
  const v = beatOf(s).verify;
  if (!READS.has(v.kind) || ev.path !== v.path || ['done', 'already'].includes(s.beat.status)) return;
  const r = judge(v, ev.read, readFrom(s, ev));
  decide(s, { ...ev, evidence: r.evidence }, effects, r.pass ? null : { hint: r.hint });
}

// Turns a result into the beat's status. `failing` is null when it passes.
function decide(s, ev, effects, failing) {
  const beat = beatOf(s);
  const st = s.beat;
  // A fresh check also needs its evidence file to have changed since its
  // step opened; a result about another file decides nothing.
  let stale = false;
  if (beat.verify.fresh) {
    // null: the file couldn't be read just now, so nothing is known yet.
    if (ev.path !== beat.evidence || ev.stamp === null) return;
    const stamps = s.progress[s.lesson].stamps;
    const key = answerKey(s);
    if (!(key in stamps)) {
      stamps[key] = ev.stamp ?? '';
      effects.push({ type: 'save' });
    }
    stale = (ev.stamp ?? '') === stamps[key];
  }
  const explicit = st.explicit;
  st.explicit = false;
  st.error = null;
  // The same FAIL message as the result before, with the watched file
  // changed between them: the learner redid the step and the check says the
  // same, so the cause is likely earlier (ticket 192). Only a result that
  // carries its file's state (`stamp`) tells a redo from a poll or an r.
  const stamp = typeof ev.stamp === 'string' ? ev.stamp : null;
  const redone = Boolean(failing) && stamp !== null && st.last?.hint === failing.hint && st.last.stamp !== null && st.last.stamp !== stamp;
  st.last = failing ? { hint: failing.hint, stamp } : null;
  if (!failing) st.same = false;
  if (!failing && stale) {
    if (st.baseline === undefined) st.baseline = null;
    st.status = 'waiting';
    st.stale = true;
    return;
  }
  st.stale = false;
  if (!failing) {
    st.status = st.baseline === undefined ? 'already' : 'done';
    // The run that passed the lesson's whole check: its done line counts
    // these, not a later poll's, which leaves the slow items out.
    if (beat.verify.all) st.passed = ev.items;
    st.evidence = ev.evidence ?? null;
    // The file a glob matched, for the card to name (106).
    st.found = ev.found ?? null;
    st.feedback = null;
    st.rung = -1;
    st.confirm = false;
    effects.push({ type: 'save' });
    return;
  }
  // The first answer is what the learner starts from: no "not yet" for it.
  if (st.baseline === undefined) {
    st.baseline = failing.hint;
    if (!explicit) {
      st.status = 'waiting';
      return;
    }
  }
  // Once a fail is on screen it follows the check; before that, a fail that
  // only repeats the first answer means nothing changed yet.
  const shown = hintStatus(st) === 'fail';
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
    st.status = 'fail';
    st.fail = failing;
    st.unlocked = true;
    st.idle = false;
    s.lastActivity = s.now;
  } else st.status = 'waiting';
}

function onGit(s, ev, effects, rRuns) {
  const w = watching(s);
  if (w?.git && !answersGit(w, ev)) return;
  s.git = { paths: ev.paths, error: null };
  if (rRuns || s.view !== 'step' || !s.beat || !GIT.has(beatOf(s).verify.kind)) return;
  const beat = beatOf(s);
  const st = s.beat;
  if (['done', 'already'].includes(st.status)) return;
  // A beat that needs git status to list something starts from what it
  // lists first, as a check does.
  if (needsChange(beat.verify)) {
    const r = judgeGit(beat.verify, ev, SINCE_GIT.has(beat.verify.kind) ? gitSince(s, ev, effects) : undefined);
    // Nothing changing is the work: the first look can say not yet.
    if (beat.verify.kind === 'git-unchanged' && st.baseline === undefined) st.baseline = null;
    return decide(s, { ...ev, evidence: r.evidence }, effects, r.pass ? null : { hint: r.hint });
  }
  const listed = cleanListed(beat.verify, ev.paths);
  const clean = listed.length === 0;
  // With a done-label, the tree decides only after the learner says the
  // session has ended; before that it is shown live.
  if (beat.doneLabel && !st.ended) {
    if (st.status === 'opening') st.status = 'waiting';
    return;
  }
  st.error = null;
  if (clean) {
    st.status = 'done';
    st.rung = -1;
    st.confirm = false;
    effects.push({ type: 'save' });
    return;
  }
  st.status = 'fail';
  st.unlocked = true;
  st.fail = { paths: listed };
  st.explicit = false;
}

// How git was when a head-moved or git-unchanged beat's step (or the step
// it names) opened: the stamp taken then, or, where none was, this result,
// kept as the stamp. `n` is that step's number on screen.
function gitSince(s, ev, effects) {
  const v = beatOf(s).verify;
  const stamps = s.progress[s.lesson].stamps;
  const key = answerKey(s);
  if (!(key in stamps)) {
    stamps[key] = v.kind === 'head-moved' ? ev.head ?? '' : statusStamp(ev.paths);
    effects.push({ type: 'save' });
  }
  return { stamp: stamps[key], n: stepsOf(s).findIndex((x) => x.id === (v.since ?? stepOf(s).id)) + 1 };
}

// What a git probe answered (ticket 105), for the probe beat on screen. A
// fresh one passes only once its `state` changed since its step opened.
function onProbe(s, ev, effects, rRuns) {
  if (rRuns || s.view !== 'step' || !s.beat) return;
  const beat = beatOf(s);
  const v = beat.verify;
  if (v.kind !== 'probe' || ev.name !== v.name || !sameJson(ev.args, v.args) || ['done', 'already'].includes(s.beat.status)) return;
  decide(s, { ...ev, path: beat.evidence, stamp: ev.state ?? null, evidence: ev.evidence ?? null }, effects, ev.pass ? null : { hint: ev.hint });
}

// ---- the reducer -------------------------------------------------------------
// The folder a result has to come from (ticket 183): a stamp's, its fresh
// beat's step's; a result for the step card on screen, that step's; any
// other, its lesson's.
function resultFolder(s, ev) {
  const id = ev.lesson ?? s.lesson;
  if (ev.type === 'stamp') {
    const named = ev.key.slice(0, ev.key.lastIndexOf('.'));
    return folderOf(s, id, stepsOf(s, id).find((x) => x.id === named) ?? null);
  }
  return folderOf(s, id, id === s.lesson && s.view === 'step' && contentOf(s) ? stepOf(s) : null);
}

export function reduce(prev, ev) {
  const s = clone({ ...prev, course: null });
  s.course = prev.course;
  const effects = [];
  if (ev.now !== undefined) s.now = ev.now;
  if (s.toast && s.now >= s.toast.until) s.toast = null;
  // r's run goes until its own result lands: the one that carries the latest
  // r's number, wherever the learner is by then. A poll's result, or an
  // earlier r's, that lands first decides nothing for the beat.
  const result = RESULTS.includes(ev.type);
  if (result && s.beat?.asked && ev.asked === s.beat.asked) s.beat.asked = 0;
  if (result && s.checkOnlyRun && ev.asked === s.checkOnlyRun.asked) s.checkOnlyRun = null;
  const rRuns = result && Boolean(s.beat?.asked);
  // One check child runs at a time, so its result means the run that
  // reported has ended: the count goes with it.
  if ((ev.type === 'check' || ev.type === 'check-error') && s.beat?.running) s.beat.running = null;
  // A result about another folder than the one its lesson runs in now (a run
  // asked for before the learner changed it, or for a step in another
  // folder) decides nothing.
  if ((result || ev.type === 'stamp') && ev.dir !== undefined && ev.dir !== resultFolder(s, ev)) ev = { ...ev, type: 'stale' };
  switch (ev.type) {
    case 'check':
      onCheck(s, ev, effects, rRuns);
      break;
    case 'running': {
      // The check child starts its nth item of m. Only the run the card says
      // "Checking" for counts: this beat's check (its lesson and its items,
      // so a run the beat before asked for, still going, is not it), asked
      // by the latest r, or by the beat opening when no r is out.
      const w = watching(s)?.check;
      if (s.beat?.status === 'opening' && (ev.asked ?? 0) === (s.beat.asked || 0) && w?.lesson === ev.lesson && sameJson(ev.items ?? null, w.items)) s.beat.running = { n: ev.n, m: ev.m };
      // On the check-only card, only r's own run counts.
      if (s.checkOnlyRun && ev.asked === s.checkOnlyRun.asked && ev.lesson === s.checkOnlyRun.lesson) s.checkOnlyRun.running = { n: ev.n, m: ev.m };
      break;
    }
    case 'check-error':
      s.checks[ev.lesson] = { ...(s.checks[ev.lesson] ?? {}), error: ev.message };
      if (!rRuns && s.view === 'step' && s.beat && beatOf(s).verify.kind === 'check' && !['done', 'already'].includes(s.beat.status)) {
        Object.assign(s.beat, { status: 'broken', error: ev.message, rung: -1, confirm: false });
      }
      break;
    case 'git':
      onGit(s, ev, effects, rRuns);
      break;
    case 'probe':
      onProbe(s, ev, effects, rRuns);
      break;
    case 'probe-error':
      if (!rRuns && s.view === 'step' && s.beat && beatOf(s).verify.kind === 'probe' && !['done', 'already'].includes(s.beat.status)) {
        Object.assign(s.beat, { status: 'broken', error: ev.message, rung: -1, confirm: false });
      }
      break;
    case 'file':
      onFile(s, ev, effects, rRuns);
      break;
    case 'stamp': {
      const stamps = s.progress[s.lesson]?.stamps;
      if (stamps && !(ev.key in stamps) && ev.stamp !== null) {
        stamps[ev.key] = ev.stamp ?? '';
        effects.push({ type: 'save' });
      }
      break;
    }
    case 'git-error':
      s.git = { paths: [], error: ev.message };
      if (!rRuns && s.view === 'step' && s.beat && GIT.has(beatOf(s).verify.kind) && !['done', 'already'].includes(s.beat.status)) {
        Object.assign(s.beat, { status: 'broken', error: ev.message, rung: -1, confirm: false });
      }
      break;
    case 'tick':
    case 'flush':
      // A held letter with nothing typed after it is a key press after all.
      if (s.held && s.now - s.held.at >= DEFER_MS) {
        const held = s.held;
        s.held = null;
        onKey(s, held, effects);
      }
      // A long wait (ticket 103) is quiet by design: no offer, no unlock.
      if (ev.type === 'tick' && s.view === 'step' && s.beat && !['done', 'already'].includes(s.beat.status) && !longWait(s) && s.now - s.lastActivity >= IDLE_MS) {
        s.beat.idle = true;
        s.beat.unlocked = true;
      }
      break;
    case 'facts':
      Object.assign(s.facts, ev.facts);
      break;
    case 'commands':
      Object.assign(s.commands, ev.found);
      break;
    case 'prereq':
      onPrereq(s, ev);
      break;
    case 'notice':
      s.toast = { kind: ev.kind, message: ev.message, until: s.now + TOAST_MS * 2 };
      break;
    case 'activity':
      // A file changed or git moved: the learner is working, so no "stuck?" offer.
      s.lastActivity = s.now;
      if (s.beat) s.beat.idle = false;
      break;
    case 'probed': {
      // What main found at a folder: kept for the notes, and, for the ask
      // the prompt is waiting on, the answer.
      s.probes[ev.path] = { missing: ev.missing, git: ev.git, gitBroken: ev.gitBroken ?? null, practice: ev.practice };
      const a = s.folderAsk;
      if (!ev.key || !a || a.key !== ev.key || a.asked !== ev.asked) break;
      if (ev.missing) Object.assign(a, { asked: 0, missing: ev.path });
      // A new copy is another folder than this practice copy.
      else if (!WORK_LEVELS.includes(ev.key) && ev.path === s.facts.root) Object.assign(a, { asked: 0, isCopy: true });
      else setFolder(s, ev.key, ev.path, effects);
      break;
    }
    case 'paste':
      // A path pasted into the prompt is kept whole, up to its first line.
      if (s.overlay === 'folder') {
        if (!s.folderAsk.asked) Object.assign(s.folderAsk, { typed: (s.folderAsk.typed + ev.text.replace(/[\r\n].*$/s, '')).slice(0, PATH_MAX), missing: null, isCopy: false });
      } else if (s.view === 'step' && s.beat && beatOf(s).kind === 'type' && s.beat.status !== 'done') {
        s.beat.typed = (s.beat.typed + ev.text.replace(/[\r\n].*$/s, '')).slice(0, TYPED_MAX);
      } else onPaste(s);
      break;
    case 'key':
      s.lastActivity = s.now;
      if (s.beat) s.beat.idle = false;
      guardKey(s, ev, effects);
      break;
    default:
      break;
  }
  // An intro that opens looks again at what its lesson needs, and so does
  // one whose folder changed or got its answer. Each ask for prerequisites
  // has its number, so an answer to an older one that comes late says nothing.
  if (s.view === 'intro' && (prev.view !== 'intro' || prev.lesson !== s.lesson || folderOf(prev) !== folderOf(s) || asksFolder(prev) !== asksFolder(s))) {
    effects.push(...introAsks(s).map((e) => (e.type === 'prereqs' ? { ...e, asked: ++s.prereqAsks } : e)));
  }
  stampFx(prev, s, ev);
  return { state: s, effects };
}

// When the screen changed, and how, for the motion layer (motion.mjs). Each
// stamp is the event's own `now`; `s.fx` lives in memory and is never saved.
export const isDone = (st) => ['done', 'already'].includes(st?.status);

// The card face's mood for what the card shows the app saw (design 2.2),
// or null on a screen with no card. On a step card: the step's last beat
// done or already done, as the cheer does (a beat before it rests, as the
// hop does); `opening`, while the card says "Checking" (a check, git or a
// file read); a check that could not run; a "Not yet", a `▲` git line, a
// pick that wasn't right, the hint box or the "Stuck?" offer; else at rest.
// On the check-only card: checking while r's run goes; else a check that
// could not run, or worried only where the card shows a failing mark (a
// slow item no run has checked shows as not checked yet).
export function cardMood(s) {
  if (s.view === 'checkonly') {
    const results = s.checks[s.lesson];
    if (s.checkOnlyRun?.lesson === s.lesson) return 'checking';
    if (results?.error) return 'broken';
    return results?.items?.some((x) => !x.pass && !x.slow) ? 'worried' : 'rest';
  }
  const st = s.beat;
  if (s.view !== 'step' || !st) return null;
  const beat = beatOf(s);
  if (isDone(st)) return isLastBeat(s) ? 'done' : 'rest';
  if (st.status === 'opening') return 'checking';
  if (st.status === 'broken') return 'broken';
  const gitLine = beat.verify.kind === 'git-clean' && st.status === 'waiting' && cleanListed(beat.verify, s.git?.paths ?? []).length > 0;
  const wrong = ['wrong', 'stuck'].includes(st.feedback?.kind);
  const stuck = st.idle && hintAvailable(s);
  return st.status === 'fail' || gitLine || wrong || st.rung >= 0 || st.confirm || stuck ? 'worried' : 'rest';
}

// Since when a check, git or probe child has run for the beat on screen
// while it is `opening`, or for r on the check-only card: a child that
// started before the status became `opening`, or before r, is not this run,
// and a file read starts none. A probe (ticket 105) runs in the check child.
const CHILD = ['check', 'probe', ...GIT];
const checkingChild = (s) => (s.view === 'step' && s.beat?.status === 'opening' && CHILD.includes(beatOf(s).verify.kind))
  || (s.view === 'checkonly' && s.checkOnlyRun?.lesson === s.lesson);
export const childSince = (s) => (checkingChild(s) && s.fx.run >= s.fx.check ? s.fx.run : undefined);
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function stampFx(prev, s, ev) {
  const fx = s.fx;
  const t = s.now;
  if (ev.type === 'key' || ev.type === 'paste') fx.key = t;
  if (ev.type === 'run-start') fx.run = t;
  if (s.view !== prev.view) fx.view = t;
  // Pip greets once per opening (176): on the first arrival on the welcome
  // or resume, and on none after it.
  if (fx.greet === undefined && GREETS.includes(s.view)) fx.greet = fx.view;
  const st = s.beat;
  const was = prev.beat;
  const opened = Boolean(st) && (!was || st.opened !== was.opened || s.lesson !== prev.lesson || !sameJson(s.pos, prev.pos));
  if (opened) fx.open = t;
  if (st?.status === 'opening' && (opened || was.status !== 'opening')) fx.check = t;
  if (s.checkOnlyRun && !prev.checkOnlyRun) fx.check = t;
  // The card face's mood changed on the same card (181): when, from which,
  // and since when the child it was checking with had run, for the motion
  // layer to tell which face that mood showed.
  const mood = cardMood(s);
  const before = cardMood(prev);
  if (mood && before && mood !== before && s.view === prev.view && s.lesson === prev.lesson && !opened) fx.mood = { at: t, was: before, since: childSince(prev) };
  // New text on the same card: a "Not yet" line, a rung, feedback, a reveal.
  if (st && was && !opened && s.view === prev.view) {
    const notYet = st.status === 'fail' && (was.status !== 'fail' || !sameJson(st.fail, was.fail));
    const rung = st.rung >= 0 && st.rung !== was.rung;
    const feedback = Boolean(st.feedback) && !sameJson(st.feedback, was.feedback);
    if (notYet || rung || feedback || (st.revealed && !was.revealed) || (st.same && !was.same)) fx.text = t;
    if (isDone(st) && !isDone(was)) {
      // A pass: the beat on screen turned done by a result or a right
      // answer, not by a guess or a shown answer.
      if (!st.revealed && beatOf(s).kind !== 'predict') fx.pass = t;
      // `passLast`: the step's last beat turned done, by any route. The step
      // is done all the same, so it cheers all the same.
      if (isLastBeat(s)) fx.passLast = t;
    }
  }
  // A look: a result for what the screen watched, and whether it differs
  // from the last one. A new thing to watch starts the comparison over,
  // after the look that ended the old one.
  const w = watching(prev);
  // A git result the beat doesn't read (onGit) is no look; one on part of
  // the tree also differs when another path is staged.
  const looked = (ev.type === 'check' && w?.check?.lesson === ev.lesson) || (ev.type === 'file' && w?.file === ev.path) || (ev.type === 'git' && answersGit(w, ev)) || (ev.type === 'probe' && w?.probe?.name === ev.name);
  if (looked) {
    const seen = JSON.stringify(ev.type === 'check' ? [ev.items, evidenceOf(ev.read)] : ev.type === 'file' ? judge(beatOf(prev).verify, ev.read, readFrom(prev, ev)) : ev.type === 'probe' ? [ev.pass, ev.state] : 'head' in ev ? [ev.paths, ev.head] : ev.files ? [ev.paths, ev.staged] : ev.paths);
    fx.changed = fx.seen !== undefined && fx.seen !== seen;
    if (fx.changed) fx.changedAt = t;
    fx.seen = seen;
    fx.look = t;
  }
  if (!sameJson(w, watching(s))) delete fx.seen;
  // The stamps before it too, the last few: the face Pip showed as a new
  // glance started (motion.mjs) is an older one's, and a save's burst of
  // changes chains several.
  if (ev.type === 'activity' && w) Object.assign(fx, { activityWas: fx.activity === undefined ? [] : [...(fx.activityWas ?? []), fx.activity].slice(-ACTIVITY_KEPT), activity: t });
  // The first of them since the card's newest words (its view, open or text
  // stamp): it ends their reading grace there, and Pip's ambient life counts
  // from that moment however many follow (motion.mjs's lifeFrom, 189).
  if (ev.type === 'activity' && w && !(fx.activityFirst > Math.max(fx.view ?? -Infinity, fx.open ?? -Infinity, fx.text ?? -Infinity))) fx.activityFirst = t;
  // On the check-only card, the items a result finds passing that the
  // result before it, for the same lesson, found not passing or left out.
  if (ev.type === 'check' && s.view === 'checkonly' && ev.lesson === s.lesson) {
    const before = prev.checks[ev.lesson]?.items ?? [];
    const started = s.checks[ev.lesson].items.filter((it) => it.pass && before.some((b) => b.index === it.index && !b.pass)).map((it) => it.index);
    if (started.length) Object.assign(fx, { itemPass: t, itemsPassed: started });
  }
  // The looks the look marker counts (motion.mjs): `from`, the newest stamp
  // that can hold it back or start it again (the stamps quietFrom and
  // sweepFrom read there); how many came since; and the times of those in
  // the 20 s after it, as long as that hold can last.
  const from = Math.max(...['key', 'view', 'open', 'text', 'activity', 'changedAt'].map((k) => fx[k] ?? -Infinity));
  if (fx.looks?.from !== from) fx.looks = { from, n: 0, early: [] };
  if (looked) {
    fx.looks.n += 1;
    if (t - from <= GRACE_MAX_MS) fx.looks.early.push(t);
  }
}

function onPaste(s) {
  s.held = null;
  s.toast = { kind: 'stray', until: s.now + TOAST_MS };
}

const DIGIT = /^[1-9]$/;
const typingAnswer = (s) => s.view === 'step' && s.beat && beatOf(s).kind === 'type' && s.beat.status !== 'done';
const letter = (ev) => Boolean(ev.ch) && /^[\x21-\x7e]$/.test(ev.ch) && !DIGIT.test(ev.ch);

// A command typed into this window instead of the other one must not act:
// its first letter could go back (b), quit (q), or reveal an answer (s), and
// a space could finish a step. So a letter waits DEFER_MS before it acts; a
// second letter or a space inside that time means typing, and every key is
// swallowed until the typing stops.
function guardKey(s, ev, effects) {
  if (ev.name === 'ctrl-c') return effects.push({ type: 'quit' });
  // The comparison's enter goes on, as the next screen's does, so its keys
  // keep the guard.
  if (typingAnswer(s) || (s.overlay && s.overlay !== 'compare')) {
    s.held = null;
    return onKey(s, ev, effects);
  }
  if (s.now < s.swallowUntil) {
    s.swallowUntil = s.now + SWALLOW_MS;
    return;
  }
  if (s.held) {
    if (s.now - s.held.at < DEFER_MS && (letter(ev) || ev.name === 'space' || ev.name === 'enter')) {
      s.held = null;
      s.swallowUntil = s.now + SWALLOW_MS;
      s.toast = { kind: 'stray', until: s.now + TOAST_MS };
      return;
    }
    const held = s.held;
    s.held = null;
    onKey(s, held, effects);
  }
  if (letter(ev)) {
    s.held = { ...ev, at: s.now };
    effects.push({ type: 'later', ms: DEFER_MS + 30 });
    return;
  }
  onKey(s, ev, effects);
}

function onKey(s, ev, effects) {
  const { name, ch } = ev;
  // Typing an answer: every printable key is input.
  if (typingAnswer(s) && !s.overlay) {
    if (name === 'enter') return submitTyped(s, effects);
    if (name === 'backspace') s.beat.typed = s.beat.typed.slice(0, -1);
    else if (name === 'escape') s.beat.typed = '';
    else if (ch && ch >= ' ' && s.beat.typed.length < TYPED_MAX) s.beat.typed += ch;
    return;
  }
  if (s.overlay === 'folder') return folderKeyPress(s, ev, effects);
  if (s.overlay) {
    // Enter never waits for the comparison: it goes on, as the next screen's.
    if (s.overlay === 'compare' && name === 'enter') {
      s.overlay = null;
      return VIEWS.next(s, ev, effects);
    }
    if (['escape', 'enter', 'q', '?', 'p', 'w', 'c', 'n'].includes(name) || (s.overlay === 'compare' && name === 'space')) s.overlay = null;
    // The arrows: one place a press. On your card and the comparison, no
    // further than it can scroll at the window's size, which main sends with
    // the key (render's cardMax): where it fits, they move nothing.
    else if (SCROLLED[s.overlay] && (name === 'up' || name === 'down')) {
      const max = ev.cardMax ?? SCROLLED[s.overlay](s).length;
      s.cardAt = arrowed(s.cardAt, max, name);
    }
    return;
  }
  if (name === 'q') return effects.push({ type: 'quit' });
  if (name === '?') {
    s.overlay = 'help';
    return;
  }
  if (name === 'p' && s.view !== 'welcome') {
    s.overlay = 'page';
    return;
  }
  if (name === 'c' && s.view !== 'welcome') {
    s.overlay = 'card';
    s.cardAt = 0;
    return;
  }
  if (name === 'm' && s.view !== 'welcome') {
    if (s.view === 'map') return closeMap(s, effects);
    s.mapReturn = s.view;
    s.view = 'map';
    s.mapCursor = Math.max(0, s.course.findIndex((l) => l.id === s.lesson));
    return;
  }
  VIEWS[s.view]?.(s, ev, effects);
}

function closeMap(s, effects) {
  // The map the app opened on has no screen behind it: open its lesson.
  if (!s.mapReturn) return startLesson(s, s.lesson, effects);
  s.view = s.mapReturn;
  if (s.view === 'step' && s.beat) {
    // Re-run what the beat waits on: files may have changed meanwhile.
    const w = watching(s);
    if (w?.check) effects.push({ type: 'check', lesson: w.check.lesson, items: w.check.items, evidence: beatOf(s).evidence ?? null, dir: w.dir });
    if (w?.file) effects.push({ type: 'file', path: w.file, dir: w.dir });
    if (w?.git) effects.push(gitAsk(w));
    if (w?.probe) effects.push(probeAsk(w));
  }
}

const VIEWS = {
  welcome(s, { name }, effects) {
    if (name !== 'enter') return false;
    s.welcomed = true;
    s.view = 'intro';
    s.cursor = 0;
    effects.push({ type: 'save' });
    return true;
  },
  resume(s, { name }, effects) {
    if (s.confirmRestart) {
      if (name === 'y') {
        s.progress[s.lesson] = blankProgress();
        s.view = 'intro';
        s.cursor = 0;
        effects.push({ type: 'save' });
      }
      s.confirmRestart = false;
      return true;
    }
    if (name === 'enter') return startLesson(s, s.lesson, effects), true;
    if (name === 'x') {
      s.confirmRestart = true;
      return true;
    }
    return false;
  },
  intro(s, { name, ch }, effects) {
    // The folder question first, where the intro asks it.
    if (asksFolder(s)) {
      const options = folderOptions(s);
      if (name === 'up' || name === 'down') s.cursor = (s.cursor + 1) % options.length;
      else if (DIGIT.test(ch ?? '') && Number(ch) <= options.length) s.cursor = Number(ch) - 1;
      else if (name === 'enter' && options[s.cursor] === 'copy') setFolder(s, folderKey(s), s.facts.root, effects);
      else if (name === 'enter') askFolder(s, folderKey(s));
      else if (name === 'n' && introNotes(s).length) openNotes(s);
      else return false;
      return true;
    }
    const options = introOptions(s);
    if (name === 'f' && folderKey(s)) askFolder(s, folderKey(s));
    else if (name === 'n' && introNotes(s).length) openNotes(s);
    else if (name === 'up' || name === 'down') s.cursor = (s.cursor + (name === 'down' ? 1 : options.length - 1)) % options.length;
    else if (DIGIT.test(ch ?? '') && Number(ch) <= options.length) s.cursor = Number(ch) - 1;
    else if (name === 'enter' && options[s.cursor] === 'first') startLesson(s, offered(s), effects);
    else if (name === 'enter') {
      // A finished lesson played again keeps its badge and its ticks, but
      // every fresh check waits for new work and the help starts from the plan.
      const p = s.progress[s.lesson];
      p.lessHelp = s.cursor === 1;
      startPlay(p);
      s.answeredNow = s.answeredNow.filter((k) => !k.startsWith(`${s.lesson}.`));
      chooseWarmups(s);
      openStep(s, 0, effects);
    } else return false;
    return true;
  },
  levelup(s, { name }, effects) {
    const p = s.progress[s.lesson];
    if (name === 'enter' || name === 'g') {
      if (!p.levels.includes(s.levelTo)) p.levels.push(s.levelTo);
      // g where it gives nothing goes on like enter.
      if (name === 'g' && moreHelpGives(s)) {
        const step = stepOf(s);
        p.moreHelpAt = step.id;
        // g gives this step the help an ease that landed here gave, so the
        // ease waits for a later step.
        if (p.easedSteps[step.id]) {
          delete p.easedSteps[step.id];
          if (!s.eased.includes(step.skill)) s.eased.push(step.skill);
        }
      }
      s.view = 'step';
      openBeat(s, effects);
      return true;
    }
    if (name === 'b') {
      back(s, effects);
      return true;
    }
    return false;
  },
  step(s, ev, effects) {
    const { name, ch } = ev;
    const beat = beatOf(s);
    const st = s.beat;
    const done = ['done', 'already'].includes(st.status);
    if (done && name === 'enter') return advance(s, effects), true;
    // The y/n before the exact command.
    if (st.confirm && !done) {
      if (name === 'y' || name === 'enter') {
        st.confirm = false;
        st.rung = rungsOf(s).length - 1;
        st.lockUntil = s.now + HINT_LOCK_MS;
        if (!s.eased.includes(stepOf(s).skill)) s.eased.push(stepOf(s).skill);
        s.progress[s.lesson].bottomAt = stepOf(s).id;
        effects.push({ type: 'save' });
      } else if (name === 'n' || name === 'escape') st.confirm = false;
      else return false;
      return true;
    }
    if (name === 'b') return back(s, effects), true;
    if (name === 'x' && stepOf(s).optional) return skipStep(s, effects), true;
    const earlier = name === 'e' && backOffered(s);
    if (earlier) return goBack(s, earlier, effects), true;
    if (name === 'w' && beat.why.length) {
      s.overlay = 'why';
      return true;
    }
    // k: main asks the terminal to copy the beat's code block, all of it, or
    // the Windows line that stands in for it there.
    const code = name === 'k' && copyable(s);
    if (code) {
      const text = (s.facts.win32 && code.win) || code.text;
      effects.push({ type: 'copy', text });
      s.toast = { kind: 'copied', lines: text.split('\n').length, until: s.now + TOAST_MS };
      return true;
    }
    if (name === 'r') {
      const w = watching(s);
      if (!w) return false;
      st.explicit = true;
      // Asking for a check is a try, whatever the check says.
      st.unlocked = true;
      if (w.git && beat.doneLabel) st.ended = st.ended || st.status === 'fail';
      // Show that r's run is going, until its own result lands: r's number
      // goes out on the effect and comes back on the result. `before` keeps
      // the status "Checking" covers, for the hints and the key bar.
      s.asks += 1;
      Object.assign(st, { status: 'opening', slowWait: false, asked: s.asks, running: null, before: st.status === 'opening' ? st.before : st.status });
      if (w.check) effects.push({ type: 'check', lesson: w.check.lesson, items: w.check.items, evidence: beat.evidence ?? null, slow: true, asked: s.asks, dir: w.dir });
      if (w.file) effects.push({ type: 'file', path: w.file, asked: s.asks, dir: w.dir });
      if (w.git) effects.push(gitAsk(w, { asked: s.asks }));
      if (w.probe) effects.push(probeAsk(w, { asked: s.asks }));
      return true;
    }
    // At CHALLENGE, hints wait for a first try: name it instead of ignoring h.
    if (name === 'h' && !hintAvailable(s) && tierOf(s) === 'challenge' && !done && tryFirst(s) && !st.unlocked && rungsOf(s).length) {
      s.toast = { kind: 'hintsLater', try: tryFirst(s), until: s.now + TOAST_MS };
      return true;
    }
    if (name === 'h' && hintAvailable(s)) {
      if (s.now < st.lockUntil) return true;
      const rungs = rungsOf(s);
      if (st.rung + 1 === rungs.length - 1 && rungs.at(-1).kind === 'bottom') st.confirm = true;
      else {
        st.rung += 1;
        st.lockUntil = s.now + HINT_LOCK_MS;
      }
      return true;
    }
    if (done) return false;
    // The long wait's box: a number answers it, once, and scores nothing.
    const box = whileRunsOpen(s) && whileRunsOf(s);
    if (box && DIGIT.test(ch ?? '') && Number(ch) <= box.beat.options.length) {
      st.whileRuns.answer = Number(ch) - 1;
      s.whileShown.push(`${s.lesson}.${box.step.id}`);
      return true;
    }
    const q = questionOf(beat);
    if (q && !st.answer) {
      const n = beat.options.length;
      if (name === 'up') s.cursor = s.cursor < 0 ? n - 1 : (s.cursor + n - 1) % n;
      else if (name === 'down') s.cursor = (s.cursor + 1) % n;
      else if (name === 'enter' && s.cursor < 0) s.toast = { kind: 'pickFirst', until: s.now + TOAST_MS };
      else if (DIGIT.test(ch ?? '') && Number(ch) <= n) pick(s, Number(ch) - 1, effects), (s.cursor = Number(ch) - 1);
      else if (name === 'enter') pick(s, s.cursor, effects);
      else if (name === 's' && beat.kind !== 'predict' && beat.options.some((o) => o.kind === 'right')) reveal(s, effects);
      else return false;
      return true;
    }
    // Self, none and "the session has ended" beats. Space ticks each, as
    // its key bar says; enter only a none beat with nothing to confirm, so
    // the enter that goes on from a step can't tick the next step's self
    // beat unread, nor give the word a done-label waits for.
    const v = beat.verify.kind;
    if ((name === 'space' || (name === 'enter' && v === 'none' && !beat.doneLabel)) && (v === 'self' || v === 'none' || beat.kind === 'self')) {
      st.status = 'done';
      advance(s, effects);
      return true;
    }
    if (name === 'space' && v === 'git-clean' && beat.doneLabel) {
      st.ended = true;
      st.explicit = true;
      effects.push(gitAsk(watching(s)));
      return true;
    }
    return false;
  },
  complete(s, { name }) {
    if (name !== 'enter') return false;
    s.view = 'next';
    return true;
  },
  next(s, { name }, effects) {
    // Recall, then compare: space shows the lesson's card entries.
    if (name === 'space' && recallOf(s).length) {
      s.overlay = 'compare';
      s.cardAt = 0;
      return true;
    }
    if (name !== 'enter') return false;
    const next = nextLessonOf(s);
    if (next) startLesson(s, next.id, effects);
    else s.view = 'map';
    return true;
  },
  // The map shows the level of the lesson under the cursor: up and down
  // move within it, so the cursor is always on a row the map draws; left
  // and right go to the level before or after, round from the last to the
  // first as up and down go round a level, at its next lesson. So each
  // level's first lesson is two keys from Beginner's page.
  map(s, { name }, effects) {
    const at = s.course[s.mapCursor];
    const here = levelLessons(s, levelOf(s, at.id));
    const levels = levelsOf(s);
    const i = here.indexOf(at);
    const to = (l) => (s.mapCursor = s.course.indexOf(l));
    if (name === 'up') to(here[(i + here.length - 1) % here.length]);
    else if (name === 'down') to(here[(i + 1) % here.length]);
    else if (name === 'left' || name === 'right') {
      const level = levels[(levels.indexOf(levelOf(s, at.id)) + (name === 'left' ? levels.length - 1 : 1)) % levels.length];
      const lessons = levelLessons(s, level);
      to(lessons.find((l) => toFinish(s, l)) ?? lessons[0]);
    } else if (name === 'enter') startLesson(s, at.id, effects);
    // f: the work folder of the level on screen (ticket 86).
    else if (name === 'f' && levelKey(s, at.id)) askFolder(s, levelKey(s, at.id));
    else return false;
    return true;
  },
  checkonly(s, { name, itemsMax }, effects) {
    if (name === 'f' && folderKey(s)) {
      askFolder(s, folderKey(s));
      return true;
    }
    // The arrows: one item a press, no further than the card can scroll at
    // the window's size, which main sends with the key (render's itemsMax):
    // where every item fits, they move nothing.
    if (name === 'up' || name === 'down') {
      const max = itemsMax ?? lessonOf(s).items.length - 1;
      s.itemsAt = arrowed(s.itemsAt, max, name);
      return true;
    }
    if (name === 'r' && watching(s)) {
      // Where r runs a slow item, the card says r's run is going until its
      // own result lands, as a step card does. Elsewhere the run takes a
      // moment, and the card stays as it is.
      if (!lessonOf(s).slow.length) {
        effects.push({ type: 'check', lesson: s.lesson, items: null, slow: true, dir: folderOf(s) });
        return true;
      }
      s.asks += 1;
      s.checkOnlyRun = { lesson: s.lesson, asked: s.asks, running: null };
      effects.push({ type: 'check', lesson: s.lesson, items: null, slow: true, asked: s.asks, dir: folderOf(s) });
      return true;
    }
    return false;
  },
};
