// --dir <path> (ticket 252): a start-up shortcut for the Work folder of the
// Level the app opens on, checked by the same rules as folder.choose's path
// (checkFolder). A path it refuses is left out: the app starts without it and
// says why.
import { resolve } from "node:path";
import type { FolderRefusal } from "@quest/contract";
import { initialState, levelKey, type CourseEntry } from "@quest/engine";
import type { FolderLook, StoreLoad } from "@quest/host";
import { checkFolder, homeOf, type Checked } from "./folders.ts";
import type { Env } from "./launch.ts";

// Why the path was left out, in the terminal. These mirror the words the
// client shows for the same refusals (quest/client/src/screens/folderWords.ts).
const refusalLine: Record<FolderRefusal, string> = {
  missing: "there is no folder there",
  "too-long": "that path is longer than 1,024 characters",
  "outside-home": "that folder is outside your home folder",
  "is-copy": "that is this practice copy, which is the Work folder already",
  "contains-copy": "that folder holds this practice copy",
  "not-repo-root": "that folder is not the top folder of a git repository",
};

export const BEGINNER_LINE =
  "--dir sets the Intermediate or Advanced work folder, and the app opens on a Beginner lesson: starting without it.";

export interface DirOptions {
  dir: string;
  /** Where a relative path is from: the folder npm run learn ran in. */
  cwd: string;
  env: Env;
  /** The Practice copy. */
  root: string;
  course: readonly CourseEntry[];
  saved: StoreLoad;
  look: (path: string) => Promise<FolderLook>;
  check?: (path: string) => Promise<Checked>;
}

export type DirResult = { ahead: FolderLook } | { refused: string };

export async function dirAhead({
  dir,
  cwd,
  env,
  root,
  course,
  saved,
  look,
  check = (path) => checkFolder(path, { home: homeOf(env), root }),
}: DirOptions): Promise<DirResult> {
  const path = resolve(cwd, dir);
  // The lesson the app opens on decides whose folder --dir is: Beginner
  // has none, so nothing is looked at.
  const opening = initialState({
    course: course as CourseEntry[],
    saved: saved && "unreadable" in saved ? null : saved,
    facts: { root },
  });
  if (!levelKey(opening)) return { refused: BEGINNER_LINE };
  const checked = await check(path);
  if ("refused" in checked)
    return {
      refused: `--dir ${path}: ${refusalLine[checked.refused]}: starting without it.`,
    };
  return { ahead: await look(checked.path) };
}
