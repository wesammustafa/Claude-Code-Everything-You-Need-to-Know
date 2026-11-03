import { describe, expect, test } from "vitest";
import {
  clientRefusal,
  isAbsolutePath,
  problemText,
  refusalText,
  workFolderLabel,
} from "./folderWords";

const COPY = "/home/ali/copy";
const WIN_COPY = "C:\\Users\\ali\\copy";

describe("folderWords", () => {
  test("absolute paths, POSIX and Windows; a relative or ~ path is refused here", () => {
    for (const path of [
      "/home/ali/app",
      "C:\\Users\\ali\\app",
      "d:/app",
      "\\\\server\\share",
    ])
      expect([path, isAbsolutePath(path), clientRefusal(path)]).toEqual([
        path,
        true,
        null,
      ]);
    expect(clientRefusal("code/app")).toBe("relative");
    expect(clientRefusal(".")).toBe("relative");
    expect(clientRefusal("~/code/app")).toBe("tilde");
    expect(clientRefusal("  ~")).toBe("tilde");
  });

  test("every reason has calm words, and the invalid and relative ones match", () => {
    for (const reason of [
      "missing",
      "too-long",
      "outside-home",
      "is-copy",
      "contains-copy",
      "not-repo-root",
      "invalid",
      "relative",
      "tilde",
    ] as const) {
      const text = refusalText(reason, "work", "/home/ali/app", COPY);
      expect(text).toMatch(/\.$/);
      expect(text).not.toMatch(/error|invalid/i);
      expect(text).not.toContain(String.fromCharCode(0x2014));
    }
    expect(refusalText("invalid", "work", "x", COPY)).toBe(
      refusalText("relative", "work", "x", COPY),
    );
  });

  test("the copy's words differ for a level and a new copy", () => {
    expect(refusalText("is-copy", "work", COPY, COPY)).toContain(
      "In this practice copy",
    );
    expect(refusalText("is-copy", "new-copy", COPY, COPY)).toContain(
      "new copy of the template",
    );
  });

  test("a path inside the practice copy gets the copy's words for not-repo-root, POSIX and Windows", () => {
    const copyWords = refusalText("is-copy", "new-copy", COPY, COPY);
    expect(
      refusalText("not-repo-root", "new-copy", `${COPY}/project`, COPY),
    ).toBe(copyWords);
    expect(refusalText("not-repo-root", "new-copy", `${COPY}/`, COPY)).toBe(
      copyWords,
    );
    expect(
      refusalText("not-repo-root", "new-copy", `  ${COPY}/project`, `${COPY}/`),
    ).toBe(copyWords);
    expect(
      refusalText(
        "not-repo-root",
        "new-copy",
        `${WIN_COPY}\\project`,
        WIN_COPY,
      ),
    ).toBe(refusalText("is-copy", "new-copy", WIN_COPY, WIN_COPY));
    expect(
      refusalText("not-repo-root", "new-copy", `${COPY}-2`, COPY),
    ).toContain("git init");
  });

  test("problems and labels", () => {
    for (const problem of [
      "missing",
      "gitBroken",
      "notGit",
      "noPractice",
    ] as const)
      expect(problemText(problem)).toMatch(/work folder/);
    expect(workFolderLabel(COPY, COPY)).toBe("this practice copy");
    expect(workFolderLabel(`${WIN_COPY}\\project`, WIN_COPY)).toBe(
      "this practice copy",
    );
    expect(workFolderLabel("/home/ali/app", COPY)).toBe("/home/ali/app");
  });
});
