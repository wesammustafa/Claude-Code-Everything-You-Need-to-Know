// The git probes' table (ticket 105; split from the Checks' probes.mjs in
// ticket 211): each probe's arguments, what the card says it watches, and
// whether it is always fresh. A lesson file names one on a beat:
//
//   - verify: probe <name> [args] [fresh [since <step>]]
//
// Pure, with no imports: the engine parses beats with it and the compile
// step checks them, and the lesson host runs each probe
// (quest/host/src/probes.mjs) in its Check child.

// What an argument must be: a pattern, or a test of its own.
interface ArgTest {
  test: (arg: string) => boolean;
}
// A probe: its arguments (`many`: one or more of the last), what the card
// says it watches, and whether it is always fresh.
export interface Probe {
  args: ArgTest[];
  many?: boolean;
  watching: string;
  fresh?: boolean;
}

const COUNT = /^[1-9]\d{0,2}$/;
// A branch name as a probe takes it: no spaces, no leading dash, no `..`.
const BRANCH = /^(?!-)(?!.*\.\.)[\w./-]+$/;
// A path named from the work folder, like .claude/worktrees/docs-pass:
// never /, ./ or .. in it, nor a backslash or a space.
const PATH: ArgTest = {
  test: (p) =>
    !/[\s\\]/.test(p) &&
    !p.startsWith("/") &&
    !p
      .replace(/\/$/, "")
      .split("/")
      .some((part) => ["", ".", ".."].includes(part)),
};

// Each probe: its arguments (`many`: one or more of the last), what the
// card says it watches, and whether it is always fresh.
export const PROBES: Readonly<Record<string, Probe>> = {
  worktrees: { args: [COUNT], watching: "git worktree list" },
  "branch-ahead": { args: [BRANCH], watching: "git branch", fresh: true },
  merged: { args: [BRANCH], many: true, watching: "git log" },
  gone: { args: [PATH], watching: "git worktree list" },
  pushed: { args: [], watching: "git status" },
  removed: { args: [PATH], many: true, watching: "git log" },
  todos: { args: [COUNT], watching: "git grep" },
};

// Why `name args` is no probe, or null where it is one.
export function probeError(name: string, args: readonly string[]) {
  const p = PROBES[name];
  if (!p)
    return `unknown probe ${name}: one of ${Object.keys(PROBES).join(", ")}`;
  const count = p.many
    ? args.length >= p.args.length
    : args.length === p.args.length;
  const bad = args.find(
    (a, i) => !p.args[Math.min(i, p.args.length - 1)]?.test(a),
  );
  if (!count || bad !== undefined)
    return `probe ${name} takes ${p.args.length ? `${p.args.map((r) => (r === COUNT ? "<n>" : r === BRANCH ? "<branch>" : "<path>")).join(" ")}${p.many ? "..." : ""}` : "no arguments"}${bad !== undefined ? `, not ${bad}` : ""}`;
  return null;
}
