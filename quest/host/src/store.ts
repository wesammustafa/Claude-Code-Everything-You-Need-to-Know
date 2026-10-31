// The learner's place, saved in `.practice/learn.json` of the practice copy:
// git ignores `.practice/`, and every check that reads git status leaves it
// out. It is the only file the app writes, and only once `.practice/` exists.
import {
  constants,
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join } from "node:path";
import type { EngineState } from "@quest/engine";
import { FOLDER_KEYS, HELP_USED, PATH_MAX, STEP_ID } from "./engine.ts";

// JSON as the file holds it, read field by field.
type Loose = Record<string, unknown>;

// What the store writes: format 1, with what sanitize keeps.
export interface Saved {
  format: number;
  welcomed: boolean;
  eased: string[];
  missed: string[];
  lessons: Record<string, Loose>;
  folders?: Record<string, string>;
}

const code = (error: unknown) => (error as NodeJS.ErrnoException).code;

export const FORMAT = 1;
export const storePath = (root: string) =>
  join(root, ".practice", "learn.json");

// The saved file, sanitized; null where there is none. A file the app
// can't read (not JSON, not an object, another format, or no file at all
// but a folder) is moved aside, never overwritten (ticket 213), and the
// load gives a marker with no lessons, so the app starts fresh and says so
// once: `{unreadable: "moved"}`, or `{unreadable: "kept"}` where the move
// failed and the file stays where it is.
export function loadState(
  root: string,
): Saved | null | { unreadable: "moved" | "kept" } {
  const file = storePath(root);
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    // No file, or a root `.practice` that is a file: no save yet.
    if (code(error) === "ENOENT" || code(error) === "ENOTDIR") return null;
    return { unreadable: moveAside(file) ? "moved" : "kept" };
  }
  if (
    typeof data !== "object" ||
    data === null ||
    Array.isArray(data) ||
    (data as Loose).format !== FORMAT
  )
    return { unreadable: moveAside(file) ? "moved" : "kept" };
  return sanitize(data);
}

// Moves the file to the first free name of `learn.json.unreadable`,
// `learn.json.unreadable-2` and on to `-99`, never over a file there: a
// hard link fails where the name is taken (EEXIST), and so does the copy
// made where links are not allowed. A `learn.json` that is a folder is
// renamed after a look. True where the file left its place.
function moveAside(file: string): boolean {
  let folder: boolean;
  try {
    folder = statSync(file).isDirectory();
  } catch {
    return false;
  }
  for (let n = 1; n <= 99; n++) {
    const target = `${file}.unreadable${n === 1 ? "" : `-${String(n)}`}`;
    try {
      if (folder) {
        if (existsSync(target)) continue;
        renameSync(file, target);
        return true;
      }
      try {
        linkSync(file, target);
      } catch (error) {
        if (!["EPERM", "ENOTSUP", "EXDEV"].includes(code(error) ?? ""))
          throw error;
        copyFileSync(file, target, constants.COPYFILE_EXCL);
      }
      rmSync(file);
      return true;
    } catch (error) {
      if (code(error) !== "EEXIST") return false;
    }
  }
  return false;
}

// A work folder as the app saved it: an absolute path on one line.
const folder = (x: unknown) =>
  typeof x === "string" &&
  x.length <= PATH_MAX &&
  isAbsolute(x) &&
  !/[\0\r\n]/.test(x)
    ? x
    : null;

const stepId = (x: unknown) =>
  typeof x === "string" && STEP_ID.test(x) ? x : null;

// The two fields ticket 213 added, still format 1, each only where it has
// something: the fingerprint the lesson was started under, and the help
// each finished step used, { stepId: { used, at } }.
const fingerprintOf = (x: unknown) =>
  typeof x === "string" && /^[0-9a-f]{64}$/.test(x) ? { fingerprint: x } : {};
function helpOf(x: unknown) {
  const help = Object.fromEntries(
    Object.entries(typeof x === "object" && x ? (x as Loose) : {})
      .filter((entry): entry is [string, { used: string; at: number }] => {
        const [k, v] = entry;
        return Boolean(
          stepId(k) &&
          typeof v === "object" &&
          v &&
          (HELP_USED as readonly unknown[]).includes((v as Loose).used) &&
          Number.isFinite((v as Loose).at) &&
          ((v as Loose).at as number) >= 0,
        );
      })
      .map(([k, v]) => [k, { used: v.used, at: v.at }]),
  );
  return Object.keys(help).length ? { help } : {};
}

// Keeps only what the app saves, so a hand-edited or newer file can't
// smuggle anything in.
export function sanitize(input: unknown): Saved {
  const data = input as Loose | null | undefined;
  const lessons: Record<string, Loose> = {};
  for (const [id, entry] of Object.entries((data?.lessons ?? {}) as Loose)) {
    if (
      !/^[a-z]-(\d+|capstone)$/.test(id) ||
      typeof entry !== "object" ||
      !entry
    )
      continue;
    const p = entry as Loose;
    lessons[id] = {
      step: typeof p.step === "string" ? p.step : null,
      beat: Number.isInteger(p.beat) && (p.beat as number) >= 0 ? p.beat : 0,
      done: Array.isArray(p.done)
        ? p.done.filter((x) => typeof x === "string")
        : [],
      answers: Object.fromEntries(
        Object.entries((p.answers ?? {}) as Loose)
          .filter(
            (e): e is [string, string] =>
              typeof e[0] === "string" && typeof e[1] === "string",
          )
          .map(([k, v]) => [k, v.slice(0, 200)]),
      ),
      levels: Array.isArray(p.levels)
        ? p.levels.filter((x: unknown) =>
            ["hinted", "challenge"].includes(x as string),
          )
        : [],
      lessHelp: p.lessHelp === true,
      // A file from before `moreHelpAt` saved `keepGuided`: it counts from the saved step.
      moreHelpAt:
        stepId(p.moreHelpAt) ?? (p.keepGuided === true ? stepId(p.step) : null),
      easedSteps: Object.fromEntries(
        Object.entries((p.easedSteps ?? {}) as Loose).filter(
          ([, v]) => v === true,
        ),
      ),
      complete: p.complete === true,
      warm: Array.isArray(p.warm)
        ? p.warm.filter((x) => typeof x === "string" && /^R\d+$/.test(x))
        : [],
      recalled: Array.isArray(p.recalled)
        ? p.recalled.filter((x) => typeof x === "string" && /^R\d+$/.test(x))
        : [],
      stamps: Object.fromEntries(
        Object.entries((p.stamps ?? {}) as Loose)
          .filter(
            (e): e is [string, string] =>
              typeof e[0] === "string" && typeof e[1] === "string",
          )
          .map(([k, v]) => [k, v.slice(0, 120)]),
      ),
      bottomAt: stepId(p.bottomAt),
      ...fingerprintOf(p.fingerprint),
      ...helpOf(p.help),
    };
  }
  // The work folders the learner chose (ticket 86): one per later level and
  // per lesson that runs in a new copy, and nothing else. A file with none
  // has no key, as before the work folder.
  const saved = data?.folders as Loose | null | undefined;
  const folders = Object.fromEntries(
    FOLDER_KEYS.filter((k) => folder(saved?.[k])).map((k) => [
      k,
      (saved as Loose)[k] as string,
    ]),
  );
  return {
    format: FORMAT,
    welcomed: data?.welcomed === true,
    eased: Array.isArray(data?.eased)
      ? data.eased.filter((x) => typeof x === "string")
      : [],
    missed: Array.isArray(data?.missed)
      ? data.missed.filter((x) => typeof x === "string")
      : [],
    lessons,
    ...(Object.keys(folders).length ? { folders } : {}),
  };
}

export const snapshot = (state: EngineState) =>
  sanitize({
    welcomed: state.welcomed,
    eased: state.eased,
    missed: state.missed,
    lessons: state.progress,
    folders: state.folders,
  });

// Makes root `.practice/` on the first start (ticket 277): the template
// ships no empty folder. A copy where it can't be made saves nothing.
export function preparePractice(root: string) {
  try {
    mkdirSync(join(root, ".practice"), { recursive: true });
  } catch {
    // Read-only or not ours: the snapshot's saving says so.
  }
}

// Writes atomically. Returns false, writing nothing, while `.practice/` is missing.
export function saveState(root: string, data: object): boolean {
  if (!existsSync(join(root, ".practice"))) return false;
  const file = storePath(root);
  const tmp = `${file}.${String(process.pid)}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 1)}\n`);
  try {
    renameSync(tmp, file);
  } catch (error) {
    // Windows: another program (an editor, antivirus) may hold the file a moment.
    if (!["EPERM", "EBUSY", "EACCES"].includes(code(error) ?? "")) throw error;
    try {
      renameSync(tmp, file);
    } catch (again) {
      rmSync(tmp, { force: true });
      throw again;
    }
  }
  return true;
}
