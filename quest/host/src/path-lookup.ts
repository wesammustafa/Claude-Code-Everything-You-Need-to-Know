// Whether a command is on the PATH (ticket 89): a file of its name in one
// of the PATH folders that may run, or on Windows one with an extension
// PATHEXT lists. Found by reading the folders: no process starts, so
// nothing the learner installed runs.
import { accessSync, constants, statSync } from "node:fs";
import { join } from "node:path";

export function onPath(
  name: string,
  env: Record<string, string | undefined> = process.env,
  platform: string = process.platform,
): boolean {
  const win = platform === "win32";
  // Windows names it Path as often as PATH.
  const get = (key: string) =>
    env[Object.keys(env).find((k) => k.toUpperCase() === key) ?? key];
  const dirs = (get("PATH") ?? "")
    .split(win ? ";" : ":")
    .map((d) => d.replace(/^"(.*)"$/, "$1"))
    .filter(Boolean);
  const exts = win
    ? (get("PATHEXT") ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)
    : [""];
  return dirs.some((dir) =>
    exts.some((ext) => {
      try {
        const file = join(dir, name + ext);
        if (!statSync(file).isFile()) return false;
        if (!win) accessSync(file, constants.X_OK);
        return true;
      } catch {
        return false;
      }
    }),
  );
}
