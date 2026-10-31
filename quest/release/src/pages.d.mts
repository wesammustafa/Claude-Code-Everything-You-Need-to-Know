// Types for pages.mjs, the page renderer's API.
export interface PageEntry {
  path: string;
  url: string;
  title: string;
  kind: "lesson" | "capstone" | "elective" | "reference" | "topic";
  level?: "beginner" | "intermediate" | "advanced";
}

export interface LinkContext {
  ref: string;
  live: Set<string>;
  stubs: Set<string>;
  files: Set<string>;
  folders: Set<string>;
}

export type LinkKind =
  | "same-page"
  | "external"
  | "page"
  | "stub"
  | "readme"
  | "folder"
  | "file"
  | "missing";

export interface Rewritten {
  href: string;
  attrs: Record<string, string>;
  path: string | null;
  kind: LinkKind;
}

export interface FoundLink extends Rewritten {
  line: number;
  target: string;
}

export interface DiagramFiles {
  light: string;
  dark: string;
  alt: string;
}

export interface Lock {
  mermaid: string;
  diagrams: Record<string, string>;
}

export function buildPages(options: {
  root: string;
  ref: string;
  outDir: string;
  diagramsDir: string;
  course?: { from: string; to: string };
}): { pages: PageEntry[]; problems: string[] };
export function treeContext(root: string, ref: string): LinkContext;
export function releaseRef(
  root: string,
  env?: Record<string, string | undefined>,
): string;

export const RAW_PREFIX: string;
export function rewriteExampleUrls(text: string, ref: string): string;
export function examplePaths(text: string): string[];
export function checkExamples(
  texts: Record<string, string>,
  filesAtRef: Iterable<string>,
): string[];

export const REPO_URL: string;
export function resolveFrom(page: string, target: string): string | null;
export function foldersOf(files: Iterable<string>): Set<string>;
export function rewriteHref(
  from: string,
  href: string,
  ctx: LinkContext,
): Rewritten;
export function checkLinks(page: string, links: FoundLink[]): string[];

export function classifyDocs(
  root: string,
  files?: string[],
): {
  live: string[];
  stubs: string[];
  readmes: string[];
  unpublished: string[];
};
export function pageName(path: string): string;
export function pageKind(path: string): Pick<PageEntry, "kind" | "level">;

export function accTitle(source: string): string;
export function diagramSources(text: string): string[];
export function sanitize(html: string): string;
export function renderPage(
  page: string,
  text: string,
  ctx: LinkContext,
  diagram: (n: number, source: string) => DiagramFiles,
): { html: string; title: string; links: FoundLink[]; diagrams: number };

export const STALE: string;
export const THEMES: readonly ["light", "dark"];
export function cacheName(name: string, n: number, theme: string): string;
export function diagramHash(
  source: string,
  version: string,
  theme: string,
): string;
export function mermaidVersion(root: string): string;
export function readLock(dir: string): Lock;
export function cachedDiagram(
  dir: string,
  lock: Lock,
  version: string,
  name: string,
  n: number,
  source: string,
  theme: string,
): Buffer;

/** The Guide checks' fragment ids for a page (.github/scripts/lib/markdown.mjs). */
export function pageIds(markdown: string): string[];
