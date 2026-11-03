// Where a typed folder path points (ticket 209): moved from main.mjs.
import { test } from "vitest";
import assert from "node:assert/strict";
import { folderPath } from "../src/folders.ts";

const ROOT = "/home/ali/claude-code-practice";
const HOME = "/home/ali";

test("a typed path loses its quotes and the shell's escaped spaces, reads ~ as home, and a relative path from the copy", () => {
  const at = (text, win32 = false) => folderPath(text, ROOT, HOME, win32);
  assert.equal(at("  /home/ali/code/my-app  "), "/home/ali/code/my-app");
  assert.equal(at("'/home/ali/my app'"), "/home/ali/my app");
  assert.equal(at('"/home/ali/my app"'), "/home/ali/my app");
  assert.equal(
    at("'/home/ali/my app\""),
    `${ROOT}/'/home/ali/my app"`,
    "quotes that don't pair stay",
  );
  assert.equal(at("/home/ali/my\\ app"), "/home/ali/my app");
  assert.equal(at("~"), HOME);
  assert.equal(at("~/code/x"), "/home/ali/code/x");
  assert.equal(
    at("~ali/x"),
    `${ROOT}/~ali/x`,
    "only ~ alone or before a slash is home",
  );
  assert.equal(at("project"), `${ROOT}/project`);
  assert.equal(at("../other"), "/home/ali/other");
  // On Windows a backslash is a separator, not the shell's escape: it stays,
  // and ~ before one is home.
  assert.equal(at("/home/ali/my\\ app", true), "/home/ali/my\\ app");
  assert.equal(at("~\\code", true), "/home/ali/\\code");
});
