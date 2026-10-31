// The Practice template's assembly: its generated files on the real inputs,
// the checks every assembled tree must pass, a byte-identical second run, and
// a tree assembled from a real server bundle that `npm run learn` serves with
// no node_modules.
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  FORBIDDEN,
  assembleTemplate,
  importProblems,
  layoutProblems,
  learnReadme,
  lessonIndex,
  progressChecklist,
  rootPackage,
  templateProblems,
  templateReadme,
  type Manifest,
} from "../src/template.mjs";
import { removeTemp, repoRoot, tempDir } from "./pages-fixture";
import {
  REF,
  fixtureInputs,
  fixtureLearn,
  lessonPages,
  stubNotices,
} from "./template-fixture";

afterAll(removeTemp);

const manifest = JSON.parse(
  readFileSync(join(repoRoot, "course/manifest.json"), "utf8"),
) as Manifest;
const RELEASE = `https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/tree/${REF}/`;
const pagesIndex = lessonPages(REF);

/** Every file under `dir` as a sorted path to base64 map. */
function tree(dir: string): Record<string, string> {
  return Object.fromEntries(
    (
      readdirSync(dir, { recursive: true, withFileTypes: true }) as never as {
        name: string;
        parentPath: string;
        isFile(): boolean;
      }[]
    )
      .filter((e) => e.isFile())
      .map((e) => {
        const path = join(e.parentPath, e.name);
        return [
          path.slice(dir.length + 1),
          readFileSync(path).toString("base64"),
        ] as const;
      })
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}

describe("the generated files", () => {
  test("the lesson index is the source checks/lessons/index.mjs", () => {
    expect(lessonIndex(manifest)).toBe(
      readFileSync(
        join(repoRoot, "practice-template/checks/lessons/index.mjs"),
        "utf8",
      ),
    );
  });

  test("the checklist lists all 23 Lessons in order, titled from their pages", () => {
    const text = progressChecklist(manifest, pagesIndex);
    const items = text.split("\n").filter((l) => l.startsWith("- [ ] "));
    expect(items).toHaveLength(23);
    expect(items.map((l) => l.split(" ")[3])).toEqual(
      manifest.lessons.map((l) => l.id),
    );
    for (const item of items) expect(item).toMatch(/^- \[ \] \S+ \S/);
    expect(text).toMatch(/^---\nname: Track my progress\n/);
    expect(text.split("\n").filter((l) => l.startsWith("### "))).toEqual([
      "### Beginner",
      "### Intermediate",
      "### Advanced",
    ]);
    expect(() =>
      progressChecklist(manifest, {
        ref: REF,
        pages: pagesIndex.pages.slice(1),
      }),
    ).toThrow(/b-1: no page title/);
  });

  test("the README has no placeholder, no source comment, and solution links at the ref", () => {
    const source = readFileSync(
      join(repoRoot, "practice-template/README.source.md"),
      "utf8",
    );
    const readme = templateReadme(source, REF);
    expect(readme).not.toContain("quest-release:");
    expect(readme).not.toContain("<!--");
    expect(readme.startsWith("# Claude Code practice\n")).toBe(true);
    for (const lesson of manifest.lessons)
      expect(readme).toContain(`(${RELEASE}solutions/${lesson.id}/)`);
    expect(() => templateReadme("x\n<!-- y -->\n", REF)).toThrow(/placeholder/);
  });

  test("learn/README.md links its source at the ref", () => {
    const text = learnReadme(REF);
    expect(text).toContain(`${RELEASE}quest`);
    expect(text).toContain("npm run template");
    expect(text).not.toContain(String.fromCharCode(0x2014));
  });

  test("the root package.json has only learn, no dependencies, Node 22 or later", () => {
    expect(rootPackage()).toEqual({
      name: "claude-code-practice",
      version: "0.0.0",
      private: true,
      type: "module",
      scripts: { learn: "node learn/app.mjs" },
      engines: { node: ">=22" },
    });
  });

  test("importProblems flags a package or relative load and passes node: and the shapes that only look like loads", () => {
    expect(
      importProblems(
        'import { x } from "hono";\nconst y = await import("./links.js");\nconst z = require("fs");\n',
      ),
    ).toEqual(["loads hono", 'loads "./links.js"', 'loads "fs"']);
    expect(
      importProblems(
        'import { styleText } from "node:util";\nif (import.meta.main) run();\n',
      ),
    ).toEqual([
      "uses styleText, not in every Node >=22",
      "uses import.meta.main, not in every Node >=22",
    ]);
    expect(
      importProblems(
        [
          'import { readFileSync } from "node:fs";',
          'export { join } from "node:path";',
          'const m = await import("node:os");',
          '/** @type {import("hono").Context} */',
          'const s = "see ./links.checked.js";',
          "// the hono app",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});

/** A minimal tree that passes both checks. */
function cleanTree(): string {
  const dir = tempDir("quest-tpl-clean-");
  const files: Record<string, string> = {
    "package.json": JSON.stringify(rootPackage()),
    "project/package.json": JSON.stringify({
      scripts: {
        test: "node --test",
        check: "node ../checks/run.mjs",
        linkcheck: "node src/cli.js",
      },
    }),
    "project/.gitignore": "",
    "project/LICENSE": "",
    "project/package-lock.json": "{}",
    "project/practice/x": "",
    "project/samples/x": "",
    "project/src/cli.js": "",
    "project/test/x.test.js": "",
    "checks/run.mjs": "",
    "capstone/brief.md": "",
    ".gitignore": "",
    ".gitattributes": "",
    "README.md": "",
    "learn/app.mjs": "",
    "learn/run-check.mjs": "",
    ".github/workflows/progress.yml": "",
    ".github/ISSUE_TEMPLATE/track-my-progress.md": "",
    ".devcontainer/devcontainer.json": "",
  };
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

function plant(dir: string, path: string, asDir = false): void {
  if (asDir) mkdirSync(join(dir, path), { recursive: true });
  else {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), "");
  }
}

describe("the tree checks", () => {
  test("a clean tree has no problem", () => {
    const dir = cleanTree();
    expect(templateProblems(dir)).toEqual([]);
    expect(layoutProblems(dir)).toEqual([]);
  });

  const plants: [string, boolean][] = [
    ...FORBIDDEN.map((name): [string, boolean] => [
      `project/src/${name}`,
      name.startsWith(".claude"),
    ]),
    ["checks/test", true],
    ["checks/lessons/ladders", true],
    ["checks/probes.mjs", false],
    ["learn/lessons", true],
    ["learn/menu.mjs", false],
    ["checks/.env", false],
    ["project/src/.DS_Store", false],
    ["capstone/.idea", true],
    ["project/test/.practice", true],
    ["checks/.scratch", true],
    ["project/src/.scratch", false],
    ["capstone/steps", true],
    ["capstone/steps/x.md", false],
    ["checks/steps.sh", false],
    ["checks/solutions", true],
  ];
  test.each(plants)("%s is one problem", (path, asDir) => {
    const dir = cleanTree();
    plant(dir, path, asDir);
    expect(templateProblems(dir)).toHaveLength(1);
  });

  test.each([
    ["learn/app/b-1.md", "---\nlesson: b-1\n---\n# Step\n", 1],
    ["capstone/README.md", "# Capstone\n\n---\nlesson: b-1\n", 0],
    ["checks/notes.md", "---\ntitle: x\n---\n", 0],
  ] as [string, string, number][])(
    "%s with its front matter is %i step file",
    (path, body, count) => {
      const dir = cleanTree();
      plant(dir, path);
      writeFileSync(join(dir, path), body);
      expect(templateProblems(dir)).toHaveLength(count);
    },
  );

  test.each([
    ["project/checks", true],
    ["project/.practice", true],
    ["project/notes.md", false],
    [".scratch", true],
    ["notes.md", false],
  ] as [string, boolean][])("%s breaks the layout", (path, asDir) => {
    const dir = cleanTree();
    plant(dir, path, asDir);
    expect(layoutProblems(dir).length).toBeGreaterThan(0);
  });

  test("a missing root file, a second script, a dependency or a wrong check script breaks the layout", () => {
    let dir = cleanTree();
    rmSync(join(dir, ".gitattributes"));
    expect(layoutProblems(dir)).toEqual([".gitattributes is missing"]);
    dir = cleanTree();
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        ...rootPackage(),
        scripts: { learn: "node learn/app.mjs", check: "x" },
        dependencies: { hono: "1" },
      }),
    );
    expect(layoutProblems(dir)).toHaveLength(2);
    dir = cleanTree();
    writeFileSync(
      join(dir, "project/package.json"),
      JSON.stringify({
        scripts: { test: "x", check: "node checks/run.mjs", linkcheck: "x" },
      }),
    );
    expect(layoutProblems(dir)).toHaveLength(1);
  });
});

describe("assembleTemplate", () => {
  const inputs = fixtureInputs(pagesIndex);
  let a = "";
  let b = "";
  beforeAll(async () => {
    const base = tempDir("quest-tpl-");
    a = join(base, "a");
    b = join(base, "b");
    for (const outDir of [a, b])
      await assembleTemplate({
        repoRoot,
        outDir,
        inputs,
        writeNotices: stubNotices,
      });
  });

  test("two runs give byte-identical trees", () => {
    expect(tree(a)).toEqual(tree(b));
  });

  test("no file holds the repository path or an output path", () => {
    for (const body of Object.values(tree(a))) {
      const text = Buffer.from(body, "base64");
      for (const at of [repoRoot.replace(/\/$/, ""), a, b])
        expect(text.includes(at)).toBe(false);
    }
  });

  test("the Starter project is wholly in project/, the answers outside it", () => {
    expect(readdirSync(join(a, "project")).sort()).toEqual([
      ".gitignore",
      "LICENSE",
      "package-lock.json",
      "package.json",
      "practice",
      "samples",
      "src",
      "test",
    ]);
    for (const at of ["checks", "capstone", "learn"])
      expect(existsSync(join(a, at)), at).toBe(true);
    expect(existsSync(join(a, "checks/test"))).toBe(false);
    expect(existsSync(join(a, "learn/lessons"))).toBe(false);
    expect(readFileSync(join(a, ".gitignore"), "utf8")).toBe(
      ".practice/\nnode_modules/\n",
    );
  });

  test("learn/ ships the release course, its README and the notices", () => {
    expect(readFileSync(join(a, "learn/course.json"), "utf8")).toBe(
      '{"from":"release"}\n',
    );
    expect(readFileSync(join(a, "learn/README.md"), "utf8")).toBe(
      learnReadme(REF),
    );
    expect(readFileSync(join(a, "learn/THIRD-PARTY-NOTICES.txt"), "utf8")).toBe(
      "notices\n",
    );
  });

  test("refuses an output folder that is not empty", async () => {
    await expect(
      assembleTemplate({
        repoRoot,
        outDir: a,
        inputs,
        writeNotices: stubNotices,
      }),
    ).rejects.toThrow(/is not empty/);
  });

  test("asks for a build when an input is missing", async () => {
    await expect(
      assembleTemplate({
        repoRoot,
        outDir: join(tempDir("quest-tpl-"), "out"),
        inputs: { ...inputs, releaseCourse: join(tempDir("x-"), "none.json") },
        writeNotices: stubNotices,
      }),
    ).rejects.toThrow(/Run npm run build first/);
  });

  test("fails when learn/app.mjs loads a package", async () => {
    const learnDir = fixtureLearn();
    writeFileSync(join(learnDir, "app.mjs"), 'import { Hono } from "hono";\n');
    await expect(
      assembleTemplate({
        repoRoot,
        outDir: join(tempDir("quest-tpl-"), "out"),
        inputs: { ...inputs, learnDir },
        writeNotices: stubNotices,
      }),
    ).rejects.toThrow(/learn\/app\.mjs loads hono/);
  });
});

// The server's Vite config sits outside this project's TypeScript program,
// so it is loaded by a computed specifier with the shape it is used by.
type ServerConfig = {
  serverBuild(options: {
    clientDir: string;
    pagesDir: string;
    outDir: string;
    checkFresh: boolean;
  }): Record<string, unknown>;
  serverRoot: string;
};
type RunCheckConfig = {
  runCheckBuild(options: { outDir: string }): Record<string, unknown>;
};

describe("a tree from a real server bundle", () => {
  let made = "";
  let out = "";
  beforeAll(async () => {
    const { build } = await import("vite");
    const server = (await import(
      /* @vite-ignore */ join(repoRoot, "quest/server/vite.config.ts")
    )) as ServerConfig;
    const runCheck = (await import(
      /* @vite-ignore */ join(repoRoot, "quest/server/vite.run-check.config.ts")
    )) as RunCheckConfig;
    const client = tempDir("quest-client-");
    writeFileSync(
      join(client, "index.html"),
      "<!doctype html><title>Quest</title>",
    );
    const pages = tempDir("quest-pages-");
    writeFileSync(join(pages, "index.json"), `${JSON.stringify(pagesIndex)}\n`);
    mkdirSync(join(server.serverRoot, "dist"), { recursive: true });
    made = mkdtempSync(join(server.serverRoot, "dist/template-test-"));
    const learnDir = join(made, "learn");
    await build({
      ...server.serverBuild({
        clientDir: client,
        pagesDir: pages,
        outDir: learnDir,
        checkFresh: false,
      }),
      configFile: false,
    });
    await build({
      ...runCheck.runCheckBuild({ outDir: learnDir }),
      configFile: false,
    });
    out = join(tempDir("quest-tpl-real-"), "copy");
    const { writeNotices } = await import("../src/licenses");
    await assembleTemplate({
      repoRoot,
      outDir: out,
      inputs: {
        learnDir,
        pagesIndexFile: join(pages, "index.json"),
        releaseCourse: join(repoRoot, "quest/engine/dist/course.json"),
      },
      writeNotices,
    });
  }, 120_000);
  afterAll(() => {
    if (made) rmSync(made, { recursive: true, force: true });
  });

  test("ships the real notices", () => {
    expect(
      readFileSync(join(out, "learn/THIRD-PARTY-NOTICES.txt"), "utf8").length,
    ).toBeGreaterThan(0);
  });

  test("npm run learn serves on 127.0.0.1 with no node_modules and stops on SIGTERM", async () => {
    expect(existsSync(join(out, "node_modules"))).toBe(false);
    const child = spawn("npm", ["run", "--silent", "learn"], {
      cwd: out,
      env: { ...process.env, QUEST_BASE_PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = new Promise<number | null>((done) =>
      child.on("exit", (code) => {
        done(code);
      }),
    );
    let stdout = "";
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    const address = await new Promise<string>((done, fail) => {
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        const match = /http:\/\/127\.0\.0\.1:(\d+)/.exec(stdout);
        if (match) done(match[0]);
      });
      void exited.then((code) => {
        fail(
          new Error(
            `exited ${String(code)} before listening.\n${stdout}\n${stderr}`,
          ),
        );
      });
    });
    const health = await fetch(`${address}/api/health`);
    expect(health.status).toBe(200);
    const page = await fetch(`${address}/`);
    await page.arrayBuffer();
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toMatch(/^text\/html/);
    child.kill("SIGTERM");
    expect(await exited).toBe(0);
  }, 30_000);
});
