// A fresh Practice copy in a temporary folder, built from practice-template/
// with the built server bundle in its learn/, and the app run there the way
// `npm run learn` runs it. The copy is a git repository committed by "Sam
// Learner", under a HOME of its own, so the developer's global git config
// never reaches it. A stub `claude` on the server's PATH prints a version, as
// checks/test/ladders/b-1.mjs does, unless QUEST_E2E_REAL_CLAUDE=1 asks for
// the installed one.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const TEMPLATE = join(repo, "practice-template");
const BUNDLE = join(repo, "quest/server/dist/learn");

/** The version the stub prints: the CHANGELOG baseline the course is stamped at. */
export const STUB_VERSION = "2.1.308 (Claude Code)";
export const LEARNER = { name: "Sam Learner", email: "sam@example.com" };

const START_MS = 15_000;
const STOP_MS = 10_000;

export interface PracticeCopy {
  /** The copy's folder. */
  dir: string;
  /** The app's address, once started. */
  url: string;
  port: number;
  /** Everything the app printed to stdout and stderr. */
  output: () => string;
  start: () => Promise<void>;
  /** SIGTERM, then exit 0 and the stop line. */
  stop: () => Promise<void>;
  /** Stops the app, then starts it again on the same port. */
  restart: () => Promise<void>;
  /** The saved progress, root `.practice/learn.json`, or null. */
  saved: () => unknown;
  /** Writes a file in the copy, by its path relative to the copy. */
  write: (path: string, text: string) => void;
  /** Stops the app if it runs and removes the folder. */
  dispose: () => Promise<void>;
}

function git(dir: string, env: NodeJS.ProcessEnv, ...args: string[]) {
  const run = spawnSync("git", args, { cwd: dir, env, encoding: "utf8" });
  if (run.status !== 0)
    throw new Error(`git ${args.join(" ")} failed: ${run.stderr}`);
}

export function practiceCopy(): PracticeCopy {
  if (!existsSync(join(BUNDLE, "app.mjs")))
    throw new Error(
      `No server bundle at ${BUNDLE}/app.mjs: run npm run build first.`,
    );
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "quest-e2e-")));
  const dir = join(tmp, "copy");
  const home = join(tmp, "home");
  const bin = join(tmp, "bin");
  cpSync(TEMPLATE, dir, { recursive: true });
  cpSync(BUNDLE, join(dir, "learn"), { recursive: true });
  // Root .practice/ is the host's to make on its first start (ticket 277).
  mkdirSync(home);
  writeFileSync(
    join(home, ".gitconfig"),
    `[user]\n\tname = ${LEARNER.name}\n\temail = ${LEARNER.email}\n[init]\n\tdefaultBranch = main\n`,
  );
  mkdirSync(bin);
  writeFileSync(
    join(bin, "claude"),
    `#!/bin/sh\nprintf '%s\\n' '${STUB_VERSION}'\n`,
  );
  chmodSync(join(bin, "claude"), 0o755);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    PATH:
      process.env.QUEST_E2E_REAL_CLAUDE === "1"
        ? process.env.PATH
        : `${bin}${delimiter}${process.env.PATH ?? ""}`,
  };
  delete env.GIT_CONFIG_GLOBAL;
  git(dir, env, "init", "-q");
  // Stands in for the release's root .gitignore, which carries the line
  // (ticket 225 D4; the template itself has none).
  writeFileSync(join(dir, ".git/info/exclude"), ".practice/\n");
  git(dir, env, "add", "-A");
  git(dir, env, "commit", "-q", "-m", "Practice copy");

  let child: ChildProcess | null = null;
  let exited: Promise<number | null> = Promise.resolve(null);
  let printed = "";
  const copy: PracticeCopy = {
    dir,
    url: "",
    port: 0,
    output: () => printed,
    async start() {
      const base = copy.port;
      // Only this run's address: a restart's output follows the last run's.
      const from = printed.length;
      const run = spawn(process.execPath, ["learn/app.mjs"], {
        cwd: dir,
        env: { ...env, QUEST_BASE_PORT: String(base) },
        stdio: ["ignore", "pipe", "pipe"],
      });
      child = run;
      exited = new Promise((done) => {
        run.on("exit", (code) => {
          done(code);
        });
      });
      run.stderr.on("data", (chunk: Buffer) => (printed += String(chunk)));
      const address = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(
            new Error(`No address within ${String(START_MS)} ms:\n${printed}`),
          );
        }, START_MS);
        run.stdout.on("data", (chunk: Buffer) => {
          printed += String(chunk);
          const match = /http:\/\/127\.0\.0\.1:(\d+)/.exec(printed.slice(from));
          if (match) {
            clearTimeout(timer);
            resolve(match[0]);
          }
        });
        void exited.then((code) => {
          clearTimeout(timer);
          reject(
            new Error(`Exited ${String(code)} before listening:\n${printed}`),
          );
        });
      });
      const port = Number(new URL(address).port);
      // A restart must come back where the page looks for it.
      if (base !== 0 && port !== base)
        throw new Error(
          `Port ${String(base)} was taken: the app moved to ${String(port)}.`,
        );
      copy.port = port;
      copy.url = address;
    },
    async stop() {
      const run = child;
      if (run === null) return;
      child = null;
      run.kill("SIGTERM");
      const code = await Promise.race([
        exited,
        new Promise<"late">((done) => {
          setTimeout(() => {
            done("late");
          }, STOP_MS);
        }),
      ]);
      if (code !== 0) {
        run.kill("SIGKILL");
        throw new Error(`Exit ${String(code)} after SIGTERM:\n${printed}`);
      }
      const line = `Claude Code Quest stopped. To start it again, run npm run learn in ${dir}.`;
      if (!printed.includes(line)) throw new Error(`No stop line:\n${printed}`);
    },
    async restart() {
      await copy.stop();
      await copy.start();
    },
    saved() {
      const file = join(dir, ".practice/learn.json");
      return existsSync(file)
        ? (JSON.parse(readFileSync(file, "utf8")) as unknown)
        : null;
    },
    write(path, text) {
      const file = join(dir, path);
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, text);
    },
    async dispose() {
      if (child !== null) {
        child.kill("SIGKILL");
        child = null;
        await exited;
      }
      rmSync(tmp, { recursive: true, force: true });
    },
  };
  return copy;
}
