// Assembles the Practice template a Learner copies: project/ (the Starter
// project), checks/ and capstone/ outside it, learn/ (the server bundle, the
// client, the release course and the rendered pages), and the root files.
// Reads the built learn/ folder, pages/index.json and the release course, so
// `npm run build` comes first. The output is deterministic: sorted writes, no
// timestamps, no absolute paths; and it is checked before it returns.
//   npm run template -w @quest/release -- <out-dir>
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_URL as REPO } from "./links.mjs";

/** Names that must not appear at any depth: live Claude Code config and the retired Assert workflow. */
export const FORBIDDEN = [
  ".claude",
  ".claude-plugin",
  "CLAUDE.md",
  "CLAUDE.local.md",
  "AGENTS.md",
  ".mcp.json",
  "assert-checks.yml",
];

// Everything the template's root may hold; anything else is a stray file.
const ROOT_ENTRIES = [
  ".devcontainer",
  ".gitattributes",
  ".github",
  ".gitignore",
  "README.md",
  "capstone",
  "checks",
  "learn",
  "package.json",
  "project",
];

/** Local leftovers a maintainer's disk can hold under a copied folder: secrets, OS and editor files, Practice state. */
const LEFTOVER =
  /^(\.env(\..*)?|\.DS_Store|\.idea|\.vscode|\.practice|\.scratch|coverage)$/;

const PROJECT_ENTRIES = [
  ".gitignore",
  "LICENSE",
  "package-lock.json",
  "package.json",
  "practice",
  "samples",
  "src",
  "test",
];

const ROOT_FILES = [
  ".gitignore",
  ".gitattributes",
  "README.md",
  "package.json",
  "learn/app.mjs",
  "learn/run-check.mjs",
  ".github/workflows/progress.yml",
  ".github/ISSUE_TEMPLATE/track-my-progress.md",
  ".devcontainer/devcontainer.json",
];

const LEARN_MODULES = ["app.mjs", "run-check.mjs"];

/** Every file and folder under `dir`, as sorted "/"-separated paths, skipping node_modules. */
export function walk(dir, at = "") {
  return readdirSync(join(dir, at), { withFileTypes: true })
    .filter((e) => e.name !== "node_modules")
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((e) => {
      const path = at ? `${at}/${e.name}` : e.name;
      return e.isDirectory()
        ? [{ path, dir: true }, ...walk(dir, path)]
        : [{ path, dir: false }];
    });
}

// A Lesson's steps or a Reference solution: a steps/ or solutions/ folder, a
// steps.sh, or Markdown that opens with a lesson's front matter.
function isStepFile(dir, path, name, isDir) {
  if (isDir) return name === "steps" || name === "solutions";
  if (name === "steps.sh") return true;
  return (
    name.endsWith(".md") &&
    readFileSync(join(dir, path), "utf8").startsWith("---\nlesson:")
  );
}

/** What the tree holds that a Learner's copy must not: config, tests, step files, the Terminal app. */
export function templateProblems(dir) {
  const problems = [];
  for (const { path, dir: isDir } of walk(dir)) {
    const parts = path.split("/");
    const name = parts.at(-1);
    if (FORBIDDEN.includes(name)) problems.push(`${path}: live config`);
    else if (LEFTOVER.test(name)) problems.push(`${path}: a local leftover`);
    else if (isDir && path === "checks/test")
      problems.push(`${path}: the checks' tests`);
    else if (isDir && name === "ladders") problems.push(`${path}: ladders`);
    else if (isStepFile(dir, path, name, isDir))
      problems.push(`${path}: step file`);
    else if (name === "probes.mjs") problems.push(`${path}: probes`);
    else if (isDir && path === "learn/lessons")
      problems.push(`${path}: the Terminal app's lessons`);
    else if (
      !isDir &&
      parts.length === 2 &&
      parts[0] === "learn" &&
      name.endsWith(".mjs") &&
      !LEARN_MODULES.includes(name)
    )
      problems.push(`${path}: a Terminal app file`);
  }
  return problems;
}

/** Where the tree's parts sit: the Starter project wholly in project/, the answers outside it. */
export function layoutProblems(dir) {
  const problems = [];
  const project = join(dir, "project");
  if (!existsSync(project)) return ["project/ is missing"];
  const entries = readdirSync(project).sort();
  if (entries.join("\n") !== PROJECT_ENTRIES.join("\n"))
    problems.push(
      `project/ holds ${entries.join(", ")}, not ${PROJECT_ENTRIES.join(", ")}`,
    );
  for (const inside of ["checks", "capstone", "learn", ".practice"])
    if (existsSync(join(project, inside)))
      problems.push(`project/${inside} must sit at the root`);
  const projectPkg = readJson(join(project, "package.json"));
  const scripts = Object.keys(projectPkg?.scripts ?? {}).sort();
  if (scripts.join() !== "check,linkcheck,test")
    problems.push(`project/package.json scripts are ${scripts.join(", ")}`);
  if (projectPkg?.scripts?.check !== "node ../checks/run.mjs")
    problems.push("project/package.json check does not run ../checks/run.mjs");
  for (const name of readdirSync(dir))
    if (!ROOT_ENTRIES.includes(name))
      problems.push(`${name}: not a template root entry`);
  for (const at of ["checks", "capstone", ...ROOT_FILES])
    if (!existsSync(join(dir, at))) problems.push(`${at} is missing`);
  const pkg = readJson(join(dir, "package.json"));
  if (pkg) {
    if (JSON.stringify(pkg.scripts) !== '{"learn":"node learn/app.mjs"}')
      problems.push("package.json must have only the learn script");
    for (const key of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ])
      if (pkg[key] !== undefined) problems.push(`package.json has ${key}`);
    if (pkg.engines?.node !== ">=22")
      problems.push("package.json engines.node must be >=22");
  }
  return problems;
}

function readJson(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined;
}

// Import and export statements, dynamic imports and CommonJS loads, with
// block comments (JSDoc's import() types) left out. Copied from
// quest/server/test/bundle.test.ts.
function loads(code) {
  const text = code.replace(/\/\*[\s\S]*?\*\//g, "");
  return [
    ...text.matchAll(
      /^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/gm,
    ),
    ...text.matchAll(/^\s*import\s*["']([^"']+)["']/gm),
    ...text.matchAll(/\bimport\s*\(\s*([^)]*)\)/g),
    ...text.matchAll(/\brequire\s*\(\s*([^)]*)\)/g),
    ...text.matchAll(/\b(createRequire)\b/g),
  ].map((m) => m[1] ?? "");
}

/** Every load in `code` that is not a node: built-in, and every API not in every Node the copy.s engines (>=22) allow. */
export function importProblems(code) {
  return [
    ...loads(code)
      .filter((spec) => !/^["']?node:/.test(spec))
      .map((spec) => `loads ${spec}`),
    ...[...code.matchAll(/\bimport\.meta\.main\b|\bstyleText\b/g)].map(
      (m) => `uses ${m[0]}, not in every Node >=22`,
    ),
  ];
}

const camel = (id) => id.replace(/-(\w)/g, (_, c) => c.toUpperCase());

/** checks/lessons/index.mjs for the manifest's lessons, in course order. */
export function lessonIndex(manifest) {
  const checks = manifest.lessons.map((l) => l.check);
  // The typedefs the checks import (215's @ts-check host types them).
  return [
    "// @ts-check",
    "// Every lesson and capstone with a check, in course order.",
    "",
    "/**",
    " * What a check returns: true when the item passes, or the hint to show.",
    " * @typedef {true | string} Result",
    " */",
    "",
    "/**",
    " * One item of a lesson's check: `local` when it reads the Learner's",
    " * machine (the installed CLI or files under .practice/).",
    " * @typedef {{ text: string, local?: boolean, check: (repo: Repo) => Result }} Item",
    " */",
    "",
    "/** @typedef {{ title: string, items: readonly Item[] }} Lesson */",
    "",
    ...checks.map((c) => `import * as ${camel(c)} from './${c}.mjs';`),
    "/** @import { Repo } from '../repo.mjs' */",
    "",
    "/** @type {Record<string, Lesson | undefined>} */",
    `export const lessons = { ${checks.map((c) => `'${c}': ${camel(c)}`).join(", ")} };`,
    "",
  ].join("\n");
}

/** The Track my progress issue template: every Lesson by level, titled from its page. */
export function progressChecklist(manifest, pagesIndex) {
  const titles = new Map(pagesIndex.pages.map((p) => [p.path, p.title]));
  const lines = [
    "---",
    "name: Track my progress",
    "about: A checklist of every lesson and capstone in the guide, to tick off as you go",
    "title: My progress",
    "labels: []",
    "assignees: []",
    "---",
    "",
    "Tick each item when its check passes (`npm run check -- <lesson-id>` from `project/`). Electives are optional and not listed.",
  ];
  for (const level of manifest.levels) {
    lines.push("", `### ${level.id[0].toUpperCase()}${level.id.slice(1)}`, "");
    for (const lesson of manifest.lessons.filter((l) => l.level === level.id)) {
      const title = titles.get(lesson.page);
      if (!title)
        throw new Error(`${lesson.id}: no page title for ${lesson.page}`);
      lines.push(`- [ ] ${lesson.id} ${title}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

/** The copy's README from practice-template/README.source.md, its links at `ref`. */
export function templateReadme(source, ref) {
  const out = source
    .split("\n")
    .slice(1)
    .join("\n")
    .replace(/^\n+/, "")
    .replaceAll("quest-release:LICENSE)", `${REPO}/blob/${ref}/LICENSE)`)
    .replaceAll("quest-release:", `${REPO}/tree/${ref}/`);
  if (out.includes("quest-release:") || out.includes("<!--"))
    throw new Error("README.source.md: a placeholder or comment survived");
  return out;
}

/** learn/README.md: what the folder is and where its source lives. */
export function learnReadme(ref) {
  return `# learn/

The Claude Code Quest app: \`npm run learn\` at the copy's root starts it. This folder is generated by \`npm run template\` in the guide repository; do not edit it. Its source is [quest/](${REPO}/tree/${ref}/quest) at this release.

The app in \`learn/\` is under the [guide repository's license](${REPO}/blob/${ref}/LICENSE) at this release. THIRD-PARTY-NOTICES.txt holds the license notice of every package it bundles.
`;
}

/** The copy's root package.json: only `learn`, no dependencies. */
export function rootPackage() {
  return {
    name: "claude-code-practice",
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: { learn: "node learn/app.mjs" },
    engines: { node: ">=22" },
  };
}

function copyTree(from, to, skip = () => false) {
  for (const { path, dir } of walk(from)) {
    if (dir || skip(path)) continue;
    mkdirSync(dirname(join(to, path)), { recursive: true });
    writeFileSync(join(to, path), readFileSync(join(from, path)));
    // Keep the permission bits, so an executable such as project/src/cli.js
    // ships as one (a Publish commit records 100755).
    chmodSync(join(to, path), statSync(join(from, path)).mode & 0o777);
  }
}

function write(to, path, body) {
  mkdirSync(dirname(join(to, path)), { recursive: true });
  writeFileSync(join(to, path), body);
}

/** The template tree at `outDir`, which must be missing or empty. Throws when any check on it fails. */
export async function assembleTemplate({
  repoRoot,
  outDir,
  inputs = {},
  writeNotices,
}) {
  const {
    learnDir = join(repoRoot, "quest/server/dist/learn"),
    pagesIndexFile = join(repoRoot, "quest/release/dist/pages/index.json"),
    releaseCourse = join(repoRoot, "quest/release/dist/course.json"),
  } = inputs;
  const notices = writeNotices ?? (await import("./licenses.ts")).writeNotices;
  const out = resolve(outDir);
  if (existsSync(out) && readdirSync(out).length > 0)
    throw new Error(`${outDir} is not empty: give a new or empty folder.`);
  const needed = [
    join(learnDir, "app.mjs"),
    join(learnDir, "run-check.mjs"),
    join(learnDir, "course.json"),
    join(learnDir, "app/index.html"),
    pagesIndexFile,
    releaseCourse,
  ];
  const missing = needed.filter((f) => !existsSync(f));
  if (missing.length)
    throw new Error(
      `Missing ${missing.map((f) => relative(repoRoot, f)).join(", ")}. Run npm run build first.`,
    );
  mkdirSync(out, { recursive: true });

  const source = join(repoRoot, "practice-template");
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, "course/manifest.json"), "utf8"),
  );
  const pagesIndex = JSON.parse(readFileSync(pagesIndexFile, "utf8"));
  const { ref } = pagesIndex;

  copyTree(join(source, "project"), join(out, "project"));
  copyTree(join(source, "checks"), join(out, "checks"), (path) => {
    const parts = path.split("/");
    return (
      parts[0] === "test" ||
      parts.includes("ladders") ||
      parts.at(-1) === "probes.mjs"
    );
  });
  write(out, "checks/lessons/index.mjs", lessonIndex(manifest));
  copyTree(join(source, "capstone"), join(out, "capstone"));
  copyTree(join(source, ".devcontainer"), join(out, ".devcontainer"));
  write(
    out,
    ".github/workflows/progress.yml",
    readFileSync(join(source, ".github/workflows/progress.yml")),
  );
  write(
    out,
    ".github/ISSUE_TEMPLATE/track-my-progress.md",
    progressChecklist(manifest, pagesIndex),
  );
  write(
    out,
    "README.md",
    templateReadme(readFileSync(join(source, "README.source.md"), "utf8"), ref),
  );
  write(out, ".gitattributes", "learn/** linguist-generated\n");
  write(out, ".gitignore", ".practice/\nnode_modules/\n");
  write(out, "package.json", `${JSON.stringify(rootPackage(), null, 2)}\n`);

  copyTree(learnDir, join(out, "learn"));
  write(out, "learn/course.json", readFileSync(releaseCourse));
  write(out, "learn/README.md", learnReadme(ref));
  notices(repoRoot, join(out, "learn/THIRD-PARTY-NOTICES.txt"));

  const problems = [
    ...templateProblems(out),
    ...layoutProblems(out),
    ...importProblems(readFileSync(join(out, "learn/app.mjs"), "utf8")).map(
      (p) => `learn/app.mjs ${p}`,
    ),
  ];
  if (
    !readFileSync(join(out, "learn/course.json")).equals(
      readFileSync(releaseCourse),
    )
  )
    problems.push("learn/course.json is not the release course");
  const local = [repoRoot.replace(/\/+$/, ""), out];
  for (const { path, dir } of walk(out)) {
    if (dir) continue;
    const body = readFileSync(join(out, path));
    for (const at of local)
      if (body.includes(at)) problems.push(`${path} holds the path ${at}`);
  }
  if (problems.length)
    throw new Error(
      `The template at ${outDir} fails its checks:\n${problems.map((p) => `  ${p}`).join("\n")}`,
    );
  return { ref };
}

async function main() {
  // npm runs workspace scripts in quest/release; INIT_CWD is where it was typed.
  const outDir =
    process.argv[2] &&
    resolve(process.env.INIT_CWD ?? process.cwd(), process.argv[2]);
  if (!outDir) {
    console.error("Usage: npm run template -w @quest/release -- <out-dir>");
    process.exit(1);
  }
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  try {
    const { ref } = await assembleTemplate({ repoRoot, outDir });
    console.log(`Assembled the Practice template at ${ref} in ${outDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
