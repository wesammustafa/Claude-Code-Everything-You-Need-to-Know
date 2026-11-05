// Row 120 (tickets 254 and 326): mapLinks finds the links in a Lesson's
// words in one pass, as the regex it replaced did, with no backtracking on a
// long run of "[" (CodeQL js/polynomial-redos, PR #166), and skips a link
// inside a code span or bold, which the app shows as text.
import { expect, test } from "vitest";
import { mapLinks } from "../src/links.ts";

const REGEX = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const prefix = (text) => mapLinks(text, (href) => `f/${href}`);

test("hands each link's href and label over, once", () => {
  const seen = [];
  expect(
    mapLinks("see [x](../a.md) and [y](https://e.com)", (href, label) => {
      seen.push([href, label]);
      return href.toUpperCase();
    }),
  ).toBe("see [x](../A.MD) and [y](HTTPS://E.COM)");
  expect(seen).toEqual([
    ["../a.md", "x"],
    ["https://e.com", "y"],
  ]);
});

test("leaves a link inside a code span or bold as it is, as the app shows it", () => {
  for (const text of [
    "a link such as `[broken](bad%.md)` crashes",
    "**[a](b)**",
    "`x` then `[a](b)`",
  ])
    expect(prefix(text)).toBe(text);
  expect(prefix("[`tdd` skill](a.md) and `[b](c)` and [d](e)")).toBe(
    "[`tdd` skill](f/a.md) and `[b](c)` and [d](f/e)",
  );
  expect(prefix("`` [a](b) and ** [c](d)")).toBe("`` [a](f/b) and ** [c](f/d)");
});

test("leaves malformed links as they are", () => {
  for (const text of ["[a] (b)", "[](x)", "[a](b c)", "[a](", "[a", "]("])
    expect(prefix(text)).toBe(text);
});

test("finds the same links the regex finds", () => {
  const texts = [
    "[a [b](c)",
    "[[a](b)",
    "[a](b)[c](d) [e]](f) [g](h i)[j](k)",
    "x [a](b) [](c) [d]([e](f)) ](g) [h](i",
    "[a\n](b)",
  ];
  for (const text of texts)
    expect(prefix(text)).toBe(
      text.replace(REGEX, (_, label, href) => `[${label}](f/${href})`),
    );
});

test("stays linear on a long run of '[', '`' or '*'", () => {
  for (const text of [
    "[\\".repeat(200_000),
    "[](".repeat(200_000),
    `${"[".repeat(200_000)}]`,
    `${"[a".repeat(100_000)}](${"b".repeat(100_000)}`,
    "`".repeat(200_000),
    "**a*".repeat(100_000),
  ]) {
    const start = performance.now();
    expect(prefix(text)).toBe(text);
    expect(performance.now() - start).toBeLessThan(100);
  }
});
