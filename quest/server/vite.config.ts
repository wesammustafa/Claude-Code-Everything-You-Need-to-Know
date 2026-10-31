// The server's bundle, learn/app.mjs in the template: one file that imports
// only node: built-ins and runs on Node 22 with no node_modules, with the
// compiled course and the client's files beside it.
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type UserConfig } from "vite";
import { shippedPackages } from "../release/src/licenses.ts";
import { shippedPackagesOnly } from "../client/build/shipped-packages.ts";
import { courseJson } from "./build/course-json.ts";
import { questStatics } from "./build/statics.ts";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
export const serverRoot = fileURLToPath(new URL("./", import.meta.url));
const clientRoot = join(repoRoot, "quest/client");

export function serverBuild({
  clientDir = join(clientRoot, "dist/app"),
  pagesDir = join(repoRoot, "quest/release/dist/pages"),
  outDir = join(serverRoot, "dist/learn"),
  checkFresh = true,
}: {
  clientDir?: string;
  pagesDir?: string;
  outDir?: string;
  checkFresh?: boolean;
} = {}): UserConfig {
  return {
    root: serverRoot,
    logLevel: "warn",
    plugins: [
      courseJson({ repoRoot }),
      questStatics({
        repoRoot,
        clientDir,
        pagesDir,
        clientRoot,
        checkFresh,
      }),
      // Only the server's production dependencies, and the bundler's
      // runtime, may land in the bundle.
      shippedPackagesOnly(() =>
        shippedPackages(repoRoot, { workspaces: ["quest/server"] }).map(
          (p) => ({
            name: p.name,
            dir: join(repoRoot, p.path),
          }),
        ),
      ),
    ],
    ssr: { noExternal: true, target: "node" },
    build: {
      ssr: "src/main.ts",
      target: "node22",
      outDir,
      emptyOutDir: true,
      // Readable stack traces while the bundle is well under its 1 MB budget.
      minify: false,
      copyPublicDir: false,
      rolldownOptions: {
        output: { codeSplitting: false, entryFileNames: "app.mjs" },
      },
    },
  };
}

export default defineConfig(serverBuild());
