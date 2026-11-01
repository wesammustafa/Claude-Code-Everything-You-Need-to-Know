// Read-only git: status, where HEAD is, whether a folder is a repository,
// and a name to greet. Every git child is tracked in a host's registry
// (children.ts), so closing the host stops it.
import { execFile } from "node:child_process";
import { statusEntries } from "../../../practice-template/checks/paths.mjs";
import { childEnv } from "./check-child.ts";
import { shared, type Children } from "./children.ts";
import { isStaged, listing } from "./engine.ts";
import type { GitStatus } from "./types.ts";

type StatusResult = GitStatus | { error: string };

// How long one git command may take.
export const GIT_LIMIT = 30_000;
export const NOT_A_REPO = "this folder is not a git repository";

const gitOptions = (dir: string) => ({
  cwd: dir,
  env: childEnv(),
  windowsHide: true,
  timeout: GIT_LIMIT,
});

// The whole tree's listing as git status shows it, each path by its
// current name, kept to what is under `prefix` and named from there.
function whole(entries: ReturnType<typeof statusEntries>, prefix: string) {
  const here = entries.filter((e) => e.path.startsWith(prefix));
  const from = (e: (typeof here)[number]) => e.path.slice(prefix.length);
  return { paths: here.map(from), staged: here.filter(isStaged).map(from) };
}

// What git status lists in `dir`, and which of those paths are staged. With
// `files`, a look at part of the tree: each untracked file on its own line,
// where git status lists a new folder whole. Either way only what is in
// `dir`, named from there, where `dir` is a folder inside a repository, as
// the copy's project/ is (ticket 277). With
// `head`, also the commit HEAD is at (ticket 105), null before the first.
export function gitStatus(
  dir: string,
  {
    files = false,
    head = false,
    children = shared,
  }: {
    files?: boolean | undefined;
    head?: boolean | undefined;
    children?: Children;
  } = {},
): Promise<StatusResult> {
  const opts = gitOptions(dir);
  const { track } = children;
  if (head) {
    return new Promise<StatusResult>((resolve) => {
      track(
        execFile(
          "git",
          ["rev-parse", "--verify", "-q", "HEAD"],
          opts,
          (error, stdout) => {
            const at = error ? null : stdout.trim() || null;
            void gitStatus(dir, { files, children }).then((r) => {
              resolve(
                (r as { error?: string }).error
                  ? r
                  : { ...(r as GitStatus), head: at },
              );
            });
          },
        ),
      );
    });
  }
  return new Promise<StatusResult>((resolve) => {
    const failed = (error: Error) => {
      resolve({ error: error.message.split("\n")[0] ?? "" });
    };
    track(
      execFile("git", ["rev-parse", "--show-prefix"], opts, (error, prefix) => {
        if (error) {
          failed(error);
          return;
        }
        const here = prefix.trim();
        const done = (again: Error | null, stdout: string) => {
          if (again) failed(again);
          else if (files) resolve(listing(statusEntries(stdout), here));
          else resolve(whole(statusEntries(stdout), here));
        };
        track(
          files
            ? execFile(
                "git",
                ["status", "--porcelain", "--untracked-files=all", "--", "."],
                opts,
                done,
              )
            : execFile("git", ["status", "--porcelain"], opts, done),
        );
      }),
    );
  });
}

// Whether `dir` is in a git working tree: null where it is, else why not.
export function gitReady(
  dir: string,
  { children = shared }: { children?: Children } = {},
): Promise<string | null> {
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
export function gitFirstName(
  dir: string,
  { children = shared }: { children?: Children } = {},
): Promise<string> {
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
