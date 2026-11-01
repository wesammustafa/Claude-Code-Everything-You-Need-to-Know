import ts from "typescript";
import { describe, expect, test } from "vitest";

// The browser's own words (spec Copy rules), linted where they are written:
// every string literal, template part and JSX text in the client's source.
// Reading the source reaches a string behind any branch, on any value the
// app passes (a via, a beat kind, a tier, a count), and the fixed words of a
// string with parameters. The Pip Playground is development-only tooling
// that never ships, as in tokens/literals.test.ts.
const sources = import.meta.glob<string>(
  ["./**/*.{ts,tsx}", "!./**/*.test.{ts,tsx}", "!./playground/**"],
  { query: "?raw", import: "default", eager: true },
);

const PROSE = /[A-Za-z][,:]? [A-Za-z]/;
const ONE_WORD = /^[A-Za-z']+[.!?…:]$/;

/** The words a source text can show: its prose literals, by file. */
function wordsOf(file: string, text: string): string[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const words = node.text.trim();
      if (words !== "") out.push(words);
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      // A route, an id, an SVG path or a class token is no sentence: prose
      // has two words, or is one word with a sentence's mark.
      if (PROSE.test(node.text) || ONE_WORD.test(node.text))
        out.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

const WORDS = Object.entries(sources).flatMap(([file, text]) =>
  wordsOf(file, text).map((words) => ({ file, words })),
);

// The code spans the app's own words may hold: the app's own files and
// commands, none of them a Claude Code fact.
const OWN_SPANS = new Set([
  ".practice",
  ".practice/",
  ".practice/learn.json",
  "learn.json.unreadable",
  ".gitignore",
  "git init",
  "mkdir .practice",
  "npm run learn",
]);

/** What a string states that the app's words never may (copy.ts's rule). */
function facts(words: string): string[] {
  const out: string[] = [];
  for (const [, span = ""] of words.matchAll(/`([^`]*)`/g))
    if (!OWN_SPANS.has(span)) out.push(`holds the code span \`${span}\``);
  if (/(^|\s)\/[a-z]/.test(words)) out.push("names a slash command");
  if (/\d+\.\d+\.\d+/.test(words)) out.push("names a version");
  if (/\b(Opus|Sonnet|Haiku|Fable)\b|claude-[a-z]+-\d/.test(words))
    out.push("names a model");
  return out;
}

// No claim that the app adapts to or knows the Learner, no praise of the
// person, no work the app doesn't do (content.test.mjs's BANNED).
const BANNED: readonly RegExp[] = [
  /\bmaster/i,
  /\bZPD\b/,
  /\badapt/i,
  /\b(genius|natural|smart|clever)\b/i,
  /\byou(?:'re| are) (?:a |so )/i,
  /personali[sz]/i,
  /tailor/i,
  /learns? (about )?you/i,
  /\bThinking\b/i,
  /\bAnaly[sz]ing\b/i,
  /Preparing your lesson/i,
  /Loading your progress/i,
];

// One name for each thing (CONTEXT's terms, copy.ts's TERMS): practice copy,
// work folder, your repository, new copy. These are their older names.
const ALIASES: readonly RegExp[] = [
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

const matching = (patterns: readonly RegExp[], words: string) =>
  patterns.filter((re) => re.test(words)).map((re) => String(re));

/** Each banned or alias phrase a source text's words hold. */
const caught = (patterns: readonly RegExp[], text: string, file = "x.tsx") =>
  wordsOf(file, text).flatMap((words) => matching(patterns, words));

describe("the app's own words (spec Copy rules)", () => {
  test("no copy string holds a code span or slash command, or names a version or a model", () => {
    expect(WORDS.length).toBeGreaterThan(100);
    expect(
      WORDS.flatMap(({ file, words }) =>
        facts(words).map((fact) => `${file}: "${words}" ${fact}`),
      ),
    ).toEqual([]);
    for (const bad of [
      "Run `claude --resume` to go on.",
      "Type /init in the session.",
      "New in 2.1.292.",
      "Ask Opus for help.",
      "Uses claude-opus-5.",
    ])
      expect(facts(bad), bad).toHaveLength(1);
  });

  test("the app's own words claim only what the app saw", () => {
    expect(
      WORDS.flatMap(({ file, words }) =>
        matching(BANNED, words).map(
          (re) => `${file}: "${words}" matches ${re}`,
        ),
      ),
    ).toEqual([]);
  });

  test("the claim check catches each banned phrase, in a plain string or a function's returned array", () => {
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
      "Analysing…",
      "Preparing your lesson…",
      "Loading your progress…",
    ]) {
      const quoted = JSON.stringify(bad);
      expect(caught(BANNED, `const x = ${quoted};`), bad).toHaveLength(1);
      expect(
        caught(BANNED, `const x = () => [${quoted}];`),
        `${bad}, in a function's array`,
      ).toHaveLength(1);
      expect(
        caught(BANNED, `const X = () => <p>${bad}</p>;`),
        `${bad}, as JSX text`,
      ).toHaveLength(1);
    }
  });

  test("the claim check reaches a string behind a branch on any value the app passes, and a count's words", () => {
    for (const branch of [
      'via === "pick"',
      'via === "r"',
      'kind === "check"',
      'kind === "git-clean"',
      'tier === "hinted"',
      'tier === "challenge"',
      "n === 0",
      "n > 2",
    ]) {
      expect(
        caught(
          BANNED,
          `const x = (v) => (${branch} ? "You mastered it." : "Fine.");`,
        ),
        branch,
      ).toHaveLength(1);
      expect(
        caught(
          BANNED,
          `function x(v) { if (${branch}) return "Fine."; return "You mastered it."; }`,
        ),
        `${branch}, the other arm`,
      ).toHaveLength(1);
    }
    // The two-count words: both counts' fixed words are read.
    expect(
      caught(
        BANNED,
        "const nextCounts = (a, b) => `${a} done, ${b} tailored for you.`;",
      ),
    ).toHaveLength(1);
    expect(
      caught(
        BANNED,
        "const nextCounts = (a, b) => `You mastered ${a} of ${b}.`;",
      ),
    ).toHaveLength(1);
  });

  test("one name for each thing: the app's words use no alias of a CONTEXT term", () => {
    expect(
      WORDS.flatMap(({ file, words }) =>
        matching(ALIASES, words).map(
          (re) => `${file}: "${words}" matches ${re}`,
        ),
      ),
    ).toEqual([]);
    const all = WORDS.map(({ words }) => words).join("\n");
    for (const term of ["practice copy", "work folder", "your repository"])
      expect(all, term).toMatch(new RegExp(term, "i"));
  });

  test("the alias check catches each older name", () => {
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
      expect(
        caught(ALIASES, `const x = ${JSON.stringify(bad)};`),
        bad,
      ).toHaveLength(1);
      expect(
        caught(ALIASES, `const X = () => <p>${bad}</p>;`),
        bad,
      ).toHaveLength(1);
    }
  });
});
