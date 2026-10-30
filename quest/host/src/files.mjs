// A file in a work folder, read as it is now: local and quick, with no
// process. The engine decides what the bytes mean.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { globName, isGlob, stampFor } from "./engine.mjs";

// The file a path names: itself, or for a glob the newest file that matches
// it (the last one written, so the one Claude just made), null when none
// does. Named as the beat names it, from the work folder.
export function matchOf(dir, path) {
  if (!isGlob(path)) return path;
  const folder = posix.dirname(path);
  const name = globName(posix.basename(path));
  let best = null;
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
  return best && posix.join(folder, best.name);
}

// A file's bytes as they are now, for the reducer to read what it holds
// (holds.mjs); null when it isn't there or can't be read just now.
export function bytesOf(dir, path) {
  try {
    return readFileSync(join(dir, matchOf(dir, path) ?? path));
  } catch {
    return null;
  }
}

// What a file is now, to tell whether it changed: its time, size and
// content. An empty string when it doesn't exist, and null when it can't be
// read just now (another program holds it, or its permissions changed).
export function stampOf(dir, path) {
  try {
    const found = matchOf(dir, path);
    if (found === null) return "";
    const file = join(dir, found);
    return stampFor(statSync(file).mtimeMs, readFileSync(file));
  } catch (error) {
    return error.code === "ENOENT" || error.code === "ENOTDIR" ? "" : null;
  }
}
