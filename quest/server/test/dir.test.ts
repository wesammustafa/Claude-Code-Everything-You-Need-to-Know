import { fileURLToPath } from "node:url";
import type { FolderRefusal } from "@quest/contract";
import { loadCourse } from "@quest/engine/course";
import type { FolderLook } from "@quest/host";
import { describe, expect, test } from "vitest";
import { BEGINNER_LINE, dirAhead, type DirOptions } from "../src/dir.ts";

const TEMPLATE = fileURLToPath(
  new URL("../../../practice-template", import.meta.url),
);
const course = loadCourse(TEMPLATE);
// Every Beginner lesson finished: the app opens on i-1.
const PAST_BEGINNER = {
  format: 1,
  welcomed: true,
  lessons: Object.fromEntries(
    course
      .filter((l) => l.level === "beginner" && l.content)
      .map((l) => [
        l.id,
        { complete: true, done: l.content?.steps.map((x) => x.id) ?? [] },
      ]),
  ),
};
const MINE = "/home/ali/mine";
const found = (path: string): FolderLook => ({
  path,
  missing: false,
  git: true,
  gitBroken: null,
  practice: true,
});

function given(over: Partial<DirOptions> = {}) {
  const checked: string[] = [];
  const looked: string[] = [];
  const options: DirOptions = {
    dir: MINE,
    cwd: "/home/ali",
    env: { HOME: "/home/ali" },
    root: "/home/ali/copy",
    course,
    saved: PAST_BEGINNER,
    look: (path) => {
      looked.push(path);
      return Promise.resolve(found(path));
    },
    check: (path) => {
      checked.push(path);
      return Promise.resolve({ path });
    },
    ...over,
  };
  return { options, checked, looked };
}

describe("dirAhead", () => {
  test("a folder the checks pass is looked at and handed to the host", async () => {
    const { options, looked } = given();
    expect(await dirAhead(options)).toEqual({ ahead: found(MINE) });
    expect(looked).toEqual([MINE]);
  });

  test("a relative path is from the folder npm run learn ran in", async () => {
    const { options, checked } = given({ dir: "code/app", cwd: "/home/ali" });
    await dirAhead(options);
    expect(checked).toEqual(["/home/ali/code/app"]);
  });

  test("on a Beginner lesson it is refused before anything is looked at", async () => {
    for (const saved of [null, { unreadable: "moved" as const }]) {
      const { options, checked, looked } = given({ saved });
      expect(await dirAhead(options)).toEqual({ refused: BEGINNER_LINE });
      expect([checked, looked]).toEqual([[], []]);
    }
  });

  test("each refusal says why and starts without it", async () => {
    const lines: Record<FolderRefusal, string> = {
      missing: "there is no folder there",
      "too-long": "that path is longer than 1,024 characters",
      "outside-home": "that folder is outside your home folder",
      "is-copy": "that is this practice copy, which is the Work folder already",
      "contains-copy": "that folder holds this practice copy",
      "not-repo-root": "that folder is not the top folder of a git repository",
    };
    for (const [reason, line] of Object.entries(lines)) {
      const { options, looked } = given({
        check: () => Promise.resolve({ refused: reason as FolderRefusal }),
      });
      expect(await dirAhead(options)).toEqual({
        refused: `--dir ${MINE}: ${line}: starting without it.`,
      });
      expect(looked).toEqual([]);
    }
  });

  test("the real checks run by default: a folder outside home is refused", async () => {
    const options: DirOptions = { ...given({ dir: "/" }).options };
    delete options.check;
    expect(await dirAhead(options)).toEqual({
      refused: `--dir /: that folder is outside your home folder: starting without it.`,
    });
  });
});
