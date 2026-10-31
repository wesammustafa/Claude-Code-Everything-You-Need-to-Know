// Where a link in a rendered page goes. A heading on the same page and other
// sites stay as written; a live Guide page keeps a GitHub link at the release
// ref as its fallback and carries data-page and data-fragment for the page
// panel; every other repo path opens on GitHub at the release ref.
import { posix } from "node:path";

export const REPO_URL =
  "https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know";

// A target's repo path, as the Guide's images check resolves one: "/" means
// the repo root, anything else is relative to the page's folder. Null for a
// fragment alone or a URL with a scheme.
export function resolveFrom(page, target) {
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(target) ||
    target.startsWith("#") ||
    target.startsWith("//")
  )
    return null;
  const clean = decode(target.split(/[?#]/)[0]);
  if (!clean) return null;
  const path = clean.startsWith("/")
    ? clean.slice(1)
    : posix.normalize(posix.join(posix.dirname(page), clean));
  return path.replace(/\/+$/, "");
}

/** The folders that hold the repo's files, for tree/ links. */
export function foldersOf(files) {
  const folders = new Set();
  for (const file of files) {
    const parts = file.split("/");
    for (let i = 1; i < parts.length; i++)
      folders.add(parts.slice(0, i).join("/"));
  }
  return folders;
}

// A percent-escape that does not decode stays as written: the link then
// fails the release test by path rather than crashing the build.
function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

// ctx: { ref, live: Set, stubs: Set, files: Set, folders: Set }.
// Returns { href, attrs, path, kind }: kind is "same-page", "external",
// "page", "stub", "readme", "folder", "file" or "missing".
export function rewriteHref(from, href, ctx) {
  if (href.startsWith("#"))
    return { href, attrs: {}, path: null, kind: "same-page" };
  const path = resolveFrom(from, href);
  if (path === null) return { href, attrs: {}, path: null, kind: "external" };
  const hash = href.indexOf("#");
  const fragment = hash === -1 ? "" : href.slice(hash + 1);
  const suffix = fragment ? `#${fragment}` : "";
  if (ctx.folders.has(path))
    return {
      href: `${REPO_URL}/tree/${ctx.ref}/${encodePath(path)}${suffix}`,
      attrs: {},
      path,
      kind: "folder",
    };
  const blob = `${REPO_URL}/blob/${ctx.ref}/${encodePath(path)}${suffix}`;
  if (ctx.live.has(path)) {
    const attrs = { "data-page": path };
    if (fragment) attrs["data-fragment"] = decode(fragment);
    return { href: blob, attrs, path, kind: "page" };
  }
  const kind = ctx.stubs.has(path)
    ? "stub"
    : !ctx.files.has(path)
      ? "missing"
      : path.endsWith("/README.md") || path === "README.md"
        ? "readme"
        : "file";
  return { href: blob, attrs: {}, path, kind };
}

// The release test on links: a link into docs/ must reach a live page, a
// Stub, a README or a folder. Links: [{ line, target, path, kind }].
export function checkLinks(page, links) {
  return links
    .filter(
      (l) =>
        l.path?.startsWith("docs/") &&
        !["page", "stub", "readme", "folder"].includes(l.kind),
    )
    .map(
      (l) =>
        `${page}:${l.line}: ${l.target} points into docs/ at ${l.path}, which is not a bundled page or a Stub`,
    );
}
