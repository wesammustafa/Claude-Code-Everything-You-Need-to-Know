import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { shippedPackages } from "../release/src/licenses.ts";
import { STAMP, inputsDigest } from "./build/inputs.ts";
import { shippedPackagesOnly } from "./build/shipped-packages.ts";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const clientRoot = fileURLToPath(new URL("./", import.meta.url));

// Records which sources dist/app was built from, so `npm run e2e` never
// tests a stale build (e2e/fresh-build.ts). A failed build leaves no stamp.
function stampInputs(): Plugin {
  const stamp = join(clientRoot, STAMP);
  return {
    name: "quest:stamp-inputs",
    apply: "build",
    buildStart() {
      rmSync(stamp, { force: true });
    },
    closeBundle(error) {
      if (error) return;
      mkdirSync(dirname(stamp), { recursive: true });
      writeFileSync(stamp, `${inputsDigest(clientRoot)}\n`);
    },
  };
}

// The Latin files of the two bundled fonts: preloaded so the first screen
// paints in its own type. Other subsets load only when a page uses them.
const PRELOAD_FONTS = [
  "inter-latin-opsz-normal.woff2",
  "jetbrains-mono-latin-wght-normal.woff2",
];

function preloadFonts(): Plugin {
  return {
    name: "quest:preload-fonts",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const assets = Object.values(ctx.bundle ?? {}).filter(
          (output) => output.type === "asset",
        );
        const fonts = PRELOAD_FONTS.map((font) =>
          assets.find((asset) =>
            asset.originalFileNames.some((name) => name.endsWith(`/${font}`)),
          ),
        );
        const missing = PRELOAD_FONTS.filter((_, i) => fonts[i] === undefined);
        if (missing.length > 0)
          throw new Error(`The build emitted no ${missing.join(" or ")}`);
        return fonts.map((asset) => ({
          tag: "link",
          attrs: {
            rel: "preload",
            href: `/${asset?.fileName ?? ""}`,
            as: "font",
            type: "font/woff2",
            crossorigin: "anonymous",
          },
          injectTo: "head" as const,
        }));
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // quest/client's production dependencies and the bundler runtime.
    shippedPackagesOnly(() =>
      shippedPackages(repoRoot).map((p) => ({
        name: p.name,
        dir: join(repoRoot, p.path),
      })),
    ),
    preloadFonts(),
    stampInputs(),
  ],
  build: {
    outDir: "dist/app",
    emptyOutDir: true,
    // Every asset is a file Vite emits, so fonts are never inlined into the CSS.
    assetsInlineLimit: 0,
    // Browsers the app supports load modules natively; no polyfill ships.
    modulePreload: { polyfill: false },
  },
  server: { host: "127.0.0.1", port: 4318, strictPort: true },
  preview: {
    host: "127.0.0.1",
    port: 4319,
    strictPort: true,
    // The headers the app's server sends, so the e2e run meets the same policy.
    headers: {
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  },
  test: {
    name: "client",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "build/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    // The token tests read tokens.css as text; no other CSS is processed.
    css: { include: [/tokens\.css/] },
  },
});
