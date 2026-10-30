// A practice copy for the host's real-adapter tests (not a test file),
// ported from learn-io's reducerRepo and reducerCheck: HEAD's template as
// "Use this template" makes it, with the stable Beginner fixture lessons in
// place of the live ones, and b-1's check answered from its version file.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { b1Item, REDUCER_COURSE, root } from "../../engine/test/drive.mjs";
import {
  exportHead,
  write,
} from "../../../practice-template/checks/test/helpers.mjs";
import { runCheck } from "../src/check-child.mjs";

const FIXTURES = REDUCER_COURSE;

export function reducerRepo() {
  const dir = exportHead(root);
  for (const id of ["b-1", "b-2", "b-3", "b-4", "b-5", "b-capstone"]) {
    write(dir, {
      [`learn/lessons/${id}.md`]: readFileSync(
        join(FIXTURES, `${id}.md`),
        "utf8",
      ).replaceAll(
        "- verify: check 0",
        id === "b-1" ? "- verify: check 1" : "- verify: check 0",
      ),
    });
  }
  return dir;
}

// The check child, but b-1's: a synthetic prerequisite, and its version
// item judged on the copy's .practice/version.txt, so no `claude` is needed.
export async function reducerCheck(dir, id, items, opts) {
  if (id !== "b-1") return runCheck(dir, id, items, opts);
  const path = join(dir, ".practice/version.txt");
  const item = b1Item(existsSync(path) ? readFileSync(path, "utf8") : null);
  return {
    items: [
      { index: 0, text: "synthetic prerequisite", pass: true, hint: "" },
      { ...item, index: 1 },
    ],
  };
}
