// Replays the Reference solutions into an assembled Practice template copy:
// makes the copy a fresh git repository, as "Use this template" does, then
// applies each Lesson's solutions/<id>/ to project/ in course order. A
// Lesson's files are restored from their inert names into a temporary folder
// and its steps.sh decides when they land; every commit and every SHA-bound
// evidence file comes from real git commands, never a recorded SHA.
//   npm run replay -w @quest/release -- [--through <lesson-id>] <copy>
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

/** Inert name to live name: the inverse of the Guide's inertness RENAME, plus dot-claude-plugin. */
export const RESTORE = {
  "dot-claude": ".claude",
  "dot-mcp.json": ".mcp.json",
  "CLAUDE.example.md": "CLAUDE.md",
  "CLAUDE.local.example.md": "CLAUDE.local.md",
  "AGENTS.example.md": "AGENTS.md",
  "dot-claude-plugin": ".claude-plugin",
};

const AUTHOR = { name: "Practice Learner", email: "learner@example.invalid" };

/** The environment every git step runs in: no user or system config, a fixed author, real dates. */
export function gitEnv(extra = {}) {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: AUTHOR.name,
    GIT_AUTHOR_EMAIL: AUTHOR.email,
    GIT_COMMITTER_NAME: AUTHOR.name,
    GIT_COMMITTER_EMAIL: AUTHOR.email,
    ...extra,
  };
}

const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    env: gitEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });

/** The Lesson ids in course order, from course/manifest.json. */
export function lessonOrder(repoRoot) {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, "course/manifest.json"), "utf8"),
  );
  return manifest.lessons.map((l) => l.id);
}

/** Makes an assembled copy a fresh git repository with one commit. */
export function prepareCopy(copy) {
  if (!existsSync(join(copy, "project")))
    throw new Error(
      `${copy} has no project/ folder: assemble a template first.`,
    );
  if (existsSync(join(copy, ".git")))
    throw new Error(`${copy} is already a git repository: give a fresh copy.`);
  git(copy, "-c", "init.defaultBranch=main", "init", "-q");
  git(copy, "add", "-A");
  git(copy, "commit", "-q", "-m", "Start from the practice template");
}

// Renames every inert entry under `dir`, at any depth, to its live name.
function restoreNames(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    let name = entry.name;
    if (Object.hasOwn(RESTORE, name)) {
      renameSync(join(dir, name), join(dir, RESTORE[name]));
      name = RESTORE[name];
    }
    if (entry.isDirectory()) restoreNames(join(dir, name));
  }
}

/** Applies one Lesson's Reference solution to `copy`/project by running its steps.sh. */
export function applyLesson({
  repoRoot,
  copy,
  id,
  solutionsDir = join(repoRoot, "solutions"),
}) {
  const source = join(solutionsDir, id);
  if (!existsSync(join(source, "steps.sh")))
    throw new Error(`no reference solution for ${id}`);
  const solution = mkdtempSync(join(tmpdir(), `solution-${id}-`));
  try {
    cpSync(source, solution, {
      recursive: true,
      filter: (path) => path !== join(source, "steps.sh"),
    });
    restoreNames(solution);
    execFileSync("sh", [join(source, "steps.sh")], {
      cwd: join(copy, "project"),
      env: gitEnv({ SOLUTION: solution, COPY: resolve(copy) }),
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = `${error?.stderr ?? ""}`.trim();
    throw new Error(
      `${id}: the reference solution failed: ${stderr || error.message}`,
      { cause: error },
    );
  } finally {
    rmSync(solution, { recursive: true, force: true });
  }
}

/** Prepares `copy` and applies every Lesson's solution in course order, through `through` when given. */
export function replay({ repoRoot, copy, through, onLesson, solutionsDir }) {
  const order = lessonOrder(repoRoot);
  const last =
    through === undefined ? order.length - 1 : order.indexOf(through);
  if (last < 0) throw new Error(`no lesson "${through}" in the course`);
  prepareCopy(copy);
  for (const id of order.slice(0, last + 1)) {
    applyLesson({ repoRoot, copy, id, solutionsDir });
    onLesson?.(id);
  }
}

function main() {
  const usage = "Usage: npm run replay -- [--through <lesson-id>] <copy>";
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: { through: { type: "string" } },
    });
  } catch (error) {
    console.error(`${error.message}\n${usage}`);
    process.exit(2);
  }
  const [target, extra] = parsed.positionals;
  if (!target || extra !== undefined) {
    console.error(usage);
    process.exit(2);
  }
  // npm runs workspace scripts in quest/release; INIT_CWD is where it was typed.
  const copy = resolve(process.env.INIT_CWD ?? process.cwd(), target);
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  try {
    replay({
      repoRoot,
      copy,
      through: parsed.values.through,
      onLesson: (id) => console.log(`Replayed ${id}`),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
