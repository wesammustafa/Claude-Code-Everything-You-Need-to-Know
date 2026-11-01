// Which docs/ pages are live, and so rendered: every tracked page except the
// Stubs (as the Guide's checks identify them), the READMEs and the ADRs.
import { listFiles, readText } from "../../../.github/scripts/lib/tree.mjs";
import { STUBS, isStub } from "../../../.github/scripts/lib/stamps.mjs";

export function classifyDocs(root, files = listFiles(root)) {
  const docs = files.filter((f) => f.startsWith("docs/") && f.endsWith(".md"));
  const out = { live: [], stubs: [], readmes: [], unpublished: [] };
  for (const path of docs) {
    if (path.endsWith("/README.md")) out.readmes.push(path);
    else if (STUBS.includes(path) || isStub(readText(root, path)))
      out.stubs.push(path);
    else if (path.startsWith("docs/adr/")) out.unpublished.push(path);
    else out.live.push(path);
  }
  return out;
}

const LEVELS = ["beginner", "intermediate", "advanced"];

// A page's name under pages/: its path less docs/ and .md.
export function pageName(path) {
  return path.slice("docs/".length, -".md".length);
}

// What kind of page it is, from its folder, and its Level when it has one.
export function pageKind(path) {
  const [folder = "", second = ""] = pageName(path).split("/");
  if (folder === "reference") return { kind: "reference" };
  if (folder === "topics") return { kind: "topic" };
  if (!LEVELS.includes(folder)) return { kind: "reference" };
  if (second === "electives") return { kind: "elective", level: folder };
  if (second === "capstone") return { kind: "capstone", level: folder };
  return { kind: "lesson", level: folder };
}
