// Builds a fixture's tree in a temporary git repo and runs the checks on it.
//
// A fixture folder holds fixture.json, tree/ (the head state), an optional
// base/ (the state before the change, for diff-scoped rules) and an optional
// generate.mjs. generate.mjs writes files that would be live Claude Code
// config if they were committed (.claude/, CLAUDE.md, AGENTS.md, .mcp.json),
// so they exist only in the temporary copy.
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const checkScript = join(dirname(fileURLToPath(import.meta.url)), '..', 'check.mjs');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function clearTree(root) {
  for (const entry of readdirSync(root)) {
    if (entry !== '.git') rmSync(join(root, entry), { recursive: true, force: true });
  }
}

async function addState(root, dir, generator, phase) {
  if (existsSync(dir)) cpSync(dir, root, { recursive: true });
  if (generator) await generator(root, phase);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--allow-empty', '-m', phase);
  return git(root, 'rev-parse', 'HEAD');
}

export async function materialize(fixtureDir, spec) {
  const root = mkdtempSync(join(tmpdir(), 'guide-check-'));
  git(root, 'init', '-q', '-b', 'main');
  // The fixture's own ignore rules apply; the machine's global ones do not.
  git(root, 'config', 'core.excludesFile', '/dev/null');
  git(root, 'config', 'user.name', 'fixture');
  git(root, 'config', 'user.email', 'fixture@example.invalid');
  git(root, 'config', 'commit.gpgsign', 'false');

  const genPath = join(fixtureDir, 'generate.mjs');
  const generator = existsSync(genPath)
    ? (await import(pathToFileURL(genPath).href)).default
    : null;

  let base;
  if (existsSync(join(fixtureDir, 'base'))) {
    base = await addState(root, join(fixtureDir, 'base'), generator, 'base');
    clearTree(root);
  }
  await addState(root, join(fixtureDir, 'tree'), generator, 'head');
  if (spec.tags) {
    for (const [tag, ref] of Object.entries(spec.tags)) {
      git(root, 'tag', tag, ref === 'base' ? base : 'HEAD');
    }
  }
  return { root, base, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

export function runChecks(root, { only, mode = 'pr', base, tag } = {}) {
  const args = [checkScript, '--root', root, '--mode', mode];
  if (only) args.push('--only', only);
  if (base) args.push('--base', base);
  if (tag) args.push('--tag', tag);
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
}
