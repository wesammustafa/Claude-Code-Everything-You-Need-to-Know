// The app's words for the Work folder (ticket 252): why a path was turned
// down, what is wrong with a saved folder, and how a folder is named. The
// server words the same refusals for --dir (quest/server/src/dir.ts).
import type {
  FolderQuestion,
  FolderRefusal,
  OverviewNote,
} from "@quest/contract";

/** Why a typed path was turned down: the server's reasons, and the client's own. */
export type FolderReason = FolderRefusal | "invalid" | "relative" | "tilde";

type Problem = Extract<OverviewNote, { kind: "folder-problem" }>["problem"];

const FULL_PATH =
  "Give the full path from the top: it starts with / (or with a drive, such as C:\\, on Windows).";

// `path` is `folder` or inside it. For words only: the server's checks
// decide what is refused.
function under(path: string, folder: string): boolean {
  const trimmed = path.trim().replace(/[\\/]+$/, "");
  folder = folder.replace(/[\\/]+$/, "");
  return (
    trimmed === folder ||
    trimmed.startsWith(`${folder}/`) ||
    trimmed.startsWith(`${folder}\\`)
  );
}

/** Whether a typed path is absolute, on POSIX or on Windows. */
export function isAbsolutePath(path: string): boolean {
  return /^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(path);
}

/** Why the client turns a typed path down before sending it, or null. */
export function clientRefusal(path: string): FolderReason | null {
  const typed = path.trim();
  if (typed.startsWith("~")) return "tilde";
  return isAbsolutePath(typed) ? null : "relative";
}

function copyText(asks: FolderQuestion["asks"]): string {
  return asks === "work"
    ? "That is this practice copy. To practise here, choose In this practice copy."
    : "That is this practice copy, and this lesson runs in a new copy of the template. Give the folder of that new copy.";
}

/** The words for a refused path. */
export function refusalText(
  reason: FolderReason,
  asks: FolderQuestion["asks"],
  typedPath: string,
  practiceCopy: string,
): string {
  switch (reason) {
    case "missing":
      return "There is no folder at that path. Check the spelling, or make the folder first.";
    case "too-long":
      return "That path is longer than 1,024 characters. Choose a folder with a shorter path.";
    case "outside-home":
      return "That folder is outside your home folder. Choose one inside it.";
    case "is-copy":
      return copyText(asks);
    case "contains-copy":
      return "That folder holds this practice copy. Choose the folder of your own repository.";
    case "not-repo-root":
      return under(typedPath, practiceCopy)
        ? copyText(asks)
        : "That folder is not the top folder of a git repository. Give the folder that git init or git clone made.";
    case "invalid":
    case "relative":
      return FULL_PATH;
    case "tilde":
      return "Write your home folder out in full instead of ~.";
  }
}

/** The overview's words for what is wrong with a saved Work folder. */
export function problemText(problem: Problem): string {
  switch (problem) {
    case "missing":
      return "The work folder is not there any more. Choose it again, or choose another.";
    case "gitBroken":
      return "Git could not look at the work folder, so its checks cannot run yet. Check that git works in your terminal.";
    case "notGit":
      return "The work folder is not a git repository. Run `git init` there, or choose another folder.";
    case "noPractice":
      return "Git does not ignore `.practice/` in the work folder. Add `.practice/` to its `.gitignore`, so your practice files stay out of your commits.";
  }
}

/** A Work folder's name on screen: this practice copy, or its path. */
export function workFolderLabel(path: string, practiceCopy: string): string {
  return under(path, practiceCopy) ? "this practice copy" : path;
}
