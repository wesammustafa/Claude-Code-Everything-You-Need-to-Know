// Internal links and their fragments resolve, checked offline with lychee.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { relative, sep } from 'node:path';

export const id = 'internal-links';
export const modes = ['pr', 'release'];

export function run(ctx) {
  const pages = ctx.files.filter((f) => f.endsWith('.md'));
  if (pages.length === 0) return { status: 'pass', summary: 'no Markdown files' };
  const lychee = process.env.LYCHEE || 'lychee';
  const result = spawnSync(
    lychee,
    ['--no-progress', '--offline', '--include-fragments', '--format', 'json', '--root-dir', ctx.root, ...pages],
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
