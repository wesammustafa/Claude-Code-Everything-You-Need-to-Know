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

/** Vite's helper for dynamic imports, which it adds to every client build that has one. */
const VITE_PRELOAD_HELPER = "\0vite/preload-helper.js";

/**
 * Wraps each dynamic import in the app's own helper (src/lib/dynamic-import.ts)
 * instead of Vite's, so no Vite code ships and the bundle check above stays
 * strict. Vite's helper preloads a dynamic chunk's dependencies; with
 * `build.modulePreload` off it preloads no JavaScript but still loads the
 * chunk's stylesheets. The app's helper only runs the import, so the build
 * fails on a dynamic chunk that brings stylesheets (generateBundle below).
 */
export function ownDynamicImportHelper(): Plugin {
  const helper = join(clientRoot, "src/lib/dynamic-import.ts");
  return {
    name: "quest:own-dynamic-import-helper",
    apply: "build",
    enforce: "pre",
    configResolved(config) {
      if (config.build.modulePreload !== false) {
        throw new Error(
          "ownDynamicImportHelper preloads nothing, so it needs build.modulePreload set to false",
        );
      }
    },
    resolveId(id) {
      return id === VITE_PRELOAD_HELPER ? helper : undefined;
    },
    // Vite's helper would load a dynamic chunk's stylesheets first; the
    // app's does not, so a dynamic chunk that brings CSS fails the build
    // rather than ship unstyled.
    generateBundle(_options, bundle) {
      const dynamic = new Set(
        Object.values(bundle).flatMap((output) =>
          output.type === "chunk" ? output.dynamicImports : [],
        ),
      );
      const styled = [...dynamic].filter((file) => {
        const chunk = bundle[file];
        return (
          chunk?.type === "chunk" &&
          (chunk.viteMetadata?.importedCss.size ?? 0) > 0
        );
      });
      if (styled.length > 0) {
        this.error(
          `A dynamically imported chunk brings stylesheets the app's dynamic import helper would not load: ${styled.join(", ")}.`,
        );
      }
    },
  };
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
