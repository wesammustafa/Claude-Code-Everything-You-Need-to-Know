// The Publish against local bare repositories standing in for the template:
// a hand edit on main is refused, a file the build no longer makes is deleted,
// the tag lands on the new commit, nothing is pushed without --push, and no
// push is ever forced. The checkout, install, build, proof and assembly are
// stubbed; `npm run publish:template` runs them for real.
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import {
  TEMPLATE_REMOTE,
  compareTags,
  guardMain,
  newestTag,
  parsePublishArgs,
  publish,
  pushArgs,
  releaseMessage,
  runGit,
  type Git,
  type PublishSteps,
} from "../src/publish.mjs";
import { removeTemp, tempDir } from "./pages-fixture";

afterAll(removeTemp);

const REPO =
  "https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know";

// Only file remotes, and nothing from the machine's git config.
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_ALLOW_PROTOCOL: "file",
  GIT_AUTHOR_NAME: "Test Owner",
  GIT_AUTHOR_EMAIL: "owner@example.com",
  GIT_COMMITTER_NAME: "Test Owner",
  GIT_COMMITTER_EMAIL: "owner@example.com",
  GIT_TERMINAL_PROMPT: "0",
};

function git(cwd: string, ...argv: string[]): string {
  return execFileSync("git", argv, {
    cwd,
    env: { ...process.env, ...GIT_ENV },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function files(dir: string, map: Record<string, string>): void {
  for (const [path, body] of Object.entries(map)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
}

const ASSEMBLED = {
  "README.md": "# Practice\n",
  "project/src/cli.js": "#!/usr/bin/env node\n",
  "learn/app.mjs": 'import "node:http";\n',
};

/** The Guide repository at a tag: one commit, tagged. */
function guideRepo(...tagNames: string[]): string {
  const dir = tempDir("quest-guide-");
  git(dir, "init", "--quiet");
  files(dir, { "README.md": "guide\n" });
  git(dir, "add", "-A");
  git(dir, "commit", "--quiet", "-m", "guide");
  for (const t of tagNames) git(dir, "tag", t);
  return dir;
}

/** A bare template repository that refuses non-fast-forward pushes and deletions. */
function bareRemote(): string {
  const dir = tempDir("quest-template-");
  git(dir, "init", "--quiet", "--bare");
  git(dir, "config", "receive.denyNonFastForwards", "true");
  git(dir, "config", "receive.denyDeletes", "true");
  return dir;
}

/** Pushes a commit holding `map` onto the remote's main (on top of it when it exists), tagged `tag`. */
function seed(
  remote: string,
  map: Record<string, string>,
  tag?: string,
): string {
  const work = tempDir("quest-seed-");
  git(work, "init", "--quiet");
  const heads = git(work, "ls-remote", remote, "refs/heads/main");
  if (heads) {
    git(work, "fetch", "--quiet", remote, "refs/heads/main");
    git(work, "checkout", "--quiet", "FETCH_HEAD");
    git(work, "rm", "--quiet", "-r", ".");
  }
  files(work, map);
  git(work, "add", "-A");
  git(work, "commit", "--quiet", "-m", "seed");
  const sha = git(work, "rev-parse", "HEAD");
  if (tag) git(work, "tag", "-a", tag, "-m", tag);
  git(
    work,
    "push",
    "--quiet",
    remote,
    `HEAD:refs/heads/main`,
    ...(tag ? [`refs/tags/${tag}`] : []),
  );
  return sha;
}

const refs = (remote: string) =>
  git(remote, "for-each-ref", "--format=%(objectname) %(refname)");

interface Run {
  code: number;
  out: string;
  calls: string[][];
}

async function run(options: {
  guide: string;
  remote: string;
  tag: string;
  push?: boolean;
  cutover?: boolean;
  diff?: boolean;
  verdict?: string;
  status?: number;
  tree?: Record<string, string>;
  beforePush?: () => void;
}): Promise<Run> {
  const lines: string[] = [];
  const calls: string[][] = [];
  const spy: Git = (argv, o = {}) => {
    calls.push(argv);
    if (argv[0] === "push") options.beforePush?.();
    return runGit(argv, {
      ...o,
      env: { ...(o.env ?? process.env), ...GIT_ENV },
    });
  };
  const steps: PublishSteps = {
    checkout: () => options.guide,
    install: () => undefined,
    build: () => undefined,
    proof: () => ({
      status: options.status ?? 0,
      verdict: options.verdict ?? "proof: 6 of 6 passed",
    }),
    assemble: ({ outDir }) => {
      files(outDir, options.tree ?? ASSEMBLED);
      chmodSync(join(outDir, "project/src/cli.js"), 0o755);
      return { ref: options.tag };
    },
  };
  const code = await publish({
    repoRoot: options.guide,
    tag: options.tag,
    remote: options.remote,
    push: options.push ?? false,
    cutover: options.cutover ?? false,
    diff: options.diff ?? false,
    steps,
    git: spy,
    log: (l) => lines.push(l),
  });
  return { code, out: lines.join("\n"), calls };
}

describe("the pure helpers", () => {
  test("parsePublishArgs: the template by default, a usage error otherwise", () => {
    expect(parsePublishArgs(["v2026.11", "--remote", "/tmp/x.git"])).toEqual({
      tag: "v2026.11",
      push: false,
      cutover: false,
      remote: "/tmp/x.git",
      diff: false,
      skipChecksTests: false,
      anyClaude: false,
    });
    expect(parsePublishArgs(["v2026.11.2", "--push", "--diff"]).remote).toBe(
      TEMPLATE_REMOTE,
    );
    expect(() => parsePublishArgs([])).toThrow(/exactly one release tag/);
    expect(() => parsePublishArgs(["2026.11"])).toThrow(/not a release tag/);
    expect(() => parsePublishArgs(["v2026.1"])).toThrow(/not a release tag/);
    expect(() => parsePublishArgs(["v2026.11", "v2026.12"])).toThrow(
      /exactly one/,
    );
    expect(() => parsePublishArgs(["v2026.11", "--force"])).toThrow(/Usage/);
    expect(() => parsePublishArgs(["v2026.11", "--remote"])).toThrow(/Usage/);
  });

  test("newestTag sorts by version: v2026.11 before v2026.11.1 before v2026.12", () => {
    expect(
      newestTag(["v2026.11.1", "v2026.12", "v2026.11", "v2026.11.10", "vx"]),
    ).toBe("v2026.12");
    expect(newestTag(["v2026.11.2", "v2026.11.10", "v2026.11"])).toBe(
      "v2026.11.10",
    );
    expect(compareTags("v2026.11", "v2026.11.1")).toBeLessThan(0);
    expect(newestTag([])).toBeNull();
  });

  test("releaseMessage names the release and links the Guide's Release, with no trailer", () => {
    expect(releaseMessage("v2026.11", "abc123")).toBe(
      [
        "Publish the Practice template at v2026.11",
        "",
        `Source: ${REPO}/tree/v2026.11 (abc123)`,
        `Release: ${REPO}/releases/tag/v2026.11`,
        "",
      ].join("\n"),
    );
  });

  test("pushArgs pushes main and the tag atomically, with no force of any kind", () => {
    const argv = pushArgs("/r.git", "c0ffee", "v2026.11");
    expect(argv).toEqual([
      "push",
      "--atomic",
      "/r.git",
      "c0ffee:refs/heads/main",
      "refs/tags/v2026.11:refs/tags/v2026.11",
    ]);
  });

  test("guardMain: the cases that refuse", () => {
    const tags = [{ name: "v2026.11", commit: "aaa" }];
    expect(
      guardMain({ main: "aaa", tags, tag: "v2026.11.1", cutover: false }),
    ).toEqual([]);
    expect(
      guardMain({ main: null, tags: [], tag: "v2026.11", cutover: true }),
    ).toEqual([]);
    expect(
      guardMain({ main: "bbb", tags: [], tag: "v2026.11", cutover: true }),
    ).toEqual([]);
    expect(
      guardMain({ main: null, tags: [], tag: "v2026.11", cutover: false })[0],
    ).toMatch(/--cutover/);
    expect(
      guardMain({ main: "aaa", tags, tag: "v2026.11.1", cutover: true })[0],
    ).toMatch(/first Publish/);
    expect(
      guardMain({ main: "bbb", tags, tag: "v2026.11.1", cutover: false })[0],
    ).toMatch(/bbb, not aaa/);
    expect(
      guardMain({ main: "aaa", tags, tag: "v2026.11", cutover: false })[0],
    ).toMatch(/already has/);
    expect(
      guardMain({ main: "aaa", tags, tag: "v2026.10", cutover: false })[0],
    ).toMatch(/does not sort after/);
  });
});

// Each spawn from a Vitest worker costs a few hundred ms on a loaded macOS
// machine, and a Publish makes about twenty git calls.
const GIT_TIMEOUT = { timeout: 90_000 };

describe("against a local bare template", GIT_TIMEOUT, () => {
  test("a hand commit on main after the last Publish is refused, naming both commits", async () => {
    const remote = bareRemote();
    const last = seed(remote, { "README.md": "old\n" }, "v2099.01.1");
    const hand = seed(remote, { "README.md": "edited by hand\n" });
    const before = refs(remote);
    const r = await run({
      guide: guideRepo("v2099.01.2"),
      remote,
      tag: "v2099.01.2",
      push: true,
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain(hand);
    expect(r.out).toContain(last);
    expect(r.out).toMatch(/changed by hand/);
    expect(r.out).toContain(hand.slice(0, 7));
    expect(refs(remote)).toBe(before);
  });

  test("a file the build no longer makes is deleted; the tag lands on the new commit; cli.js is 100755", async () => {
    const remote = bareRemote();
    const last = seed(
      remote,
      { "README.md": "old\n", "old.txt": "gone\n" },
      "v2099.01.1",
    );
    const r = await run({
      guide: guideRepo("v2099.01.2"),
      remote,
      tag: "v2099.01.2",
      push: true,
    });
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/delete mode 100644 old\.txt/);
    const main = git(remote, "rev-parse", "refs/heads/main");
    expect(git(remote, "rev-parse", "v2099.01.2^{commit}")).toBe(main);
    expect(r.out).toContain(`commit ${main}`);
    expect(git(remote, "rev-parse", `${main}^`)).toBe(last);
    expect(
      git(remote, "ls-tree", "-r", "--name-only", main).split("\n"),
    ).toEqual(["README.md", "learn/app.mjs", "project/src/cli.js"]);
    expect(git(remote, "ls-tree", main, "project/src/cli.js")).toMatch(
      /^100755 /,
    );
    expect(git(remote, "cat-file", "-t", "v2099.01.2")).toBe("tag");
    expect(git(remote, "cat-file", "-p", "v2099.01.2")).toContain(
      `Release: ${REPO}/releases/tag/v2099.01.2`,
    );
    expect(git(remote, "log", "-1", "--format=%B", main)).toContain(
      "Publish the Practice template at v2099.01.2",
    );
  });

  test("without --push nothing reaches the template, and the stat is shown", async () => {
    const remote = bareRemote();
    seed(remote, { "README.md": "old\n", "old.txt": "gone\n" }, "v2099.01.1");
    const before = refs(remote);
    const r = await run({
      guide: guideRepo("v2099.01.2"),
      remote,
      tag: "v2099.01.2",
      diff: true,
    });
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/4 files changed/);
    expect(r.out).toContain("-gone");
    expect(r.out).toContain("Not pushed: rerun with --push after review.");
    expect(refs(remote)).toBe(before);
    expect(r.calls.some((a) => a[0] === "push")).toBe(false);
  });

  test("no argv is ever forced, and a main that moves after the fetch fails the push", async () => {
    const remote = bareRemote();
    seed(remote, { "README.md": "old\n" }, "v2099.01.1");
    let racer = "";
    const r = await run({
      guide: guideRepo("v2099.01.2"),
      remote,
      tag: "v2099.01.2",
      push: true,
      beforePush: () => {
        racer = seed(remote, { "README.md": "raced\n" });
      },
    });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/push was rejected/);
    expect(git(remote, "rev-parse", "refs/heads/main")).toBe(racer);
    expect(git(remote, "tag", "--list", "v2099.01.2")).toBe("");
    const forced = /^(--force.*|-f|--mirror|--delete|-d|\+.*)$/;
    expect(r.calls.flat().filter((a) => forced.test(a))).toEqual([]);
    expect(r.calls.filter((a) => a[0] === "push")).toHaveLength(1);
  });

  test("cutover: refused without --cutover on a template with no v* tag", async () => {
    const remote = bareRemote();
    const r = await run({
      guide: guideRepo("v2099.01.1"),
      remote,
      tag: "v2099.01.1",
      push: true,
    });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/needs --cutover/);
    expect(refs(remote)).toBe("");
  });

  test("cutover onto an empty template: a root commit whose tree is the assembly, and the tag", async () => {
    const remote = bareRemote();
    const r = await run({
      guide: guideRepo("v2099.01.1"),
      remote,
      tag: "v2099.01.1",
      push: true,
      cutover: true,
    });
    expect(r.code, r.out).toBe(0);
    const main = git(remote, "rev-parse", "refs/heads/main");
    expect(git(remote, "rev-list", "--parents", "-1", main)).toBe(main);
    expect(git(remote, "rev-parse", "v2099.01.1^{commit}")).toBe(main);
    expect(r.out).toContain("parent none (a root commit)");
    expect(git(remote, "show", `${main}:README.md`)).toBe("# Practice");
    expect(
      git(remote, "ls-tree", "-r", "--name-only", main).split("\n"),
    ).toHaveLength(3);
  });

  test("cutover onto an untagged main: that main is the parent", async () => {
    const remote = bareRemote();
    const old = seed(remote, { "README.md": "terminal app\n" });
    const r = await run({
      guide: guideRepo("v2099.01.1"),
      remote,
      tag: "v2099.01.1",
      push: true,
      cutover: true,
    });
    expect(r.code, r.out).toBe(0);
    expect(git(remote, "rev-parse", "refs/heads/main^")).toBe(old);
  });

  test("cutover is refused once the template has a v* tag", async () => {
    const remote = bareRemote();
    seed(remote, { "README.md": "old\n" }, "v2099.01.1");
    const before = refs(remote);
    const r = await run({
      guide: guideRepo("v2099.01.2"),
      remote,
      tag: "v2099.01.2",
      push: true,
      cutover: true,
    });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/only for the first Publish/);
    expect(refs(remote)).toBe(before);
  });

  test("a tag the template already has, or one that sorts older, is refused", async () => {
    const remote = bareRemote();
    seed(remote, { "README.md": "old\n" }, "v2099.01.2");
    const before = refs(remote);
    const same = await run({
      guide: guideRepo("v2099.01.2"),
      remote,
      tag: "v2099.01.2",
      push: true,
    });
    expect(same.code).toBe(1);
    expect(same.out).toMatch(/already has the tag v2099\.01\.2/);
    const older = await run({
      guide: guideRepo("v2099.01.1"),
      remote,
      tag: "v2099.01.1",
      push: true,
    });
    expect(older.code).toBe(1);
    expect(older.out).toMatch(/does not sort after/);
    expect(refs(remote)).toBe(before);
  });

  test("a tag the Guide repository does not have is refused before any step", async () => {
    const remote = bareRemote();
    const r = await run({
      guide: guideRepo(),
      remote,
      tag: "v2099.01.1",
      cutover: true,
    });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/has no tag v2099\.01\.1/);
  });
});

describe("the proof decides", GIT_TIMEOUT, () => {
  test("a FAILED proof exits 1 with no commit and no fetch", async () => {
    const remote = bareRemote();
    const r = await run({
      guide: guideRepo("v2099.01.1"),
      remote,
      tag: "v2099.01.1",
      cutover: true,
      verdict: "proof: FAILED (steps 3)",
      status: 1,
    });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/nothing is committed/);
    expect(
      r.calls.some((a) =>
        ["commit-tree", "ls-remote", "fetch"].includes(a[0] ?? ""),
      ),
    ).toBe(false);
  });

  test("a PARTIAL proof is refused with --push", async () => {
    const remote = bareRemote();
    const r = await run({
      guide: guideRepo("v2099.01.1"),
      remote,
      tag: "v2099.01.1",
      cutover: true,
      push: true,
      verdict: "proof: PARTIAL (not a full proof)",
    });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/--push needs a full proof/);
    expect(refs(remote)).toBe("");
  });

  test("--push with --skip-checks-tests is refused before any step runs", async () => {
    const lines: string[] = [];
    const never = () => {
      throw new Error("a step ran");
    };
    const code = await publish({
      repoRoot: "/nonexistent",
      tag: "v2099.01.1",
      remote: "/nonexistent.git",
      push: true,
      skipChecksTests: true,
      steps: { checkout: never, install: never, build: never },
      git: never,
      log: (l) => lines.push(l),
    });
    expect(code).toBe(1);
    expect(lines.join("\n")).toMatch(/--skip-checks-tests skips step 1b/);
  });

  test("a PARTIAL proof without --push shows the change", async () => {
    const remote = bareRemote();
    const r = await run({
      guide: guideRepo("v2099.01.1"),
      remote,
      tag: "v2099.01.1",
      cutover: true,
      verdict: "proof: PARTIAL (not a full proof)",
    });
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/warning: proof: PARTIAL/);
    expect(r.out).toMatch(/3 files changed/);
    expect(refs(remote)).toBe("");
  });
});

test("publish.mjs names no credential and no force flag", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../src/publish.mjs", import.meta.url)),
    "utf8",
  );
  for (const word of [
    /credential/i,
    /token/i,
    /GITHUB_TOKEN/,
    /GH_TOKEN/,
    /netrc/i,
    /askpass/i,
    /password/i,
    /--force/,
  ])
    expect(source).not.toMatch(word);
});
