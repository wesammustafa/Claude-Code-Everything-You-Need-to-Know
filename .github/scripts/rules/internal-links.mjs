// Internal links and their fragments resolve, checked offline with lychee.
// Four folders are skipped, here and in the weekly external-links run that
// shares lychee(): course/steps/, practice-template/learn/lessons/ and the
// engine's reducer-course fixtures, whose quoted links resolve from their
// Guide pages, and practice-template/project/samples/, which holds the
// linkcheck tests' deliberately broken link.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { relative, sep } from 'node:path';

export const id = 'internal-links';
export const modes = ['pr', 'release'];

const SKIPPED = [
  'course/steps/',
  'practice-template/learn/lessons/',
  'quest/engine/test/fixtures/reducer-course/',
  'practice-template/project/samples/',
];

export function run(ctx) {
  return lychee(ctx, ['--offline', '--include-fragments']);
}

// Runs lychee over every Markdown page in the tree outside SKIPPED with the
// given options.
export function lychee(ctx, options) {
  const pages = ctx.files.filter((f) => f.endsWith('.md') && !SKIPPED.some((prefix) => f.startsWith(prefix)));
  if (pages.length === 0) return { status: 'pass', summary: 'no Markdown files' };
  const result = spawnSync(
    process.env.LYCHEE || 'lychee',
    ['--no-progress', ...options, '--format', 'json', '--root-dir', ctx.root, ...pages],
    { cwd: ctx.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error?.code === 'ENOENT') {
    return { status: 'fail', problems: [`lychee not found: install lychee 0.24 or set LYCHEE to its path`] };
  }
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    return { status: 'fail', problems: [`lychee exited ${result.status}: ${result.stderr.trim() || result.stdout.trim()}`] };
  }
  const problems = [];
  for (const [file, errors] of Object.entries(report.error_map ?? {})) {
    for (const e of errors) {
      const target = e.url.startsWith('file://')
        ? relative(ctx.root, fileURLToPath(e.url.split('#')[0])).split(sep).join('/') + (e.url.includes('#') ? `#${e.url.split('#')[1]}` : '')
        : e.url;
      const at = e.span ? `:${e.span.line}` : '';
      problems.push(`${file}${at}: ${target}: ${e.status?.text ?? 'error'}`);
    }
  }
  if (problems.length) return { status: 'fail', problems };
  return { status: 'pass', summary: `${report.total} links in ${pages.length} pages` };
}
