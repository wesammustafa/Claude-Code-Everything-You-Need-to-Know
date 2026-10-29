// The key translator (ticket 207): the terminal's keys, pastes and clock
// become Learner actions for the lesson engine (engine.mjs), and the screen
// they act on stays here. reduce(state, event) returns { state, effects }
// on one merged state: the engine's fields and the terminal's own, `view`
// beyond the engine's phase, the overlays, the cursors, the toast, the held
// letter, the typed text and the motion stamps (`fx`). The terminal's
// effects, `copy`, `later` and `quit`, start here; every other effect is the
// engine's. Nothing here reads a file, a clock or the terminal. Ticket 210
// deletes this file.
import { GIT, PATH_MAX } from './content.mjs';
import { C } from './copy.mjs';
import * as engine from './engine.mjs';
import {
  answersGit, asksFolder, beatOf, cardOf, contentOf, folderKey, folderOf, hidesRuns, hintAvailable, introNotes, introOptions, isDone, isLastBeat,
  lessonOf, levelKey, levelLessons, levelOf, levelsOf, nextLessonOf, offered, pinOf, readFrom, recallOf, RESULTS, rungsOf, sameJson, stepOf, stepsOf,
  tierOf, toFinish, tryFirst, TYPED_MAX, watching, whileRunsOf, whileRunsOpen, folderOptions, backOffered,
} from './engine.mjs';
import { evidenceOf, judge } from './holds.mjs';
import { cleanListed } from './status.mjs';

export {
  answerKey, asksFolder, asksHere, asStarted, authoredTier, backOffered, backTo, beatOf, beatShown, cardOf, contentOf, doneBefore, easeLands,
  folderKey, folderOf, folderOptions, folderProblem, hidesRuns, hintAvailable, hintStatus, IDLE_MS, introAsks, introNotes, introOptions, isDone,
  isLastBeat, lessonNumber, lessonOf, levelFolder, levelKey, levelLessons, levelOf, levelsOf, longWait, missingNeeds, moreHelpGives, nextLessonOf,
  normalize, offered, pickWarmups, pinOf, recallOf, repoNeed, rungsOf, stepNote, stepOf, stepsOf, tearDownLeft, tierOf, tiersOf, toFinish,
  tryFirst, TYPED_MAX, unmet, WARMUPS, watching, whileRunsOf, whileRunsOpen,
} from './engine.mjs';

// The longest the reading grace holds ambient motion (motion.mjs).
export const GRACE_MAX_MS = 20_000;
export const HINT_LOCK_MS = 2_000;
export const DEFER_MS = 300;
const SWALLOW_MS = 800;
const TOAST_MS = 5_000;
// The file-change stamps kept before the newest (motion.mjs's shotStarts).
const ACTIVITY_KEPT = 8;

const clone = (x) => structuredClone(x);
// The screens Pip greets the learner on, once per opening (176).
const GREETS = ['welcome', 'resume'];

export function initialState(args) {
  const s = engine.initialState(args);
  const p = s.progress[s.lesson];
  // The welcome, the map where every lesson in the app is done, the resume
  // where the lesson has a place, else its intro.
  const view = !s.welcomed ? 'welcome' : !(lessonOf(s).content && !p.complete) ? 'map' : p.step ? 'resume' : 'intro';
  if (view === 'welcome' || view === 'map') engine.apply(s, { type: 'screen.away' }, []);
  return {
    ...s,
    view,
    overlay: null, cursor: 0, mapCursor: s.course.indexOf(lessonOf(s)), toast: null,
    held: null, swallowUntil: 0, confirmRestart: false,
    // The first card entry the c overlay shows, and the first item the
    // check-only card shows, in memory.
    cardAt: 0, itemsAt: 0,
    // r's run on the check-only card of a lesson with a slow item, until its
    // own result lands: its lesson, r's number and how far the child has
    // got, in memory.
    checkOnlyRun: null,
    // The motion layer's stamps (stampFx): the first screen appears now,
    // and Pip greets on it if it is the welcome or resume.
    fx: GREETS.includes(view) ? { view: s.now, greet: s.now } : { view: s.now },
  };
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
// What the check-only card says above a lesson's items.
export const checkOnlyWords = (s, l) => (pinOf(l) !== 'new copy' ? C.checkOnly : folderOf(s, l.id) ? C.newCopyAt : C.newCopy);
// The overlays the arrows scroll, each by its entries: one place an entry,
// then the Commands by level link, the last (render.mjs); the intro's notes
// one place a note.
const SCROLLED = { card: cardOf, compare: recallOf, notes: (s) => introNotes(s).slice(1) };
// One place a press of the arrows, from 0 to `max`: a place past `max`, as
// before a resize, counts as `max`, so up moves at once.
const arrowed = (at, max, name) => Math.max(0, Math.min(max, Math.min(at, max) + (name === 'down' ? 1 : -1)));

// The path prompt, opened on a folder question, f or the map. What is
// typed is the prompt's own, kept on the engine's folder answer.
function askFolder(s, key, effects) {
  if (!act(s, { type: 'folder.ask', key }, effects)) return;
  s.overlay = 'folder';
  s.folderAsk.typed = '';
}

// The path prompt's keys: a pasted path arrives whole (onPaste), typed
// keys one at a time. Enter sends the path to main to look at; an empty line
// is the practice copy, where the copy is an answer. While main looks, only
// Esc works. What is typed, and the notes about the last answer it clears,
// are the prompt's own, on the engine's folder answer.
function folderKeyPress(s, { name, ch }, effects) {
  const a = s.folderAsk;
  if (name === 'escape') {
    s.overlay = null;
    act(s, { type: 'folder.cancel' }, effects);
    return;
  }
  if (a.asked) return;
  if (name === 'enter') {
    const text = a.typed.trim();
    if (text) act(s, { type: 'folder.choose', key: a.key, to: { path: text } }, effects);
    else act(s, { type: 'folder.choose', key: a.key, to: 'practice-copy' }, effects);
    return;
  }
  if (name === 'backspace') a.typed = a.typed.slice(0, -1);
  else if (ch && ch >= ' ') a.typed = (a.typed + ch).slice(0, PATH_MAX);
  else return;
  act(s, { type: 'folder.ask', key: a.key }, effects);
}

// n opens the notes at their first.
function openNotes(s) {
  s.overlay = 'notes';
  s.cardAt = 0;
}

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

// ---- the engine's actions, from the screen -----------------------------------
// The screen for the engine's phase: a lesson with no lesson file has its
// check-only card in place of an overview.
function screenOf(s) {
  if (s.phase === 'overview') return contentOf(s) ? 'intro' : 'checkonly';
  return { playing: 'step', 'step-down': 'levelup', complete: 'complete' }[s.phase];
}
// The actions after which the screen is the engine's phase.
const NAVIGATES = ['lesson.open', 'lesson.start', 'lesson.next', 'step.continue', 'step.back', 'step.skip', 'step.revisit', 'step.markDone', 'stepDown.accept', 'stepDown.moreHelp', 'stepDown.back'];

// What afterEngine compares with, taken before the engine acts: the folder
// answer, and the folder of the lesson r's check-only run is for.
const beforeEngine = (s) => ({ folderAsk: s.folderAsk, run: s.checkOnlyRun && folderOf(s, s.checkOnlyRun.lesson) });

// The terminal's own state after any engine call, an action or a result.
function afterEngine(s, before, input) {
  // A beat that opened gets its typed text and its hint lock. Nothing is
  // picked until the learner picks: an Enter meant for the screen before
  // can't answer a question.
  if (s.beat && !('typed' in s.beat)) {
    Object.assign(s.beat, { typed: '', lockUntil: 0 });
    const beat = beatOf(s);
    s.cursor = beat.ask && beat.options.length ? -1 : 0;
  }
  // The folder answer was taken: the prompt closes, and the intro's menu is
  // the start options now, the cursor on the first.
  const chosen = (input.type === 'folder.choose' && input.to === 'practice-copy') || (input.type === 'probed' && Boolean(before.folderAsk) && !s.folderAsk);
  if (chosen) {
    if (s.overlay === 'folder' && !s.folderAsk) s.overlay = null;
    if (s.view === 'intro') s.cursor = 0;
  }
  // r's run on the check-only card says nothing about another folder.
  if (s.checkOnlyRun && folderOf(s, s.checkOnlyRun.lesson) !== before.run) s.checkOnlyRun = null;
}

// Sends an action to the engine and sets the screen after it. False where
// the action could not act there.
function act(s, action, effects) {
  const before = beforeEngine(s);
  const { asks } = s;
  const rung = s.beat?.rung;
  const typedWrong = s.beat?.typedWrong;
  if (!engine.apply(s, action, effects)) return false;
  afterEngine(s, before, action);
  const { type } = action;
  if (NAVIGATES.includes(type)) {
    s.view = screenOf(s);
    if (s.view === 'intro') s.cursor = 0;
  }
  if (type === 'lesson.open' || type === 'lesson.next') {
    s.overlay = null;
    if (s.view === 'checkonly') {
      s.itemsAt = 0;
      // r's run on this card goes on through a trip to the map; another
      // lesson's run is not this card's (verify.mjs owing drops what r asked for it).
      if (s.checkOnlyRun?.lesson !== s.lesson) s.checkOnlyRun = null;
    }
  }
  if (type === 'welcome.finish' || type === 'lesson.restart') {
    s.view = 'intro';
    s.cursor = 0;
  }
  // A wrong answer typed clears the line for the next try.
  if (type === 'answer.type' && s.beat.typedWrong > typedWrong && s.beat.status !== 'done') s.beat.typed = '';
  // A rung, and the exact command, wait a moment before h opens another.
  if ((type === 'hint.next' && s.beat.rung > rung) || (type === 'hint.takeExact' && action.take)) s.beat.lockUntil = s.now + HINT_LOCK_MS;
  if (type === 'check.run' && s.view === 'checkonly' && s.asks > asks) s.checkOnlyRun = { lesson: s.lesson, asked: s.asks, running: null };
  return true;
}

// The lesson opens, as the map's enter opens it. Unused, and kept only so
// flow.mjs exports every name it had until ticket 210 deletes it.
export function startLesson(s, id, effects) {
  act(s, { type: 'lesson.open', lesson: id }, effects);
}

// ---- the reducer -------------------------------------------------------------
export function reduce(prev, ev) {
  const s = clone({ ...prev, course: null });
  s.course = prev.course;
  const effects = [];
  if (ev.now !== undefined) s.now = ev.now;
  if (s.toast && s.now >= s.toast.until) s.toast = null;
  // What the motion layer reads the event as: a result about another
  // folder as the engine rewrote it.
  let seen = ev;
  switch (ev.type) {
    case 'key':
      engine.apply(s, { type: 'activity' }, effects);
      guardKey(s, ev, effects);
      break;
    case 'paste':
      // A path pasted into the prompt is kept whole, up to its first line.
      if (s.overlay === 'folder') {
        if (!s.folderAsk.asked) {
          s.folderAsk.typed = (s.folderAsk.typed + ev.text.replace(/[\r\n].*$/s, '')).slice(0, PATH_MAX);
          act(s, { type: 'folder.ask', key: s.folderAsk.key }, effects);
        }
      } else if (s.view === 'step' && s.beat && beatOf(s).kind === 'type' && s.beat.status !== 'done') {
        s.beat.typed = (s.beat.typed + ev.text.replace(/[\r\n].*$/s, '')).slice(0, TYPED_MAX);
      } else onPaste(s);
      break;
    case 'flush':
      flushHeld(s, effects);
      break;
    case 'tick':
      flushHeld(s, effects);
      engine.apply(s, ev, effects);
      break;
    case 'notice':
      s.toast = { kind: ev.kind, message: ev.message, until: s.now + TOAST_MS * 2 };
      break;
    case 'run-start':
      break;
    default: {
      // r's run on the check-only card goes until its own result lands.
      if (RESULTS.includes(ev.type) && s.checkOnlyRun && ev.asked === s.checkOnlyRun.asked) s.checkOnlyRun = null;
      const before = beforeEngine(s);
      seen = engine.apply(s, ev, effects);
      // On the check-only card, only r's own run counts.
      if (ev.type === 'running' && s.checkOnlyRun && ev.asked === s.checkOnlyRun.asked && ev.lesson === s.checkOnlyRun.lesson) s.checkOnlyRun.running = { n: ev.n, m: ev.m };
      afterEngine(s, before, ev);
      // An offer that goes takes the cursor on it back to the first option.
      if (ev.type === 'prereq' && s.view === 'intro' && s.lesson === ev.lesson && !asksFolder(s) && s.cursor >= introOptions(s).length) s.cursor = 0;
    }
  }
  engine.settle(prev, s, effects);
  stampFx(prev, s, seen);
  return { state: s, effects };
}

// A held letter with nothing typed after it is a key press after all.
function flushHeld(s, effects) {
  if (s.held && s.now - s.held.at >= DEFER_MS) {
    const held = s.held;
    s.held = null;
    onKey(s, held, effects);
  }
}

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
// When the screen changed, and how, for the motion layer (motion.mjs). Each
// stamp is the event's own `now`; `s.fx` lives in memory and is never saved.
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
    if (name === 'enter') return act(s, { type: 'answer.type', text: s.beat.typed }, effects);
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
    act(s, { type: 'screen.away' }, effects);
    return;
  }
  VIEWS[s.view]?.(s, ev, effects);
}

function closeMap(s, effects) {
  // The map the app opened on has no screen behind it: open its lesson.
  if (!s.mapReturn) return act(s, { type: 'lesson.open', lesson: s.lesson }, effects);
  s.view = s.mapReturn;
  // Back on a step card, it asks again what its beat waits on: files may
  // have changed meanwhile.
  act(s, { type: 'screen.back' }, effects);
}

const VIEWS = {
  welcome(s, { name }, effects) {
    if (name !== 'enter') return false;
    return act(s, { type: 'welcome.finish' }, effects);
  },
  resume(s, { name }, effects) {
    if (s.confirmRestart) {
      if (name === 'y') act(s, { type: 'lesson.restart', lesson: s.lesson }, effects);
      s.confirmRestart = false;
      return true;
    }
    if (name === 'enter') return act(s, { type: 'lesson.open', lesson: s.lesson }, effects);
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
      else if (name === 'enter' && options[s.cursor] === 'copy') act(s, { type: 'folder.choose', key: folderKey(s), to: 'practice-copy' }, effects);
      else if (name === 'enter') askFolder(s, folderKey(s), effects);
      else if (name === 'n' && introNotes(s).length) openNotes(s);
      else return false;
      return true;
    }
    const options = introOptions(s);
    if (name === 'f' && folderKey(s)) askFolder(s, folderKey(s), effects);
    else if (name === 'n' && introNotes(s).length) openNotes(s);
    else if (name === 'up' || name === 'down') s.cursor = (s.cursor + (name === 'down' ? 1 : options.length - 1)) % options.length;
    else if (DIGIT.test(ch ?? '') && Number(ch) <= options.length) s.cursor = Number(ch) - 1;
    else if (name === 'enter' && options[s.cursor] === 'first') act(s, { type: 'lesson.open', lesson: offered(s) }, effects);
    else if (name === 'enter') act(s, { type: 'lesson.start', help: s.cursor === 1 ? 'less' : 'planned' }, effects);
    else return false;
    return true;
  },
  levelup(s, { name }, effects) {
    // g where it gives nothing goes on like enter.
    if (name === 'enter') return act(s, { type: 'stepDown.accept' }, effects);
    if (name === 'g') return act(s, { type: 'stepDown.moreHelp' }, effects);
    if (name === 'b') return act(s, { type: 'stepDown.back' }, effects);
    return false;
  },
  step(s, ev, effects) {
    const { name, ch } = ev;
    const beat = beatOf(s);
    const st = s.beat;
    const done = isDone(st);
    if (done && name === 'enter') return act(s, { type: 'step.continue' }, effects);
    // The y/n before the exact command.
    if (st.confirm && !done) {
      if (name === 'y' || name === 'enter') act(s, { type: 'hint.takeExact', take: true }, effects);
      else if (name === 'n' || name === 'escape') act(s, { type: 'hint.takeExact', take: false }, effects);
      else return false;
      return true;
    }
    if (name === 'b') return act(s, { type: 'step.back' }, effects);
    if (name === 'x' && stepOf(s).optional) return act(s, { type: 'step.skip' }, effects);
    if (name === 'e' && backOffered(s)) return act(s, { type: 'step.revisit' }, effects);
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
    if (name === 'r') return Boolean(watching(s)) && act(s, { type: 'check.run' }, effects);
    // At CHALLENGE, hints wait for a first try: name it instead of ignoring h.
    if (name === 'h' && !hintAvailable(s) && tierOf(s) === 'challenge' && !done && tryFirst(s) && !st.unlocked && rungsOf(s).length) {
      s.toast = { kind: 'hintsLater', try: tryFirst(s), until: s.now + TOAST_MS };
      return true;
    }
    if (name === 'h' && hintAvailable(s)) {
      if (s.now < st.lockUntil) return true;
      return act(s, { type: 'hint.next' }, effects);
    }
    if (done) return false;
    // The long wait's box: a number answers it, once, and scores nothing.
    const box = whileRunsOpen(s) && whileRunsOf(s);
    if (box && DIGIT.test(ch ?? '') && Number(ch) <= box.beat.options.length) return act(s, { type: 'waitQuestion.answer', option: Number(ch) - 1 }, effects);
    if (beat.ask && !st.answer) {
      const n = beat.options.length;
      if (name === 'up') s.cursor = s.cursor < 0 ? n - 1 : (s.cursor + n - 1) % n;
      else if (name === 'down') s.cursor = (s.cursor + 1) % n;
      else if (name === 'enter' && s.cursor < 0) s.toast = { kind: 'pickFirst', until: s.now + TOAST_MS };
      else if (DIGIT.test(ch ?? '') && Number(ch) <= n) act(s, { type: 'answer.pick', option: Number(ch) - 1 }, effects), (s.cursor = Number(ch) - 1);
      else if (name === 'enter') act(s, { type: 'answer.pick', option: s.cursor }, effects);
      else if (name === 's' && beat.kind !== 'predict' && beat.options.some((o) => o.kind === 'right')) act(s, { type: 'answer.reveal' }, effects);
      else return false;
      return true;
    }
    // Self, none and "the session has ended" beats. Space ticks each, as
    // its key bar says; enter only a none beat with nothing to confirm, so
    // the enter that goes on from a step can't tick the next step's self
    // beat unread, nor give the word a done-label waits for.
    const v = beat.verify.kind;
    if ((name === 'space' || (name === 'enter' && v === 'none' && !beat.doneLabel)) && (v === 'self' || v === 'none' || beat.kind === 'self')) return act(s, { type: 'step.markDone' }, effects);
    if (name === 'space' && v === 'git-clean' && beat.doneLabel) return act(s, { type: 'session.ended' }, effects);
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
    if (nextLessonOf(s)) return act(s, { type: 'lesson.next' }, effects);
    s.view = 'map';
    act(s, { type: 'screen.away' }, effects);
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
    } else if (name === 'enter') act(s, { type: 'lesson.open', lesson: at.id }, effects);
    // f: the work folder of the level on screen (ticket 86).
    else if (name === 'f' && levelKey(s, at.id)) askFolder(s, levelKey(s, at.id), effects);
    else return false;
    return true;
  },
  checkonly(s, { name, itemsMax }, effects) {
    if (name === 'f' && folderKey(s)) {
      askFolder(s, folderKey(s), effects);
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
    // Where r runs a slow item, the card says r's run is going until its
    // own result lands, as a step card does. Elsewhere the run takes a
    // moment, and the card stays as it is.
    if (name === 'r' && watching(s)) return act(s, { type: 'check.run' }, effects);
    return false;
  },
};

