// The Guide's index for the compile step: each live page with the ids its
// headings and anchors give (the page panel's ids, as render.mjs sets them),
// and every file of the tree, so a link in a Lesson's words can be checked.
import { pageIds } from "../../../.github/scripts/lib/markdown.mjs";
import { listFiles, readText } from "../../../.github/scripts/lib/tree.mjs";
import { classifyDocs } from "./live-pages.mjs";

/** @returns {import("../../engine/src/links.ts").GuideIndex} */
export function guideIndex(root, files = listFiles(root)) {
  const { live } = classifyDocs(root, files);
  return {
    pages: Object.fromEntries(
      live.map((path) => [path, pageIds(readText(root, path))]),
    ),
    files,
  };
}
