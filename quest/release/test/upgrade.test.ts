// The upgrade proof's parts, and its runner end to end in bash on a small
// copy in the old layout against a template assembled from stand-in inputs.
// The run against the real Terminal app commit, and in PowerShell, is
// `npm run upgrade:verify`, which the template job runs on every platform.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { TEMPLATE_REMOTE } from "../src/publish.mjs";
import { assembleTemplate } from "../src/template.mjs";
import {
  insteadOf,
  mapPaths,
  readmeCommands,
  runUpgradeProof,
  shellScript,
} from "../src/upgrade.mjs";
import { removeTemp, repoRoot, tempDir } from "./pages-fixture";
import {
  REF,
  fixtureInputs,
  lessonPages,
  stubNotices,
} from "./template-fixture";

afterAll(removeTemp);

const section = (block: string) =>
  `## Try it now\n\n\`\`\`bash\nnpm run learn\n\`\`\`\n\n## Already have a practice copy?\n\n${block}\n## Help that fades as you learn\n`;

test("README's section must hold one shell block that fetches the template", () => {
  expect(readmeCommands(section("No commands.\n")).problems).toEqual([
    "README's #already-have-a-practice-copy holds 0 code blocks, not one",
  ]);
  const one = "```shell\ngit fetch x\n```\n";
  expect(readmeCommands(section(`${one}${one}`)).ok).toBe(false);
  expect(readmeCommands(section(one)).problems).toEqual([
    `its first line does not fetch ${TEMPLATE_REMOTE}`,
  ]);
  expect(
    readmeCommands(
      section(`\`\`\`bash\ngit fetch ${TEMPLATE_REMOTE} main\n\`\`\`\n`),
    ).problems,
  ).toEqual(["its block is `bash`, not `shell`"]);
  const good = readmeCommands(
    section(
      `\`\`\`shell\ngit fetch ${TEMPLATE_REMOTE} main\n\nnode checks/upgrade.mjs\n\`\`\`\n`,
    ),
  );
  expect(good).toEqual({
    ok: true,
    problems: [],
    lines: [`git fetch ${TEMPLATE_REMOTE} main`, "node checks/upgrade.mjs"],
  });
});

test("the guide's README passes its own section's check", () => {
  const r = readmeCommands(readFileSync(join(repoRoot, "README.md"), "utf8"));
  expect(r.problems).toEqual([]);
  expect(r.lines.at(-1)).toBe("node checks/upgrade.mjs");
});

test("the template's URL is sent to the local repository as a file: URL", () => {
  const [key, value] = insteadOf(join(repoRoot, "x"));
  expect(key).toMatch(/^url\.file:\/\/.*\/x\.insteadOf$/);
  expect(value).toBe(TEMPLATE_REMOTE);
});

test("the path map refuses two paths on one target and an old path overwritten", () => {
  expect(
    mapPaths([
      "src/a.js",
      ".practice/learn.json",
      ".practice/b-2-plan.txt",
      "notes.md",
    ]),
  ).toEqual({
    map: {
      "src/a.js": "project/src/a.js",
      ".practice/learn.json": ".practice/learn.json",
      ".practice/b-2-plan.txt": "project/.practice/b-2-plan.txt",
      "notes.md": "notes.md",
    },
    problems: [],
  });
  expect(mapPaths(["src/a.js", "project/src/a.js"]).problems).toEqual([
    "src/a.js would overwrite project/src/a.js",
    "two paths would move to project/src/a.js",
  ]);
});

test("the PowerShell script stops at the first native command that fails", () => {
  expect(shellScript(["git fetch x", "node y"], "pwsh")).toBe(
    "git fetch x\nif ($LASTEXITCODE) { exit $LASTEXITCODE }\nnode y\nif ($LASTEXITCODE) { exit $LASTEXITCODE }\nexit 0\n",
  );
  expect(shellScript(["git fetch x", "node y"], "bash")).toBe(
    "set -e\ngit fetch x\nnode y\n",
  );
});

const OLD = {
  "src/a.js": "export const a = 1;\n",
  "test/a.test.js": "// a test\n",
  "practice/b-1/onboarding.md": "# Onboarding\n",
  LICENSE: "MIT\n",
  "package.json": `${JSON.stringify(
    {
      name: "claude-code-practice",
      private: true,
      scripts: {
        "test:checks": "node --test",
        check: "node checks/run.mjs",
        learn: "node learn/app.mjs",
      },
    },
    null,
    2,
  )}\n`,
  ".gitignore": ".practice/\nnode_modules/\n",
  "checks/run.mjs": "// old\n",
  "checks/test/run.test.mjs": "// old\n",
  "learn/app.mjs": "// old\n",
  "learn/lessons/b-1.md": "old\n",
  "capstone/beginner-bug.md": "old\n",
  ".github/workflows/assert-checks.yml": "old\n",
  ".github/workflows/progress.yml": "old\n",
  ".devcontainer/devcontainer.json": "{}\n",
  "README.md": "# My copy\n",
};

test("README's commands upgrade a copy in the old layout in bash, every Learner file at its new path", async () => {
  const tree = join(tempDir("quest-upgrade-tpl-"), "tpl");
  await assembleTemplate({
    repoRoot,
    outDir: tree,
    inputs: fixtureInputs(lessonPages(REF)),
    writeNotices: stubNotices,
  });
  const old = tempDir("quest-upgrade-old-");
  for (const [path, text] of Object.entries(OLD)) {
    mkdirSync(dirname(join(old, path)), { recursive: true });
    writeFileSync(join(old, path), text);
  }
  const git = (...argv: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@t",
        "-c",
        "core.excludesFile=",
        ...argv,
      ],
      { cwd: old, stdio: "ignore" },
    );
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "old");
  const lines: string[] = [];
  const results = await runUpgradeProof({
    repoRoot,
    template: tree,
    log: (l) => lines.push(l),
    steps: {
      startCopy: ({ copy, env }) => {
        execFileSync("git", ["clone", "-q", old, copy], {
          env,
          stdio: "ignore",
        });
        return { ok: true, problems: [] };
      },
      // The stand-in app does not serve, and the Starter project here has
      // no lockfile: both run for real in npm run upgrade:verify.
      checkRuns: () => ({ ok: true, problems: [] }),
      learnResumes: () => Promise.resolve({ ok: true, problems: [] }),
    },
  });
  expect(
    results.filter((r) => !r.ok).map((r) => [r.n, r.problems]),
    lines.join("\n"),
  ).toEqual([]);
  expect(lines.at(-1)).toBe("upgrade (bash): 8 of 8 passed");
}, 90_000);

test("with no --from, as in CI, the old copy comes from the legacy remote over https, and only later steps are held to file:", async () => {
  const legacy = JSON.parse(
    readFileSync(join(repoRoot, "course/legacy-fingerprints.json"), "utf8"),
  ) as { template: string; commit: string };
  const seen: {
    from?: string;
    fetch?: string | undefined;
    later?: string | undefined;
  } = {};
  const lines: string[] = [];
  const exitCode = process.exitCode;
  await runUpgradeProof({
    repoRoot,
    template: tempDir("quest-upgrade-none-"),
    log: (l) => lines.push(l),
    steps: {
      startCopy: ({ from, commit, env }) => {
        seen.from = from;
        seen.fetch = env.GIT_ALLOW_PROTOCOL;
        expect(commit).toBe(legacy.commit);
        return { ok: true, problems: [] };
      },
      templateRepo: ({ env }) => {
        seen.later = env.GIT_ALLOW_PROTOCOL;
        return { ok: false, problems: ["stop here"], commit: "" };
      },
    },
  });
  process.exitCode = exitCode;
  expect(seen.from).toBe(legacy.template);
  expect(legacy.template.startsWith("https://")).toBe(true);
  // git takes an unset GIT_ALLOW_PROTOCOL as every protocol allowed.
  expect(
    seen.fetch === undefined || seen.fetch.split(":").includes("https"),
  ).toBe(true);
  expect(seen.later).toBe("file");
});
