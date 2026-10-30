// Where a typed folder path points (ticket 209): moved from main.mjs.
import { test } from "vitest";
import assert from "node:assert/strict";
import { folderPath } from "../src/folders.mjs";

const ROOT = "/home/sam/claude-code-practice";
const HOME = "/home/sam";

test("a typed path loses its quotes and the shell's escaped spaces, reads ~ as home, and a relative path from the copy", () => {
  const at = (text, win32 = false) => folderPath(text, ROOT, HOME, win32);
  assert.equal(at("  /home/sam/code/my-app  "), "/home/sam/code/my-app");
  assert.equal(at("'/home/sam/my app'"), "/home/sam/my app");
  assert.equal(at('"/home/sam/my app"'), "/home/sam/my app");
  assert.equal(
    at("'/home/sam/my app\""),
    `${ROOT}/'/home/sam/my app"`,
    "quotes that don't pair stay",
  );
  assert.equal(at("/home/sam/my\\ app"), "/home/sam/my app");
  assert.equal(at("~"), HOME);
  assert.equal(at("~/code/x"), "/home/sam/code/x");
  assert.equal(
    at("~sam/x"),
    `${ROOT}/~sam/x`,
    "only ~ alone or before a slash is home",
  );
  assert.equal(at("project"), `${ROOT}/project`);
  assert.equal(at("../other"), "/home/sam/other");
  // On Windows a backslash is a separator, not the shell's escape: it stays,
  // and ~ before one is home.
  assert.equal(at("/home/sam/my\\ app", true), "/home/sam/my\\ app");
  assert.equal(at("~\\code", true), "/home/sam/\\code");
});
