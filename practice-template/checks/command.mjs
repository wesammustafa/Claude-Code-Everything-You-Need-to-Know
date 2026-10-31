// @ts-check
// Runs a command a Learner's shell would find, such as `npm` or `claude`. On
// Windows those are often npm shims that only a shell can start, so the check
// hands the shell one command line: passing an args array with `shell: true`
// prints Node's DEP0190 warning. Every caller passes fixed words, so the line
// needs no quoting.
import { spawnSync } from 'node:child_process';
/** @import { SpawnSyncOptionsWithStringEncoding } from 'node:child_process' */

/**
 * @param {string} command
 * @param {string[]} args
 * @param {SpawnSyncOptionsWithStringEncoding} options
 */
export function runCommand(command, args, options) {
  if (process.platform !== 'win32') return spawnSync(command, args, options);
  return spawnSync([command, ...args].join(' '), { ...options, shell: true });
}

// The shell, not Node, looks the command up on Windows, so a missing one is an
// exit status and a message rather than ENOENT: 9009 or cmd's "is not
// recognized", 127 or "command not found" from a POSIX shell.
/** @param {{ status: number | null, stderr?: string | null }} run */
export function shellNotFound(run) {
  return run.status === 9009 || run.status === 127 || /is not recognized as an internal or external command|command not found/.test(`${run.stderr ?? ''}`);
}
