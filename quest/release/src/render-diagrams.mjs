// Draws every Mermaid block of the live pages into the diagram cache, light
// and dark, with the pinned Mermaid in the headless Chromium the Playwright
// tests install. Run it under the e2e lock:
//   npm run render:diagrams -w @quest/release
// With --check it draws into memory and fails when the cache differs.
import { readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import { readText } from "../../../.github/scripts/lib/tree.mjs";
import { classifyDocs, pageName } from "./live-pages.mjs";
import { diagramSources } from "./render.mjs";
import {
  MERMAID_CONFIG,
  THEMES,
  cacheName,
  diagramHash,
  mermaidVersion,
} from "./diagrams.mjs";

const require = createRequire(import.meta.url);

/** Every diagram of the live pages: { name, n, source }. */
export function liveDiagrams(root) {
  return classifyDocs(root).live.flatMap((path) =>
    diagramSources(readText(root, path)).map((source, i) => ({
      name: pageName(path),
      n: i + 1,
      source,
    })),
  );
}

/** Draws each diagram in each theme: { [cache file name]: svg text }. */
export async function drawDiagrams(diagrams) {
  const script = require.resolve("mermaid/dist/mermaid.min.js");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 800 },
      deviceScaleFactor: 1,
    });
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.addScriptTag({ path: script });
    const out = {};
    for (const { name, n, source } of diagrams)
      for (const theme of THEMES) {
        const seed = `${name.replaceAll("/", "-")}-d${n}`;
        out[cacheName(name, n, theme)] = await page.evaluate(
          async ({ config, source, seed, theme }) => {
            const mermaid = globalThis.mermaid;
            mermaid.initialize({ ...config, theme, deterministicIDSeed: seed });
            const { svg } = await mermaid.render(seed, source);
            return svg;
          },
          {
            config: MERMAID_CONFIG,
            source,
            seed,
            theme: theme === "dark" ? "dark" : "default",
          },
        );
      }
    return out;
  } finally {
    await browser.close();
  }
}

/** The lock for a set of diagrams. */
export function lockFor(root, diagrams) {
  const version = mermaidVersion(root);
  const entries = diagrams.flatMap(({ name, n, source }) =>
    THEMES.map((theme) => [
      cacheName(name, n, theme),
      diagramHash(source, version, theme),
    ]),
  );
  entries.sort(([a], [b]) => (a < b ? -1 : 1));
  return { mermaid: version, diagrams: Object.fromEntries(entries) };
}

async function main() {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const dir = join(root, "quest/release/diagrams");
  const diagrams = liveDiagrams(root);
  const drawn = await drawDiagrams(diagrams);
  if (process.argv.includes("--check")) {
    const differ = Object.entries(drawn).filter(
      ([file, svg]) => readFileSync(join(dir, file), "utf8") !== `${svg}\n`,
    );
    if (differ.length) {
      console.error(
        `These diagrams draw differently from the cache: ${differ.map(([f]) => f).join(", ")}`,
      );
      process.exit(1);
    }
    console.log(`${Object.keys(drawn).length} diagrams match the cache`);
    return;
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [file, svg] of Object.entries(drawn))
    writeFileSync(join(dir, file), `${svg}\n`);
  writeFileSync(
    join(dir, "diagrams.lock.json"),
    `${JSON.stringify(lockFor(root, diagrams), null, 2)}\n`,
  );
  console.log(
    `Drew ${Object.keys(drawn).length} diagrams into quest/release/diagrams`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
