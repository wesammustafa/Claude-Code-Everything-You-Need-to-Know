// @ts-check
// Runs one command with a time limit, then ends the whole process tree it
// started, and prints what happened as JSON. stub-claude.mjs runs scripts
// through it on Windows, where spawnSync's time limit ends only bash and
// leaves whatever the script started running.
//
// Reads `{ command, args, cwd, env, timeout }` as JSON on stdin and prints
// `{ status, signal, timedOut, stdout, stderr }`, or `{ error }` when the
// command couldn't start. On Windows the tree ends with `taskkill /T /F`
// while the command is still alive; elsewhere the command gets its own
// process group, which ends with SIGKILL.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const win = process.platform === 'win32';
const { command, args, cwd, env, timeout } = JSON.parse(readFileSync(0, 'utf8'));
const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: !win });
let stdout = '';
let stderr = '';
let timedOut = false;
let done = false;
/** @type {{ status: number | null, signal: NodeJS.Signals | null } | null} */
let exited = null;
child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));

const endTree = () => {
  if (child.pid === undefined) return;
  if (win) spawnSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore', windowsHide: true });
  else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // The group has already exited.
    }
  }
};

const finish = (/** @type {object} */ result) => {
  if (done) return;
  done = true;
  clearTimeout(timer);
  process.stdout.write(JSON.stringify(result), () => process.exit(0));
};

// Something outside the tree may still hold the pipes open: stop reading
// them a second after the tree is gone.
const stopReading = () =>
  setTimeout(() => {
    child.stdout.destroy();
    child.stderr.destroy();
    finish({ status: exited?.status ?? null, signal: exited?.signal ?? (timedOut ? 'SIGKILL' : null), timedOut, stdout, stderr });
  }, 1000).unref();

const timer = setTimeout(() => {
  if (exited) return;
  timedOut = true;
  endTree();
  stopReading();
}, timeout);

child.on('error', (error) => finish({ error: { code: /** @type {NodeJS.ErrnoException} */ (error).code, message: error.message } }));
child.on('exit', (status, signal) => {
  exited = { status, signal };
  // Off Windows, whatever the script left running ends with it. On Windows
  // bash's PID is gone by now and may already name another process, so
  // nothing is killed: what the script left running outlives it.
  if (!win) endTree();
  stopReading();
});
child.on('close', (status, signal) => finish({ status, signal, timedOut, stdout, stderr }));
