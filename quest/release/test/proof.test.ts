// The fresh-copy proof's steps, each broken on purpose: a planted step file,
// a Check that passes on a fresh copy, a byte or a mode that differs, a
// failing solution or the wrong Claude Code, an app that won't serve offline
// on loopback, and the runner reporting every step whatever fails. No real
// replay and no Chromium: the full proof runs as `npm run proof`.
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import {
  baselineVersion,
  checksTests,
  freshFails,
  replayPasses,
  runProof,
  sameBytes,
  serves,
  snapshot,
  starterTests,
  treeProblems,
} from "../src/proof.mjs";
import { prepareCopy } from "../src/replay.mjs";
import { assembleTemplate } from "../src/template.mjs";
import { removeTemp, repoRoot, tempDir } from "./pages-fixture";
import {
  REF,
  fixtureInputs,
  fixtureLearn,
  lessonPages,
  stubNotices,
} from "./template-fixture";

afterAll(removeTemp);

const BASELINE = baselineVersion(
  readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8"),
);

function files(dir: string, map: Record<string, string>): string {
  for (const [path, body] of Object.entries(map)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

async function assembled(): Promise<string> {
  const outDir = join(tempDir("quest-proof-tpl-"), "copy");
  await assembleTemplate({
    repoRoot,
    outDir,
    inputs: fixtureInputs(lessonPages(REF), fixtureLearn()),
    writeNotices: stubNotices,
  });
  return outDir;
}

function claudeShim(version: string): string {
  const file = join(tempDir("quest-proof-claude-"), "claude");
  writeFileSync(file, `#!/bin/sh\necho "${version} (Claude Code)"\n`);
  chmodSync(file, 0o755);
  return file;
}

describe("baselineVersion", () => {
  test("reads the baseline from the real CHANGELOG", () => {
    expect(BASELINE).toBe("2.1.308");
  });

  test("throws without the Baseline line", () => {
    expect(() => baselineVersion("# Changelog\n\n## Unreleased\n")).toThrow(
      /no "Baseline/,
    );
  });
});

describe("step 5: treeProblems", () => {
  test.each([
    ["learn/app/b-1.md", "---\nlesson: b-1\n---\n"],
    ["capstone/steps/x.md", ""],
    ["checks/steps.sh", "#!/bin/sh\n"],
  ])("a planted %s fails it", async (path, body) => {
    const dir = await assembled();
    expect(treeProblems(dir)).toEqual([]);
    files(dir, { [path]: body });
    expect(treeProblems(dir).join("\n")).toMatch(/: step file$/m);
  });
});

describe("step 6: sameBytes", () => {
  test("two snapshots of one tree agree; a byte or a mode differs", () => {
    const tree = { "a.txt": "a\n", "b/c.txt": "c\n" };
    const one = files(tempDir("quest-proof-a-"), tree);
    const two = files(tempDir("quest-proof-b-"), tree);
    expect(sameBytes(snapshot(one), snapshot(two))).toEqual([]);
    writeFileSync(join(two, "a.txt"), "b\n");
    expect(sameBytes(snapshot(one), snapshot(two))).toEqual(["a.txt"]);
    writeFileSync(join(two, "a.txt"), "a\n");
    chmodSync(join(two, "b/c.txt"), 0o755);
    expect(sameBytes(snapshot(one), snapshot(two))).toEqual(["b/c.txt"]);
  });

  test("a file only one tree holds differs, and .git is left out", () => {
    const one = files(tempDir("quest-proof-a-"), { "a.txt": "" });
    const two = files(tempDir("quest-proof-b-"), {
      "a.txt": "",
      "x.txt": "",
      ".git/HEAD": "ref\n",
    });
    expect(sameBytes(snapshot(one), snapshot(two))).toEqual(["x.txt"]);
  });
});

/** A copy whose checks/run.mjs prints `lines` and exits `code`. */
function standIn(lines: string[], code: number): string {
  return files(tempDir("quest-proof-run-"), {
    "project/package.json": JSON.stringify({
      scripts: { check: "node ../checks/run.mjs" },
    }),
    "checks/run.mjs": `${lines.map((l) => `console.log(${JSON.stringify(l)});`).join("\n")}\nprocess.exitCode = ${String(code)};\n`,
  });
}

describe("step 2: freshFails", () => {
  test("passes when every Check fails", () => {
    expect(freshFails(standIn(["Every lesson's check fails"], 0)).ok).toBe(
      true,
    );
  });

  test("a Check that passes on a fresh copy fails it, with its line", () => {
    const line = "b-1: expected every check to fail, but all passed";
    expect(freshFails(standIn([line, "1 lesson(s) broke"], 1))).toEqual({
      ok: false,
      problems: [line],
    });
  });

  test("any other exit fails it with the status", () => {
    const result = freshFails(standIn(["usage: ..."], 2));
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toMatch(/exited 2$/);
  });
});

describe("step 1: starterTests and checksTests", () => {
  const fail = [
    process.execPath,
    "-e",
    "console.log('1 failed');process.exit(1)",
  ];
  const pass = [process.execPath, "-e", ""];

  test("a failing command fails its step, with its output", () => {
    const copy = files(tempDir("quest-proof-s-"), { "project/x": "" });
    const starter = starterTests(copy, { command: fail });
    expect(starter.ok).toBe(false);
    expect(starter.problems).toContain("1 failed");
    expect(checksTests(repoRoot, { command: fail }).ok).toBe(false);
  });

  test("a passing command passes", () => {
    const copy = files(tempDir("quest-proof-s-"), { "project/x": "" });
    expect(starterTests(copy, { command: pass }).ok).toBe(true);
    expect(checksTests(repoRoot, { command: pass }).ok).toBe(true);
  });
});

describe("step 3: replayPasses", () => {
  async function prepared(): Promise<string> {
    const copy = await assembled();
    prepareCopy(copy);
    return copy;
  }
  const failing = () =>
    files(tempDir("quest-proof-sol-"), {
      "b-1/steps.sh": "echo planted >&2\nexit 3\n",
    });

  test("the wrong Claude Code fails it before any solution runs", async () => {
    const result = replayPasses({
      repoRoot,
      copy: await prepared(),
      solutionsDir: failing(),
      claude: claudeShim("1.0.0"),
    });
    expect(result).toEqual({
      ok: false,
      problems: [`Claude Code is 1.0.0, not the baseline ${BASELINE}`],
      note: undefined,
    });
  });

  test("no Claude Code fails it", async () => {
    const result = replayPasses({
      repoRoot,
      copy: await prepared(),
      claude: join(tempDir("quest-proof-none-"), "claude"),
    });
    expect(result.problems).toEqual([
      `Claude Code is not on PATH: install @anthropic-ai/claude-code@${BASELINE}`,
    ]);
  });

  test("a failing solution fails it", async () => {
    const result = replayPasses({
      repoRoot,
      copy: await prepared(),
      solutionsDir: failing(),
      claude: claudeShim(BASELINE),
    });
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toMatch(
      /^b-1: the reference solution failed: planted/,
    );
  });

  test("anyClaude turns a mismatch into a note", async () => {
    const result = replayPasses({
      repoRoot,
      copy: await prepared(),
      solutionsDir: failing(),
      claude: claudeShim("1.0.0"),
      anyClaude: true,
    });
    expect(result.note).toBe(
      `Claude Code is 1.0.0, not the baseline ${BASELINE}`,
    );
    expect(result.problems[0]).toMatch(/^b-1: /);
  });
});

const GOOD_APP = `import http from "node:http";
const server = http.createServer((req, res) => {
  res.writeHead(req.url === "/api/health" ? 200 : 404);
  res.end("{}");
});
server.listen(0, HOST, () =>
  console.log(\`http://127.0.0.1:\${server.address().port}\`),
);
process.on("SIGTERM", () => server.close(() => process.exit(0)));
`;

function learnTree(app: string, extra: Record<string, string> = {}): string {
  return files(tempDir("quest-proof-learn-"), {
    "package.json": JSON.stringify({
      scripts: { learn: "node learn/app.mjs" },
    }),
    "learn/app.mjs": app,
    ...extra,
  });
}

describe("step 4: serves, without Chromium", () => {
  const good = GOOD_APP.replace("HOST", '"127.0.0.1"');

  test("a stub that serves on loopback passes", async () => {
    const result = await serves(learnTree(good), { chromium: false });
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.note).toMatch(/^listening at http:\/\/127\.0\.0\.1:\d+/);
  });

  test("an app that exits at once fails it", async () => {
    const result = await serves(learnTree("process.exit(0);\n"), {
      chromium: false,
    });
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toMatch(/^exited 0 before listening/);
  });

  test("an app that listens on every interface fails it", async () => {
    const result = await serves(
      learnTree(GOOD_APP.replace("HOST", '"0.0.0.0"')),
      { chromium: false },
    );
    expect(result.ok).toBe(false);
    expect(result.problems).toContain("went off loopback: listen on 0.0.0.0");
  });

  test("an app that connects out fails it", async () => {
    const out = `import net from "node:net";
try {
  net.connect(80, "192.0.2.1").on("error", () => {});
} catch {}
${good}`;
    const result = await serves(learnTree(out), { chromium: false });
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual([
      "went off loopback: connect to 192.0.2.1",
    ]);
  });

  test("a node_modules folder fails it", async () => {
    const result = await serves(
      learnTree(good, { "learn/node_modules/x/index.js": "" }),
      { chromium: false },
    );
    expect(result).toEqual({
      ok: false,
      problems: ["learn/node_modules: node_modules"],
    });
  });
});

describe("runProof", () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  const ok = () => ({ ok: true, problems: [] });
  const assemble = ({ outDir }: { outDir: string }) => {
    files(outDir, { "project/a.txt": "a\n" });
    return Promise.resolve({ ref: REF });
  };

  async function proof(options: Partial<Parameters<typeof runProof>[0]>) {
    const lines: string[] = [];
    const results = await runProof({
      repoRoot,
      log: (l) => lines.push(l),
      ...options,
      steps: {
        assemble,
        rebuild: ok,
        starterTests: ok,
        checksTests: ok,
        freshFails: ok,
        replayPasses: ok,
        serves: ok,
        treeProblems: () => [],
        ...options.steps,
      },
    });
    return { lines, results };
  }

  test("all six passing is a full proof", async () => {
    const { lines } = await proof({});
    expect(lines[0]).toBe(`proof: the Practice template at ${REF}`);
    expect(
      lines.filter((l) => /^PASS \d /.test(l)).map((l) => l.split(" ")[1]),
    ).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(lines.at(-1)).toBe("proof: 6 of 6 passed");
    expect(process.exitCode ?? 0).toBe(0);
  });

  test("a failing step still runs the rest, prints FAIL and sets the exit code", async () => {
    let served = false;
    const { lines } = await proof({
      steps: {
        freshFails: () => ({
          ok: false,
          problems: ["b-1: expected every check to fail, but all passed"],
        }),
        serves: () => {
          served = true;
          return ok();
        },
      },
    });
    expect(served).toBe(true);
    expect(lines).toContain(
      "    b-1: expected every check to fail, but all passed",
    );
    expect(lines.some((l) => l.startsWith("FAIL 2 "))).toBe(true);
    expect(lines.at(-1)).toBe("proof: FAILED (steps 2)");
    expect(process.exitCode).toBe(1);
  });

  test("a non-deterministic byte fails step 6", async () => {
    let n = 0;
    const { lines } = await proof({
      steps: {
        assemble: ({ outDir }) => {
          files(outDir, { "project/a.txt": `${String(n++)}\n` });
          return Promise.resolve({ ref: REF });
        },
      },
    });
    expect(lines).toContain("    project/a.txt differs");
    expect(lines.at(-1)).toBe("proof: FAILED (steps 6)");
  });

  test("step 6 assembles the second copy after a second build", async () => {
    const order: string[] = [];
    await proof({
      steps: {
        assemble: ({ outDir }) => {
          order.push(`assemble ${outDir.endsWith("/a") ? "a" : "b"}`);
          files(outDir, { "project/a.txt": "a\n" });
          return Promise.resolve({ ref: REF });
        },
        rebuild: () => {
          order.push("rebuild");
          return ok();
        },
      },
    });
    expect(order).toEqual(["assemble a", "rebuild", "assemble b"]);
  });

  test("a second build that fails fails step 6", async () => {
    const { lines } = await proof({
      steps: {
        rebuild: () => ({
          ok: false,
          problems: ["the second npm run build exited 1"],
        }),
      },
    });
    expect(lines).toContain("    the second npm run build exited 1");
    expect(lines.at(-1)).toBe("proof: FAILED (steps 6)");
  });

  test("an assembly that throws fails step 5 and skips the rest", async () => {
    const { lines } = await proof({
      steps: {
        assemble: () => Promise.reject(new Error("x: step file")),
      },
    });
    expect(lines.filter((l) => l.startsWith("SKIP")).length).toBe(5);
    expect(lines).toContain("    x: step file");
    expect(lines.at(-1)).toBe("proof: FAILED (steps 5)");
  });

  test("--skip-checks-tests skips them and makes the proof partial", async () => {
    let ran = false;
    const { lines } = await proof({
      skipChecksTests: true,
      steps: {
        checksTests: () => {
          ran = true;
          return ok();
        },
      },
    });
    expect(ran).toBe(false);
    expect(lines.at(-1)).toBe("proof: PARTIAL (not a full proof)");
    expect(process.exitCode ?? 0).toBe(0);
  });

  test("a Claude Code note makes the proof partial", async () => {
    const { lines } = await proof({
      steps: {
        replayPasses: () => ({ ...ok(), note: "Claude Code is 1.0.0" }),
      },
    });
    expect(lines).toContain("    note: Claude Code is 1.0.0");
    expect(lines.at(-1)).toBe("proof: PARTIAL (not a full proof)");
  });
});
