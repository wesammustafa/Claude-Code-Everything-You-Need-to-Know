// @vitest-environment node
import tailwindcss from "@tailwindcss/vite";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Rolldown } from "vite";
import { afterEach, describe, expect, test } from "vitest";
import {
  cssPulls,
  packageAt,
  packageOf,
  shippedPackagesOnly,
  type AllowedPackage,
} from "./shipped-packages";

// Fixture projects live under quest/client/dist (build output, never
// tracked), so `@import "tailwindcss"` resolves from the repo's node_modules
// while each fixture's own node_modules holds its fake packages.
const scratch = fileURLToPath(new URL("../dist/", import.meta.url));
const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(join(scratch, "shipped-test-"));
  temps.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const page = {
  "index.html":
    '<!doctype html><html><body><script type="module" src="/main.js"></script></body></html>',
  "main.js": 'import "./app.css";\n',
};

function fakePackage(
  name: string,
  css: string,
  at = `node_modules/${name}`,
): Record<string, string> {
  return {
    [`${at}/package.json`]: JSON.stringify({
      name,
      version: "1.0.0",
      license: "GPL-3.0-only",
    }),
    [`${at}/style.css`]: css,
  };
}

// Tailwind as the repo installs it, and a fixture's own packages by folder.
const tailwind: AllowedPackage = {
  name: "tailwindcss",
  dir: fileURLToPath(
    new URL("../../../node_modules/tailwindcss", import.meta.url),
  ),
};
const installed = (root: string, path: string): AllowedPackage => ({
  name: path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length),
  dir: join(root, path),
});

async function bundle(root: string, allowed: readonly AllowedPackage[]) {
  const output = await build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [tailwindcss(), shippedPackagesOnly(() => allowed)],
    build: { write: false, modulePreload: { polyfill: false } },
  });
  const outputs = (Array.isArray(output) ? output : [output]).flatMap(
    (o) => (o as Rolldown.RolldownOutput).output,
  );
  return outputs
    .filter((o) => o.type === "asset" && o.fileName.endsWith(".css"))
    .map((o) => String((o as Rolldown.OutputAsset).source))
    .join("\n");
}

describe("the build's shipped-packages check", () => {
  test("fails on a package stylesheet that a CSS @import inlines", async () => {
    const root = project({
      ...page,
      "app.css": '@import "tailwindcss";\n@import "fakecss/style.css";\n',
      ...fakePackage("fakecss", ".gplstyle { color: red; }\n"),
    });
    await expect(bundle(root, [tailwind])).rejects.toThrow(
      /outside quest\/client's dependencies: fakecss\b/,
    );
  });

  test("follows a package stylesheet's own @import to the next package", async () => {
    const root = project({
      ...page,
      "app.css": '@import "tailwindcss";\n@import "fakecss/style.css";\n',
      ...fakePackage("fakecss", '@import "deepcss/style.css";\n'),
      ...fakePackage("deepcss", ".deep { color: red; }\n"),
    });
    await expect(
      bundle(root, [tailwind, installed(root, "node_modules/fakecss")]),
    ).rejects.toThrow(/outside quest\/client's dependencies: deepcss\b/);
  });

  test("fails on a stylesheet import nothing resolves, rather than ship it unchecked", async () => {
    const root = project({
      ...page,
      "app.css": '@import "tailwindcss";\n@import "nowhere/style.css";\n',
    });
    await expect(bundle(root, [tailwind])).rejects.toThrow(
      /nowhere\/style\.css/,
    );
  });

  test("passes a stylesheet from an allowed package and ships it", async () => {
    const root = project({
      ...page,
      "app.css": '@import "tailwindcss";\n@import "fakecss/style.css";\n',
      ...fakePackage("fakecss", ".gplstyle { color: red; }\n"),
    });
    expect(
      await bundle(root, [tailwind, installed(root, "node_modules/fakecss")]),
    ).toContain(".gplstyle");
  });

  test("fails on a second installed copy of a shipped package's name", async () => {
    // The shipped fakecss is the copy nested under ok-lib; the stylesheet
    // pulls in the other one, hoisted to the top, which nothing counted.
    const root = project({
      ...page,
      "app.css": '@import "tailwindcss";\n@import "fakecss/style.css";\n',
      ...fakePackage("fakecss", ".hoisted { color: red; }\n"),
      ...fakePackage(
        "fakecss",
        ".nested { color: red; }\n",
        "node_modules/ok-lib/node_modules/fakecss",
      ),
    });
    await expect(
      bundle(root, [
        tailwind,
        installed(root, "node_modules/ok-lib/node_modules/fakecss"),
      ]),
    ).rejects.toThrow(
      /outside quest\/client's dependencies: fakecss \(node_modules\/fakecss\)/,
    );
  });
});

describe("reading the build's sources", () => {
  test("names the package a module comes from", () => {
    expect(packageOf("/repo/node_modules/react/index.js")).toBe("react");
    expect(
      packageOf(
        "C:\\repo\\node_modules\\@fontsource-variable\\inter\\opsz.css",
      ),
    ).toBe("@fontsource-variable/inter");
    expect(packageOf("/repo/node_modules/a/node_modules/b/x.css")).toBe("b");
    expect(packageOf("/repo/quest/client/src/main.tsx")).toBeUndefined();
  });

  test("finds the folder a module's package is installed in", () => {
    expect(packageAt("/repo/node_modules/a/node_modules/@s/b/x.css")).toEqual({
      name: "@s/b",
      dir: "/repo/node_modules/a/node_modules/@s/b",
    });
    expect(packageAt("C:\\repo\\node_modules\\react\\index.js")).toEqual({
      name: "react",
      dir: "C:/repo/node_modules/react",
    });
    expect(packageAt("/repo/quest/client/src/main.tsx")).toBeUndefined();
  });

  test("finds every stylesheet and plugin a stylesheet pulls in, and nothing in a comment", () => {
    expect(
      cssPulls(`
        @import "tailwindcss" source("../");
        @import './tokens.css' layer(theme);
        @import url("a.css");
        @import url(b.css);
        @plugin "some-plugin";
        @reference "not-shipped.css";
        /* @import "commented.css"; */
      `),
    ).toEqual([
      { kind: "css", spec: "tailwindcss" },
      { kind: "css", spec: "./tokens.css" },
      { kind: "css", spec: "a.css" },
      { kind: "css", spec: "b.css" },
      { kind: "js", spec: "some-plugin" },
    ]);
  });
});
