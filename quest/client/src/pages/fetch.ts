// The rendered Guide pages the release build serves under /pages/: the
// index, fetched once, and each page's HTML fragment, fetched once by URL.
// Nothing here runs until a page or the Electives list is first opened.

/** The Guide's repository, where every link outside the bundled pages goes. */
export const GUIDE_REPO =
  "https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know";

/** One rendered page, as quest/release/src/pages.d.mts types PageEntry. */
export interface PageEntry {
  /** Its repository path, such as docs/beginner/01-install-and-look-around.md. */
  path: string;
  /** Where the fragment is served, such as /pages/beginner/01-....html. */
  url: string;
  title: string;
  kind: "lesson" | "capstone" | "elective" | "reference" | "topic";
  level?: "beginner" | "intermediate" | "advanced";
}

/** /pages/index.json: the release ref and every rendered page. */
export interface PageIndex {
  ref: string;
  pages: PageEntry[];
}

async function text(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${String(response.status)}`);
  return response.text();
}

let index: Promise<PageIndex> | null = null;
const pages = new Map<string, Promise<string>>();

/** The page index, asked for once; a failed request is asked for again next time. */
export function pageIndex(): Promise<PageIndex> {
  if (index) return index;
  const asked = text("/pages/index.json").then(
    (body) => JSON.parse(body) as PageIndex,
  );
  index = asked;
  asked.catch(() => {
    if (index === asked) index = null;
  });
  return asked;
}

/** A page's HTML fragment, asked for once per URL; a failure is asked for again next time. */
export function pageHtml(url: string): Promise<string> {
  const known = pages.get(url);
  if (known) return known;
  const asked = text(url);
  pages.set(url, asked);
  asked.catch(() => {
    if (pages.get(url) === asked) pages.delete(url);
  });
  return asked;
}

export function entryFor(
  pageIndex: PageIndex,
  path: string,
): PageEntry | undefined {
  return pageIndex.pages.find((entry) => entry.path === path);
}

/** The file on GitHub at `ref`. */
export function githubBlob(ref: string, path: string): string {
  return `${GUIDE_REPO}/blob/${ref}/${path}`;
}

/** Forgets every request, for tests. */
export function resetPageCache(): void {
  index = null;
  pages.clear();
}
