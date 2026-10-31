// The committed diagram cache: each Mermaid block's light and dark SVG under
// quest/release/diagrams/, and diagrams.lock.json holding the hash of what
// each was drawn from. The build copies from the cache and needs no
// browser; a block whose hash no longer matches fails the build.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const THEMES = ["light", "dark"];

// Mermaid's settings, apart from the theme and the per-diagram id seed.
export const MERMAID_CONFIG = Object.freeze({
  startOnLoad: false,
  securityLevel: "strict",
  deterministicIds: true,
  htmlLabels: false,
  fontFamily: "sans-serif",
});

export const STALE =
  "diagram stale: run npm run render:diagrams -w @quest/release";

/** The Mermaid version the root package.json pins. */
export function mermaidVersion(root) {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return pkg.devDependencies.mermaid;
}

/** A cache file's name: the page's name with "/" as "-", then .d<n>.<theme>.svg. */
export function cacheName(name, n, theme) {
  return `${name.replaceAll("/", "-")}.d${n}.${theme}.svg`;
}

export function diagramHash(source, version, theme) {
  return createHash("sha256")
    .update(JSON.stringify({ source, version, theme, config: MERMAID_CONFIG }))
    .digest("hex");
}

export function readLock(dir) {
  const file = join(dir, "diagrams.lock.json");
  return existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : { mermaid: "", diagrams: {} };
}

/**
 * The cached SVG for one diagram, or a thrown "diagram stale" error naming
 * it when the cache lacks it or was drawn from something else.
 */
export function cachedDiagram(dir, lock, version, name, n, source, theme) {
  const file = cacheName(name, n, theme);
  const path = join(dir, file);
  if (
    lock.diagrams[file] !== diagramHash(source, version, theme) ||
    !existsSync(path)
  )
    throw new Error(`${file}: ${STALE}`);
  return readFileSync(path);
}
