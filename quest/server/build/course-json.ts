// The compiled course, quest/engine/dist/course.json from npm run
// course:compile, emitted beside app.mjs: main.ts reads it there.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

export function courseJson({ repoRoot }: { repoRoot: string }): Plugin {
  return {
    name: "quest:course-json",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "course.json",
        source: readFileSync(join(repoRoot, "quest/engine/dist/course.json")),
      });
    },
  };
}
