// Start-up of an assembled template, the proof's step 4 without Chromium:
// `npm run learn` with no node_modules and no network serves on 127.0.0.1 and
// answers GET /api/health. CI runs it on macOS and Windows, where the full
// proof does not run. Plain Node with node: imports only.
//   npm run startup -- <template-dir>
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { isMain } from "./is-main.mjs";
import { serves } from "./proof.mjs";

const USAGE = "Usage: npm run startup -- <template-dir>";

/** Checks `dir` and returns the exit code: 0 pass, 1 fail, 2 usage. */
export async function main(
  dir,
  { check = serves, log = console.log, error = console.error } = {},
) {
  if (!dir) {
    error(USAGE);
    return 2;
  }
  const result = existsSync(dir)
    ? await check(dir, { chromium: false })
    : { ok: false, problems: [`${dir}: no such folder`] };
  if (result.ok) {
    log(`PASS start-up ${result.note ?? ""}`.trimEnd());
    return 0;
  }
  error(["FAIL start-up", ...result.problems.map((p) => `  ${p}`)].join("\n"));
  return 1;
}

if (isMain(import.meta.url)) {
  // npm runs workspace scripts in quest/release; INIT_CWD is where it was typed.
  const arg = process.argv[2];
  const dir = arg && resolve(process.env.INIT_CWD ?? process.cwd(), arg);
  process.exitCode = await main(dir);
}
