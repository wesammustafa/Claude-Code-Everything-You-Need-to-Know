import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { STAMP } from "./build/inputs.ts";
import { playgroundBoard } from "./build/playground-board.ts";
import {
  PREVIEW_HEADERS,
  bundledPackagesOnly,
  ownDynamicImportHelper,
  stampInputs,
} from "./build/plugins.ts";

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
    ownDynamicImportHelper(),
    bundledPackagesOnly(),
    preloadFonts(),
    stampInputs(STAMP),
    // The Pip Playground's private board, served by the dev server only.
    playgroundBoard(import.meta.dirname),
  ],
  build: {
    outDir: "dist/app",
    emptyOutDir: true,
    // Every asset is a file Vite emits, so fonts are never inlined into the CSS.
    assetsInlineLimit: 0,
    // Browsers the app supports load modules natively, so no polyfill ships,
    // and the one dynamic import (Pip's runtime, after the first paint) is a
    // single chunk with nothing to preload (ownDynamicImportHelper).
    modulePreload: false,
  },
  server: { host: "127.0.0.1", port: 4318, strictPort: true },
  preview: {
    host: "127.0.0.1",
    port: 4319,
    strictPort: true,
    headers: PREVIEW_HEADERS,
  },
  test: {
    name: "client",
    environment: "jsdom",
    include: [
      "src/**/*.test.{ts,tsx}",
      "build/**/*.test.ts",
      "pip/**/*.test.ts",
    ],
    setupFiles: ["./test/setup.ts"],
    // The token tests read tokens.css as text; no other CSS is processed.
    css: { include: [/tokens\.css/] },
  },
});
