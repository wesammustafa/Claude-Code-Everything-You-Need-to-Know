#!/usr/bin/env node
// @ts-check
// Checks your work on a lesson's exercise.
//
//   npm run check -- <lesson-id> [--dir <path>]   one lesson, here or in another repo
//   npm run check -- all [--dir <path>]           every lesson
//
// Used by this repository's workflows:
//   --summary        a Markdown table for the progress run; never fails
//   --assert fail    every lesson must fail (the template's main branch)
//   --assert pass    every lesson must pass (the template's solutions branch)
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { lessons } from './lessons/index.mjs';
import { openRepo } from './repo.mjs';
/** @import { Lesson } from './lessons/index.mjs' */

/**
 * @param {string} message
 * @returns {never}
 */
function usage(message) {
  console.error(`${message}\nusage: npm run check -- <${Object.keys(lessons).join('|')}|all> [--dir <path>]`);
  process.exit(2);
}

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: { dir: { type: 'string' }, summary: { type: 'boolean' }, assert: { type: 'string' } },
  });
} catch (error) {
  usage(/** @type {Error} */ (error).message);
}
const { values, positionals } = parsed;
const [id, extra] = positionals;
if (!id) usage('name a lesson to check');
// Some shells, such as Windows PowerShell with an older npm, drop the `--`, so
// npm keeps --dir for itself and passes only the folder on.
if (extra !== undefined) usage(`unexpected argument "${extra}". Put --dir before the folder to check. If you did, your shell dropped the --: run node checks/run.mjs ${id} --dir <folder> instead.`);
if (id !== 'all' && !lessons[id]) usage(`no check for "${id}"`);
if (values.assert && !['pass', 'fail'].includes(values.assert)) usage('--assert takes pass or fail');
// Without --dir, the folder the check runs in: project/, where the copy's
// root script changes to first. A --dir given to `npm run check` is from the
// folder it was typed in, which npm passes as INIT_CWD, so a relative path
// typed at the copy's root means the same as anywhere else.
const typedIn = process.env.npm_lifecycle_event === 'check' ? process.env.INIT_CWD : undefined;
// Run by hand at the copy's root, as `node checks/run.mjs <id>`, the check
// means project/ too: the root holds the course's folders, never the work.
const atRoot = values.dir === undefined && existsSync(resolve('project')) && existsSync(resolve('checks/run.mjs'));
const dir = values.dir === undefined ? resolve(atRoot ? 'project' : '.') : resolve(typedIn ?? '.', values.dir);
if (!existsSync(dir)) usage(`no such folder: ${dir}`);

const repo = openRepo(dir);
// usage() has refused an unknown id.
const chosen = /** @type {[string, Lesson][]} */ (id === 'all' ? Object.entries(lessons) : [[id, lessons[id]]]);
const results = chosen.map(([lessonId, lesson]) => ({
  id: lessonId,
  title: lesson.title,
  items: lesson.items.map((item) => {
    let outcome;
    try {
      outcome = item.check(repo);
    } catch (error) {
      outcome = `The check could not run: ${/** @type {Error} */ (error).message}`;
    }
    return { text: item.text, local: Boolean(item.local), pass: outcome === true, hint: outcome === true ? '' : outcome };
  }),
}));

// Each report sets the exit code and lets the process end on its own:
// process.exit() would drop output still on its way through a pipe, which a
// busy machine can leave there.
if (values.summary) {
  // The installed CLI and saved state under .practice/ belong to the
  // Learner's machine, so progress reports those items as checked locally.
  const rows = results.flatMap((l) => l.items.map((i) => `| ${l.id} | ${i.text} | ${i.local ? 'checked locally' : i.pass ? 'passed' : 'not yet'} |`));
  console.log(['## Practice progress', '', '| Lesson | Item | Result |', '|---|---|---|', ...rows, '',
    'Items marked "checked locally" use your installed CLI or files under `.practice/`, which are never pushed. Run `npm run check -- <lesson-id>` on your machine to check them.'].join('\n'));
} else if (values.assert) {
  const wrong = results.filter((l) => (values.assert === 'pass') !== l.items.every((i) => i.pass));
  for (const l of wrong) console.log(`${l.id}: expected every check to ${values.assert}, but ${values.assert === 'pass' ? 'some failed' : 'all passed'}`);
  console.log(wrong.length ? `${wrong.length} lesson(s) broke the assertion` : `Every lesson's check ${values.assert === 'pass' ? 'passes' : 'fails'}, as expected.`);
  process.exitCode = wrong.length ? 1 : 0;
} else report();

function report() {
  let failed = 0;
  for (const l of results) {
    console.log(`${l.id}  ${l.title}`);
    for (const i of l.items) {
      console.log(`  ${i.pass ? 'PASS' : 'FAIL'}  ${i.text}`);
      if (!i.pass) {
        failed += 1;
        console.log(`        ${i.hint}`);
      }
    }
  }
  const total = results.reduce((n, l) => n + l.items.length, 0);
  console.log(`\n${total - failed} of ${total} passed`);
  process.exitCode = failed ? 1 : 0;
}
