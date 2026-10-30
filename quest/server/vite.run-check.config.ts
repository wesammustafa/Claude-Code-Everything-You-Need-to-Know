// The Check child's entry, learn/run-check.mjs in the template: the host
// spawns it beside app.mjs (check-child.mjs). The template's own checks/
// stay files the copy holds, imported as ../checks/, so a lesson's check
// runs the copy's code; the rest is bundled in.
import { join, relative } from "node:path";
import { defineConfig, type Plugin, type UserConfig } from "vite";
import { repoRoot, serverRoot } from "./vite.config.ts";

const CHECKS = join(repoRoot, "practice-template/checks");

/** The specifier the bundle imports a template check file by, or undefined for any other file. */
export function checksSpecifier(file: string): string | undefined {
  const rest = relative(CHECKS, file).replaceAll("\\", "/");
  if (rest.startsWith("../") || rest === "" || rest.startsWith("/"))
    return undefined;
  return `../checks/${rest}`;
}

function templateChecksExternal(): Plugin {
  return {
    name: "quest:template-checks-external",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (source.startsWith("../checks/"))
        return { id: source, external: true };
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      if (!resolved || resolved.external) return resolved;
      const specifier = checksSpecifier(resolved.id);
      return specifier ? { id: specifier, external: true } : resolved;
    },
  };
}

export function runCheckBuild({
  outDir = join(serverRoot, "dist/learn"),
}: { outDir?: string } = {}): UserConfig {
  return {
    root: serverRoot,
    logLevel: "warn",
    plugins: [templateChecksExternal()],
    ssr: { noExternal: true, target: "node" },
    build: {
      ssr: join(repoRoot, "quest/host/src/run-check.mjs"),
      target: "node22",
      outDir,
      emptyOutDir: false,
      minify: false,
      copyPublicDir: false,
      rolldownOptions: {
        output: { codeSplitting: false, entryFileNames: "run-check.mjs" },
      },
    },
  };
}

export default defineConfig(runCheckBuild());
