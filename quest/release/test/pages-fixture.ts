// Shared by the page renderer's tests: the real tree's link context, and a
// temporary git repository built from a planted fixture.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type LinkContext, treeContext } from "../src/pages.mjs";

export const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
export const fixtures = fileURLToPath(
  new URL("fixtures/pages/", import.meta.url),
);
export const diagramsDir = join(repoRoot, "quest/release/diagrams");

export function realContext(ref: string): LinkContext {
  return treeContext(repoRoot, ref);
}

const made: string[] = [];

export function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  made.push(dir);
  return dir;
}

export function removeTemp(): void {
  for (const dir of made.splice(0))
    rmSync(dir, { recursive: true, force: true });
}

// Fixture files end in .txt so the Guide's checks and Prettier leave them
// alone; the copy drops it.
function dropTxt(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) dropTxt(path);
    else if (entry.name.endsWith(".txt"))
      renameSync(path, path.slice(0, -".txt".length));
  }
}

/** A git repository holding the fixture, committed and tagged v0000.00. */
export function plantedRepo(fixture: string): string {
  const root = tempDir("quest-pages-");
  cpSync(join(fixtures, fixture), root, { recursive: true });
  dropTxt(root);
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify({ devDependencies: { mermaid: "0.0.0" } })}\n`,
  );
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, stdio: "ignore" });
  git("init", "-q");
  git("add", ".");
  git(
    "-c",
    "user.name=fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "fixture",
  );
  git("-c", "tag.gpgsign=false", "tag", "v0000.00");
  return root;
}
