// Read-only git: status, where HEAD is, whether a folder is a repository,
// and a name to greet. Every git child is tracked in a host's registry
// (children.mjs), so closing the host stops it.
import { execFile } from "node:child_process";
import { statusEntries } from "../../../practice-template/checks/paths.mjs";
import { childEnv } from "./check-child.mjs";
import { shared } from "./children.mjs";
import { isStaged, listing } from "./engine.mjs";

// How long one git command may take.
export const GIT_LIMIT = 30_000;
export const NOT_A_REPO = "this folder is not a git repository";

const gitOptions = (dir) => ({
  cwd: dir,
  env: childEnv(),
  windowsHide: true,
  timeout: GIT_LIMIT,
});

// What git status lists in `dir`, and which of those paths are staged. With
// `files`, a look at part of the tree: each untracked file on its own line,
// where git status lists a new folder whole, and only what is in `dir`,
// named from there, where `dir` is a folder inside a repository. With
// `head`, also the commit HEAD is at (ticket 105), null before the first.
export function gitStatus(
  dir,
  { files = false, head = false, children = shared } = {},
) {
  const opts = gitOptions(dir);
  const { track } = children;
  if (head) {
    return new Promise((resolve) => {
      track(
        execFile(
          "git",
          ["rev-parse", "--verify", "-q", "HEAD"],
          opts,
          (error, stdout) => {
            const at = error ? null : stdout.trim() || null;
            gitStatus(dir, { files, children }).then((r) =>
              resolve(r.error ? r : { ...r, head: at }),
            );
          },
        ),
      );
    });
  }
  return new Promise((resolve) => {
    const failed = (error) => resolve({ error: error.message.split("\n")[0] });
    if (!files) {
      track(
        execFile("git", ["status", "--porcelain"], opts, (error, stdout) => {
          if (error) return failed(error);
          const entries = statusEntries(stdout);
          resolve({
            paths: entries.map((e) => e.path),
            staged: entries.filter(isStaged).map((e) => e.path),
          });
        }),
      );
      return;
    }
    track(
      execFile("git", ["rev-parse", "--show-prefix"], opts, (error, prefix) => {
        if (error) return failed(error);
        track(
          execFile(
            "git",
            ["status", "--porcelain", "--untracked-files=all", "--", "."],
            opts,
            (again, stdout) => {
              if (again) failed(again);
              else resolve(listing(statusEntries(stdout), prefix.trim()));
            },
          ),
        );
      }),
    );
  });
}

// Whether `dir` is in a git working tree: null where it is, else why not.
export function gitReady(dir, { children = shared } = {}) {
  return new Promise((resolve) => {
    children.track(
      execFile(
        "git",
        ["rev-parse", "--is-inside-work-tree"],
        gitOptions(dir),
        (error) => {
          resolve(
            error
              ? error.code === "ENOENT"
                ? "git is not installed"
                : error.killed
                  ? "git did not answer in time"
                  : NOT_A_REPO
              : null,
          );
        },
      ),
    );
  });
}

// The first word of git's user.name, to say hello. Read, never stored.
export function gitFirstName(dir, { children = shared } = {}) {
  return new Promise((resolve) => {
    children.track(
      execFile(
        "git",
        ["config", "user.name"],
        gitOptions(dir),
        (error, stdout) => {
          resolve(
            error ? "" : (stdout.trim().split(/\s+/)[0] ?? "").slice(0, 20),
          );
        },
      ),
    );
  });
}
