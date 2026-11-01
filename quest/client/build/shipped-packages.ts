// The build's own check that the client bundle holds code only from the
// packages the license test counts and the notices credit.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { createIdResolver, type Plugin } from "vite";

/** The package a bundled module or asset came from, or undefined for first-party code. */
export function packageOf(id: string): string | undefined {
  return packageAt(id)?.name;
}

/**
 * The package a bundled module or asset came from, with its folder: the path
 * up to and including its last `node_modules/<name>`, in forward slashes.
 */
export function packageAt(
  id: string,
): { name: string; dir: string } | undefined {
  const path = id.replaceAll("\\", "/");
  const at = `/${path}`.lastIndexOf("/node_modules/");
  if (at === -1) return undefined;
  const start = at + "node_modules/".length;
  const [scope, name] = path.slice(start).split("/");
  if (scope === undefined || scope === "") return undefined;
  const full =
    scope.startsWith("@") && name !== undefined ? `${scope}/${name}` : scope;
  return { name: full, dir: path.slice(0, start + full.length) };
}

/** A package the bundle may hold code from: its name, and the folder it is installed in. */
export interface AllowedPackage {
  name: string;
  dir: string;
}

// One spelling for a folder, so a path through a symlink (macOS's /tmp, a
// linked workspace) still matches the folder it points to.
function canonical(dir: string): string {
  const real = existsSync(dir) ? realpathSync.native(dir) : resolve(dir);
  return real.replaceAll("\\", "/");
}

// The stylesheets and plugins a stylesheet pulls in: `@import "x"`,
// `@import url("x")`, `@import url(x)` and Tailwind's `@plugin "x"` (whose
// generated CSS ships), comments left out. `@reference` adds no output.
const PULLS =
  /@(import|plugin)\s+(?:url\(\s*)?(["'])((?:(?!\2).)+)\2|@import\s+url\(\s*([^"')\s]+)\s*\)/g;

export function cssPulls(css: string): { kind: "css" | "js"; spec: string }[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...text.matchAll(PULLS)].flatMap((m) => {
    const spec = m[3] ?? m[4];
    if (spec === undefined) return [];
    return [
      { kind: m[1] === "plugin" ? ("js" as const) : ("css" as const), spec },
    ];
  });
}

/**
 * Fails the build when it bundles code or an asset (a font file, a
 * stylesheet) from a package outside `allowed()`, the shipped set the license
 * test checks and the notices credit. A package matches by the folder it is
 * installed in, not only its name, so a second installed copy of a shipped
 * package (another version, nested elsewhere) fails too. The bundle's own
 * record misses a stylesheet that a CSS `@import` inlines (Tailwind and Vite
 * fold it into the emitted CSS), so every stylesheet the build loads is
 * followed through its `@import`s and `@plugin`s too, resolved the way
 * Tailwind resolves them; one that cannot be resolved fails the build rather
 * than ship unchecked. Vite's
 * own helpers (the module preload polyfill, the dynamic import helper) count
 * as the package "vite" and fail.
 */
export function shippedPackagesOnly(
  allowed: () => readonly AllowedPackage[],
): Plugin {
  let root = process.cwd();
  let resolveCss: ReturnType<typeof createIdResolver> | undefined;
  let resolveJs: ReturnType<typeof createIdResolver> | undefined;
  const pulled = new Map<string, string>();
  const unresolved = new Set<string>();
  const followed = new Set<string>();

  return {
    name: "quest:shipped-packages-only",
    apply: "build",
    configResolved(resolved) {
      root = resolved.root;
      resolveCss = createIdResolver(resolved, {
        ...resolved.resolve,
        extensions: [".css"],
        mainFields: ["style"],
        conditions: ["style", "development|production"],
        tryIndex: false,
        preferRelative: true,
      });
      resolveJs = createIdResolver(resolved, resolved.resolve);
    },
    buildStart() {
      pulled.clear();
      unresolved.clear();
      followed.clear();
    },
    transform: {
      filter: { id: /\.css(?:\?.*)?$/ },
      async handler(_code, id) {
        if (id.startsWith("\0")) return;
        const follow = async (file: string): Promise<void> => {
          if (followed.has(file) || !existsSync(file)) return;
          followed.add(file);
          for (const { kind, spec } of cssPulls(readFileSync(file, "utf8"))) {
            const resolve = kind === "css" ? resolveCss : resolveJs;
            const target =
              (await resolve?.(this.environment, spec, file, true)) ??
              (await resolve?.(this.environment, spec, file));
            if (target === undefined) {
              unresolved.add(`${spec} (from ${file})`);
              continue;
            }
            const clean = target.split("?")[0] ?? target;
            pulled.set(clean, file);
            if (kind === "css") await follow(clean);
          }
        };
        await follow(id.split("?")[0] ?? id);
      },
    },
    generateBundle(_options, bundle) {
      const permitted = allowed();
      const names = new Set(permitted.map((p) => p.name));
      const dirs = new Set(permitted.map((p) => canonical(p.dir)));
      const strays = new Set<string>();
      const check = (id: string) => {
        // A virtual module such as \0rolldown/runtime.js belongs to the bundler it names.
        if (id.startsWith("\0")) {
          const bundler = id.slice(1).split("/")[0];
          if (bundler !== undefined && !names.has(bundler)) strays.add(bundler);
          return;
        }
        const clean = id.split("?")[0] ?? id;
        const pkg = packageAt(isAbsolute(clean) ? clean : resolve(root, clean));
        if (pkg === undefined) return;
        const dir = canonical(pkg.dir);
        if (!dirs.has(dir)) strays.add(`${pkg.name} (${relative(root, dir)})`);
      };
      for (const output of Object.values(bundle)) {
        const sources =
          output.type === "chunk" ? output.moduleIds : output.originalFileNames;
        for (const id of sources) check(id);
      }
      for (const file of pulled.keys()) check(file);
      if (unresolved.size > 0) {
        this.error(
          `The client's stylesheets pull in what the build cannot resolve, so cannot check: ${[...unresolved].sort().join(", ")}.`,
        );
      }
      if (strays.size > 0) {
        this.error(
          `The client bundle holds code from outside quest/client's dependencies: ${[...strays].sort().join(", ")}. ` +
            "Add a bundled package to quest/client's dependencies (owner's OK, license allowlist), or stop importing it.",
        );
      }
    },
  };
}
