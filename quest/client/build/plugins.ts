// The build plugins and preview settings every quest/client build shares: the
// app's own, and the Pip contract page the e2e run loads.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { shippedPackages } from "../../release/src/licenses.ts";
import { inputsDigest } from "./inputs.ts";
import { shippedPackagesOnly } from "./shipped-packages.ts";

export const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
export const clientRoot = fileURLToPath(new URL("../", import.meta.url));

/**
 * Records which sources a build was built from, in `stamp` (relative to
 * quest/client), so `npm run e2e` never tests a stale build
 * (e2e/fresh-build.ts). A failed build leaves no stamp.
 */
export function stampInputs(stamp: string): Plugin {
  const file = join(clientRoot, stamp);
  return {
    name: "quest:stamp-inputs",
    apply: "build",
    buildStart() {
      rmSync(file, { force: true });
    },
    closeBundle(error) {
      if (error) return;
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, `${inputsDigest(clientRoot)}\n`);
    },
  };
}

/** Fails a build that bundles anything outside quest/client's production dependencies and the bundler runtime. */
export function bundledPackagesOnly(): Plugin {
  return shippedPackagesOnly(() =>
    shippedPackages(repoRoot).map((p) => ({
      name: p.name,
      dir: join(repoRoot, p.path),
    })),
  );
}

/** The headers the app's server sends, so an e2e run meets the same policy. */
export const PREVIEW_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};
