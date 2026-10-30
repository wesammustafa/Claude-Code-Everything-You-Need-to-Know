// The engine's own words: the verification lines it writes about a file or
// git status (ticket 210 left only these; the screens' words are the
// client's). They state no Claude Code fact: every fact on screen is a quote
// from the lesson's step file. Tests keep commands, versions, model names
// and any claim the app can't back out of this file. A celebration praises
// the work, not how it was done: a string a celebration shows goes on
// CELEBRATIONS in quest/engine/test/content.test.mjs.

// One name for each thing the app's words talk about. No engine string reads
// it since ticket 210: it is the names the copy test holds the engine's words
// and the step files' unquoted lines to, and the client's words follow. The
// copy test rejects an older name, or a second way to describe the tiers.
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
};
