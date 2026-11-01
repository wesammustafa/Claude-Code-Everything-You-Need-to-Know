// Row 120 (ticket 254): fromPage finds a warm-up's relative links in one
// pass, as the regex it replaced did, with no backtracking on a long run of
// "[" (CodeQL js/polynomial-redos, PR #166).
import { expect, test } from "vitest";
import { fromPage } from "../src/project.ts";

const REGEX = /\[([^\]]+)\]\(([^)\s]+)\)/g;

test("resolves only relative links, as before", () => {
  expect(
    fromPage(
      "guide/beginner",
      "see [x](../a.md) and [y](https://e.com) and [z](#h)",
    ),
  ).toBe("see [x](guide/a.md) and [y](https://e.com) and [z](#h)");
});

test("leaves malformed links as they are", () => {
  for (const text of ["[a] (b)", "[](x)", "[a](b c)", "[a](", "[a", "]("])
    expect(fromPage("f", text)).toBe(text);
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
    expect(fromPage("f/", text)).toBe(
      text.replace(REGEX, (_, label, href) => `[${label}](f/${href})`),
    );
});

test("stays linear on a long run of '['", () => {
  for (const text of [
    "[\\".repeat(200_000),
    "[](".repeat(200_000),
    `${"[".repeat(200_000)}]`,
    `${"[a".repeat(100_000)}](${"b".repeat(100_000)}`,
  ]) {
    const start = performance.now();
    expect(fromPage("f", text)).toBe(text);
    expect(performance.now() - start).toBeLessThan(100);
  }
});
