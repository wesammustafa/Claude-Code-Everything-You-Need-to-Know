// `npm run dev -- <practice-copy>`: Claude Code Quest in development, with the
// Pip Playground at /#/playground. The spec runs the server and the client
// against a Practice copy; until the server lands (tickets 216 to 220) this
// starts the client's Vite dev server alone on 127.0.0.1, and the Practice
// copy, if given, is accepted and not read. `--port <n>` picks another port.
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createServer } from "vite";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { port: { type: "string" } },
});

const port = values.port === undefined ? undefined : Number(values.port);
if (port !== undefined && !(Number.isInteger(port) && port > 0)) {
  console.error(`--port takes a port number, not ${String(values.port)}`);
  process.exit(2);
}

const root = import.meta.dirname;
const server = await createServer({
  root,
  configFile: join(root, "vite.config.ts"),
  server: { host: "127.0.0.1", ...(port === undefined ? {} : { port }) },
});
await server.listen();
server.printUrls();

const local = server.resolvedUrls?.local[0];
if (local !== undefined) console.log(`  Pip Playground: ${local}#/playground`);
const copy = positionals[0];
if (copy !== undefined) {
  console.log(
    `  Practice copy ${copy} is not read yet: the app's server comes with tickets 216 to 220.`,
  );
}
