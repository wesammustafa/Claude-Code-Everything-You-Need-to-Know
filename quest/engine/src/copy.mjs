// The app's own words. They state no Claude Code fact: every fact on screen
// is a quote from the lesson's content file. Tests keep commands, versions,
// model names and any claim the app can't back out of this file.
// A celebration praises the work, not how it was done: a string a
// celebration shows goes on CELEBRATIONS in checks/test/learn-content.test.mjs.

// One name for each thing the app's words talk about. The copy test rejects
// an older name, or a second way to describe the tiers.
export const TERMS = {
  practiceCopy: "practice copy",
  // The copy of the template a-5 and the Advanced capstone have the learner make.
  newCopy: "new copy",
  // Where a later level's lessons happen (ticket 86): the practice copy by
  // default, or another folder, such as one of the learner's own projects.
  workFolder: "work folder",
  yourRepository: "your repository",
  tierHelp: {
    guided: "every command shown",
    hinted: "the goal, hints if you ask",
    challenge: "just the goal",
  },
  // The guide's level names, by the folder of a lesson's page.
  levels: {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  },
  // A level's index page, docs/<level>/README.md, as the guide's README
  // links it: "Level index".
  levelIndex: "level index",
};

export const C = {
  appName: "Claude Code practice",
  levels: TERMS.levels,
  levelPath: (level) => `${level} path`,
  pathLabel: (level, done, total) =>
    `${C.levelPath(level)} · ${done} of ${total} done`,
  pathHint: "each stop a little harder",
  hi: (name) => `Hi ${name || "there"}! Let's learn Claude Code by using it.`,
  pip1: `I'm Pip. I watch your ${TERMS.practiceCopy} and light up`,
  pip2: "the moment a step works.",
  // A lesson may use more than one other window (ticket 103), so the
  // welcome promises none in particular.
  twoWindows: "You use this window beside one or more terminals:",
  thisWindow: "this window",
  thisWindowLines: ["one step at a time,", "checks your work"],
  otherWindow: "your terminals",
  otherWindowLines: [
    "where you type commands",
    "and run Claude Code",
    "(this app checks them)",
  ],
  openSecond: "Open a second terminal now, in this same folder:",
  comeBack: "Then come back here and press enter.",
  // The boot frame, while git answers the first questions at start.
  askingGit: "Asking git about this folder…",
  gitBroken: (error) =>
    `git isn't working here: ${error}. This isn't your work: install git, then start this app again.`,

  whyLead: "Why:",
  youllBeAble: "You'll be able to",
  helpShrinks: "The help shrinks each time a skill comes back:",
  tierHelp: TERMS.tierHelp,
  startLesson: (n) => `Start lesson ${n}`,
  startCapstone: "Start the capstone",
  lessHelp: "I've used Claude Code before: give me less help",
  steps: (n) => `${n} steps`,
  stepOf: (n, m) => `step ${n} of ${m}`,

  where: {
    terminal: "in your other terminal",
    claude: "in Claude Code",
    "claude-2": "in your second Claude Code",
    shell: "in a terminal beside Claude Code",
    editor: "in your editor",
    browser: "in your browser",
    predict: "guess first",
    ask: "quick question",
    type: "from memory",
    self: "self-check",
  },
  // A lesson that numbers its terminals as its page does (ticket 103).
  terminalN: (n) => `in terminal ${n}`,
  // A long wait's card, where the page gives no words for it (ticket 103):
  // about the app, never about how long the run takes.
  waitLong: "No hurry: this card waits for as long as it takes.",
  // The box a long wait offers a warm-up in (ticket 150). It scores nothing.
  whileItRuns: "While it runs",
  whileNotScored: "not scored",
  whilePress: "Press its number to answer.",
  terminalInFolder: "in a terminal",
  warmup: (n, level) =>
    `Warm-up from ${level ? `${level} lesson` : "lesson"} ${n}`,
  warmupIndex: (level) => `Warm-up from the ${level} ${TERMS.levelIndex}`,
  // A wrong pick shows its because at once, but a typed warm-up with no hint
  // (Intermediate's, 137) shows the lesson's words only after a second try,
  // and since 194 this line goes on whichever warm-up a learner meets first:
  // so "follow", not "at once".
  warmupWhy:
    "A warm-up brings back an earlier lesson from memory. A wrong answer is fine: the lesson's words follow.",
  // A warm-up from a level index quotes that page, not a lesson (ticket
  // 178): these take the place of the words of the same name around it.
  fromIndex: {
    warmupWhy: `A warm-up asks one question from memory. A wrong answer is fine: the ${TERMS.levelIndex}'s words follow.`,
    why: `Why this matters, in the ${TERMS.levelIndex}'s words:`,
    trueOfElse: `That's true of something else. The ${TERMS.levelIndex} says:`,
    theAnswer: `The answer, in the ${TERMS.levelIndex}'s words:`,
    fixFirst: `That's the fix, in the ${TERMS.levelIndex}'s words:`,
    stillStuck: `Still stuck? Press p for the ${TERMS.levelIndex} and the Stuck link.`,
    codeMore: `More lines are on the ${TERMS.levelIndex}: press p.`,
    codeWide: (dots) =>
      `A line that ends in ${dots} goes on past the edge: press p for the ${TERMS.levelIndex}.`,
    pageTitle: `The ${TERMS.levelIndex}`,
  },
  warmups: (n) => `${n} warm-up${n === 1 ? "" : "s"} first`,
  done: "DONE",
  doneWhen: "Done when ",
  noCommands: "No commands this time.",
  // An optional step's card (ticket 102): the lesson file's words for when
  // to skip it, then the key.
  optional: (when) => `Optional. ${when} Press x to skip it.`,
  doneEachPart: "You've done each part before.",
  watching: (what) => [
    `Watching `,
    what,
    ". I'll turn green the moment it's right.",
  ],
  staleWatch: (what) => [
    `Watching `,
    what,
    ". It's from an earlier step: I'll turn green once it changes.",
  ],
  stalePush: (what) => [
    "Watching ",
    what,
    ": everything here is already pushed, so I'll turn green after your next push.",
  ],
  fileEmpty: (path) => `${path} has no line in it yet.`,
  // What a file holds, for a beat that reads it (ticket 87): the not-yet lines.
  noFile: (path) => `${path} is not there yet.`,
  noMatch: (glob) => `No file matches ${glob} yet.`,
  notText: (path, what) => `${path} is not a text file yet: it holds ${what}.`,
  notJson: (path, error) => `${path} does not parse as JSON yet (${error}).`,
  noKey: (path, key) => `${path} has no ${key} yet.`,
  noLine: (path) => `${path} has no line like that yet.`,
  // A fresh match on a file that only grew reads only what was added.
  noNewLine: (path) => `${path} has no new line like that yet.`,
  stillHas: (path, line) => `${path} still has: ${line}`,
  notValue: (path, key, found, value) =>
    `${path} has ${key} ${found}, not ${value}, yet.`,
  // A binary file's evidence: its kind and size, never its bytes.
  pngImage: (w, h) => `a PNG image, ${w} x ${h}`,
  binaryData: (size) => `binary data, ${size}`,
  andMore: (line, n) => `${line} and ${n} more line${n === 1 ? "" : "s"}`,
  slowWait:
    "Part of this check takes a while, so it runs only when you ask: press r when you are ready.",
  doneBefore: {
    hinted: "You've done this before, so you get the goal: press h for hints.",
    challenge: "You've done this before, so you get just the goal.",
  },
  watchingGit: "Watching ",
  gitClean: "no changes so far",
  // `under`: the paths a git-clean beat names, where it names some (ticket 88).
  gitCleanUnder: (under) => `no changes under ${under} so far`,
  gitDirty: (n) => `git status lists ${n} change${n === 1 ? "" : "s"}:`,
  // A look at part of the tree has git list each file, where git status
  // alone lists a new folder whole: these lines name files, not git status.
  changedUnder: (n, under) =>
    `${n} file${n === 1 ? "" : "s"} changed under ${under}:`,
  // A git-clean scope that is one file, and the one change (r27 E13).
  fileUncommitted: (path) => `${path} has uncommitted changes.`,
  checking: (what) => (what ? `Checking ${what}…` : "Checking…"),
  // How far a run of several items has got, from the check child's reports.
  checkingItem: (n, m) => `Checking item ${n} of ${m}…`,
  // How long a slow check's child has run, beside the spinner.
  seconds: (n) => `${n} s`,
  notYet: "Not yet:",
  // The not-yet line folded under "The check says:", which says why.
  notYetShort: "Not yet.",
  pressH: "Press h for help.",
  pressHAgain: "Press h again for more help.",
  checkSays: "The check says:",
  showExact: "Show the exact command? y / n",
  // A check that answers the same after the learner redid the step (ticket
  // 192). The app can't see why, so it points earlier, and to the step a
  // lesson's back line names, which e goes back to.
  sameAnswer:
    "You redid this step and the check says the same, so the cause is likely in an earlier step.",
  goBack: (n, title) =>
    `Press e to go back to step ${n}: ${title}. Your files and ticks stay.`,
  // The note's shorter forms, for a window with fewer spare rows: the note
  // takes only the rows the screen has free, so nothing on it moves.
  sameShort: "Same answer again: the cause is likely earlier.",
  goBackTo: (n, title) => `Press e to go back to step ${n}: ${title}.`,
  sameBack: (n, title) =>
    title
      ? `Same answer again. Press e to go back to step ${n}: ${title}.`
      : `Same answer again. Press e to go back to step ${n}.`,
  stuckOffer: "Stuck? Press h for a hint.",
  broken: (error) =>
    `The check could not run: ${error}. This isn't your work. Press r to try again.`,
  gitFailAfter: "Press r to look again.",
  stepDone: (n) => `Step ${n} done!`,
  holds: (path) => [path, " holds "],
  cleanCopy: `Your ${TERMS.practiceCopy} is clean: nothing to commit.`,
  // In the learner's own repository, a work folder that isn't the copy.
  cleanRepo: "Your repository is clean: nothing to commit.",
  cleanUnder: (under) => `git status lists nothing under ${under}.`,
  // What changed, for a beat that needs git status to list something.
  changedShows: (shown, more) =>
    `Changed: ${shown}${more ? ` and ${more} more` : ""}`,
  noChangeUnder: (under) => `git status lists no change under ${under} yet.`,
  noChange: "git status lists no change yet.",
  nothingStaged: "git status lists nothing staged yet.",
  stagedShows: (shown, more) =>
    `Staged: ${shown}${more ? ` and ${more} more` : ""}`,
  changedOutside: (n, under, shown) =>
    `${n} file${n === 1 ? "" : "s"} changed outside ${under}: ${shown}`,
  // Against how git was when step n opened (ticket 105).
  headSame: (n) =>
    `No new commit yet: HEAD is where it was when step ${n} opened.`,
  headDirty: (count, shown, more) =>
    `A new commit, but git status still lists ${count} path${count === 1 ? "" : "s"}: ${shown}${more ? ` and ${more} more` : ""}`,
  headMoved: (sha) => `A new commit, ${sha}, and nothing left to commit.`,
  unchanged: (n) => `git status lists the same paths as when step ${n} opened.`,
  changedSince: (n, count, shown, more) =>
    `git status lists other paths than when step ${n} opened${count ? `: ${shown}${more ? ` and ${more} more` : ""}` : ": none now"}`,
  // A requires item that is the work folder's own (probe todos), not a lesson's.
  folderLacks: (hint) =>
    `This lesson needs your ${TERMS.workFolder} to hold more: ${hint}`,
  session: (n) => `${n} step${n === 1 ? "" : "s"} this session`,
  beatDone: "Done.",
  already: "Already done: the check already passes, so this step counts.",
  // A beat git status passed before anything changed: no check ran.
  alreadyDone: "Already done, so this step counts.",
  alreadyCheck: "The check already passes, so this step counts.",
  hintsLater: (via) =>
    via === "pick"
      ? "Try it first: pick an answer, then h works."
      : "Try it first: press r to check, then h works.",
  pickFirst: "Pick an answer first: a number, or the arrows.",
  why: "Why this matters, in the lesson's words:",

  guessFirst: "Guess:",
  safetyChoice: "A safety choice.",
  anyAnswer: "Any answer is fine: nothing is scored.",
  guessRight: "Your guess was right.",
  nowYouKnow: "Now you know:",
  findOutAt: (n) => `Got it. You'll find out at step ${n}.`,
  youGuessed: (text) => `You guessed: ${text}`,
  right: "Right.",
  answered: "Answered.",
  notQuite: "Not quite.",
  trueOfElse: "That's true of something else. The lesson says:",
  lookAgain: "Look again, or press s to see the answer.",
  // On a typing beat s is a letter of the answer (ticket 187).
  lookAgainTyped:
    "Look again, or press enter on an empty line to see the answer.",
  lookFor: "Look for",
  theAnswer: "The answer, in the lesson's words:",
  theAnswerIs: (n) => `It's option ${n}.`,
  fixFirst: "That's the fix, in the lesson's words:",
  fixThenPick: "Fix it, then pick again.",
  otherFine: "That's fine.",
  stillStuck: "Still stuck? Press p for the lesson page and the Stuck link.",
  // Where a code block is taller than the window: what doesn't fit is on
  // the page (ticket 90), above or below the line the beat explains.
  codeMore: "More lines are on the lesson page: press p.",
  // Where a line of it is wider than the window and ends in `dots`.
  codeWide: (dots) =>
    `A line that ends in ${dots} goes on past the edge: press p for the lesson page.`,
  // k sends the block to the terminal, which may or may not put it on the
  // clipboard: the app can't see which, so it says what it did.
  copied: (n) =>
    `Asked your terminal to copy ${n === 1 ? "this line" : `these ${n} lines`}. Nothing to paste? Press p for the page.`,
  lastQuestion: "Last question",
  typeIt: "Type it and press enter. No options this time.",
  emptyShows: "Not sure? Press enter on an empty line to see the answer.",
  checkPasses: (n, m) => [`passes: ${n} of ${m} item${m === 1 ? "" : "s"}.`],
  runItToo: (place) => `Run it ${place} too: you will see the same result.`,
  eased: "A little more help on this one: you needed help with it last time.",
  stray: "That looks like a command. Type it in your other terminal, not here.",
  strayIn: (place) =>
    `That looks like a command. Type it in a terminal, ${place}, not here.`,
  // Which folder a line that sends the learner to another terminal means,
  // where the level's work folder isn't the copy (ticket 86).
  inFolder: (name) => `in ${name}`,
  inCopy: `in your ${TERMS.practiceCopy}`,
  inNewCopy: `in your ${TERMS.newCopy}`,

  levelUp: "LEVEL UP",
  toHinted: [
    "You've done each of these once, with every command shown.",
    "From here you get the goal. Press h when you want a hint.",
  ],
  toChallenge: [
    "From memory now: just the goal.",
    "Try it first, then press h if you need a hint.",
  ],
  nextCounts: (h, c) =>
    `Still to come: ${[h && `${h} hinted step${h === 1 ? "" : "s"}`, c && `${c} challenge${c === 1 ? "" : "s"}`].filter(Boolean).join(" and ")}.`,

  complete: "COMPLETE",
  lessonDone: (label) => `${label} done! You practised:`,
  badge: (name) => `New badge: ${name}`,
  checkedSummary: (n, m) =>
    `The lesson's check passes: ${n} of ${m} item${m === 1 ? "" : "s"}`,
  handover: "You did every task without the exact command.",
  // On each level's capstone next screen only: inside a level, the next
  // lesson expects a clean tree.
  invitation:
    "Questions about anything in this level? Ask in your other terminal, then compare the answer with the lesson pages.",
  invitationAt: (place) =>
    `Questions about anything in this level? Ask in your other terminal, ${place}, then compare the answer with the lesson pages.`,
  answeredSummary: (n) => `${n} question${n === 1 ? "" : "s"} answered`,
  yourClimb: "Your climb",
  nextUp: "Next up",
  notchHarder: "A notch harder: it starts with less help.",
  savedBreak:
    "Your progress is saved, so a break is fine. Come back with npm run learn.",
  goFurther: "Go further:",

  map: "MAP",
  help: "Help:",
  mapFooter:
    "Each lesson reuses what came before, so it starts with less help.",
  mapDone: "done",
  mapNext: "next",
  // A lesson whose Check passed with its Tear down still to do (ticket 102).
  mapTearDown: "tear down",
  tearDownLeft: "The check passes. The tear down is still to do.",
  ofDone: (n, m) => `${n} of ${m} done`,

  checkOnly: [
    "This lesson isn't in the app yet. Follow the lesson page,",
    "and I'll watch its check for you:",
  ],
  // After the page's name (pageTitle, p's title), a link where links work,
  // on the card: p spells out the address, which a card's rail would break.
  pageLink: ": press p for its address.",
  newCopy: [
    `This lesson runs in a ${TERMS.newCopy} of the template, not in this`,
    `${TERMS.practiceCopy}. Press f to give its folder, and I'll watch its check there:`,
  ],
  newCopyAt: [
    `This lesson runs in your ${TERMS.newCopy} of the template. Follow the`,
    "lesson page, and I'll watch its check there:",
  ],
  newCopyPlain: `runs in a ${TERMS.newCopy} of the template, so it is not checked here`,
  // Which items the check-only card shows, where they don't all fit.
  itemsShown: (a, b, n) => `Items ${a} to ${b} of ${n}`,
  itemOf: (a, n) => `Item ${a} of ${n}`,

  // The work folder (ticket 86): the intro's question, the prompt for a
  // folder's path, and what the app found there. These are about this app
  // and git, never about Claude Code.
  folderAsk: (level) => `Where do you want to practise ${level}?`,
  folderCopy: `In this ${TERMS.practiceCopy}`,
  folderOther: `In another folder, such as ${TERMS.yourRepository}`,
  newCopyAsk: `Where is your ${TERMS.newCopy} of the template?`,
  folderNewCopy: `Give the folder of your ${TERMS.newCopy}`,
  workFolder: "Work folder:",
  thisCopy: `this ${TERMS.practiceCopy}`,
  folderPrompt: (level) => `The ${TERMS.workFolder} for ${level}`,
  folderPromptNew: `The folder of your ${TERMS.newCopy} of the template`,
  folderHow: "Type or paste its path, then press enter.",
  folderEmpty: `An empty line means this ${TERMS.practiceCopy}.`,
  // The notes name no folder: the header and the Work folder line do, so a
  // long name costs no row.
  notGit: `git says this ${TERMS.workFolder} is not a git repository. Press f to pick another folder.`,
  noPractice: `Git doesn't ignore .practice/ in this ${TERMS.workFolder}, where lessons save their files: add a .practice/ line to its .git/info/exclude or .gitignore.`,
  folderGitBroken: (error) =>
    `git couldn't look at this ${TERMS.workFolder}: ${error}.`,
  // A new copy given as this practice copy, in the prompt or with --dir.
  newCopyIsCopy: `That is this ${TERMS.practiceCopy}. Give the folder of your ${TERMS.newCopy} of the template.`,
  folderGone: (path) =>
    `No folder at ${path} any more. Press f to pick another.`,
  // What a lesson needs before it starts (ticket 89). A prerequisite that
  // failed in the work folder: the lesson it comes from, and the one check
  // item that doesn't pass or what the one file lacks.
  buildsOnCheck: (label, item) =>
    `This lesson builds on ${label}. One item of its check doesn't pass here yet: ${item}`,
  buildsOnFile: (label, hint) => `This lesson builds on ${label}: ${hint}`,
  openFirst: (label) => `Open ${label} first`,
  // Commands no PATH folder holds, before the page's You need lines that name them.
  // The lead of the page's line for the learner's repository (ticket 179).
  youNeed: "You need:",
  notOnPath: (...names) =>
    `No ${names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : names[0]} on your PATH. You need:`,
  // Where the intro has no room for all of that, one row hands it to n.
  notesShort: "Read this before you start: press n",
  notesTitle: "Before you start",

  welcomeBack: "Welcome back!",
  restartAsk:
    "Start this lesson over? Your answers and ticks for it are cleared.",
  saveFailed: (error) =>
    `Couldn't save your place: ${error}. The app keeps going.`,
  youreOn: (label, n, m, title) =>
    `You're on ${label}, step ${n} of ${m}: ${title}.`,

  cardTitle: "Your card",
  cardIntro: "The commands from steps you finished, in the lessons' words.",
  cardEmpty:
    "Nothing here yet: commands show up here as you finish the steps that use them.",
  cardLink: "Commands by level, in the guide:",
  // Recall, then compare: the next screen asks, space shows the entries.
  // A lesson's entries can be keys or a git command, and there can be one:
  // the words name neither a kind nor a number.
  recallAsk: (label) =>
    `Say to yourself what ${label} taught you, then press space.`,
  compareTitle: (label) => `${label}, on your card`,
  compareIntro: "Compare what you said with the lesson's own words.",

  pageTitle: "The lesson page",
  stuckLink: "Stuck? Tell us here:",

  keysTitle: "Keys",
  keyHelp: [
    ["enter", "next, or choose"],
    ["space", "I did it"],
    ["↑ ↓  1-9", "move, or pick an answer"],
    ["h", "a hint, one at a time"],
    ["r", "check again now"],
    ["w", "why this matters"],
    ["b", "back one screen"],
    ["m", "the map of lessons"],
    ["p", "the lesson page and what to read next"],
    ["?", "these keys"],
    ["q", "quit (your place is saved)"],
  ],
  // Listed under the arrows where the course has more than one level, with
  // f, which changes a later level's work folder on its map page (ticket 86).
  levelKey: ["← →  f", `the map: another level; f: ${TERMS.workFolder}`],
  folderChange: "f to change",
  // Listed only where the ? overlay has a row to spare.
  cardKey: ["c", "your card: commands from finished steps"],
  calm: "Prefer a still screen? Quit, then start with npm run learn -- --calm.",

  small: "Make this window a bit bigger (at least 60 by 20).",
  savedAt: (label, n, m) =>
    `Saved: ${label}, step ${n} of ${m}. Run npm run learn to pick up where you left off.`,
  // Where the lesson's work folder is another: progress stays in the copy.
  savedAtCopy: (label, n, m, root) =>
    `Saved: ${label}, step ${n} of ${m}. Run npm run learn in your ${TERMS.practiceCopy}, ${root}, to pick up where you left off.`,
  // Beginner lesson 1 no longer makes .practice/; lesson 2 does, so name the
  // command rather than a step.
  savedLater: `Your place is saved once your ${TERMS.practiceCopy} has a .practice/ folder: run mkdir .practice there.`,
  plainIntro:
    "npm run learn shows one step at a time in a terminal. Run it in a terminal window to use it.",
  usage:
    "Usage: npm run learn -- [--calm] [--plain] [--dir <folder>]. --calm keeps the screen still; --plain draws plain symbols with no color; --dir sets the work folder of the level the app opens on.",
  noFolder: (path) => `No folder at ${path}.`,
  dirBeginner: `This app checks Beginner in this ${TERMS.practiceCopy}, so --dir has no level to set yet. From Intermediate on, use it, or press f on the map.`,
  plainIn: (dir) => ` (checked in ${dir})`,
  // A lesson done in the app whose check fails now (106): a later lesson
  // may change what it checks on purpose, as a-6 moves a component.
  plainChanged:
    "Its check fails now: a later lesson may have changed what it checks.",

  k: {
    itsOpen: "it's open",
    quit: "quit",
    choose: "choose",
    start: "start",
    map: "map",
    more: "more",
    checkNow: "check now",
    checkAgain: "check again",
    moreHelp: "more help",
    help: "help",
    hint: "hint",
    anotherHint: "another hint",
    why: "why",
    back: "back",
    next: "next",
    nextTo: (title) => `next: ${title}`,
    answer: "answer",
    showAnswer: "show answer",
    letsGo: "let's go",
    bringIt: "bring it on",
    whatsNext: "what's next",
    startN: (label) => `start ${label}`,
    open: "open",
    useIt: "use it",
    cancel: "cancel",
    folder: "folder",
    giveFolder: "give its folder",
    continue: "continue",
    startOver: "start over",
    yesStartOver: "yes, start over",
    keep: "no, keep it",
    close: "close",
    scroll: "scroll",
    level: "level",
    card: "card",
    yes: "show it",
    no: "not yet",
    page: "page",
    clear: "clear",
    copy: "copy",
    earlier: "earlier step",
    earlierShort: "earlier",
    skip: "skip",
  },
};
