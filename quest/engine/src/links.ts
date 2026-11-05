// ---- links in a Lesson's words ---------------------------------------------
// A step file quotes Guide pages, so a relative link in its words is the
// page's: written against the page's folder. The compile step resolves each
// one (compileCourse), so the app gets a link it can open as it is: a Guide
// page's repository path, which the page panel opens, or a web address.

/** The Guide as the compile step sees it: what a link may point at. */
export interface GuideIndex {
  /** Each live Guide page by repository path, with its heading and anchor ids. */
  pages: Readonly<Record<string, readonly string[]>>;
  /** Every file in the repository, by repository path. */
  files: readonly string[];
}

/**
 * Text with each `[label](href)` the app shows as a link given the href
 * `to` returns. The app reads `code`, **bold** and links from the left, the
 * first span to start winning (InlineText in quest/client), so a link inside
 * a code span or bold stays text and is left as it is.
 *
 * One pass: each closing mark is looked up from a place that only moves
 * forward, so every lookup resumes where the last stopped. A regex such as
 * /\[([^\]]+)\]\(([^)\s]+)\)/g backtracks quadratically on a run of "["
 * (CodeQL js/polynomial-redos, PR #166).
 */
export function mapLinks(
  text: string,
  to: (href: string, label: string) => string,
): string {
  const seen = new Map<string, number>();
  const next = (mark: string, from: number) => {
    const at = seen.get(mark);
    if (at !== undefined && (at < 0 || at >= from)) return at;
    const found = text.indexOf(mark, from);
    seen.set(mark, found);
    return found;
  };
  let stop = -1; // the first ")" or space at or after the last href start
  let out = "";
  let done = 0;
  for (let i = 0; i < text.length;) {
    const c = text[i];
    if (c === "`") {
      const close = next("`", i + 1);
      if (close > i + 1) {
        i = close + 1;
        continue;
      }
    } else if (c === "*" && text[i + 1] === "*") {
      const close = next("*", i + 2);
      if (close > i + 2 && text[close + 1] === "*") {
        i = close + 2;
        continue;
      }
    } else if (c === "[") {
      const close = next("]", i + 1);
      const start = close + 2;
      if (close > i + 1 && text[close + 1] === "(") {
        if (stop < start) {
          stop = start;
          while (stop < text.length && !/[)\s]/.test(text[stop] ?? "")) stop++;
        }
        if (stop > start && text[stop] === ")") {
          const label = text.slice(i + 1, close);
          out += `${text.slice(done, i)}[${label}](${to(text.slice(start, stop), label)})`;
          done = stop + 1;
          i = done;
          continue;
        }
      }
    }
    i++;
  }
  return out + text.slice(done);
}

/**
 * Where a link written on the page at `page` goes, from the repository root:
 * `{ path, fragment }`, or null for a web address or another scheme. A bare
 * `#heading` is the page's own. Throws when the path climbs above the root.
 */
export function linkTarget(
  page: string,
  href: string,
): { path: string; fragment: string | null } | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return null;
  const hash = href.indexOf("#");
  const written = hash < 0 ? href : href.slice(0, hash);
  const fragment = hash < 0 ? null : href.slice(hash + 1);
  if (written === "") return { path: page, fragment };
  const parts = written.startsWith("/")
    ? []
    : page.split("/").slice(0, -1).filter(Boolean);
  for (const part of decode(written).split("/")) {
    if (part === "..") {
      if (!parts.length) throw new Error("climbs above the repository root");
      parts.pop();
    } else if (part !== "." && part !== "") parts.push(part);
  }
  return { path: parts.join("/"), fragment };
}

// A percent-escape that does not decode stays as written, and the link then
// fails by its path rather than crashing the compile step.
function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * The href the app gets for a link written on the page at `page`: a live
 * Guide page's repository path (and heading), which the page panel opens;
 * any other file or folder of the repository on GitHub at main, as the
 * compiled Lesson's own page link is; a web
 * address as it is. Throws with the reason when the link reaches nothing.
 */
export function resolveLink(
  page: string,
  href: string,
  guide: GuideIndex,
  repo: string,
  folders: ReadonlySet<string> = foldersOf(guide.files),
): string {
  const target = linkTarget(page, href);
  if (target === null) return href;
  const { path, fragment } = target;
  const suffix = fragment === null ? "" : `#${fragment}`;
  const ids = guide.pages[path];
  if (ids) {
    if (
      fragment === "" ||
      (fragment !== null && !ids.includes(decode(fragment)))
    )
      throw new Error(`${path} has no heading or anchor #${fragment}`);
    return `${path}${suffix}`;
  }
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  if (folders.has(path)) return `${repo}/tree/main/${encoded}${suffix}`;
  // Under docs/, only a live page or a README: never a Stub, an ADR or a
  // page that is gone.
  const file =
    guide.files.includes(path) &&
    (!path.startsWith("docs/") || path.endsWith("/README.md"));
  if (file) return `${repo}/blob/main/${encoded}${suffix}`;
  throw new Error(
    path.startsWith("docs/")
      ? `${path} is no page in the Guide's index`
      : `${path} is no file or folder in the repository`,
  );
}

/** The folders that hold the given files, for a link to a folder. */
export function foldersOf(files: readonly string[]): Set<string> {
  const folders = new Set<string>();
  for (const file of files) {
    const parts = file.split("/");
    for (let i = 1; i < parts.length; i++)
      folders.add(parts.slice(0, i).join("/"));
  }
  return folders;
}
