// `npm run dev -- <practice-copy>`: Claude Code Quest in development. The
// server runs from source for the Practice copy, on 4747 or the next free
// port, with the repo's compiled course; the client's Vite dev server serves
// the app on 4318 and passes /api and /pages to it. The Guide pages the Book
// panel opens are served once rendered (npm run build -w @quest/release, or
// node quest/release/src/render-pages.mjs); until then the panel says the
// page did not load. The Pip Playground is at /#/playground.
import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { createHost, realAdapters } from "@quest/host";
import { loadCourse } from "@quest/engine/course";
import { CONTENT_TYPES } from "./build/statics.ts";
import { start } from "./src/start.ts";
import { loadStatics, type StaticEntry, type Statics } from "./src/statics.ts";

const repo = resolve(import.meta.dirname, "../..");
const given = process.argv[2];
if (
  given === undefined ||
  !existsSync(given) ||
  !statSync(given).isDirectory()
) {
  console.error(
    "Usage: npm run dev -- <practice-copy>, a folder made from practice-template",
  );
  process.exit(2);
}
const copy = resolve(given);

// The rendered Guide pages, when the release build has made them.
function renderedPages(): Statics {
  const dir = join(repo, "quest/release/dist/pages");
  if (!existsSync(join(dir, "index.json"))) {
    console.log(
      "  Guide pages: not rendered yet, so the Book panel has none. Run node quest/release/src/render-pages.mjs and start again.",
    );
    return new Map();
  }
  const table: StaticEntry[] = readdirSync(dir, {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(dir, join(entry.parentPath, entry.name)).replaceAll("\\", "/"),
    )
    .flatMap((name) => {
      const type = CONTENT_TYPES[extname(name)];
      return type === undefined
        ? []
        : [{ path: `/pages/${name}`, file: name, type, immutable: false }];
    });
  return loadStatics(dir, table);
}

let vite: ViteDevServer | undefined;
const started = await start({
  root: copy,
  // The repo's compiled course (npm run course:compile), read as the
  // template's.
  courseRoot: join(repo, "practice-template"),
  argv: process.argv.slice(3),
  env: process.env,
  platform: process.platform,
  statics: renderedPages(),
  signals: process,
  stdout: process.stdout,
  stderr: process.stderr,
  exit: (code) => {
    void (vite?.close() ?? Promise.resolve()).finally(() => process.exit(code));
  },
  // The app is at the client's address below, not the server's.
  isTTY: false,
  announce: false,
  openBrowser: () => undefined,
  createHost,
  realAdapters,
  loadCourse,
});
if (started) {
  const client = join(repo, "quest/client");
  vite = await createServer({
    root: client,
    configFile: join(client, "vite.config.ts"),
    server: {
      // Keep the browser's Host: the server's trust check matches it against
      // the Origin, and Vite's string form would rewrite it to the target.
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${String(started.port)}`,
          changeOrigin: false,
        },
        "/pages": {
          target: `http://127.0.0.1:${String(started.port)}`,
          changeOrigin: false,
        },
      },
    },
  });
  await vite.listen();
  vite.printUrls();
  const local = vite.resolvedUrls?.local[0];
  if (local !== undefined)
    console.log(`  Pip Playground: ${local}#/playground`);
}
