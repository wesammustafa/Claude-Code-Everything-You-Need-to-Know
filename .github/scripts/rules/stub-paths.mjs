// Every page path in the committed list still exists, as the page or its Stub.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readText } from '../lib/tree.mjs';

export const id = 'stub-paths';
export const modes = ['pr', 'release'];

export const PATHS_FILE = '.github/compat/paths.txt';

export function run(ctx) {
  if (!existsSync(join(ctx.root, PATHS_FILE))) {
    return { status: 'fail', problems: [`${PATHS_FILE} is missing`] };
  }
  const paths = readText(ctx.root, PATHS_FILE).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const missing = paths.filter((p) => !existsSync(join(ctx.root, p)));
  if (missing.length) {
    return { status: 'fail', problems: missing.map((p) => `${p}: removed; leave a Stub at this path that says where the page went`) };
  }
  return { status: 'pass', summary: `${paths.length} paths` };
}
