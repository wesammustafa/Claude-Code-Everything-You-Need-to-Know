// The Publish: builds the Practice template from a release tag and makes one
// commit on the template repository's main whose tree is exactly that build.
//   1 checks out the tag in a temporary git worktree, installs and builds it;
//   2 runs the tag's own proof there, then assembles the tree a second time;
//   3 fetches the template's main and v* tags into a fresh repository and
//     refuses unless main is still the commit the last Publish made (the
//     newest v* tag), or, with --cutover, the template has no v* tag yet;
//   4 commits the tree on top of main (files the build no longer makes are
//     deleted), with an annotated tag of the same name, and shows the change;
//   5 only with --push, pushes the commit and the tag in one atomic push,
//     with the machine's own git sign-in. Never forced, never retried.
// Run it without --push first and review what it prints.
//   npm run publish:template -- <tag> [--push] [--cutover] [--remote <url>]
//     [--diff] [--skip-checks-tests] [--any-claude]
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { REPO_URL } from "./links.mjs";
import { walk } from "./template.mjs";

export const TEMPLATE_REMOTE =
  "https://github.com/wesammustafa/claude-code-practice";

/** A release tag: an Edition vYYYY.MM or a correction vYYYY.MM.N. */
export const TAG = /^v\d{4}\.\d{2}(\.\d+)?$/;

/** The proof's all-passed line; the step count belongs to the tag's proof, not to this script. */
const FULL_PROOF = /^proof: (\d+) of \1 passed$/;

const USAGE =
  "Usage: npm run publish:template -- <tag> [--push] [--cutover] [--remote <url>] [--diff] [--skip-checks-tests] [--any-claude]";

/** The options from the command line; throws a message (exit 2) on a usage error. */
export function parsePublishArgs(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        push: { type: "boolean" },
        cutover: { type: "boolean" },
        remote: { type: "string" },
        diff: { type: "boolean" },
        "skip-checks-tests": { type: "boolean" },
        "any-claude": { type: "boolean" },
      },
    });
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : error}\n${USAGE}`,
    );
  }
  const { values, positionals } = parsed;
  if (positionals.length !== 1)
    throw new Error(`Give exactly one release tag.\n${USAGE}`);
  const [tag] = positionals;
  if (!TAG.test(tag))
    throw new Error(
      `${tag} is not a release tag (vYYYY.MM or vYYYY.MM.N).\n${USAGE}`,
    );
  if (values.remote === "") throw new Error(`--remote needs a URL.\n${USAGE}`);
  return {
    tag,
    push: Boolean(values.push),
    cutover: Boolean(values.cutover),
    remote: values.remote ?? TEMPLATE_REMOTE,
    diff: Boolean(values.diff),
    skipChecksTests: Boolean(values["skip-checks-tests"]),
    anyClaude: Boolean(values["any-claude"]),
  };
}

/** The Publish commit's message: it names the release and links the Guide's Release. */
export function releaseMessage(tag, sha) {
  return [
    `Publish the Practice template at ${tag}`,
    "",
    `Source: ${REPO_URL}/tree/${tag} (${sha})`,
    `Release: ${REPO_URL}/releases/tag/${tag}`,
    "",
  ].join("\n");
}

const version = (tag) => {
  const m = tag.match(/^v(\d{4})\.(\d{2})(?:\.(\d+))?$/);
  return m
    ? [Number(m[1]), Number(m[2]), m[3] === undefined ? -1 : Number(m[3])]
    : null;
};

/** Negative, zero or positive as release tag `a` sorts before, with or after `b`. */
export function compareTags(a, b) {
  const [va, vb] = [version(a), version(b)];
  for (let i = 0; i < 3; i++) if (va[i] !== vb[i]) return va[i] - vb[i];
  return 0;
}

/** The newest release tag among `tags` by version (v2026.11 before v2026.11.1), or null. */
export function newestTag(tags) {
  const releases = tags.filter((t) => TAG.test(t)).sort(compareTags);
  return releases.at(-1) ?? null;
}

/**
 * Why this Publish may not go on the template, as a list (empty when it may).
 * `main` is the template's main commit or null; `tags` are its v* tags with
 * the commit each one peels to.
 */
export function guardMain({ main, tags, tag, cutover }) {
  const problems = [];
  const names = tags.map((t) => t.name);
  if (names.includes(tag))
    problems.push(`the template already has the tag ${tag}`);
  if (names.length === 0) {
    if (!cutover)
      problems.push(
        "the template has no v* tag: the first Publish needs --cutover",
      );
    return problems;
  }
  if (cutover)
    problems.push(
      `--cutover is only for the first Publish, and the template has v* tags (${names.join(", ")})`,
    );
  const last = newestTag(names);
  if (!last) {
    problems.push(
      `no v* tag on the template is a release tag (${names.join(", ")})`,
    );
    return problems;
  }
  if (compareTags(tag, last) <= 0)
    problems.push(
      `${tag} does not sort after the template's newest tag ${last}`,
    );
  const lastCommit = tags.find((t) => t.name === last)?.commit;
  if (main !== lastCommit)
    problems.push(
      `the template's main is ${main ?? "missing"}, not ${lastCommit} (the commit ${last} made): it was changed by hand`,
    );
  return problems;
}

/** The one push a Publish makes: the commit to main and the tag, atomically, never forced. */
export function pushArgs(remote, commit, tag) {
  return [
    "push",
    "--atomic",
    remote,
    `${commit}:refs/heads/main`,
    `refs/tags/${tag}:refs/tags/${tag}`,
  ];
}

/** Runs git and returns its standard output; throws with its standard error on a non-zero exit. */
export function runGit(argv, { cwd, env = process.env } = {}) {
  return execFileSync("git", argv, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 256 * 1024 * 1024,
  });
}

const gitError = (error) =>
  `${error?.stderr ?? ""}`.trim() ||
  (error instanceof Error ? error.message : String(error));

// Settings the commit must not take from the maintainer's machine: a global
// excludes file would drop files, autocrlf would change bytes, and the mode
// and symlink settings decide what the tree records.
const TREE_CONFIG = [
  "-c",
  "core.excludesFile=",
  "-c",
  "core.autocrlf=false",
  "-c",
  "core.safecrlf=false",
  "-c",
  "core.fileMode=true",
  "-c",
  "core.symlinks=true",
];

/**
 * The commit whose tree is exactly the files under `tree`, on `parent` (or a
 * root commit), and its annotated tag. Throws when the tree git recorded is
 * not every file under `tree`.
 */
export function buildCommit({
  git,
  repo,
  tree,
  parent,
  tag,
  message,
  scratch,
  env,
}) {
  const gitDir = join(repo, ".git");
  const index = join(scratch, "index");
  rmSync(index, { force: true });
  const indexEnv = { ...env, GIT_INDEX_FILE: index };
  git(["--git-dir", gitDir, "--work-tree", tree, ...TREE_CONFIG, "add", "-A"], {
    cwd: tree,
    env: indexEnv,
  });
  const treeSha = git(["--git-dir", gitDir, "write-tree"], {
    cwd: repo,
    env: indexEnv,
  }).trim();
  const recorded = git(["ls-tree", "-r", "-z", "--name-only", treeSha], {
    cwd: repo,
    env,
  })
    .split("\0")
    .filter(Boolean)
    .sort();
  const files = walk(tree)
    .filter((e) => !e.dir)
    .map((e) => e.path)
    .sort();
  const missing = files.filter((p) => !recorded.includes(p));
  const extra = recorded.filter((p) => !files.includes(p));
  if (missing.length || extra.length)
    throw new Error(
      [
        "the commit's tree is not the assembled tree:",
        ...missing.map((p) => `  not recorded: ${p}`),
        ...extra.map((p) => `  not assembled: ${p}`),
      ].join("\n"),
    );
  const messageFile = join(scratch, "message");
  writeFileSync(messageFile, message);
  const commit = git(
    [
      "commit-tree",
      treeSha,
      ...(parent ? ["-p", parent] : []),
      "-F",
      messageFile,
    ],
    { cwd: repo, env },
  ).trim();
  git(["tag", "-a", tag, "-F", messageFile, commit], { cwd: repo, env });
  return { commit, tree: treeSha };
}

function spawnLogged(command, args, { cwd, env, log }) {
  return new Promise((done) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    const lines = [];
    for (const stream of [child.stdout, child.stderr]) {
      let rest = "";
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        const parts = `${rest}${chunk}`.split("\n");
        rest = parts.pop() ?? "";
        for (const line of parts) {
          lines.push(line);
          log(line);
        }
      });
      stream.on("end", () => {
        if (rest) {
          lines.push(rest);
          log(rest);
        }
      });
    }
    child.on("error", (error) => {
      lines.push(error.message);
      done({ status: null, lines });
    });
    child.on("close", (status) => done({ status, lines }));
  });
}

function npm(args, { cwd, env }) {
  const run = spawnSync("npm", args, {
    cwd,
    env,
    stdio: ["ignore", "inherit", "inherit"],
    shell: process.platform === "win32",
  });
  if (run.status !== 0)
    throw new Error(`npm ${args.join(" ")} exited ${String(run.status)}`);
}

/** The real steps; the tests replace them. */
export const defaultSteps = {
  /** The tag, checked out detached in a new git worktree at `dir`. */
  checkout({ repoRoot, tag, dir, git }) {
    git(["worktree", "add", "--detach", dir, tag], { cwd: repoRoot });
    return dir;
  },
  install({ dir, env }) {
    npm(["ci", "--prefer-offline", "--no-audit", "--no-fund"], {
      cwd: dir,
      env,
    });
  },
  build({ dir, env }) {
    npm(["run", "build"], { cwd: dir, env });
  },
  /** The tag's own proof, run in its checkout: its exit status and its verdict line. */
  async proof({ dir, env, skipChecksTests, anyClaude, log }) {
    const args = [
      "quest/release/src/proof.mjs",
      ...(skipChecksTests ? ["--skip-checks-tests"] : []),
      ...(anyClaude ? ["--any-claude"] : []),
    ];
    const { status, lines } = await spawnLogged(process.execPath, args, {
      cwd: dir,
      env,
      log,
    });
    const verdict = lines
      .filter((l) => /^proof: (FAILED|PARTIAL|\d+ of \d+)/.test(l))
      .at(-1);
    return { status, verdict: verdict ?? null };
  },
  /** The tag's own assembly into `outDir`: the ref it printed. */
  async assemble({ dir, outDir, env, log }) {
    const { status, lines } = await spawnLogged(
      "npm",
      ["run", "--silent", "template", "--", outDir],
      { cwd: dir, env, log },
    );
    if (status !== 0)
      throw new Error(`npm run template exited ${String(status)}`);
    const ref = lines
      .map((l) => l.match(/^Assembled the Practice template at (\S+) in /)?.[1])
      .find(Boolean);
    return { ref: ref ?? null };
  },
};

/**
 * One Publish of `tag`: returns the exit code (0 shown or pushed, 1 refused or
 * failed). `steps` and `git` are the tests' seams; `log` receives each line.
 */
export async function publish({
  repoRoot,
  tag,
  remote,
  push = false,
  cutover = false,
  diff = false,
  skipChecksTests = false,
  anyClaude = false,
  steps = {},
  git = runGit,
  log = console.log,
}) {
  const fn = { ...defaultSteps, ...steps };
  const refuse = (...lines) => {
    for (const line of lines) log(`publish: ${line}`);
    return 1;
  };
  if (!TAG.test(tag)) return refuse(`${tag} is not a release tag`);
  // A skipped step always makes the proof partial: refuse before the build.
  if (push && skipChecksTests)
    return refuse(
      "--push needs a full proof, and --skip-checks-tests skips step 1b",
    );
  let source;
  try {
    source = git(
      ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}^{commit}`],
      {
        cwd: repoRoot,
      },
    ).trim();
  } catch {
    return refuse(`this repository has no tag ${tag}`);
  }
  const env = { ...process.env, QUEST_RELEASE_TAG: tag };
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), "quest-publish-")));
  try {
    log(`publish: ${tag} (${source}) to ${remote}`);
    const dir = await fn.checkout({
      repoRoot,
      tag,
      dir: join(scratch, "guide"),
      git,
    });
    await fn.install({ dir, env });
    await fn.build({ dir, env });

    const proved = await fn.proof({
      dir,
      env,
      skipChecksTests,
      anyClaude,
      log,
    });
    if (
      proved.status !== 0 ||
      !proved.verdict ||
      proved.verdict.startsWith("proof: FAILED")
    )
      return refuse(
        `the proof failed (${proved.verdict ?? `exit ${String(proved.status)}`}): nothing is committed`,
      );
    const full = FULL_PROOF.test(proved.verdict);
    if (!full) {
      log(
        `publish: warning: ${proved.verdict}, so this run may show the change but not push it`,
      );
      if (push) return refuse("--push needs a full proof (every step passed)");
    }

    const tree = join(scratch, "tree");
    const { ref } = await fn.assemble({ dir, outDir: tree, env, log });
    if (ref !== tag)
      return refuse(`the assembly is at ${ref ?? "no ref"}, not ${tag}`);

    const repo = join(scratch, "pub");
    git(["init", "--quiet", repo], { cwd: scratch, env });
    const heads = git(
      ["ls-remote", remote, "refs/heads/main", "refs/tags/v*"],
      {
        cwd: repo,
        env,
      },
    );
    if (/\srefs\/heads\/main$/m.test(heads))
      git(
        [
          "fetch",
          "--quiet",
          "--no-tags",
          remote,
          "refs/heads/main:refs/remotes/template/main",
        ],
        {
          cwd: repo,
          env,
        },
      );
    if (/\srefs\/tags\/v/m.test(heads))
      git(
        ["fetch", "--quiet", "--no-tags", remote, "refs/tags/v*:refs/tags/v*"],
        {
          cwd: repo,
          env,
        },
      );
    const revParse = (rev) => {
      try {
        return git(["rev-parse", "--verify", "--quiet", rev], {
          cwd: repo,
          env,
        }).trim();
      } catch {
        return null;
      }
    };
    const main = revParse("refs/remotes/template/main^{commit}");
    const tags = git(["tag", "--list", "v*"], { cwd: repo, env })
      .split("\n")
      .filter(Boolean)
      .map((name) => ({
        name,
        commit: revParse(`refs/tags/${name}^{commit}`),
      }));

    const problems = guardMain({ main, tags, tag, cutover });
    if (problems.length) {
      const last = newestTag(tags.map((t) => t.name));
      const lastCommit = tags.find((t) => t.name === last)?.commit;
      const since =
        main && lastCommit && main !== lastCommit
          ? git(["log", "--oneline", `${lastCommit}..${main}`], {
              cwd: repo,
              env,
            }).trimEnd()
          : "";
      return refuse(
        "refused, nothing is changed:",
        ...problems.map((p) => `  ${p}`),
        ...(since
          ? [
              "commits on main since the last Publish:",
              ...since.split("\n").map((l) => `  ${l}`),
            ]
          : []),
      );
    }

    // Our own tag on the new commit replaces nothing: guardMain refused a tag the template has.
    const { commit, tree: treeSha } = buildCommit({
      git,
      repo,
      tree,
      parent: main,
      tag,
      message: releaseMessage(tag, source),
      scratch,
      env,
    });
    const emptyTree = git(["hash-object", "-t", "tree", "/dev/null"], {
      cwd: repo,
      env,
    }).trim();
    log(`publish: ${proved.verdict}`);
    log(`publish: commit ${commit}`);
    log(`publish: tree ${treeSha}`);
    log(`publish: parent ${main ?? "none (a root commit)"}`);
    log(
      git(["diff", "--stat", "--summary", main ?? emptyTree, commit], {
        cwd: repo,
        env,
      }).trimEnd(),
    );
    if (diff)
      log(
        git(["diff", main ?? emptyTree, commit], { cwd: repo, env }).trimEnd(),
      );

    if (!push) {
      log("Not pushed: rerun with --push after review.");
      return 0;
    }
    try {
      git(pushArgs(remote, commit, tag), { cwd: repo, env });
    } catch (error) {
      const why = gitError(error);
      return refuse(
        /non-fast-forward|fetch first|rejected/.test(why)
          ? "the push was rejected (main moved since the fetch); nothing is retried:"
          : "the push failed:",
        ...why.split("\n").map((l) => `  ${l}`),
      );
    }
    log(`publish: pushed ${commit} to main and the tag ${tag}`);
    return 0;
  } catch (error) {
    return refuse(gitError(error));
  } finally {
    try {
      rmSync(scratch, { recursive: true, force: true });
    } catch (error) {
      log(`publish: warning: could not remove ${scratch}: ${gitError(error)}`);
    }
    try {
      git(["worktree", "prune"], { cwd: repoRoot });
    } catch {
      // A prune that fails leaves only a stale worktree entry behind.
    }
  }
}

async function main() {
  let options;
  try {
    options = parsePublishArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  }
  // npm runs workspace scripts in quest/release; a local remote path is from where it was typed.
  const local = resolve(process.env.INIT_CWD ?? process.cwd(), options.remote);
  const remote = existsSync(local) ? local : options.remote;
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  process.exitCode = await publish({ ...options, remote, repoRoot });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
