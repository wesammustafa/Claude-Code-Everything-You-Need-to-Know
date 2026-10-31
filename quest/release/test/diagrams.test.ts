// The committed diagram cache: five diagrams, light and dark, each with the
// accTitle and accDescr as its title and description, and a lock that still
// matches the pages. QUEST_RENDER_DIAGRAMS=1 also redraws them in Chromium
// (run it under the e2e lock) and expects the cache's bytes.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  STALE,
  THEMES,
  cachedDiagram,
  classifyDocs,
  diagramSources,
  mermaidVersion,
  pageName,
  readLock,
} from "../src/pages.mjs";
import { diagramsDir, repoRoot } from "./pages-fixture";

const lock = readLock(diagramsDir);
const version = mermaidVersion(repoRoot);
const diagrams = classifyDocs(repoRoot).live.flatMap((path) =>
  diagramSources(readFileSync(join(repoRoot, path), "utf8")).map(
    (source, i) => ({ name: pageName(path), n: i + 1, source }),
  ),
);

describe("the diagram cache", () => {
  test("holds the five diagrams in both themes and nothing else", () => {
    expect(diagrams.map((d) => d.name)).toEqual([
      "advanced/02-orchestration-patterns",
      "intermediate/01-first-skill",
      "intermediate/05-hooks",
      "intermediate/06-subagents",
      "intermediate/07-mcp",
    ]);
    expect(
      readdirSync(diagramsDir).filter((f) => f.endsWith(".svg")),
    ).toHaveLength(10);
    expect(Object.keys(lock.diagrams)).toHaveLength(10);
    expect(lock.mermaid).toBe(version);
  });

  test.each(diagrams)(
    "$name is fresh and titled in both themes",
    ({ name, n, source }) => {
      const title = source.match(/accTitle:\s*(.+)/)?.[1]?.trim();
      const desc = source.match(/accDescr:\s*(.+)/)?.[1]?.trim();
      for (const theme of THEMES) {
        const svg = cachedDiagram(
          diagramsDir,
          lock,
          version,
          name,
          n,
          source,
          theme,
        ).toString();
        const id = svg.match(/^<svg id="([^"]+)"/)?.[1] ?? "";
        expect(svg).toContain(`aria-labelledby="chart-title-${id}"`);
        expect(svg).toContain(`aria-describedby="chart-desc-${id}"`);
        expect(svg).toContain(
          `<title id="chart-title-${id}">${title ?? ""}</title>`,
        );
        expect(svg).toContain(
          `<desc id="chart-desc-${id}">${desc ?? ""}</desc>`,
        );
      }
    },
  );

  test("a changed source is stale", () => {
    const [first] = diagrams;
    if (!first) throw new Error("no diagram");
    expect(() =>
      cachedDiagram(
        diagramsDir,
        lock,
        version,
        first.name,
        first.n,
        `${first.source}\n`,
        "light",
      ),
    ).toThrow(STALE);
  });

  test.runIf(process.env.QUEST_RENDER_DIAGRAMS === "1")(
    "redrawing gives the cache's bytes",
    () => {
      const run = spawnSync(
        process.execPath,
        [join(repoRoot, "quest/release/src/render-diagrams.mjs"), "--check"],
        { encoding: "utf8" },
      );
      expect(run.stderr).toBe("");
      expect(run.status).toBe(0);
    },
    120_000,
  );
});
