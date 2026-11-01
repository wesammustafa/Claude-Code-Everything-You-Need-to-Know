// The page renderer's API, in one module for the tests and for ticket 225.
export { buildPages, treeContext } from "./render-pages.mjs";
export { releaseRef } from "./release-ref.mjs";
export {
  RAW_PREFIX,
  checkExamples,
  examplePaths,
  rewriteExampleUrls,
} from "./example-urls.mjs";
export {
  REPO_URL,
  checkLinks,
  foldersOf,
  resolveFrom,
  rewriteHref,
} from "./links.mjs";
export { classifyDocs, pageKind, pageName } from "./live-pages.mjs";
export { accTitle, diagramSources, renderPage, sanitize } from "./render.mjs";
export {
  STALE,
  THEMES,
  cacheName,
  cachedDiagram,
  diagramHash,
  mermaidVersion,
  readLock,
} from "./diagrams.mjs";
export { pageIds } from "../../../.github/scripts/lib/markdown.mjs";
