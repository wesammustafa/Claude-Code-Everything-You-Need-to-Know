// The start-up CLI with a stub in place of the real check: a pass prints
// PASS and exits 0, problems print FAIL and exit 1, a missing folder fails
// without starting anything, and no argument is a usage error.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { main } from "../src/startup.mjs";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function run(
  target: string | undefined,
  result: { ok: boolean; problems: string[]; note?: string },
) {
  const lines: string[] = [];
  const calls: unknown[][] = [];
  const code = main(target, {
    check: (...args) => {
      calls.push(args);
      return result;
    },
    log: (line) => lines.push(line),
    error: (line) => lines.push(line),
  });
  return { code, lines, calls };
}

test("a pass prints PASS with the note and exits 0, without Chromium", async () => {
  dir = mkdtempSync(join(tmpdir(), "quest-startup-"));
  const note = "listening at http://127.0.0.1:4000 after 300 ms";
  const { code, lines, calls } = run(dir, { ok: true, problems: [], note });
  expect(await code).toBe(0);
  expect(lines).toEqual([`PASS start-up ${note}`]);
  expect(calls).toEqual([[dir, { chromium: false }]]);
});

test("problems print FAIL, one line each, and exit 1", async () => {
  dir = mkdtempSync(join(tmpdir(), "quest-startup-"));
  const { code, lines } = run(dir, {
    ok: false,
    problems: ["learn: node_modules", "GET /api/health answered 500"],
  });
  expect(await code).toBe(1);
  expect(lines.join("\n")).toBe(
    "FAIL start-up\n  learn: node_modules\n  GET /api/health answered 500",
  );
});

test("a missing folder fails without running the check", async () => {
  const missing = join(tmpdir(), "quest-startup-missing-0");
  const { code, lines, calls } = run(missing, { ok: true, problems: [] });
  expect(await code).toBe(1);
  expect(lines.join("\n")).toContain(`${missing}: no such folder`);
  expect(calls).toEqual([]);
});

test("no argument prints the usage and exits 2", async () => {
  const { code, lines, calls } = run(undefined, { ok: true, problems: [] });
  expect(await code).toBe(2);
  expect(lines).toEqual(["Usage: npm run startup -- <template-dir>"]);
  expect(calls).toEqual([]);
});
