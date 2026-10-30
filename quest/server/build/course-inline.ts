// TEMPORARY: tickets 214 and 215 delete this file, once the engine reads its
// course without reading files at module load.
//
// The engine's course.mjs reads course/manifest.json and dist/course.json
// beside its own source at load, and parses step files unless the copy is
// the repo's practice-template. In the bundle the manifest is inlined, the
// compiled course is read beside app.mjs, and the compiled course is always
// used: the template ships no step files. Each rewrite must match exactly
// once, so a change to course.mjs fails the build here, not at a Learner's
// start.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

const COURSE = /[\\/]quest[\\/]engine[\\/]src[\\/]course\.(?:mjs|ts)$/;

export const REWRITES: readonly {
  name: string;
  from: string;
  to: (repoRoot: string) => string;
}[] = [
  {
    name: "the manifest",
    from: `readFileSync(
    new URL("../../../course/manifest.json", import.meta.url),
    "utf8",
  )`,
    to: (repoRoot) =>
      JSON.stringify(
        readFileSync(join(repoRoot, "course/manifest.json"), "utf8"),
      ),
  },
  {
    name: "the compiled course",
    from: `new URL("../dist/course.json", import.meta.url)`,
    to: () => `new URL("./course.json", import.meta.url)`,
  },
  {
    name: "the template check",
    from: `resolve(new URL("../../../practice-template", import.meta.url).pathname)`,
    to: () => `resolve(root)`,
  },
];

/** course.mjs with each rewrite applied once, or an error naming the one that did not match once. */
export function inlineCourse(code: string, repoRoot: string): string {
  let out = code;
  for (const rewrite of REWRITES) {
    const count = out.split(rewrite.from).length - 1;
    if (count !== 1)
      throw new Error(
        `quest/server/build/course-inline.ts: ${rewrite.name} matched ${String(count)} times in quest/engine/src/course.mjs, not once. If ticket 214 changed how the course is read, delete this temporary rewrite.`,
      );
    out = out.replace(rewrite.from, rewrite.to(repoRoot));
  }
  return out;
}

export function courseInline({ repoRoot }: { repoRoot: string }): Plugin {
  return {
    name: "quest:course-inline",
    apply: "build",
    transform: {
      filter: { id: COURSE },
      handler(code) {
        return { code: inlineCourse(code, repoRoot), map: null };
      },
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "course.json",
        source: readFileSync(join(repoRoot, "quest/engine/dist/course.json")),
      });
    },
  };
}
