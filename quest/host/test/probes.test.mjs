// The git probes (ticket 105), ported from learn-probes (ticket 209): the
// probes themselves, moved from the Checks to the host in ticket 211 with
// their table in the engine, and the host's probe effect running one in
// the Check child through the real adapters.
import { test as vitest } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PROBES, probeError } from "../../engine/src/probes.ts";
import { PROBES as HOST_PROBES, probeRepo, RUNS } from "../src/probes.ts";
import { openRepo } from "../../../practice-template/checks/repo.mjs";
import {
  commit,
  repo,
  withRepo,
  write,
} from "../../../practice-template/checks/test/helpers.mjs";
import { realAdapters } from "../src/real.ts";

vitest(
  "the host runs every probe in the engine's table, and its registry is that table",
  () => {
    assert.deepEqual(Object.keys(RUNS).sort(), Object.keys(PROBES).sort());
    assert.equal(HOST_PROBES, PROBES);
  },
);

// Each makes git repositories: more time than Vitest's default.
const test = (name, fn) => vitest(name, fn, 60_000);
const { probes } = realAdapters({ root: "/nowhere" });

const git = (dir, ...args) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    cwd: dir,
    encoding: "utf8",
  }).trim();
const probe = (dir, name, ...args) => probeRepo(openRepo(dir), name, args);
const started = () => {
  const dir = repo({
    "README.md": "hi\n",
    ".gitignore": ".claude/worktrees/\n",
  });
  commit(dir, "start");
  return dir;
};

test("probes: each takes its arguments, and nothing else", () => {
  for (const ok of [
    ["worktrees", ["2"]],
    ["branch-ahead", ["feature/x"]],
    ["merged", ["a", "b-2"]],
    ["gone", [".claude/worktrees/docs-pass"]],
    ["pushed", []],
    ["todos", ["2"]],
  ]) {
    assert.equal(probeError(...ok), null, ok.join(" "));
  }
  for (const bad of [
    ["nope", []],
    ["worktrees", []],
    ["worktrees", ["0"]],
    ["worktrees", ["two"]],
    ["branch-ahead", []],
    ["branch-ahead", ["a", "b"]],
    ["branch-ahead", ["-x"]],
    ["merged", []],
    ["merged", ["a..b"]],
    ["gone", ["/abs"]],
    ["gone", ["../up"]],
    ["gone", ["./here"]],
    ["pushed", ["origin"]],
    ["todos", []],
  ]) {
    assert.ok(probeError(...bad), bad.join(" "));
  }
});

test("probes: worktrees counts the live ones under .claude/worktrees/, and gone says when one is removed", () =>
  withRepo(started, (dir) => {
    assert.equal(probe(dir, "worktrees", "1").pass, false);
    assert.match(
      probe(dir, "worktrees", "1").hint,
      /no worktree under \.claude\/worktrees\//,
    );
    git(
      dir,
      "worktree",
      "add",
      "-q",
      "-b",
      "docs-pass",
      ".claude/worktrees/docs-pass",
    );
    git(
      dir,
      "worktree",
      "add",
      "-q",
      "-b",
      "elsewhere",
      join(dir, "..", `${dir.split("/").pop()}-out`),
    );
    const one = probe(dir, "worktrees", "2");
    assert.equal(
      one.pass,
      false,
      "a worktree outside .claude/worktrees/ does not count",
    );
    assert.match(
      one.hint,
      /1 worktree under \.claude\/worktrees\/ \(docs-pass\); this step needs 2/,
    );
    git(
      dir,
      "worktree",
      "add",
      "-q",
      "-b",
      "test-pass",
      ".claude/worktrees/test-pass",
    );
    const two = probe(dir, "worktrees", "2");
    assert.deepEqual(
      [two.pass, two.evidence],
      [true, "Worktrees under .claude/worktrees/: docs-pass, test-pass"],
    );
    assert.notEqual(two.state, one.state, "the state follows the worktrees");
    assert.equal(probe(dir, "gone", ".claude/worktrees/docs-pass").pass, false);
    assert.match(
      probe(dir, "gone", ".claude/worktrees/docs-pass").hint,
      /still shows \.claude\/worktrees\/docs-pass/,
    );
    git(dir, "worktree", "remove", ".claude/worktrees/docs-pass");
    assert.deepEqual(
      [
        probe(dir, "gone", ".claude/worktrees/docs-pass").pass,
        probe(dir, "worktrees", "2").pass,
      ],
      [true, false],
    );
    // A folder deleted by hand leaves a prunable record: no live worktree.
    rmSync(join(dir, ".claude/worktrees/test-pass"), {
      recursive: true,
      force: true,
    });
    assert.equal(probe(dir, "gone", ".claude/worktrees/test-pass").pass, true);
    rmSync(join(dir, "..", `${dir.split("/").pop()}-out`), {
      recursive: true,
      force: true,
    });
  }));

test("probes: branch-ahead finds the branch and its state is its commit; merged wants each branch in HEAD", () =>
  withRepo(started, (dir) => {
    assert.deepEqual(probe(dir, "branch-ahead", "docs-pass"), {
      pass: false,
      hint: "No branch docs-pass yet.",
      state: "",
    });
    git(dir, "branch", "docs-pass");
    const before = probe(dir, "branch-ahead", "docs-pass");
    assert.equal(before.pass, true);
    git(dir, "checkout", "-q", "docs-pass");
    const sha = commit(dir, "Write the docs");
    git(dir, "checkout", "-q", "-");
    const after = probe(dir, "branch-ahead", "docs-pass");
    assert.deepEqual(
      [after.state, after.evidence],
      [sha, `docs-pass is at ${sha.slice(0, 7)}: Write the docs`],
    );
    assert.notEqual(after.state, before.state);
    assert.match(
      probe(dir, "merged", "docs-pass", "test-pass").hint,
      /No branch test-pass here/,
    );
    git(dir, "branch", "test-pass");
    assert.equal(
      probe(dir, "merged", "docs-pass", "test-pass").hint,
      "Not merged into HEAD yet: docs-pass.",
    );
    git(dir, "merge", "-q", "--no-edit", "docs-pass");
    assert.deepEqual(
      probe(dir, "merged", "docs-pass", "test-pass").evidence,
      "Merged into HEAD: docs-pass, test-pass",
    );
  }));

test("probes: pushed wants an upstream and nothing to push, read from the local refs", () =>
  withRepo(started, (dir) => {
    const remote = repo();
    try {
      git(remote, "config", "receive.denyCurrentBranch", "ignore");
      const branch = git(dir, "symbolic-ref", "--short", "HEAD");
      assert.match(
        probe(dir, "pushed").hint,
        new RegExp(`${branch} has no upstream yet`),
      );
      git(dir, "remote", "add", "origin", remote);
      git(dir, "push", "-q", "-u", "origin", branch);
      assert.deepEqual(
        [probe(dir, "pushed").pass, probe(dir, "pushed").evidence],
        [true, `${branch} is pushed to origin/${branch}`],
      );
      commit(dir, "More");
      assert.equal(
        probe(dir, "pushed").hint,
        `1 commit on ${branch} not pushed to origin/${branch} yet.`,
      );
      git(dir, "checkout", "-q", "--detach");
      assert.match(probe(dir, "pushed").hint, /HEAD is on no branch/);
    } finally {
      rmSync(remote, { recursive: true, force: true });
    }
  }));

// r27 TRIAGE-4 pattern U: a removal is committed and pushed, not any push.
test("probes: removed wants each path gone from HEAD and HEAD pushed", () =>
  withRepo(started, (dir) => {
    const remote = repo();
    try {
      assert.equal(
        probeError("removed", [
          ".github/workflows/a.yml",
          ".github/workflows/b.yml",
        ]),
        null,
      );
      for (const bad of [[], ["/abs.yml"], ["../up.yml"]])
        assert.ok(probeError("removed", bad), bad.join(" "));
      git(remote, "config", "receive.denyCurrentBranch", "ignore");
      write(dir, {
        ".github/workflows/a.yml": "on: push\n",
        ".github/workflows/b.yml": "on: push\n",
      });
      commit(dir, "Add workflows");
      const branch = git(dir, "symbolic-ref", "--short", "HEAD");
      git(dir, "remote", "add", "origin", remote);
      git(dir, "push", "-q", "-u", "origin", branch);
      const paths = [".github/workflows/a.yml", ".github/workflows/b.yml"];
      const both = probe(dir, "removed", ...paths);
      assert.deepEqual(
        [both.pass, both.hint],
        [
          false,
          "Still in the last commit: .github/workflows/a.yml, .github/workflows/b.yml. Delete them with git rm, then commit and push.",
        ],
      );
      git(dir, "rm", "-q", ".github/workflows/a.yml");
      commit(dir, "Remove a");
      assert.equal(
        probe(dir, "removed", ...paths).hint,
        "Still in the last commit: .github/workflows/b.yml. Delete it with git rm, then commit and push.",
      );
      // Any push alone doesn't pass it.
      git(dir, "push", "-q");
      assert.equal(probe(dir, "removed", ...paths).pass, false);
      git(dir, "rm", "-q", ".github/workflows/b.yml");
      commit(dir, "Remove b");
      assert.equal(
        probe(dir, "removed", ...paths).hint,
        `1 commit on ${branch} not pushed to origin/${branch} yet.`,
      );
      git(dir, "push", "-q");
      const done = probe(dir, "removed", ...paths);
      assert.deepEqual(
        [done.pass, done.evidence],
        [
          true,
          "Removed and pushed: .github/workflows/a.yml, .github/workflows/b.yml",
        ],
      );
      assert.equal(
        done.state,
        probe(dir, "pushed").state,
        "its state is the push's, so a fresh beat waits for a new push",
      );
    } finally {
      rmSync(remote, { recursive: true, force: true });
    }
  }));

test("probes: todos counts the top-level folders whose tracked files hold TODO or FIXME", () =>
  withRepo(started, (dir) => {
    assert.equal(
      probe(dir, "todos", "2").hint,
      "git grep finds TODO or FIXME in no top-level folder here; this needs 2.",
    );
    write(dir, {
      "src/a.js": "// TODO: split\n",
      "NOTES.md": "TODO at the top level\n",
      "test/deep/b.js": "// FIXME later\n",
      "docs/c.md": "nothing\n",
      "tmp/u.js": "// TODO untracked\n",
    });
    git(dir, "add", "src", "NOTES.md", "docs");
    assert.equal(
      probe(dir, "todos", "2").hint,
      "git grep finds TODO or FIXME in 1 top-level folder (src/) here; this needs 2.",
    );
    git(dir, "add", "test");
    assert.deepEqual(
      [probe(dir, "todos", "2").pass, probe(dir, "todos", "2").evidence],
      [true, "TODO or FIXME in src/, test/"],
    );
  }));

test("probes: the app runs one in its check child, which never fetches; a bad probe is an error, not a FAIL", async () => {
  const dir = started();
  try {
    git(dir, "branch", "docs-pass");
    const r = await probes.run(dir, "branch-ahead", ["docs-pass"]);
    assert.deepEqual(
      [r.pass, r.state],
      [true, git(dir, "rev-parse", "docs-pass")],
    );
    assert.match(
      (await probes.run(dir, "nope", [])).error,
      /unknown probe nope/,
    );
    assert.match(
      (await probes.run(join(dir, "missing"), "pushed", [])).error,
      /no such folder/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // Every git call a probe makes is a local read.
  const src = readFileSync(
    new URL("../src/probes.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /repo\.git\(/);
  assert.doesNotMatch(src, /["'](fetch|pull|ls-remote|remote)["']/);
});
