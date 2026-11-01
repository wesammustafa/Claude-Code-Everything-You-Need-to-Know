// Shared by the assembly's and the replay's tests: stand-in inputs for
// assembleTemplate, so a tree can be assembled without a release build.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { accTitle, renderPage, treeContext } from "../src/pages.mjs";
import type { Manifest, PagesIndex } from "../src/template.mjs";
import { repoRoot, tempDir } from "./pages-fixture";

export const REF = "v0000.00";

/** The pages index entries of the Lessons, titled the way the page build titles them. */
export function lessonPages(ref: string): PagesIndex {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, "course/manifest.json"), "utf8"),
  ) as Manifest;
  const ctx = treeContext(repoRoot, ref);
  const noDiagram = (_n: number, source: string) => ({
    light: "x.light.svg",
    dark: "x.dark.svg",
    alt: accTitle(source),
  });
  return {
    ref,
    pages: manifest.lessons.map((l) => ({
      path: l.page,
      title: renderPage(
        l.page,
        readFileSync(join(repoRoot, l.page), "utf8"),
        ctx,
        noDiagram,
      ).title,
    })),
  };
}

/** A built learn/ folder stand-in: a node:-only app.mjs and the files assembly needs. */
export function fixtureLearn(): string {
  const dir = tempDir("quest-learn-");
  mkdirSync(join(dir, "app/pages"), { recursive: true });
  writeFileSync(join(dir, "app.mjs"), 'import "node:http";\n');
  writeFileSync(join(dir, "run-check.mjs"), 'import "../checks/run.mjs";\n');
  writeFileSync(join(dir, "course.json"), '{"from":"engine"}\n');
  writeFileSync(join(dir, "app/index.html"), "<!doctype html>");
  writeFileSync(join(dir, "app/pages/index.json"), "{}\n");
  return dir;
}

export function fixtureInputs(
  pagesIndex: PagesIndex,
  learnDir = fixtureLearn(),
) {
  const dir = tempDir("quest-release-");
  const pagesIndexFile = join(dir, "index.json");
  writeFileSync(pagesIndexFile, `${JSON.stringify(pagesIndex)}\n`);
  const releaseCourse = join(dir, "course.json");
  writeFileSync(releaseCourse, '{"from":"release"}\n');
  return { learnDir, pagesIndexFile, releaseCourse };
}

export const stubNotices = (_root: string, outFile: string) => {
  writeFileSync(outFile, "notices\n");
};
