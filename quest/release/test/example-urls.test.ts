// The example-fetch rewrite and the release test on example paths: the real
// tree's paths are known exactly, so a shell idiom examplePaths() doesn't
// read fails here, and a planted fetch of a missing file is named.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  RAW_PREFIX,
  buildPages,
  classifyDocs,
  examplePaths,
  rewriteExampleUrls,
} from "../src/pages.mjs";
import {
  diagramsDir,
  plantedRepo,
  removeTemp,
  repoRoot,
  tempDir,
} from "./pages-fixture";

afterAll(removeTemp);

describe("rewriteExampleUrls", () => {
  test("moves the prefix at main to the ref and nothing else", () => {
    const blob =
      "https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/blob/main/x.md";
    const other =
      "https://raw.githubusercontent.com/anthropics/claude-code/main/x.json";
    expect(
      rewriteExampleUrls(
        `${RAW_PREFIX}main/examples/a.sh ${blob} ${other}`,
        "v2026.11",
      ),
    ).toBe(`${RAW_PREFIX}v2026.11/examples/a.sh ${blob} ${other}`);
  });
});

describe("examplePaths", () => {
  test("expands loops and a joined base", () => {
    expect(
      examplePaths(
        [
          `base=${RAW_PREFIX}main/examples/kit`,
          `curl "$base/a.json" -o a.json`,
          "for f in b c; do",
          `  curl "$base/$f.md" -o "$f.md"`,
          `  curl "${RAW_PREFIX}main/examples/x/\${f}.sh"`,
          "done",
        ].join("\n"),
      ),
    ).toEqual([
      "examples/kit/a.json",
      "examples/kit/b.md",
      "examples/kit/c.md",
      "examples/x/b.sh",
      "examples/x/c.sh",
    ]);
  });

  test("finds exactly the real tree's fetches", () => {
    const texts = classifyDocs(repoRoot).live.map((path) =>
      readFileSync(join(repoRoot, path), "utf8"),
    );
    expect([...new Set(texts.flatMap(examplePaths))].sort()).toEqual([
      "examples/advanced/06-share-your-setup/dot-claude-plugin/marketplace.json",
      "examples/advanced/06-share-your-setup/plugins/team-kit/.claude-plugin/plugin.json",
      "examples/advanced/06-share-your-setup/plugins/team-kit/agents/config-reviewer.md",
      "examples/advanced/06-share-your-setup/plugins/team-kit/skills/onboard/SKILL.md",
      "examples/advanced/electives/agent-teams/dot-claude/agents/security-reviewer.md",
      "examples/advanced/electives/agent-teams/dot-claude/agents/test-reviewer.md",
      "examples/intermediate/01-first-skill/dot-claude/skills/five-whys/SKILL.md",
      "examples/intermediate/01-first-skill/dot-claude/skills/tdd/SKILL.md",
      "examples/intermediate/05-hooks/dot-claude/hooks/format-after-edit.sh",
      "examples/intermediate/05-hooks/dot-claude/hooks/protect-files.sh",
      "examples/intermediate/06-subagents/dot-claude/agents/code-reviewer.md",
    ]);
  });
});

describe("the release test on example paths", () => {
  test("names a fetch of a file missing from the tagged tree", () => {
    const root = plantedRepo("planted-missing-example");
    const { problems } = buildPages({
      root,
      ref: "v0000.00",
      outDir: tempDir("quest-pages-out-"),
      diagramsDir,
    });
    expect(problems).toEqual([
      "docs/beginner/01-start.md: fetches examples/missing.sh, which is not in the tree at the release ref",
    ]);
  });
});
