// The Reference solutions' replay: its contract on fixture solutions (the
// names it restores, where and how steps.sh runs, which Lessons it applies),
// the CLIs' path resolution, the real Beginner, Intermediate and Advanced
// solutions on an assembled copy, and that no solution file names a commit SHA.
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { delimiter, join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  RESTORE,
  applyLesson,
  lessonOrder,
  prepareCopy,
  replay,
} from "../src/replay.mjs";
import { assembleTemplate } from "../src/template.mjs";
import { removeTemp, repoRoot, tempDir } from "./pages-fixture";
import {
  REF,
  fixtureInputs,
  lessonPages,
  stubNotices,
} from "./template-fixture";

afterAll(removeTemp);

const order = lessonOrder(repoRoot);
// The Guide's checks sit outside the release TypeScript program.
const inertness = join(repoRoot, ".github/scripts/rules/inertness.mjs");
const { RENAME } = (await import(inertness)) as {
  RENAME: Record<string, string>;
};
const replayCli = join(repoRoot, "quest/release/src/replay.mjs");
const templateCli = join(repoRoot, "quest/release/src/template.mjs");

/** A stand-in assembled copy: a project/ folder with one file. */
function fakeCopy(): string {
  const copy = tempDir("quest-copy-");
  mkdirSync(join(copy, "project"));
  writeFileSync(join(copy, "project/README.md"), "starter\n");
  return copy;
}

/** A solutions folder whose Lessons' steps.sh are `steps`, by id. */
function fixtureSolutions(steps: Record<string, string>): string {
  const dir = tempDir("quest-solutions-");
  for (const [id, script] of Object.entries(steps)) {
    mkdirSync(join(dir, id));
    writeFileSync(join(dir, id, "steps.sh"), `#!/bin/sh\nset -eu\n${script}`);
  }
  return dir;
}

const gitIn = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

describe("the replay's contract", () => {
  test("RESTORE inverts the Guide's inertness RENAME", () => {
    for (const [live, inert] of Object.entries(RENAME))
      expect(RESTORE[inert.replace(/\/$/, "")]).toBe(live);
    expect(RESTORE["dot-claude-plugin"]).toBe(".claude-plugin");
  });

  test("lessonOrder is the manifest's course order", () => {
    expect(order[0]).toBe("b-1");
    expect(order.indexOf("b-capstone")).toBeLessThan(order.indexOf("i-1"));
    expect(order.at(-1)).toBe("a-capstone");
  });

  test("prepareCopy makes one commit under the fixed author and refuses an existing repository", () => {
    const copy = fakeCopy();
    prepareCopy(copy);
    expect(gitIn(copy, "log", "--format=%an <%ae>|%s")).toBe(
      "Practice Learner <learner@example.invalid>|Start from the practice template",
    );
    expect(gitIn(copy, "branch", "--show-current")).toBe("main");
    expect(() => {
      prepareCopy(copy);
    }).toThrow(/already a git repository/);
    expect(() => {
      prepareCopy(tempDir("quest-empty-"));
    }).toThrow(/no project\/ folder/);
  });

  test("steps.sh runs in project/ with SOLUTION restored, COPY set and the fixed git author", () => {
    const solutionsDir = fixtureSolutions({
      x: [
        'pwd -P > "$COPY/where.txt"',
        'echo "$COPY" > "$COPY/copy.txt"',
        'git var GIT_AUTHOR_IDENT | sed "s/>.*/>/" > "$COPY/name.txt"',
        'find "$SOLUTION" -mindepth 1 | sed "s#^$SOLUTION/##" | sort > "$COPY/files.txt"',
        "",
      ].join("\n"),
    });
    mkdirSync(join(solutionsDir, "x/dot-claude/skills/dot-claude"), {
      recursive: true,
    });
    for (const file of [
      "dot-claude/skills/dot-claude/AGENTS.example.md",
      "CLAUDE.example.md",
      "CLAUDE.local.example.md",
      "dot-mcp.json",
    ])
      writeFileSync(join(solutionsDir, "x", file), "x\n");
    const copy = fakeCopy();
    prepareCopy(copy);
    applyLesson({ repoRoot, copy, id: "x", solutionsDir });
    const read = (name: string) =>
      readFileSync(join(copy, name), "utf8").trim();
    expect(read("where.txt")).toBe(
      execFileSync("pwd", ["-P"], { cwd: join(copy, "project") })
        .toString()
        .trim(),
    );
    expect(read("copy.txt")).toBe(copy);
    expect(read("name.txt")).toBe("Practice Learner <learner@example.invalid>");
    expect(read("files.txt").split("\n")).toEqual([
      ".claude",
      ".claude/skills",
      ".claude/skills/.claude",
      ".claude/skills/.claude/AGENTS.md",
      ".mcp.json",
      "CLAUDE.local.md",
      "CLAUDE.md",
    ]);
  });

  test("a missing solution and a failing steps.sh name the Lesson", () => {
    const solutionsDir = fixtureSolutions({
      bad: "echo broken on purpose >&2\nexit 3\n",
    });
    const copy = fakeCopy();
    prepareCopy(copy);
    expect(() => {
      applyLesson({ repoRoot, copy, id: "gone", solutionsDir });
    }).toThrow("no reference solution for gone");
    expect(() => {
      applyLesson({ repoRoot, copy, id: "bad", solutionsDir });
    }).toThrow(/^bad: .*broken on purpose/);
  });

  test("--through stops after that Lesson; an unknown id applies nothing", () => {
    const solutionsDir = fixtureSolutions(
      Object.fromEntries(order.map((id) => [id, `touch ${id}.txt\n`])),
    );
    const copy = fakeCopy();
    const seen: string[] = [];
    replay({
      repoRoot,
      copy,
      through: "b-2",
      solutionsDir,
      onLesson: (id) => seen.push(id),
    });
    expect(seen).toEqual(["b-1", "b-2"]);
    expect(readdirSync(join(copy, "project")).sort()).toEqual([
      "README.md",
      "b-1.txt",
      "b-2.txt",
    ]);
    expect(() => {
      replay({ repoRoot, copy: fakeCopy(), through: "b-9" });
    }).toThrow('no lesson "b-9"');
  });

  test("both CLIs resolve a relative path from INIT_CWD, where npm was typed", () => {
    const typed = tempDir("quest-typed-");
    // Enough of a copy for the real b-1 solution.
    mkdirSync(join(typed, "rel/project/practice/b-1"), { recursive: true });
    writeFileSync(join(typed, "rel/project/README.md"), "starter\n");
    const run = (cli: string, args: string[]) =>
      spawnSync(process.execPath, [cli, ...args], {
        cwd: join(repoRoot, "quest/release"),
        env: { ...process.env, INIT_CWD: typed },
        encoding: "utf8",
      });
    const replayed = run(replayCli, ["--through", "b-1", "rel"]);
    expect(replayed.stdout).toContain("Replayed b-1");
    expect(existsSync(join(typed, "rel/.git"))).toBe(true);
    // A non-empty folder is refused by name, at the INIT_CWD path.
    const assembled = run(templateCli, ["rel"]);
    expect(assembled.status).toBe(1);
    expect(assembled.stderr).toContain(join(typed, "rel"));
    expect(run(replayCli, []).status).toBe(2);
    expect(run(replayCli, ["--bogus", "x"]).stderr).toMatch(/Usage/);
  });
});

/** A PATH whose `claude` prints the baseline version, as on a Learner's machine. */
function claudeOnPath(): string {
  const bin = tempDir("quest-bin-");
  writeFileSync(
    join(bin, "claude"),
    "#!/bin/sh\necho '2.1.308 (Claude Code)'\n",
  );
  chmodSync(join(bin, "claude"), 0o755);
  return `${bin}${delimiter}${process.env.PATH ?? ""}`;
}

// NODE_TEST_CONTEXT would make an `npm test` a Check runs skip its tests.
const checkEnv: NodeJS.ProcessEnv = { ...process.env, PATH: claudeOnPath() };
delete checkEnv.NODE_TEST_CONTEXT;
const check = (copy: string, id: string) =>
  spawnSync(process.execPath, ["../checks/run.mjs", id], {
    cwd: join(copy, "project"),
    env: checkEnv,
    encoding: "utf8",
  });

/** A fresh assembled copy, made a git repository with one commit. */
async function assembledCopy(): Promise<string> {
  const copy = join(tempDir("quest-tpl-"), "tpl");
  await assembleTemplate({
    repoRoot,
    outDir: copy,
    inputs: fixtureInputs(lessonPages(REF)),
    writeNotices: stubNotices,
  });
  prepareCopy(copy);
  return copy;
}

describe("the Beginner solutions on an assembled copy", () => {
  const beginner = order.slice(0, order.indexOf("b-capstone") + 1);

  test("each Check fails before its Lesson's solution and passes after it, with every earlier one", async () => {
    const copy = await assembledCopy();
    for (const [i, id] of beginner.entries()) {
      expect(check(copy, id).status, `${id} before its solution`).toBe(1);
      applyLesson({ repoRoot, copy, id });
      for (const done of beginner.slice(0, i + 1)) {
        const run = check(copy, done);
        expect(run.status, `${done} after ${id}:\n${run.stdout}`).toBe(0);
      }
    }
  }, 300_000);
});

describe("the Intermediate solutions on an assembled copy", () => {
  const first = order.indexOf("i-1");
  const done = order.slice(0, first);
  const intermediate = order.slice(first, order.indexOf("i-capstone") + 1);

  // b-3's last-commit item holds only while a commit with a test is the
  // latest, so the earlier levels are checked again once, at the end.
  test("each Check fails before its Lesson's solution and passes after it, with every earlier one", async () => {
    const copy = await assembledCopy();
    for (const id of done) applyLesson({ repoRoot, copy, id });
    for (const [i, id] of intermediate.entries()) {
      expect(check(copy, id).status, `${id} before its solution`).toBe(1);
      applyLesson({ repoRoot, copy, id });
      for (const earlier of intermediate.slice(0, i + 1)) {
        const run = check(copy, earlier);
        expect(run.status, `${earlier} after ${id}:\n${run.stdout}`).toBe(0);
      }
    }
    for (const id of [...done, ...intermediate]) {
      const run = check(copy, id);
      expect(run.status, `${id} at the end:\n${run.stdout}`).toBe(0);
    }
  }, 600_000);
});

/**
 * A bin folder of stand-ins for the tools that reach the network. Each logs
 * its name and fails, so a solution that calls one fails and the log shows it.
 */
function guardedPath(): { bin: string; log: string } {
  const bin = tempDir("quest-guard-");
  const log = join(bin, "calls.log");
  for (const name of ["claude", "gh", "npx", "npm", "curl", "wget"]) {
    writeFileSync(
      join(bin, name),
      `#!/bin/sh\necho ${name} >> '${log}'\nexit 1\n`,
    );
    chmodSync(join(bin, name), 0o755);
  }
  return { bin, log };
}

// The PATH guard misses a tool called by its full path, or one whose failure
// `|| true` hides, so the scripts are also read for one in command position
// (comments and single-quoted text, such as saved JSON, left out).
test("no Advanced git-step script runs a network tool by any path", () => {
  const tool =
    /(^|[;&|(`]\s*|\$\(\s*)(\S*\/)?(claude|gh|npx|npm|curl|wget)(\s|$)/m;
  const ids = readdirSync(join(repoRoot, "solutions")).filter((id) =>
    id.startsWith("a-"),
  );
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) {
    const code = readFileSync(
      join(repoRoot, "solutions", id, "steps.sh"),
      "utf8",
    )
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .join("\n")
      .replace(/'[^']*'/g, "''");
    expect(tool.test(code), id).toBe(false);
  }
});

describe("the Advanced solutions on an assembled copy", () => {
  const first = order.indexOf("a-1");
  const done = order.slice(0, first);
  const advanced = order.slice(first);

  // The Advanced solutions run with the network tools shadowed (b-3's runs
  // `npm test`, so the earlier levels run as before); the Checks keep their
  // own `claude` stand-in.
  test("each Check fails before its Lesson's solution and passes after it, with every earlier one, and no solution reaches the network", async () => {
    const { bin, log } = guardedPath();
    const apply = (copy: string, id: string) => {
      const path = process.env.PATH;
      process.env.PATH = `${bin}${delimiter}${path ?? ""}`;
      try {
        applyLesson({ repoRoot, copy, id });
      } finally {
        if (path === undefined) delete process.env.PATH;
        else process.env.PATH = path;
      }
    };
    const copy = await assembledCopy();
    for (const id of done) applyLesson({ repoRoot, copy, id });
    for (const [i, id] of advanced.entries()) {
      expect(check(copy, id).status, `${id} before its solution`).toBe(1);
      apply(copy, id);
      for (const earlier of advanced.slice(0, i + 1)) {
        const run = check(copy, earlier);
        expect(run.status, `${earlier} after ${id}:\n${run.stdout}`).toBe(0);
      }
    }
    for (const id of order) {
      const run = check(copy, id);
      expect(run.status, `${id} at the end:\n${run.stdout}`).toBe(0);
    }
    expect(existsSync(log) ? readFileSync(log, "utf8") : "").toBe("");
  }, 900_000);
});

/** Every file under `dir`, relative to it. */
function files(dir: string, rel = ""): string[] {
  return readdirSync(join(dir, rel)).flatMap((name) => {
    const path = rel ? `${rel}/${name}` : name;
    return statSync(join(dir, path)).isDirectory() ? files(dir, path) : [path];
  });
}

test("no file under solutions/ names a commit SHA or is a saved commit", () => {
  const root = join(repoRoot, "solutions");
  const allowed: string[] = [];
  const found = files(root).flatMap((path) => {
    if (/-commit\.txt$/.test(path)) return [`${path}: a saved commit`];
    const text = readFileSync(join(root, path), "utf8");
    return [...text.matchAll(/\b[0-9a-f]{7,40}\b/g)]
      .map((m) => m[0])
      .filter((s) => /\d/.test(s) && /[a-f]/.test(s) && !allowed.includes(s))
      .map((s) => `${path}: ${s}`);
  });
  expect(found).toEqual([]);
});
