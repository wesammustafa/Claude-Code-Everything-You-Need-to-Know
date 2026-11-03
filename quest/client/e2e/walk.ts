// A whole Lesson walked on a Practice copy, overview through complete, as
// a Learner who has done the Reference solution's work would walk it
// (254): every frame the page receives is recorded, every beat the course
// has is either seen or named in UNREACHED with its reason, and every
// screen on the way is held to the rules the deleted terminal tests kept.
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { expect, type Page } from "@playwright/test";
import type { Snapshot } from "@quest/contract";
import { KEY_NAMES, bar, checkAgainOn, heading, move } from "./play.ts";
import { RESTORE, gitEnv } from "../../release/src/replay.mjs";
import { repoRoot, type PracticeCopy } from "./practice-copy.ts";

/** What a recorded frame says of the page's Lesson. */
export interface Frame {
  instance: string;
  revision: number;
  lesson: string;
  phase: string;
  step: string | null;
  beat: number | null;
  status: string | null;
  decidedBy: string | null;
  milestones: string[];
}

interface CourseBeat {
  kind: string;
  skill?: string;
  verify?: { kind: string; fresh?: true; path?: string };
  evidence?: string;
  lines?: { key: string; text: string }[];
}
interface CourseStep {
  id: string;
  title: string;
  part: string;
  skill?: string;
  beats: CourseBeat[];
}
interface CourseLesson {
  id: string;
  newCopy?: boolean;
  content: {
    worked?: string;
    intro?: { payoff?: string };
    warmup: CourseStep[];
    steps: CourseStep[];
  };
}

let course: CourseLesson[] | null = null;
/** The compiled course, read-only. */
export function courseLessons(): CourseLesson[] {
  course ??= (
    JSON.parse(
      readFileSync(
        join(import.meta.dirname, "../../engine/dist/course.json"),
        "utf8",
      ),
    ) as { lessons: CourseLesson[] }
  ).lessons;
  return course;
}

/** A beat's key: "lesson:step.beat", the beat counted from 0. */
export const beatKey = (lesson: string, step: string, beat: number) =>
  `${lesson}:${step}.${String(beat)}`;

/** Every beat of Lesson `id`, warm-ups first, as keys. */
export function expectedBeats(id: string): string[] {
  const lesson = courseLessons().find((l) => l.id === id);
  if (lesson === undefined) throw new Error(`no lesson "${id}" in the course`);
  return [...lesson.content.warmup, ...lesson.content.steps].flatMap((step) =>
    step.beats.map((_, n) => beatKey(id, step.id, n)),
  );
}

/**
 * The skill a save must have missed for Lesson `id` to start on its first
 * warm-up (engine pickWarmups: one warm-up, on a missed skill only), or
 * null for a Lesson with none.
 */
export function warmupSkill(id: string): string | null {
  const first = courseLessons().find((l) => l.id === id)?.content.warmup[0];
  return first?.beats[0]?.skill ?? first?.skill ?? null;
}

/** The heading a step's card shows, by its id. */
export function stepTitle(id: string, step: string): string {
  const lesson = courseLessons().find((l) => l.id === id);
  const found = [
    ...(lesson?.content.warmup ?? []),
    ...(lesson?.content.steps ?? []),
  ].find((s) => s.id === step);
  if (found === undefined) throw new Error(`no step ${id}:${step}`);
  return found.title;
}

/**
 * Records every snapshot the page takes in, from POST /api/actions replies
 * and from the event stream (a watched beat moves on over the stream with
 * no POST), as frames on window.__walkFrames.
 */
export async function recordFrames(page: Page) {
  await page.addInitScript(() => {
    const frames: unknown[] = [];
    (window as unknown as { __walkFrames: unknown[] }).__walkFrames = frames;
    const take = (snapshot: Snapshot | undefined) => {
      if (snapshot === undefined) return;
      const lesson = snapshot.lesson;
      const playing = lesson.phase === "playing" ? lesson : null;
      frames.push({
        instance: snapshot.instance,
        revision: snapshot.revision,
        lesson: lesson.id,
        phase: lesson.phase,
        step: playing?.step?.id ?? null,
        beat: playing?.beat?.index ?? null,
        status: playing?.beat?.status ?? null,
        decidedBy: playing?.beat?.decidedBy ?? null,
        milestones: snapshot.milestones.map((m) => m.id),
      });
    };
    const Source = window.EventSource;
    window.EventSource = class extends Source {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init);
        this.addEventListener("snapshot", (event) => {
          try {
            take(JSON.parse(String(event.data)) as Snapshot);
          } catch {
            // Not a snapshot the walk can read; the app reports its own.
          }
        });
      }
    };
    const send = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await send(input, init);
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.endsWith("/api/actions") && response.ok)
        void response
          .clone()
          .json()
          .then((body: { snapshot?: Snapshot }) => {
            take(body.snapshot);
          })
          .catch(() => undefined);
      return response;
    };
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { __walkFrames: Frame[] }).__walkFrames,
    );
}

/**
 * The state the Learner has made by a beat, where the replayed final state
 * is not it: an intermediate file the step asks for, a file only a worked
 * example makes, or a git fact a probe looks for. Applied once, on the
 * beat's waiting or Not yet, in the Lesson's work folder (the copy's
 * project/, or the Work folder given).
 */
type Stage = (dir: string) => void;

const EXAMPLES = join(repoRoot, "examples");
const SOLUTIONS = join(repoRoot, "solutions");
// Live name to inert name: RESTORE's inverse, for a path in solutions/.
const INERT = Object.fromEntries(
  Object.entries(RESTORE).map(([inert, live]) => [live, inert]),
);
const inert = (path: string) =>
  path
    .split("/")
    .map((part) => INERT[part] ?? part)
    .join("/");

/** Writes `text` at `path`. */
const put =
  (path: string, text: string): Stage =>
  (dir) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
/** Adds `line` at the end of `path`. */
const add =
  (path: string, line: string): Stage =>
  (dir) => {
    appendFileSync(join(dir, path), `${line}\n`);
  };
/** Copies `path` from an example under examples/, by its inert path there. */
const example = (path: string, from: string): Stage =>
  put(path, readFileSync(join(EXAMPLES, from), "utf8"));
/** Puts `path` back as Lesson `id`'s Reference solution has it. */
const restore =
  (id: string, path: string): Stage =>
  (dir) => {
    put(path, readFileSync(join(SOLUTIONS, id, inert(path)), "utf8"))(dir);
  };
/** Runs git in the work folder, as replay.mjs runs it. */
const git =
  (...args: string[]): Stage =>
  (dir) => {
    const run = spawnSync("git", args, {
      cwd: dir,
      env: gitEnv(),
      encoding: "utf8",
    });
    if (run.status !== 0)
      throw new Error(`git ${args.join(" ")} failed: ${run.stderr}`);
  };
const executable =
  (path: string): Stage =>
  (dir) => {
    chmodSync(join(dir, path), 0o755);
  };
/** Keeps `path` out of git as Claude Code keeps its local settings file out. */
const exclude =
  (path: string): Stage =>
  (dir) => {
    const ask = (...args: string[]) =>
      spawnSync("git", args, {
        cwd: dir,
        env: gitEnv(),
        encoding: "utf8",
      }).stdout.trim();
    const file = join(dir, ask("rev-parse", "--git-path", "info/exclude"));
    appendFileSync(file, `/${ask("rev-parse", "--show-prefix")}${path}\n`);
  };
/** Rewrites the JSON file at `path` from Lesson `id`'s solution, changed by `edit`. */
const solutionJson =
  (
    id: string,
    path: string,
    edit: (json: Record<string, unknown>) => void,
  ): Stage =>
  (dir) => {
    const json = JSON.parse(
      readFileSync(join(SOLUTIONS, id, inert(path)), "utf8"),
    ) as Record<string, unknown>;
    edit(json);
    put(path, `${JSON.stringify(json, null, 2)}\n`)(dir);
  };
/**
 * A stage the walk applies again on each try: a commit a fresh git look
 * may have stamped as the step's start.
 */
const REPEATS = new WeakSet<Stage>();
const each = (stage: Stage): Stage => {
  REPEATS.add(stage);
  return stage;
};
let commits = 0;
/**
 * A new commit on a new file, as "make a small change and commit it":
 * committed from the index before the file lands, so no look sees it
 * uncommitted.
 */
const smallCommit = (): Stage =>
  each((dir) => {
    commits += 1;
    const text = `A small change, ${String(commits)}.\n`;
    const blob = spawnSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: dir,
      env: gitEnv(),
      input: text,
      encoding: "utf8",
    }).stdout.trim();
    const prefix = spawnSync("git", ["rev-parse", "--show-prefix"], {
      cwd: dir,
      env: gitEnv(),
      encoding: "utf8",
    }).stdout.trim();
    git(
      "update-index",
      "--add",
      "--cacheinfo",
      `100644,${blob},${prefix}NOTES.md`,
    )(dir);
    git("commit", "-q", "-m", "Make a small change")(dir);
    put("NOTES.md", text)(dir);
  });
/**
 * Commits what is staged and pushes it, as the step's commit and git push:
 * pushed before the branch moves, so no look sees it committed and not
 * pushed.
 */
const commitAndPush =
  (message: string): Stage =>
  (dir) => {
    const ask = (...args: string[]) => {
      const run = spawnSync("git", args, {
        cwd: dir,
        env: gitEnv(),
        encoding: "utf8",
      });
      if (run.status !== 0)
        throw new Error(`git ${args.join(" ")} failed: ${run.stderr}`);
      return run.stdout.trim();
    };
    const sha = ask(
      "commit-tree",
      ask("write-tree"),
      "-p",
      "HEAD",
      "-m",
      message,
    );
    const branch = ask("symbolic-ref", "--short", "HEAD");
    ask("push", "-q", "origin", `${sha}:refs/heads/${branch}`);
    ask("update-ref", "HEAD", sha);
  };
const all =
  (...stages: Stage[]): Stage =>
  (dir) => {
    for (const stage of stages) stage(dir);
  };

const POST_TOOL_USE = [
  {
    matcher: "Edit|Write",
    hooks: [
      {
        type: "command",
        command: "${CLAUDE_PROJECT_DIR}/.claude/hooks/format-after-edit.sh",
        args: [],
      },
    ],
  },
];
const WT = ".claude/worktrees";
const API_KEY =
  "the walk answers An API key at W2.1: this beat is A subscription token's";
const FIVE_WHYS = ".claude/skills/five-whys/SKILL.md";
const LOADED = ".practice/i-2-loaded.txt";

const SANDBOX_LOCAL = all(
  put(
    ".claude/settings.local.json",
    '{\n  "sandbox": { "enabled": true }\n}\n',
  ),
  exclude(".claude/settings.local.json"),
);
export const STAGE: Record<string, Stage> = {
  // i-1: the worked example's downloaded skill, the partial tdd skill, the
  // trigger chosen, and the two skills committed together.
  "i-1:W1.0": example(
    FIVE_WHYS,
    "intermediate/01-first-skill/dot-claude/skills/five-whys/SKILL.md",
  ),
  "i-1:Y1.0": example(
    ".claude/skills/tdd/SKILL.md",
    "intermediate/01-first-skill/dot-claude/skills/tdd/SKILL.md",
  ),
  "i-1:Y2.0": restore("i-1", ".claude/skills/tdd/SKILL.md"),
  "i-1:Y3.1": all(
    git("add", ".claude/skills/five-whys"),
    git("commit", "-q", "-m", "Add project skills"),
  ),
  // i-2: the worked example's import, rule and load log lines.
  "i-2:W1.0": add("CLAUDE.md", "- npm scripts: @package.json"),
  "i-2:W5.0": (dir) => {
    add(LOADED, `path_glob_match\t${dir}/.claude/rules/testing.md`)(dir);
  },
  // The teammate's rule as given, with its wrong pattern; each new logged
  // session adds its lines to the log; then the pattern fixed.
  "i-2:Y1.0": put(
    ".claude/rules/cli.md",
    '---\npaths:\n  - "source/**/*.js"\n---\n\n# CLI output\n\n- Print errors to stderr, starting with `linkcheck:`.\n',
  ),
  "i-2:Y2.0": (dir) => {
    add(LOADED, `session_start\t${dir}/CLAUDE.md`)(dir);
  },
  "i-2:Y4.0": restore("i-2", ".claude/rules/cli.md"),
  "i-2:Y4.1": (dir) => {
    add(LOADED, `session_start\t${dir}/CLAUDE.md`)(dir);
  },
  "i-2:Y4.2": (dir) => {
    add(LOADED, `path_glob_match\t${dir}/.claude/rules/cli.md`)(dir);
  },
  // i-3: the effort line on i-1's downloaded skill (which i-1's solution
  // leaves out, so it is downloaded again), the partial changelog skill, then
  // its choices.
  "i-3:W4.0": (dir) => {
    if (!existsSync(join(dir, FIVE_WHYS))) STAGE["i-1:W1.0"]?.(dir);
    const text = readFileSync(join(dir, FIVE_WHYS), "utf8");
    writeFileSync(
      join(dir, FIVE_WHYS),
      text.replace(/^(---\n[\s\S]*?)(\n---\n)/, "$1\neffort: high$2"),
    );
  },
  "i-3:Y1.0": (dir) => {
    const path = ".claude/skills/changelog/SKILL.md";
    const text = readFileSync(join(SOLUTIONS, "i-3", inert(path)), "utf8");
    put(
      path,
      text
        .replace(/^model: .*$/m, "model: TODO")
        .replace(/^effort: .*$/m, "effort: TODO"),
    )(dir);
  },
  "i-3:Y2.0": restore("i-3", ".claude/skills/changelog/SKILL.md"),
  // A change staged for /changelog, then everything committed.
  "i-3:Y3.0": all(
    put("NOTES.md", "A staged change.\n"),
    git("add", "NOTES.md"),
  ),
  "i-3:Y4.0": all(
    git("add", "-A"),
    git("commit", "-q", "-m", "Add a changelog entry"),
  ),
  // i-4: the personal sandbox setting, kept out of git as Claude Code keeps
  // it: in the copy's project/ for the Worked example, then in the Work
  // folder for Your turn (one folder in the Practice copy).
  "i-4:W4.0": SANDBOX_LOCAL,
  "i-4:Y3.0": SANDBOX_LOCAL,
  // i-5: the two downloaded hooks, both registered, the gate's skeleton,
  // then the gate finished and registered in place of the formatter.
  "i-5:W1.0": all(
    example(
      ".claude/hooks/protect-files.sh",
      "intermediate/05-hooks/dot-claude/hooks/protect-files.sh",
    ),
    example(
      ".claude/hooks/format-after-edit.sh",
      "intermediate/05-hooks/dot-claude/hooks/format-after-edit.sh",
    ),
    executable(".claude/hooks/protect-files.sh"),
    executable(".claude/hooks/format-after-edit.sh"),
  ),
  "i-5:W2.0": solutionJson("i-5", ".claude/settings.json", (json) => {
    const hooks = json.hooks as Record<string, unknown>;
    delete hooks.Stop;
    hooks.PostToolUse = POST_TOOL_USE;
  }),
  "i-5:Y1.1": put(
    ".claude/hooks/test-gate.sh",
    '#!/bin/bash\nINPUT=$(cat)\ncd "$CLAUDE_PROJECT_DIR"\n\n# TODO: exit 0 when stop_hook_active is true, so Claude can stop after one retry\n# TODO: run the test command; if it fails, print a reason to stderr and exit 2\n\nexit 0\n',
  ),
  "i-5:Y1.2": all(
    restore("i-5", ".claude/hooks/test-gate.sh"),
    executable(".claude/hooks/test-gate.sh"),
  ),
  "i-5:Y2.0": solutionJson("i-5", ".claude/settings.json", (json) => {
    const hooks = json.hooks as Record<string, unknown>;
    hooks.PostToolUse = POST_TOOL_USE;
  }),
  // "Commit the three hook scripts and the settings" (Y4): its Check passes
  // on the replayed commit, so the walk commits at Y5's clean look; i-5's
  // solution leaves the formatter out (254 Notes).
  "i-5:Y5.1": all(
    git("add", ".claude/hooks", ".claude/settings.json"),
    git("commit", "-q", "-m", "Add the hooks"),
  ),
  // i-6: the downloaded reviewer, the helper's skeleton, then finished.
  "i-6:W1.0": example(
    ".claude/agents/code-reviewer.md",
    "intermediate/06-subagents/dot-claude/agents/code-reviewer.md",
  ),
  "i-6:Y1.0": put(
    ".claude/agents/test-gaps.md",
    "---\nname: test-gaps\ndescription: TODO\ntools: TODO\n---\n\nList exported functions no test calls. Never change files.\nReport each by file and suggest a test. If all are called, say so.\n",
  ),
  "i-6:Y1.1": restore("i-6", ".claude/agents/test-gaps.md"),
  // i-7: the page with its planted bug, then repaired.
  "i-7:W1.0": put(
    ".practice/demo.html",
    '<!doctype html>\n<title>Linkcheck demo</title>\n<a href="#guide">Guide</a> <a href="#reference">Reference</a>\n<p id="link-count">Counting links...</p>\n<script>\nconst links = document.querySelectorAll(\'a\');\ndocument.querySelector(\'#link-total\').textContent = `${links.length} links ready`;\n</script>\n',
  ),
  "i-7:Y5.1": restore("i-7", ".practice/demo.html"),
  // i-8: the language server plugin trialled locally, and a committed change.
  "i-8:W2.2": all(
    put(
      ".claude/settings.local.json",
      '{\n  "enabledPlugins": { "typescript-lsp@claude-plugins-official": true }\n}\n',
    ),
    exclude(".claude/settings.local.json"),
  ),
  "i-8:W3.2": smallCommit(),
  // a-1: a remote to push to, the two worked-example worktrees on the
  // replayed branches, a commit in each, merged, then removed; then the
  // Learner's own pair.
  "a-1:W1.1": (dir) => {
    const remote = join(dir, "../../remote.git");
    git("init", "-q", "--bare", remote)(dir);
    git("remote", "add", "origin", remote)(dir);
    git("push", "-q", "-u", "origin", "HEAD")(dir);
  },
  "a-1:W2.0": git(
    "worktree",
    "add",
    "-q",
    `${WT}/docs-pass`,
    "worktree-docs-pass",
  ),
  "a-1:W3.0": git(
    "worktree",
    "add",
    "-q",
    `${WT}/test-pass`,
    "worktree-test-pass",
  ),
  "a-1:W4.1": git(
    "-C",
    `${WT}/docs-pass`,
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "Docs pass",
  ),
  "a-1:W4.2": git(
    "-C",
    `${WT}/test-pass`,
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "Test pass",
  ),
  "a-1:W5.0": all(
    git("merge", "-q", "--no-edit", "worktree-docs-pass"),
    git("merge", "-q", "--no-edit", "worktree-test-pass"),
  ),
  "a-1:W6.1": git("worktree", "remove", `${WT}/docs-pass`),
  "a-1:W6.2": git("worktree", "remove", `${WT}/test-pass`),
  "a-1:Y2.0": git(
    "worktree",
    "add",
    "-q",
    "-b",
    "worktree-fence",
    `${WT}/fence`,
  ),
  "a-1:Y3.0": git(
    "worktree",
    "add",
    "-q",
    "-b",
    "worktree-cli-test",
    `${WT}/cli-test`,
  ),
  "a-1:Y4.0": (dir) => {
    for (const name of ["fence", "cli-test"]) {
      put(`${WT}/${name}/project/${name}.txt`, `${name}\n`)(dir);
      git("-C", `${WT}/${name}`, "add", "-A")(dir);
      git("-C", `${WT}/${name}`, "commit", "-q", "-m", `Change ${name}`)(dir);
    }
    const run = spawnSync("git", ["worktree", "list", "--porcelain"], {
      cwd: dir,
      env: gitEnv(),
      encoding: "utf8",
    });
    put(".practice/a-1-worktrees.txt", run.stdout)(dir);
  },
  "a-1:Y5.0": all(
    git("merge", "-q", "--no-edit", "worktree-fence"),
    git("merge", "-q", "--no-edit", "worktree-cli-test"),
  ),
  "a-1:Y6.2": all(
    git("worktree", "remove", `${WT}/fence`),
    git("worktree", "remove", `${WT}/cli-test`),
  ),
  // a-4: the three headless runs' JSON, as claude -p --output-format json
  // writes it.
  "a-4:W1.0": put(
    ".practice/a-4-first.json",
    '{"type":"result","subtype":"success","is_error":false,"structured_output":{"summary":"Checks the links in Markdown files.","test_command":"npm test"}}\n',
  ),
  "a-4:W2.1": put(
    ".practice/a-4-denied.json",
    '{"type":"result","subtype":"success","is_error":false,"permission_denials":[{"tool_name":"Bash","tool_use_id":"toolu_1","tool_input":{"command":"npm test"}}]}\n',
  ),
  "a-4:W4.2": put(
    ".practice/a-4-capped.json",
    '{"type":"result","subtype":"error_max_turns","is_error":true,"num_turns":2}\n',
  ),
  // a-6: the downloaded marketplace (the replay committed it: taken back
  // out of the index), committed without the piece Your turn moves in, the
  // personal opt-out and its removal, then everything committed.
  "a-6:W1.0": git("rm", "-r", "-q", "--cached", "team-marketplace"),
  "a-6:W4.0": all(
    git(
      "add",
      "team-marketplace",
      ".claude/settings.json",
      ":!team-marketplace/plugins/team-kit/skills/review-checklist",
    ),
    git("commit", "-q", "-m", "Share the team's Claude Code setup"),
  ),
  "a-6:W6.0": put(
    ".claude/settings.local.json",
    '{\n  "enabledPlugins": { "team-kit@team-tools": false }\n}\n',
  ),
  "a-6:W6.2": put(".claude/settings.local.json", "{}\n"),
  "a-6:Y5.0": all(
    git("add", "-A"),
    git("commit", "-q", "-m", "Move the review checklist into the team kit"),
  ),
  // a-7: the worked example's bounds and runner as the page gives them,
  // committed; then the Learner's narrowed pair, committed.
  "a-7:W1.0": (dir) => {
    put(".claude/bounded-run.json", `${codeOf("a-7:W1.0")}\n`)(dir);
  },
  "a-7:W2.0": (dir) => {
    put("scripts/bounded-run.sh", `${codeOf("a-7:W2.0")}\n`)(dir);
  },
  "a-7:W3.0": all(
    executable("scripts/bounded-run.sh"),
    git("add", "scripts/bounded-run.sh", ".claude/bounded-run.json"),
    git("commit", "-q", "-m", "Add a bounded runner for unattended tasks"),
  ),
  "a-7:Y1.1": restore("a-7", ".claude/bounded-run.json"),
  "a-7:Y2.0": restore("a-7", "scripts/bounded-run.sh"),
  "a-7:Y3.0": each(
    all(
      git("add", "scripts/bounded-run.sh", ".claude/bounded-run.json"),
      git("commit", "-q", "--allow-empty", "-m", "Narrow the bounds"),
    ),
  ),
  "a-7:Y4.2": smallCommit(),
  // a-5, in its new copy: the hand-started workflow as the page gives it,
  // committed and pushed to a remote of its own; the report workflow (its
  // solution removes it at the end, so it comes back first); then both
  // removed and pushed.
  "a-5:W1.0": (dir) => {
    put(".github/workflows/ask-claude.yml", `${codeOf("a-5:W1.0")}\n`)(dir);
  },
  "a-5:W1.3": (dir) => {
    const remote = join(dir, "../../actions-remote.git");
    if (!existsSync(remote)) {
      git("init", "-q", "--bare", remote)(dir);
      git("remote", "add", "origin", remote)(dir);
      git("push", "-q", "-u", "origin", "HEAD")(dir);
    }
    git("add", ".github/workflows/ask-claude.yml")(dir);
    commitAndPush("Add a workflow you start by hand")(dir);
  },
  "a-5:Y1.0": restore("a-5", ".github/workflows/linkcheck-report.yml"),
  "a-5:Y1.2": all(
    git("add", ".github/workflows/linkcheck-report.yml"),
    commitAndPush("Add a workflow that reports broken links"),
  ),
  "a-5:Y5.0": all(
    git(
      "rm",
      "-q",
      "--ignore-unmatch",
      ".github/workflows/ask-claude.yml",
      ".github/workflows/linkcheck-report.yml",
    ),
    commitAndPush("Remove the Claude workflows"),
  ),
  // a-capstone: the review workflow back (its solution removes it at the
  // end), committed and pushed, then removed again and pushed.
  "a-capstone:T5.0": all(
    restore("a-capstone", ".github/workflows/claude-review.yml"),
    git("add", ".github/workflows/claude-review.yml"),
    commitAndPush("Review pull requests with the team review skill"),
  ),
  "a-capstone:D1.0": all(
    git("rm", "-q", "--ignore-unmatch", ".github/workflows/claude-review.yml"),
    commitAndPush("Remove the pull request review workflow"),
  ),
};

/** Beats a straight walk does not take, each with its reason. */
export const UNREACHED: Record<string, string> = {
  ...Object.fromEntries(
    courseLessons().flatMap((lesson) =>
      lesson.content.warmup
        .slice(1)
        .flatMap((step) =>
          step.beats.map((_, n) => [
            beatKey(lesson.id, step.id, n),
            "a Lesson starts on one warm-up (engine rules.ts WARMUPS), on the skill the walk's save missed",
          ]),
        ),
    ),
  ),
  "a-5:W2.3": API_KEY,
  "a-5:W2.4": API_KEY,
  "a-5:W2.5": API_KEY,
  "a-5:Y6.2": API_KEY,
  "a-5:Y7.2": API_KEY,
  "a-6:Y2.2": "the walk answers A skill at Y2.0: this beat is A subagent's",
  "a-6:Y2.3": "the walk answers A skill at Y2.0: this beat is A hook's",
  "a-capstone:D3.2":
    "the walk answers a Claude Console API key at T5.2: this beat is a setup-token's",
};

/** Brings every file of the Lesson's work to now, so a fresh check sees it changed. */
function freshen(dir: string) {
  const now = new Date();
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) utimesSync(path, now, now);
    }
  };
  if (existsSync(dir) && statSync(dir).isDirectory()) walk(dir);
}

/** The code block a beat shows, by its key: what the page asks to save. */
export function codeOf(key: string): string {
  const [id = "", at = ""] = key.split(":");
  const line = beatsOf(id)
    .get(`${id}:${at}`)
    ?.lines?.find((l) => l.key === "code");
  if (line === undefined) throw new Error(`${key} shows no code block`);
  return line.text;
}

/** Lesson `id`'s beats by key. */
function beatsOf(id: string): Map<string, CourseBeat> {
  const lesson = courseLessons().find((l) => l.id === id);
  const beats = new Map<string, CourseBeat>();
  for (const step of [
    ...(lesson?.content.warmup ?? []),
    ...(lesson?.content.steps ?? []),
  ])
    step.beats.forEach((beat, n) => beats.set(beatKey(id, step.id, n), beat));
  return beats;
}

/**
 * Takes out, before the app starts, every file a fresh match of Lesson
 * `id` reads that the replay left in `dir`: it reads only what was written
 * after its step opened, as the Learner writes it then. The
 * walk puts each back, whole, when its beat waits for it. Returns what it
 * took out, by path.
 */
export function takeOutFresh(id: string, dir: string): Taken {
  const taken = new Map<string, TakenFile>();
  for (const [key, beat] of beatsOf(id)) {
    const path = beat.evidence;
    const step = key.slice(id.length + 1).replace(/\.\d+$/, "");
    // A match reads only the lines added since the step opened; every other
    // fresh look counts any change, so a newer time does for those.
    if (
      beat.verify?.fresh !== true ||
      path === undefined ||
      !["match", "no-match"].includes(beat.verify.kind)
    )
      continue;
    const found = path.includes("*") ? newestMatch(dir, path) : path;
    if (found === null || taken.has(found) || !existsSync(join(dir, found)))
      continue;
    const file = join(dir, found);
    taken.set(found, {
      bytes: readFileSync(file),
      mode: statSync(file).mode,
      step,
    });
    rmSync(file);
    // A glob's beat names the glob: it is put back under that name too.
    if (found !== path)
      taken.set(path, { bytes: Buffer.alloc(0), mode: 0, as: found, step });
  }
  return taken;
}

/** What takeOutFresh took out, by path: its bytes and mode. */
export type Taken = Map<string, TakenFile>;
interface TakenFile {
  bytes: Buffer;
  mode: number;
  /** For a glob, the path of the file it found. */
  as?: string;
  /** The step whose beat reads it. */
  step?: string;
}

/** The newest file a one-folder glob such as `dir/*.js` matches, or null. */
function newestMatch(dir: string, glob: string): string | null {
  const folder = dirname(glob);
  const pattern = new RegExp(
    `^${glob
      .slice(folder.length + 1)
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^/]*")}$`,
  );
  if (!existsSync(join(dir, folder))) return null;
  const files = readdirSync(join(dir, folder))
    .filter((name) => pattern.test(name))
    .map((name) => `${folder}/${name}`)
    .sort(
      (a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs,
    );
  return files[0] ?? null;
}

/** Puts back what takeOutFresh took: `path`, or all of it. */
function putBack(taken: Taken, dir: string, path?: string) {
  putBackWhere(taken, dir, path, () => true);
}

/**
 * Puts back every file whose step has opened, and says whether it put any
 * back. A file for a step not yet open stays out: back before its step
 * opens, it is in that step's fresh stamp, and its beat can never see it
 * change.
 */
function putBackOpened(taken: Taken, dir: string, opened: Set<string>) {
  return putBackWhere(
    taken,
    dir,
    undefined,
    (file) => file.step === undefined || opened.has(file.step),
  );
}

function putBackWhere(
  taken: Taken,
  dir: string,
  path: string | undefined,
  keep: (file: TakenFile) => boolean,
): boolean {
  const want = path === undefined ? undefined : (taken.get(path)?.as ?? path);
  let wrote = false;
  for (const [at, file] of taken) {
    if (!keep(file)) continue;
    if (file.as !== undefined) {
      if (want === undefined || file.as === want) taken.delete(at);
      continue;
    }
    if (want !== undefined && at !== want) continue;
    mkdirSync(dirname(join(dir, at)), { recursive: true });
    writeFileSync(join(dir, at), file.bytes);
    chmodSync(join(dir, at), file.mode & 0o777);
    taken.delete(at);
    wrote = true;
  }
  return wrote;
}

export interface WalkOptions {
  /** What takeOutFresh took out before the app started. */
  taken?: Taken;
  /** The folder the beats look in: the copy's project/ by default. */
  folder?: string;
  /** Called on every screen the walk shows. */
  onScreen?: (page: Page) => Promise<void>;
}

/**
 * The newest frame: the highest revision of the newest instance, since a
 * POST's reply can land after a later frame from the stream.
 */
export const newest = (frames: Frame[]): Frame | null =>
  frames.reduce<Frame | null>(
    (best, frame) =>
      best === null ||
      frame.instance !== best.instance ||
      frame.revision >= best.revision
        ? frame
        : best,
    null,
  );

const LOOK_MS = 120_000;

/** Waits for a frame newer than `after` whose beat is not mid-look. */
async function settled(
  frames: () => Promise<Frame[]>,
  after: Frame,
  timeout = LOOK_MS,
) {
  await expect
    .poll(
      async () => {
        const now = newest(await frames());
        return (
          now !== null &&
          (now.instance !== after.instance || now.revision > after.revision) &&
          now.status !== "checking"
        );
      },
      { timeout },
    )
    .toBe(true);
}

/**
 * Walks Lesson `id` from its first beat to Lesson complete, moving as a
 * Learner does (play.ts move). On a waiting or Not yet beat it first
 * applies the beat's STAGE, else brings the work's files to now, then looks
 * again; a beat that will not pass in three tries fails with its key and
 * the Check's words. Returns every beat key the page showed.
 */
export async function walkLesson(
  page: Page,
  copy: PracticeCopy,
  id: string,
  frames: () => Promise<Frame[]>,
  opts: WalkOptions = {},
): Promise<Set<string>> {
  const dir = opts.folder ?? join(copy.dir, "project");
  // A `worked: copy` Lesson's Worked example steps run in the copy's
  // project/ whatever its Work folder (folderOf, ticket 183).
  const lesson = courseLessons().find((l) => l.id === id);
  const workedInCopy = lesson?.content.worked === "copy";
  const worked = new Set(
    (lesson?.content.steps ?? [])
      .filter((s) => s.part === "Worked example")
      .map((s) => s.id),
  );
  const tries = new Map<string, number>();
  const staged = new Set<string>();
  const picks = new Map<string, number>();
  const beats = beatsOf(id);
  const taken = opts.taken ?? new Map<string, TakenFile>();
  const opened = new Set<string>();
  for (let moves = 0; ; moves += 1) {
    const seen = await frames();
    // Every frame counts: a step that opened and closed between two polls
    // shows only in an older frame.
    for (const frame of seen)
      if (frame.lesson === id && frame.step !== null) opened.add(frame.step);
    const now = newest(seen);
    if (now?.phase === "complete" && now.lesson === id) break;
    if (moves === 400)
      throw new Error(
        `${id}: no Lesson complete in 400 moves; newest frame ${JSON.stringify(now)}`,
      );
    await opts.onScreen?.(page);
    if (now?.status === "checking") {
      await settled(frames, now);
      continue;
    }
    if (
      now?.phase === "playing" &&
      now.step !== null &&
      now.beat !== null &&
      (now.status === "waiting" || now.status === "fail") &&
      (now.decidedBy === "check" || now.decidedBy === "watch")
    ) {
      const key = beatKey(id, now.step, now.beat);
      const stepDir =
        workedInCopy && worked.has(now.step) ? join(copy.dir, "project") : dir;
      const tried = (tries.get(key) ?? 0) + 1;
      tries.set(key, tried);
      if (tried > 3) {
        const says = await page
          .locator("main")
          .innerText()
          .catch(() => "");
        const status = spawnSync("git", ["status", "--short", "--branch"], {
          cwd: stepDir,
          env: gitEnv(),
          encoding: "utf8",
        });
        const recent = (await frames()).slice(-6);
        throw new Error(
          `${key} never passed. git status:\n${status.stdout}${status.stderr}\nThe page says:\n${says}\nLast frames: ${JSON.stringify(recent)}`,
        );
      }
      // The step's fresh stamps are taken as it opens: let them land first.
      if (tried === 1) await page.waitForTimeout(1_000);
      const stage = STAGE[key];
      const evidence = beats.get(key)?.evidence;
      if (stage !== undefined && (!staged.has(key) || REPEATS.has(stage))) {
        staged.add(key);
        stage(stepDir);
      } else if (evidence !== undefined && taken.has(evidence))
        putBack(taken, stepDir, evidence);
      else if (!(
        taken.size > 0 &&
        tried > 1 &&
        // A git or whole-Lesson look wants the work back in place.
        putBackOpened(taken, stepDir, opened)
      ))
        freshen(stepDir);
      // A watched beat looks again by itself on a change; a Check, or a
      // watch that saw nothing new, waits for Check again.
      if (now.decidedBy === "watch") {
        const looked = await settled(frames, now, 3_000).then(
          () => true,
          () => false,
        );
        if (looked) continue;
      }
      // The host's watcher may look on the staged change by itself and
      // answer the beat before the click lands (254 D25): either counts.
      // The press is bound to this beat (checkAgainOn): not pressed means
      // the beat moved on, and the host's answer is awaited below.
      const answered = settled(frames, now);
      // Reported below, after the click, if the host never answers.
      answered.catch(() => undefined);
      await checkAgainOn(
        page,
        `${id}:${now.step}:${String(now.beat)}`,
        now.status,
        LOOK_MS,
      );
      await answered.catch(async (error: unknown) => {
        const recent = (await frames()).slice(-3);
        throw new Error(
          `${key}: no answer to Check again after ${JSON.stringify(recent)}`,
          { cause: error },
        );
      });
      continue;
    }
    // A question: each answer in turn, by its place, since a wrong pick on
    // a warm-up clears for another try rather than staying marked.
    // An answered question can stay on the card, disabled the non-native way.
    const answers = page.locator(
      'main fieldset:not([disabled]):not([aria-disabled="true"]):not([data-disabled]) label',
    );
    if (
      now?.phase === "playing" &&
      now.step !== null &&
      now.beat !== null &&
      (await answers.count()) > 0
    ) {
      const key = beatKey(id, now.step, now.beat);
      const picked = picks.get(key) ?? 0;
      picks.set(key, picked + 1);
      if (picked >= (await answers.count()) + 1)
        throw new Error(`${key}: no answer moved it on`);
      await answers.nth(picked % (await answers.count())).click();
      await page
        .locator("main")
        .getByRole("button", { name: /^(Check my answer|That's my guess)$/ })
        .first()
        .click();
      await settled(frames, now);
      continue;
    }
    if (
      now !== null &&
      (await bar(page).getByRole("button").count()) === 0 &&
      (await heading(page).innerText()) !== "Less help from here"
    ) {
      // Nothing to press yet: the page's next frame may be on its way.
      const came = await settled(frames, now, 5_000).then(
        () => true,
        () => false,
      );
      if (came) continue;
      throw new Error(
        `${id}: nothing to press on ${JSON.stringify(now)}: ${await page.locator("main").innerText()}`,
      );
    }
    try {
      await move(page);
    } catch (error) {
      const recent = (await frames()).slice(-4);
      throw new Error(
        `${id}: a move failed after ${JSON.stringify(recent)}: ${String(error)}`,
        { cause: error },
      );
    }
  }
  const seen = new Set<string>();
  for (const frame of await frames())
    if (
      frame.lesson === id &&
      frame.phase === "playing" &&
      frame.step !== null &&
      frame.beat !== null
    )
      seen.add(beatKey(id, frame.step, frame.beat));
  await expect(heading(page)).toBeVisible();
  return seen;
}

/** The capstone invitation's words (LessonComplete.tsx). */
export const INVITATION =
  "Questions about anything in this level? Ask Claude Code, then compare the answer with the lesson pages.";

/**
 * The rules every screen of a walk keeps: on the workspace, Pip is there
 * (:3016), no text names a key (D14), the capstone invitation is not
 * there (LR:785), and the action bar covers none of the card; a Step-down
 * shows its words whole, with Go on in view (LR:1398).
 */
export async function holdsScreen(page: Page) {
  await expect(page.getByText(INVITATION)).toHaveCount(0);
  if ((await heading(page).innerText()) === "Less help from here") {
    await expect(page.getByRole("button", { name: /^Go on/ })).toBeInViewport();
    return;
  }
  if (!/\/step$/.test(new URL(page.url()).hash)) return;
  await expect(page.locator("[data-pip]").first()).toBeVisible();
  await namesNoKey(page);
  // Scrolled to its end, the card's last line sits above the bar.
  const card = page.locator("main article").last();
  if ((await card.count()) === 0) return;
  await card.evaluate((node) => {
    node.scrollIntoView({ block: "end" });
  });
  const [box, over] = await Promise.all([
    card.boundingBox(),
    bar(page).boundingBox(),
  ]);
  if (box !== null && over !== null)
    expect(box.y + box.height).toBeLessThanOrEqual(over.y + 1);
}

/**
 * Nothing on the page moves: no running animation changes a transform (a
 * rise of 0px is a fade), as reduced motion asks (complete.spec, 254).
 */
export async function expectStill(page: Page) {
  const moving = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((animation) => animation.playState === "running")
        .filter((animation) => {
          const effect = animation.effect as KeyframeEffect | null;
          return (effect?.getKeyframes() ?? []).some(
            (frame) =>
              typeof frame.transform === "string" &&
              !/^(none|translate[XY]?\(0px(, 0px)?\))$/.test(frame.transform),
          );
        }).length,
  );
  expect(moving).toBe(0);
}

/** No text on the workspace names a keyboard key (246 D14). */
export async function namesNoKey(page: Page) {
  const text = await page.evaluate(() =>
    [
      document.querySelector("[data-says-bubble]"),
      document.querySelector("[data-action-bar]"),
    ]
      .map((root) => (root as HTMLElement | null)?.innerText ?? "")
      .join("\n"),
  );
  // A credential's key (a-capstone's "the key is deleted") is no keyboard key.
  expect(text.replace(/\b(API|the) key\b/gi, "")).not.toMatch(KEY_NAMES);
}

export { bar };
