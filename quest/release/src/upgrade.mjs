// The upgrade proof: a Learner's copy from the template's last Terminal app
// commit, upgraded by README's own commands to an assembled template, and
// checked the way the spec's Current Learners' upgrade has it:
//   1 README's "Already have a practice copy?" holds one shell block, whose
//     first line fetches the template's main;
//   2 the copy starts from the Terminal app commit in
//     course/legacy-fingerprints.json;
//   3 a local template repository holds that commit and, on top of it, a
//     commit of the assembled tree, and the copy's git reaches it in place of
//     the template's URL (file: only from here on, so README's fetch never
//     reaches GitHub);
//   4 the copy gets modified and untracked Learner files, lesson files and a
//     Terminal app save under .practice/, and a linked worktree;
//   5 README's block runs, line by line, in bash, pwsh or Windows PowerShell;
//   6 every Learner file has its bytes at its new path, none is left at the
//     old one, and no Terminal app file lingers;
//   7 `npm ci` and `npm run check -- b-1` work from project/;
//   8 `npm run learn` at the root opens at the save's place.
// A step that cannot start because an earlier one failed is skipped.
//   npm run upgrade:verify -- --template <dir> [--from <url|path>]
//     [--shell bash|pwsh|powershell] [--keep]
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { sectionBlocks } from "../../../.github/scripts/lib/markdown.mjs";
import {
  SAVE,
  STARTER,
  rewriteProjectPackage,
} from "../../../practice-template/checks/upgrade.mjs";
import { isMain } from "./is-main.mjs";
import { snapshot, sameBytes, startLearn, verdict } from "./proof.mjs";
import { TEMPLATE_REMOTE, buildCommit, runGit } from "./publish.mjs";

const WINDOWS = process.platform === "win32";

export const SECTION = "already-have-a-practice-copy";
export const SHELLS = ["bash", "pwsh", "powershell"];

const STEPS = [
  [1, "README's upgrade commands"],
  [2, "the copy at the Terminal app commit"],
  [3, "the local template repository"],
  [4, "the Learner's files and save"],
  [5, "the commands run"],
  [6, "every Learner file at its new path"],
  [7, "npm run check from project/"],
  [8, "npm run learn at the saved place"],
];

// Commits and tags need a name, which a CI machine has none of.
const IDENTITY = {
  GIT_AUTHOR_NAME: "upgrade proof",
  GIT_AUTHOR_EMAIL: "proof@example.invalid",
  GIT_COMMITTER_NAME: "upgrade proof",
  GIT_COMMITTER_EMAIL: "proof@example.invalid",
};

/** Step 1: the block's lines, or why README's section is not one block fetching the template. */
export function readmeCommands(markdown) {
  const blocks = sectionBlocks(markdown, SECTION);
  if (blocks.length !== 1)
    return {
      ok: false,
      problems: [
        `README's #${SECTION} holds ${String(blocks.length)} code blocks, not one`,
      ],
      lines: [],
    };
  const [{ lang, lines: raw }] = blocks;
  const lines = raw.map((l) => l.trim()).filter(Boolean);
  const problems = [];
  if (lang !== "shell")
    problems.push(`its block is \`${lang}\`, not \`shell\``);
  if (!lines[0]?.includes(TEMPLATE_REMOTE))
    problems.push(`its first line does not fetch ${TEMPLATE_REMOTE}`);
  return { ok: problems.length === 0, problems, lines };
}

/** The script that runs `lines` in `shell`, stopping at the first that fails. */
export function shellScript(lines, shell) {
  if (shell === "bash") return `set -e\n${lines.join("\n")}\n`;
  // A native command's exit code, checked after each line: Windows
  // PowerShell turns git's progress on standard error into an error record,
  // so $ErrorActionPreference = 'Stop' would end a line that succeeded.
  return `${lines.map((l) => `${l}\nif ($LASTEXITCODE) { exit $LASTEXITCODE }`).join("\n")}\nexit 0\n`;
}

/** The command that runs a script file in `shell`; Git Bash on Windows, never WSL's bash. */
export function shellCommand(shell, file) {
  if (shell === "bash") {
    if (!WINDOWS) return ["bash", file];
    const exec = execFileSync("git", ["--exec-path"], {
      encoding: "utf8",
    }).trim();
    return [resolve(exec, "../../../bin/bash.exe"), file];
  }
  return [
    shell,
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    file,
  ];
}

/** The git config that sends the template's URL to `repo`, a local folder. */
export function insteadOf(repo) {
  return [`url.${pathToFileURL(repo).href}.insteadOf`, TEMPLATE_REMOTE];
}

const ROOT_FILES = ["package.json", ".gitignore"];

const inStarter = (path) =>
  STARTER.find((name) => path === name || path.startsWith(`${name}/`));

/**
 * Each Learner path before the upgrade to its path after: the Starter
 * project's into project/, .practice/ lesson files into project/.practice/,
 * the save and everything else where it was. A target two paths share, or
 * one an old path already holds, is a problem.
 */
export function mapPaths(paths) {
  const map = {};
  const problems = [];
  const all = new Set(paths);
  for (const path of paths) {
    let to = path;
    if (inStarter(path)) to = `project/${path}`;
    else if (path.startsWith(".practice/")) {
      const name = path.slice(".practice/".length);
      if (!SAVE.test(name)) to = `project/${path}`;
    }
    if (to !== path && all.has(to))
      problems.push(`${path} would overwrite ${to}`);
    if (Object.values(map).includes(to))
      problems.push(`two paths would move to ${to}`);
    map[path] = to;
  }
  return { map, problems };
}

const fail = (error) => ({
  ok: false,
  problems: (error instanceof Error ? error.message : String(error))
    .trim()
    .split("\n"),
});

function legacy(repoRoot) {
  return JSON.parse(
    readFileSync(join(repoRoot, "course/legacy-fingerprints.json"), "utf8"),
  );
}

/** Step 2: `copy` as a fresh repository at the Terminal app commit from `from`. */
export function startCopy({ copy, from, commit, env }) {
  const git = (argv) => runGit(argv, { cwd: copy, env });
  mkdirSync(copy, { recursive: true });
  git(["init", "-q", "-b", "main"]);
  git(["fetch", "-q", "--depth", "1", from, commit]);
  const fetched = git(["rev-parse", "FETCH_HEAD"]).trim();
  if (fetched !== commit)
    return { ok: false, problems: [`fetched ${fetched}, not ${commit}`] };
  git(["-c", "core.autocrlf=false", "checkout", "-q", "-B", "main", commit]);
  return { ok: true, problems: [] };
}

/** Step 3: a template repository at `repo` whose main is the assembled tree on the copy's commit. */
export function templateRepo({ copy, repo, tree, scratch, env }) {
  const git = (argv, cwd = repo) => runGit(argv, { cwd, env });
  mkdirSync(repo, { recursive: true });
  git(["init", "-q", "-b", "main"]);
  // The copy is shallow, so this one is too: git refuses a shallow root otherwise.
  git(["fetch", "-q", "--depth", "1", pathToFileURL(copy).href, "main"]);
  const parent = git(["rev-parse", "FETCH_HEAD"]).trim();
  const { commit } = buildCommit({
    git: (argv, options) => runGit(argv, options),
    repo,
    tree,
    parent,
    tag: "v0000.00-upgrade",
    message: "The assembled template, for the upgrade proof\n",
    scratch,
    env,
  });
  git(["update-ref", "refs/heads/main", commit]);
  git(["config", ...insteadOf(repo)], copy);
  return { ok: true, problems: [], commit };
}

const append = (file, text) =>
  writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from(text)]));

/** Step 4: the Learner's work in `copy`, from the save fixture under `repoRoot`. */
export function learnerFiles({ repoRoot, copy, env }) {
  const git = (argv) => runGit(argv, { cwd: copy, env });
  const first = (folder) =>
    git(["ls-files", "-z", "--", folder]).split("\0").find(Boolean);
  for (const folder of ["src", "test", "practice"]) {
    const file = first(folder);
    if (!file) return { ok: false, problems: [`the copy has no ${folder}/`] };
    append(join(copy, file), "\n// the Learner's edit\n");
  }
  append(join(copy, "LICENSE"), "\nThe Learner's line.\n");
  const pkgFile = join(copy, "package.json");
  const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
  writeFileSync(
    pkgFile,
    `${JSON.stringify({ ...pkg, "x-learner": "a field of my own" }, null, 2)}\n`,
  );
  const files = {
    "src/extra.js": "export const extra = 1;\n",
    ".claude/settings.json":
      '{ "permissions": { "deny": ["Read(./.env)"] } }\n',
    "CLAUDE.md": "# My project memory\n",
    ".practice/a-1-worktrees.txt": "worktree /somewhere\n",
    ".practice/b-2-plan.txt": "src/a.js\n",
    "my-notes.md": "Notes the Learner keeps at the root.\n",
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(copy, path)), { recursive: true });
    writeFileSync(join(copy, path), text);
  }
  const saves = join(repoRoot, "quest/host/test/fixtures/terminal-saves");
  writeFileSync(
    join(copy, ".practice/learn.json"),
    readFileSync(join(saves, "mid-lesson.json")),
  );
  writeFileSync(join(copy, ".practice/learn.json.unreadable"), "{ not json\n");
  git(["worktree", "add", "-q", "-b", "x", ".claude/worktrees/x"]);
  return { ok: true, problems: [] };
}

/** Step 5: README's lines in `shell`, from a script outside the copy. */
export function runCommands({ copy, lines, shell, scratch, env }) {
  const file = join(scratch, shell === "bash" ? "upgrade.sh" : "upgrade.ps1");
  writeFileSync(file, shellScript(lines, shell));
  const [command, ...args] = shellCommand(shell, file);
  const problems = [];
  if (shell === "bash" && WINDOWS) {
    const version = spawnSync(command, ["--version"], { encoding: "utf8" });
    if (!/msys/i.test(version.stdout ?? ""))
      return { ok: false, problems: [`${command} is not Git Bash`] };
  }
  const result = spawnSync(command, args, {
    cwd: copy,
    env,
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error)
    problems.push(`${shell} did not start: ${result.error.message}`);
  else if (result.status !== 0)
    problems.push(
      `${shell} exited ${String(result.status)}`,
      ...output.trimEnd().split("\n").slice(-15),
    );
  return { ok: problems.length === 0, problems, output };
}

/** Step 6: `after` holds every `before` path's bytes at its mapped path, and nothing the upgrade should remove. */
export function bytesMoved({ copy, before, after, oldPackage, env }) {
  const learner = Object.keys(before).filter(
    (p) =>
      inStarter(p) ||
      p.startsWith(".practice/") ||
      p.startsWith(".devcontainer/") ||
      p === "my-notes.md" ||
      p === "README.md",
  );
  const { map, problems } = mapPaths(learner);
  for (const [from, to] of Object.entries(map)) {
    // The root takes the template's package.json and .gitignore.
    if (to !== from && from in after && !ROOT_FILES.includes(from))
      problems.push(`${from} is still at its old path`);
    if (from === "package.json") {
      if (
        readFileSync(join(copy, to), "utf8") !==
        rewriteProjectPackage(oldPackage)
      )
        problems.push(`${to} is not the old one with check run from project/`);
      continue;
    }
    if (sameBytes({ [to]: before[from] }, { [to]: after[to] }).length)
      problems.push(`${to} does not have ${from}'s bytes`);
  }
  for (const path of Object.keys(after))
    if (
      path === ".practice/learn.json.unreadable-2" ||
      path.startsWith("learn/lessons/") ||
      path.startsWith("checks/test/") ||
      path === ".github/workflows/assert-checks.yml"
    )
      problems.push(`${path} is left`);
  const list = runGit(["worktree", "list", "--porcelain"], { cwd: copy, env });
  for (const line of list.split("\n")) {
    if (line.startsWith("worktree ") && !existsSync(line.slice(9)))
      problems.push(`git worktree list names ${line.slice(9)}, which is gone`);
    if (line.startsWith("prunable")) problems.push(`a worktree is ${line}`);
  }
  return { ok: problems.length === 0, problems };
}

/** Step 7: `npm ci`, then one Check, from project/: it runs and reports, passing or not. */
export function checkRuns({ copy, env }) {
  const cwd = join(copy, "project");
  const ci = spawnSync("npm", ["ci", "--no-audit", "--no-fund"], {
    cwd,
    env,
    encoding: "utf8",
    shell: WINDOWS,
  });
  if (ci.status !== 0)
    return {
      ok: false,
      problems: [
        `npm ci exited ${String(ci.status)}`,
        ...`${ci.stderr}`.trimEnd().split("\n").slice(-10),
      ],
    };
  const check = spawnSync("npm", ["run", "--silent", "check", "--", "b-1"], {
    cwd,
    env,
    encoding: "utf8",
    shell: WINDOWS,
  });
  const output = `${check.stdout ?? ""}${check.stderr ?? ""}`;
  const problems = [];
  if (check.status !== 0 && check.status !== 1)
    problems.push(`npm run check -- b-1 exited ${String(check.status)}`);
  if (
    !/^b-1 {2}\S/m.test(output) ||
    !/^ {2}(PASS|FAIL) {2}\S/m.test(output) ||
    !/^\d+ of \d+ passed$/m.test(output)
  )
    problems.push(
      "its output is not a Check's report",
      ...output.trimEnd().split("\n").slice(-10),
    );
  return { ok: problems.length === 0, problems };
}

/** The first `event: snapshot` frame's data from an SSE stream at `url`. */
export async function firstSnapshot(url, deadlineMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status !== 200)
      throw new Error(`GET ${url} answered ${String(response.status)}`);
    const decoder = new TextDecoder();
    let text = "";
    for await (const chunk of response.body) {
      text += decoder.decode(chunk, { stream: true });
      for (const frame of text.split(/\r?\n\r?\n/).slice(0, -1)) {
        const lines = frame.split(/\r?\n/);
        if (!lines.includes("event: snapshot")) continue;
        const data = lines
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        return JSON.parse(data);
      }
    }
    throw new Error(`${url} closed before a snapshot`);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

const PHASES = { welcome: "overview", intro: "overview", resume: "playing" };

/** Where a snapshot puts the Learner, to hold against the save's oracle entry. */
export function placeOf(snap) {
  return {
    complete: snap.course.levels
      .flatMap((l) => l.lessons)
      .filter((l) => l.complete)
      .map((l) => l.id),
    next: snap.course.next,
    lesson: snap.lesson.id,
    phase: snap.lesson.phase,
    step: snap.lesson.steps?.find((s) => s.state === "current")?.id ?? null,
  };
}

/** Step 8: the app at the copy's root opens where the save left off. */
export async function learnResumes({ repoRoot, copy, env }) {
  const saves = join(repoRoot, "quest/host/test/fixtures/terminal-saves");
  const save = JSON.parse(readFileSync(join(saves, "mid-lesson.json"), "utf8"));
  const oracle = JSON.parse(readFileSync(join(saves, "oracle.json"), "utf8"))[
    "mid-lesson"
  ];
  const want = {
    complete: Object.entries(save.lessons)
      .filter(([, p]) => p.complete)
      .map(([id]) => id),
    next: oracle.lesson,
    lesson: oracle.lesson,
    phase: PHASES[oracle.view],
    step: oracle.step,
  };
  const app = await startLearn(copy, { env, deadlineMs: 30_000 });
  try {
    const have = placeOf(await firstSnapshot(`${app.url}/api/events`));
    const problems = Object.keys(want)
      .filter((k) => JSON.stringify(have[k]) !== JSON.stringify(want[k]))
      .map(
        (k) =>
          `${k}: ${JSON.stringify(have[k])}, not ${JSON.stringify(want[k])}`,
      );
    return { ok: problems.length === 0, problems };
  } finally {
    await app.stop();
  }
}

export const defaultSteps = {
  startCopy,
  templateRepo,
  learnerFiles,
  runCommands,
  bytesMoved,
  checkRuns,
  learnResumes,
};

/** Runs every step and prints each one's result and the verdict; returns the results. */
export async function runUpgradeProof({
  repoRoot,
  template,
  from,
  shell = "bash",
  keep = false,
  steps = {},
  log = console.log,
}) {
  const fn = { ...defaultSteps, ...steps };
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "quest-upgrade-")));
  const copy = join(tmp, "copy");
  const scratch = join(tmp, "scratch");
  mkdirSync(scratch);
  // Step 2 fetches the old copy from GitHub when no --from is given, as in
  // CI, so only the steps after it are held to file: (README's fetch must
  // reach the local template, never GitHub).
  const fetchEnv = { ...process.env, ...IDENTITY };
  delete fetchEnv.NODE_TEST_CONTEXT;
  delete fetchEnv.GIT_ALLOW_PROTOCOL;
  const env = { ...fetchEnv, GIT_ALLOW_PROTOCOL: "file" };
  const { template: remote, commit } = legacy(repoRoot);
  const results = [];
  let lines = [];
  let before = null;
  let oldPackage = "";
  const plan = [
    () => {
      const r = readmeCommands(
        readFileSync(join(repoRoot, "README.md"), "utf8"),
      );
      lines = r.lines;
      return r;
    },
    () => fn.startCopy({ copy, from: from ?? remote, commit, env: fetchEnv }),
    () =>
      fn.templateRepo({
        copy,
        repo: join(tmp, "template"),
        tree: template,
        scratch,
        env,
      }),
    () => {
      const r = fn.learnerFiles({ repoRoot, copy, env });
      oldPackage = readFileSync(join(copy, "package.json"), "utf8");
      before = snapshot(copy);
      return r;
    },
    () => fn.runCommands({ copy, lines, shell, scratch, env }),
    () =>
      fn.bytesMoved({ copy, before, after: snapshot(copy), oldPackage, env }),
    () => fn.checkRuns({ copy, env }),
    () => fn.learnResumes({ repoRoot, copy, env }),
  ];
  try {
    let blocked = null;
    for (const [i, [n, name]] of STEPS.entries()) {
      let r;
      const started = performance.now();
      if (blocked)
        r = {
          ok: true,
          skipped: true,
          problems: [`step ${String(blocked)} failed`],
        };
      else {
        try {
          r = await plan[i]();
        } catch (error) {
          r = fail(error);
        }
        if (!r.ok) blocked = n;
      }
      const result = { n, name, ...r, ms: performance.now() - started };
      results.push(result);
      const mark = r.ok ? (r.skipped ? "SKIP" : "PASS") : "FAIL";
      log(`${mark} ${String(n)} ${name} (${String(Math.round(result.ms))} ms)`);
      for (const p of r.problems) log(`    ${p}`);
    }
    if (keep) log(`upgrade: kept the copy in ${tmp}`);
    const { failed, line } = verdict(results);
    log(line.replace(/^proof:/, `upgrade (${shell}):`));
    if (failed) process.exitCode = 1;
    return results;
  } finally {
    if (!keep) rmSync(tmp, { recursive: true, force: true });
  }
}

/** The options from the command line; throws a message (exit 2) on a usage error. */
export function parseUpgradeArgs(argv, cwd = process.cwd()) {
  const usage =
    "Usage: npm run upgrade:verify -- --template <dir> [--from <url|path>] [--shell bash|pwsh|powershell] [--keep]";
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        template: { type: "string" },
        from: { type: "string" },
        shell: { type: "string" },
        keep: { type: "boolean" },
      },
    }));
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : error}\n${usage}`,
    );
  }
  if (!values.template) throw new Error(`Give --template.\n${usage}`);
  const shell = values.shell ?? "bash";
  if (!SHELLS.includes(shell))
    throw new Error(`--shell is one of ${SHELLS.join(", ")}.\n${usage}`);
  // A local --from is a folder, fetched as file:// so --depth applies.
  const from =
    values.from && !/^[a-z][a-z0-9+.-]*:\/\//i.test(values.from)
      ? pathToFileURL(resolve(cwd, values.from)).href
      : values.from;
  return {
    template: resolve(cwd, values.template),
    from,
    shell,
    keep: Boolean(values.keep),
  };
}

if (isMain(import.meta.url)) {
  // npm runs workspace scripts in quest/release; INIT_CWD is where it was typed.
  let options;
  try {
    options = parseUpgradeArgs(
      process.argv.slice(2),
      process.env.INIT_CWD ?? process.cwd(),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  if (!existsSync(options.template) || !isAbsolute(options.template)) {
    console.error(`${options.template}: no such folder`);
    process.exit(2);
  }
  await runUpgradeProof({ repoRoot, ...options });
}
