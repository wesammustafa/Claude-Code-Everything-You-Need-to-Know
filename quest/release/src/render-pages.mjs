// Renders every live Guide page for the release into quest/release/dist:
// pages/<name>.html fragments with their diagrams' SVG files beside them,
// pages/index.json listing them, and course.json, the compiled course with
// its example fetches pointed at the release ref. Runs the release tests on
// links and example paths and exits non-zero when either fails.
//   npm run build -w @quest/release
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { filesAt } from "../../../.github/scripts/lib/git.mjs";
import { listFiles, readText } from "../../../.github/scripts/lib/tree.mjs";
import {
  THEMES,
  cachedDiagram,
  mermaidVersion,
  readLock,
} from "./diagrams.mjs";
import { checkExamples, rewriteExampleUrls } from "./example-urls.mjs";
import { checkLinks, foldersOf } from "./links.mjs";
import { classifyDocs, pageKind, pageName } from "./live-pages.mjs";
import { releaseRef } from "./release-ref.mjs";
import { accTitle, renderPage } from "./render.mjs";

/** What links resolve against: the tree's files, folders and docs/ pages. */
export function linkContext(ref, files, docs) {
  return {
    ref,
    live: new Set(docs.live),
    stubs: new Set(docs.stubs),
    files: new Set(files),
    folders: foldersOf(files),
  };
}

/** The link context of a working tree. */
export function treeContext(root, ref) {
  const files = listFiles(root);
  return linkContext(ref, files, classifyDocs(root, files));
}

/**
 * Renders the pages into `outDir` (emptied first) and copies the course when
 * `course` is given. Returns { pages, problems }; writes nothing when there
 * are problems.
 */
export function buildPages({ root, ref, outDir, diagramsDir, course }) {
  const files = listFiles(root);
  const docs = classifyDocs(root, files);
  const ctx = linkContext(ref, files, docs);
  const lock = readLock(diagramsDir);
  const version = mermaidVersion(root);
  const out = new Map();
  const problems = [];
  const pages = [];
  const sources = {};
  for (const path of docs.live) {
    const name = pageName(path);
    const text = readText(root, path);
    sources[path] = text;
    const rendered = renderPage(
      path,
      rewriteExampleUrls(text, ref),
      ctx,
      (n, source) => {
        for (const theme of THEMES)
          out.set(
            `${name}.d${n}.${theme}.svg`,
            cachedDiagram(diagramsDir, lock, version, name, n, source, theme),
          );
        return {
          light: `/pages/${name}.d${n}.light.svg`,
          dark: `/pages/${name}.d${n}.dark.svg`,
          alt: accTitle(source),
        };
      },
    );
    problems.push(...checkLinks(path, rendered.links));
    out.set(`${name}.html`, rendered.html);
    pages.push({
      path,
      url: `/pages/${name}.html`,
      title: rendered.title,
      ...pageKind(path),
    });
  }
  for (const step of files.filter((f) => /^course\/steps\/[^/]+\.md$/.test(f)))
    sources[step] = readText(root, step);
  problems.push(...checkExamples(sources, filesAt(root, ref)));
  if (problems.length) return { pages, problems };

  rmSync(outDir, { recursive: true, force: true });
  for (const [file, body] of [...out].sort(([a], [b]) => (a < b ? -1 : 1))) {
    mkdirSync(dirname(join(outDir, file)), { recursive: true });
    writeFileSync(join(outDir, file), body);
  }
  writeFileSync(
    join(outDir, "index.json"),
    `${JSON.stringify({ ref, pages }, null, 2)}\n`,
  );
  // Shipped without indentation: the compiled course is the largest file in
  // learn/ after Rive's WASM, and the whitespace was about half of it.
  if (course)
    writeFileSync(
      course.to,
      `${JSON.stringify(JSON.parse(rewriteExampleUrls(readFileSync(course.from, "utf8"), ref)))}\n`,
    );
  return { pages, problems };
}

function main() {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const from = join(root, "quest/engine/dist/course.json");
  if (!existsSync(from))
    throw new Error(
      "quest/engine/dist/course.json is missing: run npm run course:compile first.",
    );
  const ref = releaseRef(root);
  const { pages, problems } = buildPages({
    root,
    ref,
    outDir: join(root, "quest/release/dist/pages"),
    diagramsDir: join(root, "quest/release/diagrams"),
    course: { from, to: join(root, "quest/release/dist/course.json") },
  });
  if (problems.length) {
    console.error(
      `The release tests failed:\n${problems.map((p) => `  ${p}`).join("\n")}`,
    );
    process.exit(1);
  }
  console.log(
    `Rendered ${pages.length} pages at ${ref} to quest/release/dist/pages`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
