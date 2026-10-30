// What a folder the Learner names is, and where a typed path points.
import { execFile } from "node:child_process";
import { statSync } from "node:fs";
import { join, resolve } from "node:path";
import { childEnv } from "./check-child.ts";
import { shared, type Children } from "./children.ts";
import { GIT_LIMIT, gitReady, NOT_A_REPO } from "./git.ts";
import type { FolderLook } from "./types.ts";

// What a work folder is (ticket 86): whether it is a folder at all, whether
// git says it is a repository, and whether git ignores the `.practice/`
// folder the lessons save to. The folder itself may not exist yet: a new
// copy of the template ignores it before a step makes it (r27 a-5); a file
// of that name holds nothing. Read, never changed. `gitBroken` is why git
// could not say (not installed, no answer), null where it did.
export async function probeFolder(
  path: string,
  { children = shared }: { children?: Children } = {},
): Promise<FolderLook> {
  let folder = false;
  try {
    folder = statSync(path).isDirectory();
  } catch {
    // Not there, or not readable: no folder.
  }
  if (!folder)
    return {
      path,
      missing: true,
      git: false,
      gitBroken: null,
      practice: false,
    };
  const said = await gitReady(path, { children });
  const git = said === null;
  const gitBroken = said && said !== NOT_A_REPO ? said : null;
  let notFolder = false;
  try {
    notFolder = !statSync(join(path, ".practice")).isDirectory();
  } catch {
    // No `.practice` yet.
  }
  const practice =
    git &&
    !notFolder &&
    (await new Promise<boolean>((resolve) => {
      children.track(
        execFile(
          "git",
          ["check-ignore", "-q", ".practice/"],
          { cwd: path, env: childEnv(), windowsHide: true, timeout: GIT_LIMIT },
          (error) => {
            resolve(!error);
          },
        ),
      );
    }));
  return { path, missing: false, git, gitBroken, practice };
}

// A folder path as the learner typed or pasted it, in full: quotes around
// it and the shell's `\ ` for a space (a folder dragged onto the terminal)
// come off, `~` is the home folder, and a relative path is from the copy,
// as npm run check reads one.
export function folderPath(
  text: string,
  root: string,
  home: string,
  win32: boolean,
): string {
  let path = text.trim().replace(/^(['"])(.*)\1$/, "$2");
  if (!win32) path = path.replace(/\\ /g, " ");
  if (path === "~" || /^~[\\/]/.test(path)) path = join(home, path.slice(1));
  return resolve(root, path);
}
