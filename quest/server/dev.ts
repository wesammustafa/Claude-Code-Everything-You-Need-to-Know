// `npm run dev -- <practice-copy>`: Claude Code Quest in development. The
// server runs from source for the Practice copy, on 4747 or the next free
// port, with the repo's compiled course and no static files; the client's
// Vite dev server serves the app on 4318 and passes /api to it. The Pip
// Playground is at /#/playground.
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { createHost, realAdapters } from "@quest/host";
import { loadCourse } from "@quest/engine/course";
import { start } from "./src/start.ts";

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

let vite: ViteDevServer | undefined;
const started = await start({
  root: copy,
  // The repo's compiled course (npm run course:compile), read as the
  // template's.
  courseRoot: join(repo, "practice-template"),
  argv: process.argv.slice(3),
  env: process.env,
  platform: process.platform,
  statics: new Map(),
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
      proxy: { "/api": `http://127.0.0.1:${String(started.port)}` },
    },
  });
  await vite.listen();
  vite.printUrls();
  const local = vite.resolvedUrls?.local[0];
  if (local !== undefined)
    console.log(`  Pip Playground: ${local}#/playground`);
}
