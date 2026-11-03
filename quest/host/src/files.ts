// A file in a work folder, read as it is now: local and quick, with no
// process. The engine decides what the bytes mean.
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { join, posix, relative, sep } from "node:path";
import { globName, isGlob, stampFor } from "./engine.ts";

// The places a read looks: the work folder, then `alt`, the git root above
// it where Claude Code keeps some files (ticket 295), as a path from the
// work folder. No `alt` when there is none or it is the work folder itself.
function basesOf(dir: string, alt?: string | null): string[] {
  if (!alt) return [""];
  try {
    if (realpathSync(alt) === realpathSync(dir)) return [""];
  } catch {
    // Either is gone just now: look in both.
  }
  return ["", relative(dir, alt).split(sep).join("/")];
}

// A glob's newest match in one base, null when none does.
function newestIn(dir: string, base: string, path: string) {
  const folder = posix.join(base, posix.dirname(path));
  const name = globName(posix.basename(path));
  let best: { at: number; name: string } | null = null;
  try {
    for (const e of readdirSync(join(dir, folder), { withFileTypes: true })) {
      if (!e.isFile() || !name.test(e.name)) continue;
      const at = statSync(join(dir, folder, e.name)).mtimeMs;
      if (!best || at > best.at || (at === best.at && e.name < best.name))
        best = { at, name: e.name };
    }
  } catch {
    return null;
  }
  return best && { at: best.at, path: posix.join(folder, best.name) };
}

// The file a path names: itself, or for a glob the newest file that matches
// it (the last one written, so the one Claude just made), null when none
// does. Named as the beat names it, from the work folder. With `alt`, a
// path the work folder lacks is the one at `alt` when that has it (as
// `../.claude/...`), and a glob takes the newest match in either.
export function matchOf(
  dir: string,
  path: string,
  alt?: string | null,
): string | null {
  const bases = basesOf(dir, alt);
  if (!isGlob(path)) {
    for (const base of bases.slice(1))
      if (!existsSync(join(dir, path)) && existsSync(join(dir, base, path)))
        return posix.join(base, path);
    return path;
  }
  let best: { at: number; path: string } | null = null;
  for (const base of bases) {
    const m = newestIn(dir, base, path);
    if (m && (!best || m.at > best.at)) best = m;
  }
  return best && best.path;
}

// A file's bytes as they are now, for the reducer to read what it holds
// (holds.ts); null when it isn't there or can't be read just now.
export function bytesOf(dir: string, path: string): Buffer | null {
  try {
    return readFileSync(join(dir, matchOf(dir, path) ?? path));
  } catch {
    return null;
  }
}

// What a file is now, to tell whether it changed: its time, size and
// content. An empty string when it doesn't exist (in either place, with
// `alt`), and null when it can't be read just now (another program holds
// it, or its permissions changed).
export function stampOf(
  dir: string,
  path: string,
  alt?: string | null,
): string | null {
  try {
    const found = matchOf(dir, path, alt);
    if (found === null) return "";
    const file = join(dir, found);
    return stampFor(statSync(file).mtimeMs, readFileSync(file));
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    return code === "ENOENT" || code === "ENOTDIR" ? "" : null;
  }
}
