// The static files the server bundle carries: each source folder's files,
// listed by URL path in `virtual:quest-statics` and copied beside the bundle
// under app/. The server serves only what this list names.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import type { Plugin } from "vite";
import { STAMP, inputsDigest } from "../../client/build/inputs.ts";
import type { StaticEntry } from "../src/statics.ts";

export interface StaticSource {
  /** The folder, relative to the repo root. */
  from: string;
  /** The URL path its files are served under, ending in "/". */
  at: string;
  /** Whether a file, by its name inside `from`, is hashed and so never changes. */
  immutable: (name: string) => boolean;
}

const CLIENT = "quest/client/dist/app";
const PAGES = "quest/release/dist/pages";

/** The client's built app and the rendered Guide pages with their diagrams. */
export const STATIC_SOURCES: readonly StaticSource[] = [
  {
    from: CLIENT,
    at: "/",
    immutable: (name) => name.startsWith("assets/"),
  },
  // Named by page, not hashed: a page is revalidated like index.html.
  { from: PAGES, at: "/pages/", immutable: () => false },
];

export const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".riv": "application/octet-stream",
  ".json": "application/json",
};

const VIRTUAL = "virtual:quest-statics";
// Not a "\0" id: the shipped-packages check counts a "\0" id as the bundler
// it names.
const RESOLVED = `${VIRTUAL}.mjs`;

/** Where the copies go under the bundle's folder. */
export const STATIC_DIR = "app";

interface Found {
  entry: StaticEntry;
  source: string;
}

/** Every file of the sources, by URL path. An unknown extension or a path listed twice throws. */
export function staticTable(
  sources: readonly (StaticSource & { dir: string })[],
): Found[] {
  const found = new Map<string, Found>();
  for (const source of sources) {
    const names = readdirSync(source.dir, {
      recursive: true,
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        relative(source.dir, join(entry.parentPath, entry.name)).replaceAll(
          "\\",
          "/",
        ),
      )
      .filter((name) => !name.startsWith(".vite/"))
      .sort();
    for (const name of names) {
      const type = CONTENT_TYPES[extname(name)];
      if (type === undefined)
        throw new Error(
          `${source.from}/${name}: no content type for ${extname(name) || "a file with no extension"}. Add it to CONTENT_TYPES in quest/server/build/statics.ts.`,
        );
      const url = `${source.at}${name}`;
      const path = url.endsWith("/index.html")
        ? url.slice(0, -"index.html".length)
        : url;
      if (found.has(path))
        throw new Error(`${path} is listed twice: ${source.from}/${name}`);
      found.set(path, {
        entry: {
          path,
          file: `${STATIC_DIR}${url}`,
          type,
          immutable: source.immutable(name),
        },
        source: join(source.dir, name),
      });
    }
  }
  return [...found.values()];
}

/** Refuses a client build that is missing or was built from other sources, the way the e2e run does. */
export function checkClientFresh(clientRoot: string): void {
  const stamp = join(clientRoot, STAMP);
  const built = existsSync(stamp) ? readFileSync(stamp, "utf8").trim() : "";
  if (
    built !== inputsDigest(clientRoot) ||
    !existsSync(join(clientRoot, "dist/app/index.html"))
  )
    throw new Error(
      "quest/client/dist/app is missing or was built from other sources than these. Run `npm run build` from the repo root, which builds the client before the server.",
    );
}

/** Refuses a build with no rendered pages. */
export function checkPagesBuilt(pagesDir: string): void {
  if (!existsSync(join(pagesDir, "index.json")))
    throw new Error(
      `${pagesDir} has no rendered pages. Run \`npm run build -w @quest/release\`, or \`npm run build\` from the repo root, which builds the release before the server.`,
    );
}

export function questStatics({
  repoRoot,
  clientDir,
  pagesDir,
  clientRoot,
  checkFresh,
}: {
  repoRoot: string;
  /** The client's built app folder: quest/client/dist/app, or a test's fixture. */
  clientDir: string;
  /** The rendered pages folder: quest/release/dist/pages, or a test's fixture. */
  pagesDir: string;
  clientRoot: string;
  checkFresh: boolean;
}): Plugin {
  let found: Found[] = [];
  return {
    name: "quest:statics",
    apply: "build",
    buildStart() {
      if (checkFresh) checkClientFresh(clientRoot);
      checkPagesBuilt(pagesDir);
      const dirs: Record<string, string> = {
        [CLIENT]: clientDir,
        [PAGES]: pagesDir,
      };
      found = staticTable(
        STATIC_SOURCES.map((source) => ({
          ...source,
          dir: dirs[source.from] ?? join(repoRoot, source.from),
        })),
      );
    },
    resolveId(id) {
      return id === VIRTUAL ? RESOLVED : undefined;
    },
    load(id) {
      if (id !== RESOLVED) return undefined;
      const table = found.map(({ entry }) => entry);
      return `export default Object.freeze(${JSON.stringify(table)}.map(Object.freeze));\n`;
    },
    generateBundle() {
      for (const { entry, source } of found)
        this.emitFile({
          type: "asset",
          fileName: entry.file,
          source: readFileSync(source),
        });
    },
  };
}
