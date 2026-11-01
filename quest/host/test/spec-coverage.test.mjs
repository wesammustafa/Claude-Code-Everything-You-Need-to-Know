// The host's half of the spec's behavior list (ticket 209): each
// host-owned id has a `// spec: <id>` tag on a test here, and no engine id
// is tagged here, since the engine's tests prove those.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import assert from "node:assert/strict";
import { SPEC } from "../../engine/test/spec.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const tags = readdirSync(here)
  .filter((f) => f.endsWith(".test.mjs"))
  .flatMap((name) =>
    readFileSync(join(here, name), "utf8")
      .split("\n")
      .flatMap((line, i) => {
        const m = /^\s*\/\/ spec: (\S+)\s*$/.exec(line);
        return m ? [{ id: m[1], at: `${name}:${i + 1}` }] : [];
      }),
  );
const owner = new Map(SPEC.map((x) => [x.id, x.owner]));

test("every host-owned behavior has a test here", () => {
  const hostIds = SPEC.filter((x) => x.owner === "host").map((x) => x.id);
  assert.equal(hostIds.length, 7);
  const tagged = new Set(tags.map((t) => t.id));
  assert.deepEqual(
    hostIds.filter((id) => !tagged.has(id)),
    [],
  );
});

test("every tag here names a host-owned behavior", () => {
  assert.deepEqual(
    tags
      .filter((t) => owner.get(t.id) !== "host")
      .map((t) => `${t.at} ${t.id}`),
    [],
  );
});
