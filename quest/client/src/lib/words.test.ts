import { describe, expect, test } from "vitest";
import { sentence, skillLabel } from "./words";

describe("sentence", () => {
  test("capitalizes a lowercase first letter, plain or in bold", () => {
    expect(sentence("once you trust it, the dialog lists them")).toBe(
      "Once you trust it, the dialog lists them",
    );
    expect(sentence("**the account** matters")).toBe("**The account** matters");
  });
  test("leaves code spans, links, capitals and empty text alone", () => {
    expect(sentence("`claude --version` prints a version")).toBe(
      "`claude --version` prints a version",
    );
    expect(sentence("[git diff](https://git-scm.com/docs/git-diff)")).toBe(
      "[git diff](https://git-scm.com/docs/git-diff)",
    );
    expect(sentence("Already a sentence")).toBe("Already a sentence");
    expect(sentence("")).toBe("");
  });
});

describe("skillLabel", () => {
  test("reads a kebab-case id as words, with initialisms spelled out", () => {
    expect(skillLabel("review-diff")).toBe("Review diff");
    expect(skillLabel("gh-secret")).toBe("GitHub secret");
    expect(skillLabel("mcp-scope")).toBe("MCP scope");
    expect(skillLabel("ci-workflow")).toBe("CI workflow");
    expect(skillLabel("ask")).toBe("Ask");
  });
});
