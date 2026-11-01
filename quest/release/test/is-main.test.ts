// The entry-script guard: the same file matches through a relative path, a
// symlinked folder and, on win32, a different case; another file never does.
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, expect, test } from "vitest";
import { isMain } from "../src/is-main.mjs";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function script() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "is-main-")));
  dir = root;
  mkdirSync(join(root, "src"));
  const file = join(root, "src", "cli.mjs");
  writeFileSync(file, "");
  return { root, file };
}

test("matches the same file by absolute or relative path", () => {
  const { file } = script();
  const url = pathToFileURL(file).href;
  expect(isMain(url, file)).toBe(true);
  expect(isMain(url, relative(process.cwd(), file))).toBe(true);
});

test("matches through a symlinked folder", () => {
  const { root, file } = script();
  const link = join(root, "link");
  symlinkSync(join(root, "src"), link, "junction");
  expect(isMain(pathToFileURL(file).href, join(link, "cli.mjs"))).toBe(true);
});

test("folds case on win32 only", () => {
  const { file } = script();
  const url = pathToFileURL(file).href;
  const upper = file.toUpperCase();
  expect(isMain(url, upper, "win32")).toBe(true);
  // On a case-sensitive file system the upper-case path is another file.
  if (realpathOrNull(upper) === null)
    expect(isMain(url, upper, "linux")).toBe(false);
});

test("rejects another file and a missing argv[1]", () => {
  const { root, file } = script();
  const other = join(root, "src", "other.mjs");
  writeFileSync(other, "");
  expect(isMain(pathToFileURL(file).href, other)).toBe(false);
  expect(isMain(pathToFileURL(file).href, "")).toBe(false);
});

function realpathOrNull(path: string) {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}
