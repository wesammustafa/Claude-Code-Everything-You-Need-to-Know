// The PATH lookup (needs.path-lookup; ticket 209, from learn-folder's
// FO:1161): a command is found by reading the PATH folders, starting none
// of them, and on Windows by PATHEXT.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onPath } from "../src/path-lookup.ts";
import { realAdapters } from "../src/real.ts";

// spec: needs.path-lookup
test("a command is a file that may run in one of the PATH folders, found with no process started; on Windows one PATHEXT names, under Path too", () => {
  const bin = mkdtempSync(join(tmpdir(), "host-bin-"));
  const ran = join(bin, "ran");
  const other = join(bin, "more");
  mkdirSync(other);
  // jq and socat would leave a mark if run; python3 is there but can't
  // run; bwrap is not there at all. A second folder holds socat.
  writeFileSync(join(bin, "jq"), `#!/bin/sh\ntouch '${ran}'\n`, {
    mode: 0o755,
  });
  writeFileSync(join(bin, "python3"), "#!/bin/sh\n", { mode: 0o644 });
  writeFileSync(join(other, "socat"), `#!/bin/sh\ntouch '${ran}'\n`, {
    mode: 0o755,
  });
  try {
    const env = { PATH: `${bin}:${join(bin, "none")}:"${other}"` };
    const { commands } = realAdapters({ root: bin, env, platform: "linux" });
    assert.deepEqual(
      ["jq", "python3", "socat", "bwrap"].map((n) => commands.has(n)),
      [true, false, true, false],
    );
    assert.equal(
      onPath("jq", { PATH: "" }, "linux"),
      false,
      "an empty PATH holds nothing",
    );
    // On Windows a command is a file with one of PATHEXT's extensions, and
    // the environment may name the PATH `Path`.
    writeFileSync(join(bin, "python3.EXE"), "");
    const win = { Path: `${bin};${other}`, PATHEXT: ".COM;.EXE" };
    assert.deepEqual(
      ["jq", "python3", "socat"].map((n) => onPath(n, win, "win32")),
      [false, true, false],
    );
    assert.equal(
      onPath("python3", { Path: bin }, "win32"),
      true,
      "PATHEXT's default lists .EXE",
    );
    assert.ok(!existsSync(ran), "a command was started to find it");
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
});
