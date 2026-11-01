// The platform legs prove the Checks on macOS and Windows (230), so no test
// they run may skip itself by platform.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const DIRS = ["practice-template/checks/test", "quest/release/test", ".github/scripts/test"];
const SELF = "no-platform-skips.test.mjs";
const SKIP = /(skip|todo)\s*:\s*[^,}]*process\.platform|\.(skip|todo|skipIf|runIf)\s*\([^)]*process\.platform|process\.platform[^\n]*\)\s*\.?\s*(skip|todo)\b/;

const files = (dir) =>
  readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(m?js|ts)$/.test(e.name) && e.name !== SELF)
    .map((e) => join(e.parentPath, e.name));

test("no test the platform legs run skips itself by platform", () => {
  const found = DIRS.flatMap(files).filter((f) => SKIP.test(readFileSync(f, "utf8")));
  assert.deepEqual(found, []);
});
