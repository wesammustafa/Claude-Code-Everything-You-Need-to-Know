// SECURITY.md's server statements and the tests that back them (259).
// Each statement is matched by a phrase and names test titles that must
// still exist, so a statement cannot outlive its test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const server = (name) => `quest/server/test/${name}`;
const host = (name) => `quest/host/test/${name}`;

const STATEMENTS = [
  ["listens only on `127.0.0.1`", [[server("loopback.test.ts"), "the server listens on 127.0.0.1 over IPv4"], [server("loopback.test.ts"), "no other address of this machine reaches it"]]],
  ["requests addressed to `127.0.0.1` or `localhost`", [[server("trust.test.ts"), "X-Forwarded-Host"], [server("launch.test.ts"), "in a codespace is the forwarded https address alone, and nothing opens"]]],
  ["cannot make it act", [[server("trust.test.ts"), "a cross-site Origin is refused"], [server("trust.test.ts"), "another local port's Origin is refused"], [server("trust.test.ts"), "no GET or HEAD route changes the revision or dispatches"]]],
  ["must be the root of a git repository inside your home folder", [[server("folders.test.ts"), "a refused path"], [server("dir.test.ts"), "a folder outside home is refused"]]],
  ["writes only to `.practice/`", [[host("read-only.test.mjs"), "write only through the store"]]],
  ["runs only the Checks, read-only git commands", [[host("read-only.test.mjs"), "start only the Check child and read-only git"], [server("folders.test.ts"), "the server's only child processes are git rev-parse and the browser opener"]]],
  ["make no network request", [[host("read-only.test.mjs"), "the engine and the host make no network call"]]],
  ["never a header value or a cookie", [[server("redaction.test.ts"), "writes no header value, cookie or token"]]],
];

const doc = read("SECURITY.md");
const section = doc.slice(doc.indexOf("## The Claude Code Quest server"), doc.indexOf("## Reporting"));

for (const [phrase, backing] of STATEMENTS)
  test(`SECURITY.md says "${phrase}" and its tests exist`, () => {
    assert.ok(section.includes(phrase), `missing statement: ${phrase}`);
    for (const [file, title] of backing)
      assert.ok(read(file).includes(title), `${file} lost "${title}"`);
  });

test("every server statement is backed or named as untestable", () => {
  const bullets = section.split("\n").filter((line) => line.startsWith("- "));
  const untestable = ["keep the port private", "private advisory"];
  for (const bullet of bullets)
    assert.ok(
      [...STATEMENTS.map(([p]) => p), ...untestable].some((p) => bullet.includes(p)),
      `no backing test for: ${bullet}`,
    );
});

test("no claim that the server listens on all interfaces", () => {
  assert.doesNotMatch(section, /0\.0\.0\.0|all interfaces|any address/i);
});

test("the lesson feedback form asks for the Step and the release", () => {
  const form = read(".github/ISSUE_TEMPLATE/lesson-feedback.yml");
  assert.match(form, /id: step\b/);
  assert.match(form, /id: release\b/);
});
