// A digest of everything the client build reads, so `npm run e2e` can refuse
// to test a dist/app that was built from other sources.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Where the build records the digest of the sources it was built from: beside dist/app, never shipped. */
export const STAMP = "dist/app.inputs";

/** The same for the Pip contract page, a test page built beside the app and never into it. */
export const PIP_CONTRACT_STAMP = "dist/pip-contract.inputs";

// Relative to quest/client. Unit tests are left out: they never reach the bundle.
const INPUTS = [
  "index.html",
  "package.json",
  "vite.config.ts",
  "vite.pip-contract.config.ts",
  "build",
  "pip",
  "public",
  "src",
  "../release/src",
  "../../package-lock.json",
];

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && !/\.test\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** The sha256 of every build input's path and content, in a stable order. */
export function inputsDigest(clientRoot: string): string {
  const files = INPUTS.flatMap((input) => filesUnder(join(clientRoot, input)))
    .map((file) => relative(clientRoot, file).replaceAll("\\", "/"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(`${file}\0`);
    hash.update(readFileSync(join(clientRoot, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}
