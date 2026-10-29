// The Pip contract page: a test page that loads the committed pip.riv in the
// web runtime the app ships, for e2e/pip-contract.spec.ts. `npm run build`
// builds it into dist/pip-contract, beside the app and never into it, and
// `vite preview` serves it on 127.0.0.1:4320 with the app's own headers.
import react from "@vitejs/plugin-react";
import { join } from "node:path";
import { defineConfig } from "vite";
import { PIP_CONTRACT_STAMP } from "./build/inputs.ts";
import {
  PREVIEW_HEADERS,
  bundledPackagesOnly,
  clientRoot,
  stampInputs,
} from "./build/plugins.ts";

export default defineConfig({
  root: join(clientRoot, "pip/contract-page"),
  plugins: [react(), bundledPackagesOnly(), stampInputs(PIP_CONTRACT_STAMP)],
  build: {
    outDir: join(clientRoot, "dist/pip-contract"),
    emptyOutDir: true,
    // The WASM and the .riv stay files of their own, served from this origin.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    // A test page loads the runtime in one chunk; its size is not a budget.
    chunkSizeWarningLimit: 1024,
  },
  preview: {
    host: "127.0.0.1",
    port: 4320,
    strictPort: true,
    headers: PREVIEW_HEADERS,
  },
});
