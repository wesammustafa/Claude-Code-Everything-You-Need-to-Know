import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import {
  NOTICES_FILE,
  licenseAllowed,
  licenseProblems,
  renderNotices,
  shippedPackages,
  writeNotices,
} from "../src/licenses";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const fixture = fileURLToPath(new URL("fixtures/project/", import.meta.url));

// The fixture keeps its installed packages outside node_modules (which git
// ignores) and is laid out at the lockfile's paths in a temporary folder.
// app depends on gpl-lib (GPL, direct), ok-lib, the linked workspace shared,
// and optionally on opt-lib (installed) and opt-absent (not installed).
// ok-lib -> inner@2 (nested; a GPL inner@1 is hoisted beside it) and mid-lib;
// mid-lib -> deep-gpl (GPL, three levels down) and bare-lib (no license file);
// shared -> shared-dep. dev-tool is a GPL devDependency.
const LAYOUT: Record<string, string> = {
  "packages/ok-lib": "node_modules/ok-lib",
  "packages/inner": "node_modules/ok-lib/node_modules/inner",
  "packages/stray": "node_modules/inner",
  "packages/gpl-lib": "node_modules/gpl-lib",
  "packages/dev-tool": "node_modules/dev-tool",
  "packages/mid-lib": "node_modules/mid-lib",
  "packages/deep-gpl": "node_modules/deep-gpl",
  "packages/bare-lib": "node_modules/bare-lib",
  "packages/opt-lib": "node_modules/opt-lib",
  "packages/shared-dep": "node_modules/shared-dep",
  app: "app",
  shared: "shared",
};

const FIXTURE = { workspaces: ["app"], bundlerRuntime: [] };

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function installFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "quest-licenses-"));
  temps.push(root);
  cpSync(join(fixture, "package-lock.json"), join(root, "package-lock.json"));
  for (const [from, to] of Object.entries(LAYOUT)) {
    cpSync(join(fixture, from), join(root, to), { recursive: true });
  }
  return root;
}

describe("licenseAllowed", () => {
  test.each([
    "MIT",
    "ISC",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "Apache-2.0",
    "OFL-1.1",
  ])("allows %s", (license) => {
    expect(licenseAllowed(license)).toBe(true);
  });

  test.each([
    ["(MIT OR GPL-3.0-only)", true],
    ["(GPL-3.0-only OR Apache-2.0)", true],
    ["(MIT AND ISC)", true],
    ["(MIT AND GPL-3.0-only)", false],
    ["MIT AND (ISC OR GPL-2.0-only)", true],
    ["GPL-3.0-only", false],
    ["LGPL-2.1-or-later", false],
    ["MPL-2.0", false],
    ["GPL-2.0-only WITH Classpath-exception-2.0", false],
    ["Apache-2.0 WITH LLVM-exception", false],
    ["UNLICENSED", false],
    ["SEE LICENSE IN LICENSE.txt", false],
    ["(MIT", false],
    ["", false],
  ])("reads %s as allowed: %s", (license, allowed) => {
    expect(licenseAllowed(license)).toBe(allowed);
  });

  test("refuses a package with no license", () => {
    expect(licenseAllowed(undefined)).toBe(false);
  });
});

describe("the shipped set", () => {
  test("follows production dependencies with Node's lookup order and leaves dev tools out", () => {
    const root = installFixture();
    const shipped = shippedPackages(root, FIXTURE);
    // Every level down, installed optional dependencies, and a linked
    // workspace's dependencies (not the workspace itself, which is first-party).
    expect(shipped.map((p) => `${p.name}@${p.version}`)).toEqual([
      "bare-lib@1.0.0",
      "deep-gpl@1.0.0",
      "gpl-lib@1.0.0",
      "inner@2.0.0",
      "mid-lib@1.0.0",
      "ok-lib@1.0.0",
      "opt-lib@1.0.0",
      "shared-dep@1.0.0",
    ]);
    expect(shipped.find((p) => p.name === "inner")?.path).toBe(
      "node_modules/ok-lib/node_modules/inner",
    );
  });

  test("fails on a GPL package at any depth, and on one with no license file", () => {
    const root = installFixture();
    const problems = licenseProblems(root, shippedPackages(root, FIXTURE));
    expect(problems).toEqual([
      {
        name: "bare-lib",
        version: "1.0.0",
        license: "MIT",
        reason: "no license file to credit in the notices",
      },
      {
        name: "deep-gpl",
        version: "1.0.0",
        license: "GPL-3.0-or-later",
        reason: "license GPL-3.0-or-later is not on the allowlist",
      },
      {
        name: "gpl-lib",
        version: "1.0.0",
        license: "GPL-3.0-only",
        reason: "license GPL-3.0-only is not on the allowlist",
      },
    ]);
    expect(() =>
      writeNotices(root, join(root, "NOTICES.txt"), FIXTURE),
    ).toThrow(/gpl-lib 1\.0\.0: license GPL-3\.0-only is not on the allowlist/);
  });

  test("writes the notices once every shipped package passes", () => {
    const root = installFixture();
    const out = join(root, "NOTICES.txt");
    // Only the clean branch: shared's dependencies.
    const shipped = writeNotices(root, out, {
      workspaces: ["shared"],
      bundlerRuntime: [],
    });
    expect(shipped.map((p) => p.name)).toEqual(["shared-dep"]);
    const notices = readFileSync(out, "utf8");
    expect(notices).toContain(
      "\nshared-dep 1.0.0\nLicense: MIT\n\n--- LICENSE ---\nMIT License\n",
    );
    // The notices of code a package copied in travel with it too; a folder
    // named like a license file is skipped.
    expect(notices).toContain(
      "\n--- THIRD-PARTY-LICENSE ---\nNotices for the code shared-dep copied in.\n",
    );
    expect(notices).toContain("Copyright (c) 2020 Copied Code Author");
    expect(notices).not.toContain("--- LICENSES ---");
  });

  test("ships a bundler's own files but not the packages it builds with", () => {
    const root = installFixture();
    const shipped = shippedPackages(root, {
      workspaces: [],
      bundlerRuntime: ["mid-lib"],
    });
    expect(shipped.map((p) => p.name)).toEqual(["mid-lib"]);
  });

  test("fails on a workspace the lockfile does not hold", () => {
    const root = installFixture();
    expect(() =>
      shippedPackages(root, { workspaces: ["missing"], bundlerRuntime: [] }),
    ).toThrow(/no workspace missing/);
  });

  test("fails on a dependency the lockfile does not hold, but skips a missing optional one", () => {
    const root = installFixture();
    const lockFile = join(root, "package-lock.json");
    const lock = JSON.parse(readFileSync(lockFile, "utf8")) as {
      packages: Record<string, unknown>;
    };
    // opt-absent is already missing and skipped; drop a required package too.
    expect(lock.packages["node_modules/opt-absent"]).toBeUndefined();
    delete lock.packages["node_modules/deep-gpl"];
    writeFileSync(lockFile, JSON.stringify(lock));
    expect(() => shippedPackages(root, FIXTURE)).toThrow(
      "node_modules/mid-lib depends on deep-gpl, which the lockfile does not hold",
    );
  });

  test("fails on a bundler the lockfile does not hold", () => {
    const root = installFixture();
    expect(() =>
      shippedPackages(root, { workspaces: [], bundlerRuntime: ["absent"] }),
    ).toThrow("The lockfile does not hold the bundler absent");
  });
});

describe("Claude Code Quest's bundled packages", () => {
  const shipped = shippedPackages(repoRoot);
  const names = shipped.map((p) => p.name);

  test("include the client's runtime and fonts, and no dev tool", () => {
    expect(names).toEqual(
      expect.arrayContaining([
        "react",
        "react-dom",
        "scheduler",
        "react-router",
        "@fontsource-variable/inter",
        "@fontsource-variable/jetbrains-mono",
        "tailwindcss",
        "rolldown",
      ]),
    );
    for (const devTool of [
      "vite",
      "vitest",
      "typescript",
      "@testing-library/react",
      "jsdom",
    ]) {
      expect(names).not.toContain(devTool);
    }
  });

  test("all carry a license on the allowlist, with fonts alone under OFL-1.1", () => {
    expect(licenseProblems(repoRoot, shipped)).toEqual([]);
    const ofl = shipped
      .filter((p) => p.license === "OFL-1.1")
      .map((p) => p.name);
    expect(ofl.every((name) => name.startsWith("@fontsource-variable/"))).toBe(
      true,
    );
  });

  test("are credited in the notices file", () => {
    const out = join(repoRoot, NOTICES_FILE);
    writeNotices(repoRoot, out);
    const notices = readFileSync(out, "utf8");
    for (const pkg of shipped) {
      expect(notices).toContain(
        `\n${pkg.name} ${pkg.version}\nLicense: ${pkg.license ?? ""}\n`,
      );
    }
    expect(notices).toContain("SIL Open Font License");
    expect(notices).toContain("Permission is hereby granted, free of charge");
  });

  test("credit every license and notice file each package ships, the bundler's third-party notices included", () => {
    const notices = renderNotices(repoRoot, shipped);
    const sections = notices.split(`\n${"=".repeat(78)}\n`);
    for (const pkg of shipped) {
      const section = sections.find((s) =>
        s.startsWith(`${pkg.name} ${pkg.version}\nLicense: `),
      );
      expect(section, pkg.name).toBeDefined();
      const files = readdirSync(join(repoRoot, pkg.path), {
        withFileTypes: true,
      })
        .filter((e) => e.isFile() && /licen[cs]e|notice|copying/i.test(e.name))
        .map((e) => e.name);
      for (const file of files) {
        expect(section, `${pkg.name}: ${file}`).toContain(`--- ${file} ---`);
      }
    }
    // Rolldown's runtime helpers derive from Rollup and esbuild, whose
    // notices it ships in THIRD-PARTY-LICENSE.
    const rolldown = sections.find((s) => s.startsWith("rolldown "));
    expect(rolldown).toContain("--- THIRD-PARTY-LICENSE ---");
    expect(rolldown).toContain("Copyright (c) 2020 Evan Wallace");
  });
});
