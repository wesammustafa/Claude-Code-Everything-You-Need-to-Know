import {
  cpSync,
  existsSync,
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
  EMBEDDED_NOTICES,
  NOTICES_FILE,
  SUPPLIED_LICENSES,
  licenseAllowed,
  licenseProblems,
  renderNotices,
  shippedPackages,
  writeNotices,
  type EmbeddedNotices,
  type ShippedPackage,
  type SuppliedLicense,
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

// Each package's part of the notices, by name and version: from its header to
// the next package's. A license text may hold a rule of = signs of its own
// (Emscripten's does), so the rule alone does not end a part.
function sectionsOf(
  notices: string,
  shipped: readonly ShippedPackage[],
): Map<string, string> {
  const rule = `\n${"=".repeat(78)}\n`;
  const starts = shipped.map((pkg) => {
    const at = notices.indexOf(`${rule}${pkg.name} ${pkg.version}\nLicense: `);
    expect(at, `${pkg.name} ${pkg.version} has a part`).toBeGreaterThan(-1);
    return at;
  });
  return new Map(
    shipped.map((pkg, i) => [
      `${pkg.name} ${pkg.version}`,
      notices.slice(
        (starts[i] ?? 0) + rule.length,
        starts[i + 1] ?? notices.length,
      ),
    ]),
  );
}

describe("licenseAllowed", () => {
  test.each([
    "MIT",
    "ISC",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "Apache-2.0",
    "OFL-1.1",
    "MIT-Modern-Variant",
    "MIT-0",
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
    ["Unlicense", false],
    ["Unlicense OR MIT-0", true],
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

  describe("a license text supplied for a package published without one", () => {
    const source = "https://example.test/bare-lib/blob/abc123/LICENSE";
    // bare-lib@1.0.0 ships no license file; its text is kept in the repo.
    function text(root: string): SuppliedLicense {
      writeFileSync(
        join(root, "bare-lib.LICENSE"),
        "MIT License\r\n\r\nBare.\n",
      );
      return { file: "bare-lib.LICENSE", source };
    }
    const supply = (root: string, key = "bare-lib@1.0.0") => ({
      [key]: text(root),
    });
    const problemsFor = (
      root: string,
      supplied: Record<string, SuppliedLicense>,
      name: string,
    ) =>
      licenseProblems(root, shippedPackages(root, FIXTURE), supplied).filter(
        (p) => p.name === name,
      );

    test("credits the package in the notices, naming where the text came from", () => {
      const root = installFixture();
      const supplied = supply(root);
      expect(problemsFor(root, supplied, "bare-lib")).toEqual([]);
      const notices = renderNotices(
        root,
        shippedPackages(root, FIXTURE),
        supplied,
      );
      expect(notices).toContain(
        `\nbare-lib 1.0.0\nLicense: MIT\n\n--- LICENSE (from ${source}) ---\nMIT License\n\nBare.\n`,
      );
    });

    test("matches the exact version only", () => {
      const root = installFixture();
      expect(
        problemsFor(root, supply(root, "bare-lib@1.0.1"), "bare-lib"),
      ).toEqual([
        {
          name: "bare-lib",
          version: "1.0.0",
          license: "MIT",
          reason: "no license file to credit in the notices",
        },
      ]);
    });

    test("fails when the supplied text is missing", () => {
      const root = installFixture();
      const supplied = supply(root);
      rmSync(join(root, "bare-lib.LICENSE"));
      expect(problemsFor(root, supplied, "bare-lib")).toEqual([
        expect.objectContaining({
          reason: "its supplied license text bare-lib.LICENSE is missing",
        }),
      ]);
    });

    test("fails once the package ships its own text, so the supplied one is removed", () => {
      const root = installFixture();
      const supplied = { "ok-lib@1.0.0": text(root) };
      expect(problemsFor(root, supplied, "ok-lib")).toEqual([
        expect.objectContaining({
          reason:
            "ships its own license file, so its supplied text bare-lib.LICENSE is no longer needed",
        }),
      ]);
    });

    test("never excuses a license outside the allowlist", () => {
      const root = installFixture();
      const supplied = { "gpl-lib@1.0.0": text(root) };
      expect(problemsFor(root, supplied, "gpl-lib")).toEqual([
        expect.objectContaining({
          reason: "license GPL-3.0-only is not on the allowlist",
        }),
      ]);
    });
  });

  describe("notices for code a package compiled or copied into its files", () => {
    const source = "https://example.test/vendored/blob/def456/LICENSE";
    // ok-lib@1.0.0 ships its own MIT text, and carries a vendored library too.
    function embed(
      root: string,
      version = "1.0.0",
      license = "ISC",
    ): Record<string, EmbeddedNotices> {
      writeFileSync(
        join(root, "vendored.LICENSE"),
        "ISC License\r\n\r\nCopyright (c) 2024 Vendored Author\n",
      );
      return {
        "ok-lib": {
          version,
          notices: [
            {
              project: "Vendored",
              license,
              file: "vendored.LICENSE",
              source,
            },
          ],
        },
      };
    }
    const problemsFor = (
      root: string,
      embedded: Record<string, EmbeddedNotices>,
    ) =>
      licenseProblems(
        root,
        shippedPackages(root, FIXTURE),
        {},
        embedded,
      ).filter((p) => p.name === "ok-lib");

    test("credits each one under the package, after its own license", () => {
      const root = installFixture();
      const embedded = embed(root);
      expect(problemsFor(root, embedded)).toEqual([]);
      const notices = renderNotices(
        root,
        shippedPackages(root, FIXTURE),
        {},
        embedded,
      );
      const section = notices
        .split(`\n${"=".repeat(78)}\n`)
        .find((s) => s.startsWith("ok-lib 1.0.0\n"));
      expect(section).toContain(`--- LICENSE ---\nMIT License\n`);
      expect(section).toContain(
        `It carries code from the projects below, compiled or copied into its files.\n\n--- Vendored, ISC (from ${source}) ---\nISC License\n\nCopyright (c) 2024 Vendored Author\n`,
      );
      expect(section?.indexOf("--- LICENSE ---")).toBeLessThan(
        section?.indexOf("--- Vendored") ?? -1,
      );
    });

    test("fails once the package's version moves on, until they are gathered again", () => {
      const root = installFixture();
      expect(problemsFor(root, embed(root, "0.9.0"))).toEqual([
        {
          name: "ok-lib",
          version: "1.0.0",
          license: "MIT",
          reason:
            "the notices for the code compiled or copied into it were gathered for 0.9.0; gather them again for 1.0.0",
        },
      ]);
      // Never credited for the wrong version.
      expect(
        renderNotices(
          root,
          shippedPackages(root, FIXTURE),
          {},
          embed(root, "0.9.0"),
        ),
      ).not.toContain("Vendored");
    });

    test("holds each one to the allowlist, however its package is licensed", () => {
      const root = installFixture();
      const reason = (license: string) =>
        `the Vendored code compiled or copied into it is under ${license}, which is not on the allowlist`;
      expect(problemsFor(root, embed(root, "1.0.0", "GPL-3.0-only"))).toEqual([
        {
          name: "ok-lib",
          version: "1.0.0",
          license: "MIT",
          reason: reason("GPL-3.0-only"),
        },
      ]);
      // A permissive license the allowlist does not name fails too.
      expect(problemsFor(root, embed(root, "1.0.0", "Unlicense"))).toEqual([
        expect.objectContaining({ reason: reason("Unlicense") }),
      ]);
      expect(
        problemsFor(root, embed(root, "1.0.0", "Unlicense OR MIT-0")),
      ).toEqual([]);
      expect(() =>
        writeNotices(root, join(root, "NOTICES.txt"), {
          ...FIXTURE,
          supplied: {},
          embedded: embed(root, "1.0.0", "GPL-3.0-only"),
        }),
      ).toThrow(/ok-lib 1\.0\.0: the Vendored code .* GPL-3\.0-only/);
    });

    test("fails when a notice's text is missing", () => {
      const root = installFixture();
      const embedded = embed(root);
      rmSync(join(root, "vendored.LICENSE"));
      expect(problemsFor(root, embedded)).toEqual([
        expect.objectContaining({
          reason: "the Vendored notice vendored.LICENSE is missing",
        }),
      ]);
    });
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

  test("include the client's runtime and fonts, the server's, and no dev tool", () => {
    expect(names).toEqual(
      expect.arrayContaining([
        "hono",
        "@hono/node-server",
        "zod",
        "react",
        "react-dom",
        "scheduler",
        "react-router",
        "@rive-app/react-webgl2",
        "@rive-app/webgl2",
        "@fontsource-variable/inter",
        "@fontsource-variable/jetbrains-mono",
        "tailwindcss",
        "motion",
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

  test("supply a text only for a shipped package at its exact version that ships none", () => {
    for (const [key, text] of Object.entries(SUPPLIED_LICENSES)) {
      const pkg = shipped.find((p) => `${p.name}@${p.version}` === key);
      expect(pkg, `${key} is shipped at that version`).toBeDefined();
      expect(existsSync(join(repoRoot, text.file)), text.file).toBe(true);
      expect(text.source).toMatch(
        /^https:\/\/github\.com\/[\w-]+\/[\w-]+\/blob\/[0-9a-f]{40}\//,
      );
    }
  });

  test("embed notices only for a shipped package at its exact version, each kept in the repo with its pinned source and under a license on the allowlist", () => {
    for (const [name, inside] of Object.entries(EMBEDDED_NOTICES)) {
      const pkg = shipped.find((p) => p.name === name);
      expect(pkg?.version, `${name} is shipped at ${inside.version}`).toBe(
        inside.version,
      );
      expect(inside.notices.length).toBeGreaterThan(0);
      for (const notice of inside.notices) {
        expect(existsSync(join(repoRoot, notice.file)), notice.file).toBe(true);
        expect(licenseAllowed(notice.license), notice.project).toBe(true);
        expect(notice.source).toMatch(
          /^https:\/\/github\.com\/[\w-]+\/[\w-]+\/blob\/[0-9a-f]{40}\//,
        );
      }
    }
  });

  test("credit the libraries compiled into Rive's WASM and the code copied into its JavaScript", () => {
    const sections = sectionsOf(renderNotices(repoRoot, shipped), shipped);
    const webgl2 = shipped.find((p) => p.name === "@rive-app/webgl2");
    const rive = sections.get(`${webgl2?.name ?? ""} ${webgl2?.version ?? ""}`);
    expect(rive).toBeDefined();
    for (const holder of [
      "Copyright (c) 2020-2021 Rive",
      "Copyright (c) 2020 Rive",
      "Copyright (c) 2011 Google Inc.",
      'HarfBuzz is licensed under the so-called "Old MIT" license.',
      "Copyright (c) Microsoft Corporation.",
      "Apache License",
      "Copyright (c) Facebook, Inc. and its affiliates.",
      "Copyright (c) 2019-2025 Roblox Corporation",
      "Lua.org, PUC-Rio.",
      "Frank Denis",
      "Public Domain (www.unlicense.org)",
      "Emscripten is available under 2 licenses",
      "Rich Felker, et al.",
      "Copyright (c) 2017 Braintree",
    ]) {
      expect(rive, holder).toContain(holder);
    }
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
    const sections = sectionsOf(renderNotices(repoRoot, shipped), shipped);
    for (const pkg of shipped) {
      const section = sections.get(`${pkg.name} ${pkg.version}`);
      expect(section, pkg.name).toBeDefined();
      const files = readdirSync(join(repoRoot, pkg.path), {
        withFileTypes: true,
      })
        .filter((e) => e.isFile() && /licen[cs]e|notice|copying/i.test(e.name))
        .map((e) => e.name);
      for (const file of files) {
        expect(section, `${pkg.name}: ${file}`).toContain(`--- ${file} ---`);
      }
      const text = SUPPLIED_LICENSES[`${pkg.name}@${pkg.version}`];
      if (files.length === 0) {
        expect(text, `${pkg.name} ships no license file`).toBeDefined();
        expect(section).toContain(
          `--- LICENSE (from ${text?.source ?? ""}) ---`,
        );
      }
    }
    // Rolldown's runtime helpers derive from Rollup and esbuild, whose
    // notices it ships in THIRD-PARTY-LICENSE.
    const rolldown = [...sections].find(([key]) =>
      key.startsWith("rolldown "),
    )?.[1];
    expect(rolldown).toContain("--- THIRD-PARTY-LICENSE ---");
    expect(rolldown).toContain("Copyright (c) 2020 Evan Wallace");
  });
});
