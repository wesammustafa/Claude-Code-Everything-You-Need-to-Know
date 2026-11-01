// @vitest-environment node
// The browser's one way to the engine's world is the contract's types: the
// contract compiles to nothing, a client file that names it keeps none of it
// once compiled, and no client file or dependency reaches the engine, the
// host or the server.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";

const quest = fileURLToPath(new URL("../../", import.meta.url));
const contract = join(quest, "contract/src");
const client = join(quest, "client");
const FORBIDDEN = ["engine", "host", "server"];

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return ["node_modules", "dist"].includes(entry.name)
        ? []
        : filesUnder(path);
    return /\.(ts|tsx|mts|cts|js|mjs)$/.test(entry.name) ? [path] : [];
  });
}

const transpile = (path: string): string =>
  ts.transpileModule(readFileSync(path, "utf8"), {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2024,
      jsx: ts.JsxEmit.ReactJSX,
      verbatimModuleSyntax: true,
      removeComments: true,
    },
  }).outputText;

// Every module a file names: imports, re-exports and dynamic imports.
const specifiers = (path: string): string[] =>
  ts
    .preProcessFile(readFileSync(path, "utf8"), true, true)
    .importedFiles.map((f) => f.fileName);

describe("the contract", () => {
  const files = readdirSync(contract).filter((f) => f.endsWith(".ts"));

  test("holds its five modules and the barrel", () => {
    expect(files.sort()).toEqual([
      "actions.ts",
      "common.ts",
      "events.ts",
      "index.ts",
      "live.ts",
      "snapshot.ts",
    ]);
  });

  test.each(files)("%s compiles to no code at all", (file) => {
    expect(transpile(join(contract, file)).trim()).toBe("export {};");
  });

  test.each(files)(
    "%s names only its siblings, and only their types",
    (file) => {
      const text = readFileSync(join(contract, file), "utf8");
      for (const name of specifiers(join(contract, file)))
        expect(name, `${file} names ${name}`).toMatch(/^\.\/[a-z]+$/);
      const statements = text.match(
        /^(?:import|export)\b[^;]*?\bfrom\s+["'][^"']+["']/gms,
      );
      for (const s of statements ?? [])
        expect(s, `${file}: ${s}`).toMatch(/^(?:import|export) type\b/);
    },
  );
});

describe("the client", () => {
  const files = filesUnder(client);

  test("names the contract only for its types: nothing of it stays once compiled", () => {
    const naming = files.filter((path) =>
      specifiers(path).includes("@quest/contract"),
    );
    expect(naming.length).toBeGreaterThan(0);
    for (const path of naming)
      expect(transpile(path), relative(quest, path)).not.toContain(
        "@quest/contract",
      );
  });

  test("names no engine, host or server module, by package or by path", () => {
    const named = new RegExp(`^@quest/(?:${FORBIDDEN.join("|")})(?:/|$)`);
    const folders = FORBIDDEN.map((name) => join(quest, name));
    for (const path of files)
      for (const name of specifiers(path)) {
        const where = `${relative(quest, path)} names ${name}`;
        expect(name, where).not.toMatch(named);
        if (!name.startsWith(".")) continue;
        const to = resolve(dirname(path), name);
        for (const folder of folders)
          expect(relative(folder, to).startsWith(".."), where).toBe(true);
      }
  });

  test("depends on no engine, host or server package", () => {
    const pkg = JSON.parse(
      readFileSync(join(client, "package.json"), "utf8"),
    ) as Record<string, unknown>;
    const deps = ["dependencies", "devDependencies", "peerDependencies"]
      .flatMap((k) => Object.keys((pkg[k] ?? {}) as Record<string, string>))
      .filter((name) => name.startsWith("@quest/"));
    expect(deps).toEqual(["@quest/contract"]);
  });
});
